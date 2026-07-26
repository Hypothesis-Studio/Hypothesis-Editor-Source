/**
 * TunnelService - Manages LocalTunnel instances for the Hypothesis Editor.
 * Provides port forwarding via localtunnel with lifecycle management,
 * auto-reconnect, and per-tunnel metrics.
 */
import { BrowserWindow, shell, clipboard } from 'electron';
import localtunnel from 'localtunnel';
import { EventEmitter } from 'events';
import { nanoid } from '../../utils/nanoid';
import type {
  TunnelEntry,
  TunnelCreateOptions,
  TunnelStatus,
  TunnelStatusChangedEvent,
} from '../../../shared/types/tunnel';
import { TUNNEL_IPC } from '../../../shared/types/tunnel';

// Raw localtunnel tunnel handle
interface LTTunnel extends EventEmitter {
  url: string;
  clientId: string;
  close(): void;
}

interface TunnelRecord {
  entry: TunnelEntry;
  lt: LTTunnel | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  closing: boolean;
}

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const RECONNECT_MULTIPLIER = 1.5;

export class TunnelService {
  private readonly records = new Map<string, TunnelRecord>();
  private reconnectDelays = new Map<string, number>();

  // ── Public API ──────────────────────────────────────────────────────────────

  async open(options: TunnelCreateOptions): Promise<TunnelEntry> {
    const id = nanoid();
    const entry: TunnelEntry = {
      id,
      localPort: options.localPort,
      label: options.label ?? `Port ${options.localPort}`,
      publicUrl: null,
      subdomain: options.subdomain ?? null,
      status: 'connecting',
      startedAt: null,
      error: null,
      requestCount: 0,
      bytesIn: 0,
      bytesOut: 0,
      autoReconnect: options.autoReconnect ?? true,
    };

    const record: TunnelRecord = { entry, lt: null, reconnectTimer: null, closing: false };
    this.records.set(id, record);
    this.reconnectDelays.set(id, RECONNECT_DELAY_MS);

    await this.connect(record);
    return { ...entry };
  }

  async close(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;

    record.closing = true;
    if (record.reconnectTimer) {
      clearTimeout(record.reconnectTimer);
      record.reconnectTimer = null;
    }

    if (record.lt) {
      record.lt.removeAllListeners();
      record.lt.close();
      record.lt = null;
    }

    this.updateStatus(record, 'closed', null, null);
    this.records.delete(id);
    this.reconnectDelays.delete(id);
  }

  async closeAll(): Promise<void> {
    const ids = [...this.records.keys()];
    await Promise.all(ids.map((id) => this.close(id)));
  }

  list(): TunnelEntry[] {
    return [...this.records.values()].map((r) => ({ ...r.entry }));
  }

  get(id: string): TunnelEntry | null {
    const record = this.records.get(id);
    return record ? { ...record.entry } : null;
  }

  updateLabel(id: string, label: string): TunnelEntry | null {
    const record = this.records.get(id);
    if (!record) return null;
    record.entry.label = label.trim() || `Port ${record.entry.localPort}`;
    this.broadcastStatus(record);
    return { ...record.entry };
  }

  copyUrl(id: string): boolean {
    const record = this.records.get(id);
    if (!record?.entry.publicUrl) return false;
    clipboard.writeText(record.entry.publicUrl);
    return true;
  }

  openInBrowser(id: string): boolean {
    const record = this.records.get(id);
    if (!record?.entry.publicUrl) return false;
    shell.openExternal(record.entry.publicUrl);
    return true;
  }

  dispose(): void {
    this.closeAll();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async connect(record: TunnelRecord): Promise<void> {
    if (record.closing) return;

    this.updateStatus(record, 'connecting', null, null);

    try {
      const ltOpts: { port: number; subdomain?: string } = { port: record.entry.localPort };
      if (record.entry.subdomain) ltOpts.subdomain = record.entry.subdomain;

      const lt = (await localtunnel(ltOpts)) as unknown as LTTunnel;
      if (record.closing) {
        lt.close();
        return;
      }

      record.lt = lt;
      record.entry.startedAt = new Date().toISOString();
      this.reconnectDelays.set(record.entry.id, RECONNECT_DELAY_MS);
      this.updateStatus(record, 'connected', lt.url, null);

      lt.on('close', () => {
        if (record.closing) return;
        this.updateStatus(record, 'closed', null, null);
        this.scheduleReconnect(record);
      });

      lt.on('error', (err: Error) => {
        if (record.closing) return;
        this.updateStatus(record, 'error', null, err.message);
        record.lt = null;
        this.scheduleReconnect(record);
      });

      // Intercept request events for metrics — localtunnel request events
      // fire on the tunnel emitter when the underlying client emits 'request'.
      // We attach at the Node EventEmitter level via the internal client.
      this.attachRequestMetrics(record, lt);
    } catch (err: unknown) {
      if (record.closing) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.updateStatus(record, 'error', null, msg);
      this.scheduleReconnect(record);
    }
  }

  private attachRequestMetrics(record: TunnelRecord, lt: LTTunnel): void {
    // localtunnel doesn't expose per-request events on its public API,
    // but emits 'request' on some versions. Guard gracefully.
    try {
      lt.on('request', (info: { method?: string; path?: string; statusCode?: number }) => {
        if (record.closing) return;
        record.entry.requestCount += 1;
        // Estimate rough bytes — real values unavailable without intercepting TCP
        record.entry.bytesIn += 512;
        record.entry.bytesOut += 2048;

        this.broadcast(TUNNEL_IPC.EVT_REQUEST, {
          tunnelId: record.entry.id,
          method: info?.method ?? 'GET',
          path: info?.path ?? '/',
          statusCode: info?.statusCode ?? 200,
          bytesIn: 512,
          bytesOut: 2048,
          durationMs: 0,
          timestamp: new Date().toISOString(),
        });
      });
    } catch {
      // Not available on this version — silently skip
    }
  }

  private scheduleReconnect(record: TunnelRecord): void {
    if (record.closing || !record.entry.autoReconnect) return;
    if (record.reconnectTimer) clearTimeout(record.reconnectTimer);

    const delay = this.reconnectDelays.get(record.entry.id) ?? RECONNECT_DELAY_MS;
    const nextDelay = Math.min(delay * RECONNECT_MULTIPLIER, MAX_RECONNECT_DELAY_MS);
    this.reconnectDelays.set(record.entry.id, nextDelay);

    record.reconnectTimer = setTimeout(() => {
      record.reconnectTimer = null;
      if (!record.closing) this.connect(record);
    }, delay);
  }

  private updateStatus(
    record: TunnelRecord,
    status: TunnelStatus,
    publicUrl: string | null,
    error: string | null,
  ): void {
    record.entry.status = status;
    if (publicUrl !== null) record.entry.publicUrl = publicUrl;
    if (error !== null) record.entry.error = error;
    if (status === 'connected') record.entry.error = null;

    this.broadcastStatus(record);
  }

  private broadcastStatus(record: TunnelRecord): void {
    const payload: TunnelStatusChangedEvent = {
      tunnelId: record.entry.id,
      status: record.entry.status,
      publicUrl: record.entry.publicUrl,
      error: record.entry.error,
    };
    this.broadcast(TUNNEL_IPC.EVT_STATUS, payload);
  }

  private broadcast(channel: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    });
  }
}
