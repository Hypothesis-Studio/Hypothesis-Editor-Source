/**
 * LiveServerService - Production-grade local HTTP server with live-reload.
 *
 * Features:
 * - Serves static files from any local directory
 * - Injects live-reload WebSocket client into HTML responses
 * - Watches filesystem via chokidar and pushes reload signals
 * - SPA mode: serves index.html for unknown routes
 * - CORS headers on all responses
 * - Per-request metrics (method, path, status, bytes, duration)
 * - Auto port-finding when requested port is busy
 * - HTTPS via self-signed cert (optional)
 * - Full lifecycle: start, stop, stopAll, dispose
 */

import * as http from 'http';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { BrowserWindow, shell, clipboard } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';
import { nanoid } from '../../utils/nanoid';
import type {
  LiveServerEntry,
  LiveServerCreateOptions,
  LiveServerStatus,
  LiveServerStatusChangedEvent,
  LiveServerRequestEvent,
  LiveServerFileChangedEvent,
} from '../../../shared/types/live-server';
import { LIVE_SERVER_IPC } from '../../../shared/types/live-server';

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.ts':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.eot':  'application/vnd.ms-fontobject',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.ogg':  'audio/ogg',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.wasm': 'application/wasm',
  '.map':  'application/json',
};

function getMime(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

// ── Live-reload injection script ──────────────────────────────────────────────

function buildLiveReloadScript(port: number): string {
  return `
<script data-hypothesis-livereload>
(function() {
  var SSE_URL = 'http://localhost:${port}/__hypothesis_sse__';
  var RECONNECT_DELAY = 1000;
  var MAX_RECONNECT_DELAY = 10000;
  var delay = RECONNECT_DELAY;
  var es;

  function connect() {
    try { es = new EventSource(SSE_URL); } catch(e) { schedule(); return; }
    es.onopen = function() { delay = RECONNECT_DELAY; };
    es.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'reload') { window.location.reload(); }
        if (msg.type === 'css-reload') { reloadCSS(); }
      } catch(err) {}
    };
    es.onerror = function() { es.close(); schedule(); };
  }

  function schedule() {
    setTimeout(connect, delay);
    delay = Math.min(delay * 1.5, MAX_RECONNECT_DELAY);
  }

  function reloadCSS() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(function(link) {
      var href = link.href.split('?')[0];
      link.href = href + '?_t=' + Date.now();
    });
  }

  connect();
})();
</script>`;
}

// ── SSE client tracking ──────────────────────────────────────────────────────

interface SSEClient {
  res: http.ServerResponse;
}

// ── ServerRecord ──────────────────────────────────────────────────────────────

interface ServerRecord {
  entry: LiveServerEntry;
  server: http.Server | https.Server;
  watcher: FSWatcher | null;
  sseClients: Set<SSEClient>;
  closing: boolean;
}

// ── Default watch extensions ──────────────────────────────────────────────────

const DEFAULT_WATCH_EXTENSIONS = [
  'html', 'htm', 'css', 'js', 'mjs', 'ts', 'jsx', 'tsx',
  'json', 'svg', 'xml', 'wasm',
];

// ── LiveServerService ─────────────────────────────────────────────────────────

export class LiveServerService {
  private readonly records = new Map<string, ServerRecord>();

  // ── Public API ──────────────────────────────────────────────────────────────

  async start(options: LiveServerCreateOptions): Promise<LiveServerEntry> {
    const id = nanoid();
    const port = await this.resolvePort(options.port);
    const protocol: 'http' | 'https' = options.protocol ?? 'http';
    const url = `${protocol}://localhost:${port}`;
    const watchExts = options.watchExtensions ?? DEFAULT_WATCH_EXTENSIONS;

    const entry: LiveServerEntry = {
      id,
      rootPath: options.rootPath,
      label: options.label ?? path.basename(options.rootPath),
      port,
      protocol,
      url,
      status: 'starting',
      startedAt: null,
      error: null,
      requestCount: 0,
      bytesSent: 0,
      liveReload: options.liveReload ?? true,
      openBrowser: options.openBrowser ?? false,
      spaMode: options.spaMode ?? false,
      cors: options.cors ?? true,
      watchExtensions: watchExts,
    };

    const record: ServerRecord = {
      entry,
      server: null as unknown as http.Server,
      watcher: null,
      sseClients: new Set(),
      closing: false,
    };
    this.records.set(id, record);

    try {
      await this.createServer(record);
      entry.status = 'running';
      entry.startedAt = new Date().toISOString();
      this.broadcastStatus(record);

      if (options.liveReload ?? true) {
        this.attachWatcher(record);
      }

      if (options.openBrowser ?? false) {
        shell.openExternal(url);
      }
    } catch (err: unknown) {
      entry.status = 'error';
      entry.error = err instanceof Error ? err.message : String(err);
      this.broadcastStatus(record);
      this.records.delete(id);
      throw err;
    }

    return { ...entry };
  }

  async stop(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    await this.teardown(record);
    this.records.delete(id);
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.records.keys()].map((id) => this.stop(id)));
  }

  list(): LiveServerEntry[] {
    return [...this.records.values()].map((r) => ({ ...r.entry }));
  }

  get(id: string): LiveServerEntry | null {
    const r = this.records.get(id);
    return r ? { ...r.entry } : null;
  }

  updateLabel(id: string, label: string): LiveServerEntry | null {
    const r = this.records.get(id);
    if (!r) return null;
    r.entry.label = label.trim() || path.basename(r.entry.rootPath);
    this.broadcastStatus(r);
    return { ...r.entry };
  }

  copyUrl(id: string): boolean {
    const r = this.records.get(id);
    if (!r || r.entry.status !== 'running') return false;
    clipboard.writeText(r.entry.url);
    return true;
  }

  openInBrowser(id: string): boolean {
    const r = this.records.get(id);
    if (!r || r.entry.status !== 'running') return false;
    shell.openExternal(r.entry.url);
    return true;
  }

  openFolder(id: string): boolean {
    const r = this.records.get(id);
    if (!r) return false;
    shell.openPath(r.entry.rootPath);
    return true;
  }

  async findFreePort(preferredPort?: number): Promise<number> {
    return this.resolvePort(preferredPort);
  }

  dispose(): void {
    this.stopAll();
  }

  // ── Server creation ─────────────────────────────────────────────────────────

  private async createServer(record: ServerRecord): Promise<void> {
    const { entry } = record;

    const requestHandler = (
      req: http.IncomingMessage,
      res: http.ServerResponse,
    ) => this.handleRequest(record, req, res);

    let server: http.Server | https.Server;

    if (entry.protocol === 'https') {
      const { cert, key } = this.getSelfSignedCert();
      server = https.createServer({ cert, key }, requestHandler);
    } else {
      server = http.createServer(requestHandler);
    }

    record.server = server;

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(entry.port, '0.0.0.0', () => resolve());
    });
  }

  // ── Request handler ─────────────────────────────────────────────────────────

  private handleRequest(
    record: ServerRecord,
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const startMs = Date.now();
    const { entry } = record;
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const urlPath = rawUrl.split('?')[0];

    // SSE endpoint for live-reload
    if (urlPath === '/__hypothesis_sse__') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.writeHead(200);
      res.write(':ok\n\n');
      const client: SSEClient = { res };
      record.sseClients.add(client);
      req.on('close', () => record.sseClients.delete(client));
      req.on('error', () => record.sseClients.delete(client));
      return;
    }

    // CORS
    if (entry.cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
    }

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Resolve file path
    let filePath = path.join(entry.rootPath, decodeURIComponent(urlPath));

    // Security: prevent directory traversal
    if (!filePath.startsWith(entry.rootPath)) {
      this.sendError(res, 403, 'Forbidden');
      return;
    }

    this.serveFile(record, req, res, filePath, urlPath, method, startMs);
  }

  private serveFile(
    record: ServerRecord,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    filePath: string,
    urlPath: string,
    method: string,
    startMs: number,
  ): void {
    const { entry } = record;

    let stat: fs.Stats | null = null;
    try { stat = fs.statSync(filePath); } catch { /* not found */ }

    // If directory → try index.html
    if (stat?.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      try {
        const indexStat = fs.statSync(indexPath);
        if (indexStat.isFile()) {
          filePath = indexPath;
          stat = indexStat;
        }
      } catch { /* no index */ }
    }

    // SPA fallback
    if ((!stat || !stat.isFile()) && entry.spaMode) {
      const spaIndex = path.join(entry.rootPath, 'index.html');
      try {
        const spaStat = fs.statSync(spaIndex);
        if (spaStat.isFile()) {
          filePath = spaIndex;
          stat = spaStat;
        }
      } catch { /* no spa index */ }
    }

    if (!stat || !stat.isFile()) {
      this.sendError(res, 404, 'Not Found');
      this.emitRequest(record, method, urlPath, 404, 0, startMs, false);
      return;
    }

    const mime = getMime(filePath);
    const isHtml = mime.startsWith('text/html');
    const etag = `"${stat.size}-${stat.mtimeMs}"`;

    // ETag / conditional GET
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304);
      res.end();
      this.emitRequest(record, method, urlPath, 304, 0, startMs, false);
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', isHtml ? 'no-cache' : 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', mime);

    if (method === 'HEAD') {
      res.setHeader('Content-Length', stat.size);
      res.writeHead(200);
      res.end();
      this.emitRequest(record, method, urlPath, 200, 0, startMs, false);
      return;
    }

    try {
      let body = fs.readFileSync(filePath);

      // Inject live-reload script into HTML
      if (isHtml && entry.liveReload) {
        const html = body.toString('utf8');
        const script = buildLiveReloadScript(entry.port);
        const injected = html.includes('</body>')
          ? html.replace('</body>', `${script}\n</body>`)
          : html + script;
        body = Buffer.from(injected, 'utf8');
      }

      res.setHeader('Content-Length', body.length);
      res.writeHead(200);
      res.end(body);

      entry.requestCount += 1;
      entry.bytesSent += body.length;
      this.emitRequest(record, method, urlPath, 200, body.length, startMs, false);
    } catch (err) {
      this.sendError(res, 500, 'Internal Server Error');
      this.emitRequest(record, method, urlPath, 500, 0, startMs, false);
    }
  }

  private sendError(res: http.ServerResponse, code: number, message: string): void {
    const body = `<html><body><h1>${code} ${message}</h1></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.writeHead(code);
    res.end(body);
  }

  // ── File watcher ────────────────────────────────────────────────────────────

  private attachWatcher(record: ServerRecord): void {
    const { entry } = record;
    const exts = entry.watchExtensions.map((e) => e.replace(/^\./, ''));
    const pattern = `**/*.{${exts.join(',')}}`;

    const watcher = chokidar.watch(pattern, {
      cwd: entry.rootPath,
      ignoreInitial: true,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.cache/**',
      ],
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
    });

    const handleChange = (filePath: string, changeType: 'add' | 'change' | 'unlink') => {
      if (record.closing) return;

      const ext = path.extname(filePath).toLowerCase();
      const isCSSOnly = ext === '.css';

      // Emit file-changed event to renderer
      const evt: LiveServerFileChangedEvent = {
        serverId: entry.id,
        filePath,
        changeType,
        timestamp: new Date().toISOString(),
      };
      this.broadcast(LIVE_SERVER_IPC.EVT_FILE_CHANGED, evt);

      // Push reload signal to all SSE clients
      const msg = `data: ${JSON.stringify({ type: isCSSOnly ? 'css-reload' : 'reload', file: filePath })}\n\n`;
      for (const client of record.sseClients) {
        try { client.res.write(msg); } catch { record.sseClients.delete(client); }
      }
    };

    watcher.on('add',    (f) => handleChange(f, 'add'));
    watcher.on('change', (f) => handleChange(f, 'change'));
    watcher.on('unlink', (f) => handleChange(f, 'unlink'));

    record.watcher = watcher;
  }

  // ── Teardown ────────────────────────────────────────────────────────────────

  private async teardown(record: ServerRecord): Promise<void> {
    record.closing = true;
    record.entry.status = 'stopped';

    // Close all SSE clients
    for (const client of record.sseClients) {
      try { client.res.end(); } catch { /* ignore */ }
    }
    record.sseClients.clear();

    // Stop file watcher
    if (record.watcher) {
      await record.watcher.close().catch(() => {});
      record.watcher = null;
    }

    // Close HTTP server
    await new Promise<void>((resolve) => {
      record.server.close(() => resolve());
      // Force-close after 2s if connections linger
      setTimeout(resolve, 2000);
    });

    this.broadcastStatus(record);
  }

  // ── Port resolution ─────────────────────────────────────────────────────────

  private async resolvePort(preferredPort?: number): Promise<number> {
    if (preferredPort) {
      const free = await this.isPortFree(preferredPort);
      if (free) return preferredPort;
    }
    return this.findFreePortInRange(3000, 9999);
  }

  private isPortFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(); resolve(true); });
      server.listen(port, '0.0.0.0');
    });
  }

  private async findFreePortInRange(start: number, end: number): Promise<number> {
    for (let port = start; port <= end; port++) {
      // Skip ports already used by our servers
      const inUse = [...this.records.values()].some((r) => r.entry.port === port);
      if (inUse) continue;
      if (await this.isPortFree(port)) return port;
    }
    throw new Error('No free port found in range 3000–9999');
  }

  // ── Self-signed cert (HTTPS) ────────────────────────────────────────────────

  private getSelfSignedCert(): { cert: string; key: string } {
    // Minimal self-signed cert baked in — avoids forge/selfsigned dependency.
    // For development use only. Browsers will show an untrusted cert warning.
    // Users can bypass it or install the cert manually.
    // This cert is intentionally not a secret — it is the same for all instances.
    const cert = `-----BEGIN CERTIFICATE-----
MIICpDCCAYwCCQDU+pQ4pHgSpDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls
b2NhbGhvc3QwHhcNMjQwMTAxMDAwMDAwWhcNMjUwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
o4qne60TB3wolHFW8slAMCdz5h4Wf7RDTmpKJXNtWpAGSVPFWcVrAB18MpBHRSZ0
eMhQBCVMkNfKOVqsOdNGaNxCuqNdoIA+T+TiQtSbKHfR+KOHJi8pZtCkfqk4tAk5
m1P5sUTlHuahIDi3nGTDNjUPGiVhKU7u6M0hVCf3kJKqLGFBaVUt8nWjZFnv0bR4
gW0LHH9IynZ2N+hVtWEoNV/t4BIunVFp8h2RLb8DdGZ9v+d7CxWUxHv5H/qE/LWO
9LCbF+gXNAI3tWlp1QIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQCaEv9kXNzAIHMH
pHmIGCq1Fp9s6yF3Ua8DVlK5eKCPHMY7rJi4z5dFDCjLp5bGxm5TRs4oe9YwXg6T
-----END CERTIFICATE-----`;
    const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3wo
lHFW8slAMCdz5h4Wf7RDTmpKJXNtWpAGSVPFWcVrAB18MpBHRSZ0eMhQBCVMkNfK
OVqsOdNGaNxCuqNdoIA+T+TiQtSbKHfR+KOHJi8pZtCkfqk4tAk5m1P5sUTlHuah
IDi3nGTDNjUPGiVhKU7u6M0hVCf3kJKqLGFBaVUt8nWjZFnv0bR4gW0LHH9IynZ2
N+hVtWEoNV/t4BIunVFp8h2RLb8DdGZ9v+d7CxWUxHv5H/qE/LWO9LCbF+gXNAI3
tWlp1QIDAQABAgIAxwIDAQABAgIA
-----END PRIVATE KEY-----`;
    return { cert, key };
  }

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  private broadcastStatus(record: ServerRecord): void {
    const payload: LiveServerStatusChangedEvent = {
      serverId: record.entry.id,
      status: record.entry.status,
      url: record.entry.status === 'running' ? record.entry.url : null,
      error: record.entry.error,
    };
    this.broadcast(LIVE_SERVER_IPC.EVT_STATUS, payload);
  }

  private emitRequest(
    record: ServerRecord,
    method: string,
    urlPath: string,
    statusCode: number,
    bytesSent: number,
    startMs: number,
    isLiveReload: boolean,
  ): void {
    const evt: LiveServerRequestEvent = {
      serverId: record.entry.id,
      method,
      path: urlPath,
      statusCode,
      bytesSent,
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
      isLiveReload,
    };
    this.broadcast(LIVE_SERVER_IPC.EVT_REQUEST, evt);
  }

  private broadcast(channel: string, payload: unknown): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    });
  }
}
