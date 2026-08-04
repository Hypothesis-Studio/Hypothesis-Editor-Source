/**
 * TunnelService - Manages Cloudflare Quick Tunnel instances.
 * Uses `cloudflared tunnel --url` — no account or login required.
 * URL format: https://<random>.trycloudflare.com
 */
import { BrowserWindow, shell, clipboard } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { Tunnel as CloudflaredTunnel } from 'cloudflared';
import { nanoid } from '../../utils/nanoid';
import type {
  TunnelEntry,
  TunnelCreateOptions,
  TunnelStatus,
  TunnelStatusChangedEvent,
} from '../../../shared/types/tunnel';
import { TUNNEL_IPC } from '../../../shared/types/tunnel';

const RECONNECT_DELAY_MS = 5_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const RECONNECT_MULTIPLIER = 1.5;

interface TunnelRecord {
  entry: TunnelEntry;
  proc: ChildProcess | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  closing: boolean;
}

export class TunnelService extends EventEmitter {
  private readonly records = new Map<string, TunnelRecord>();
  private reconnectDelays = new Map<string, number>();

  // ── Public API ──────────────────────────────────────────────────────────────

  async open(options: TunnelCreateOptions): Promise<TunnelEntry> {
    const id = nanoid();
    const provider = options.provider ?? 'cloudflare';

    const entry: TunnelEntry = {
      id,
      localPort: options.localPort,
      label: options.label ?? `Port ${options.localPort}`,
      publicUrl: null,
      subdomain: options.subdomain ?? null,
      status: 'connecting',
      provider,
      source: options.source ?? 'tunnel-panel',
      startedAt: null,
      error: null,
      requestCount: 0,
      bytesIn: 0,
      bytesOut: 0,
      autoReconnect: options.autoReconnect ?? true,
    };

    const record: TunnelRecord = { entry, proc: null, reconnectTimer: null, closing: false };
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

    if (record.proc) {
      record.proc.removeAllListeners();
      try {
        if (process.platform === 'win32' && record.proc.pid) {
          spawn('taskkill', ['/pid', String(record.proc.pid), '/f', '/t'], { windowsHide: true });
        } else {
          record.proc.kill('SIGTERM');
        }
      } catch (_) { /* ignore */ }
      record.proc = null;
    }
    // Stop cloudflared Tunnel instance if present
    if ((record as any)._cfTunnel) {
      try { (record as any)._cfTunnel.stop(); } catch (_) { /* ignore */ }
      (record as any)._cfTunnel = null;
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
    return [...this.records.values()]
      .filter((r) => r.entry.source !== 'chat-room')
      .map((r) => ({ ...r.entry }));
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

  // ── Connection ──────────────────────────────────────────────────────────────

  private async connect(record: TunnelRecord): Promise<void> {
    if (record.closing) return;
    this.updateStatus(record, 'connecting', null, null);
    if (record.entry.provider === 'localtunnel') {
      await this.connectLocaltunnel(record);
    } else {
      await this.connectCloudflare(record);
    }
  }

  private async connectLocaltunnel(record: TunnelRecord): Promise<void> {
    try {
      const localtunnel = await import('localtunnel').then((m: any) => m.default ?? m);
      const ltOpts: { port: number; subdomain?: string } = { port: record.entry.localPort };
      if (record.entry.subdomain) ltOpts.subdomain = record.entry.subdomain;
      const lt = await localtunnel(ltOpts) as any;
      if (record.closing) { lt.close(); return; }
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
        this.scheduleReconnect(record);
      });
    } catch (err: unknown) {
      if (record.closing) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.updateStatus(record, 'error', null, msg);
      this.scheduleReconnect(record);
    }
  }

  private async connectCloudflare(record: TunnelRecord): Promise<void> {
    try {
      if (record.closing) return;

      const cf = CloudflaredTunnel.quick(`http://localhost:${record.entry.localPort}`);

      // Store process reference for cleanup
      (record as any)._cfTunnel = cf;

      cf.once('url', (url: string) => {
        if (record.closing) { cf.stop(); return; }
        record.entry.startedAt = new Date().toISOString();
        this.reconnectDelays.set(record.entry.id, RECONNECT_DELAY_MS);
        this.updateStatus(record, 'connected', url, null);
      });

      cf.once('exit', (code: number | null) => {
        (record as any)._cfTunnel = null;
        record.proc = null;
        if (record.closing) return;
        this.updateStatus(record, 'closed', null, code !== null && code !== 0 ? `Process exited with code ${code}` : null);
        this.scheduleReconnect(record);
      });

      cf.on('error', (err: Error) => {
        if (record.closing) return;
        this.updateStatus(record, 'error', null, err.message);
        this.scheduleReconnect(record);
      });

    } catch (err: unknown) {
      if (record.closing) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.updateStatus(record, 'error', null, msg);
      this.scheduleReconnect(record);
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

  // ── Status helpers ──────────────────────────────────────────────────────────

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
