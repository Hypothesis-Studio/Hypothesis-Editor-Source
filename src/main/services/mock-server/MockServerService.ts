/**
 * MockServerService - HTTP Mock Server for Hypothesis Editor.
 * Runs local HTTP servers that respond with configured JSON/text responses.
 * Each server is independent with its own port and endpoint list.
 */
import * as http from 'http';
import * as net from 'net';
import { BrowserWindow } from 'electron';
import { nanoid as uuidv4 } from '../../utils/nanoid';
import type {
  MockServerEntry,
  MockServerCreateOptions,
  MockEndpoint,
  MockRequestLog,
  MockEndpointMethod,
} from '../../../shared/types/mock-server';

// ── In-memory store ───────────────────────────────────────────────────────────

interface RunningServer {
  entry: MockServerEntry;
  httpServer: http.Server;
}

export class MockServerService {
  private servers = new Map<string, RunningServer>();
  private stopped = new Map<string, MockServerEntry>(); // stopped servers persisted in memory
  private logs = new Map<string, MockRequestLog[]>(); // serverId → logs
  private mainWindow: (() => BrowserWindow | null) | null = null;
  private readonly MAX_LOGS = 200;

  setMainWindow(getter: () => BrowserWindow | null): void {
    this.mainWindow = getter;
  }

  private emit(channel: string, data: unknown): void {
    const win = this.mainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async create(options: MockServerCreateOptions): Promise<MockServerEntry> {
    const port = options.port ?? await this.findFreePort(3100);
    const entry: MockServerEntry = {
      id: uuidv4(),
      name: options.name || 'Mock Server',
      port,
      status: 'stopped',
      cors: options.cors ?? true,
      endpoints: (options.endpoints ?? []).map(e => ({ ...e, id: uuidv4() })),
      createdAt: new Date().toISOString(),
      startedAt: null,
      error: null,
      requestCount: 0,
    };
    this.stopped.set(entry.id, entry);
    this.logs.set(entry.id, []);
    return entry;
  }

  delete(id: string): boolean {
    const running = this.servers.get(id);
    if (running) {
      running.httpServer.close();
      this.servers.delete(id);
    }
    this.stopped.delete(id);
    this.logs.delete(id);
    return true;
  }

  list(): MockServerEntry[] {
    const result: MockServerEntry[] = [];
    for (const [, r] of this.servers) result.push({ ...r.entry });
    for (const [id, e] of this.stopped) {
      if (!this.servers.has(id)) result.push({ ...e });
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(id: string): MockServerEntry | null {
    return this.servers.get(id)?.entry ?? this.stopped.get(id) ?? null;
  }

  update(id: string, updates: Partial<Pick<MockServerEntry, 'name' | 'port' | 'cors' | 'endpoints'>>): MockServerEntry | null {
    const running = this.servers.get(id);
    if (running) {
      Object.assign(running.entry, updates);
      return { ...running.entry };
    }
    const stopped = this.stopped.get(id);
    if (stopped) {
      Object.assign(stopped, updates);
      return { ...stopped };
    }
    return null;
  }

  // ── Endpoints ─────────────────────────────────────────────────────────────

  addEndpoint(serverId: string, endpoint: Omit<MockEndpoint, 'id'>): MockServerEntry | null {
    const entry = this._getEntry(serverId);
    if (!entry) return null;
    entry.endpoints.push({ ...endpoint, id: uuidv4() });
    return { ...entry };
  }

  updateEndpoint(serverId: string, endpointId: string, updates: Partial<MockEndpoint>): MockServerEntry | null {
    const entry = this._getEntry(serverId);
    if (!entry) return null;
    const idx = entry.endpoints.findIndex(e => e.id === endpointId);
    if (idx === -1) return null;
    Object.assign(entry.endpoints[idx], updates);
    return { ...entry };
  }

  deleteEndpoint(serverId: string, endpointId: string): MockServerEntry | null {
    const entry = this._getEntry(serverId);
    if (!entry) return null;
    entry.endpoints = entry.endpoints.filter(e => e.id !== endpointId);
    return { ...entry };
  }

  reorderEndpoints(serverId: string, orderedIds: string[]): MockServerEntry | null {
    const entry = this._getEntry(serverId);
    if (!entry) return null;
    const map = new Map(entry.endpoints.map(e => [e.id, e]));
    entry.endpoints = orderedIds.map(id => map.get(id)).filter(Boolean) as MockEndpoint[];
    return { ...entry };
  }

  private _getEntry(serverId: string): MockServerEntry | null {
    return this.servers.get(serverId)?.entry ?? this.stopped.get(serverId) ?? null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(id: string): Promise<MockServerEntry> {
    const entry = this._getEntry(id);
    if (!entry) throw new Error(`Server ${id} not found`);
    if (this.servers.has(id)) return { ...entry }; // already running

    entry.status = 'starting';
    entry.error = null;
    this.emit('mock-server:evt:status', { serverId: id, status: 'starting', error: null });

    try {
      const httpServer = this._createHttpServer(entry);
      await new Promise<void>((resolve, reject) => {
        httpServer.once('error', (err: NodeJS.ErrnoException) => {
          reject(new Error(err.code === 'EADDRINUSE' ? `Port ${entry.port} is already in use` : err.message));
        });
        httpServer.listen(entry.port, '127.0.0.1', resolve);
      });

      entry.status = 'running';
      entry.startedAt = new Date().toISOString();
      entry.requestCount = 0;
      this.servers.set(id, { entry, httpServer });
      this.stopped.delete(id);
      this.emit('mock-server:evt:status', { serverId: id, status: 'running', error: null });
      return { ...entry };
    } catch (err: any) {
      entry.status = 'error';
      entry.error = err.message;
      this.stopped.set(id, entry);
      this.emit('mock-server:evt:status', { serverId: id, status: 'error', error: err.message });
      throw err;
    }
  }

  async stop(id: string): Promise<void> {
    const running = this.servers.get(id);
    if (!running) return;
    await new Promise<void>(resolve => running.httpServer.close(() => resolve()));
    running.entry.status = 'stopped';
    running.entry.startedAt = null;
    this.stopped.set(id, running.entry);
    this.servers.delete(id);
    this.emit('mock-server:evt:status', { serverId: id, status: 'stopped', error: null });
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.servers.keys()].map(id => this.stop(id)));
  }

  // ── HTTP Server ───────────────────────────────────────────────────────────

  private _createHttpServer(entry: MockServerEntry): http.Server {
    return http.createServer((req, res) => {
      const startMs = Date.now();
      const method = (req.method ?? 'GET').toUpperCase();
      const url = req.url ?? '/';
      const path = url.split('?')[0];

      // Collect request body
      const bodyChunks: Buffer[] = [];
      req.on('data', chunk => bodyChunks.push(chunk));
      req.on('end', () => {
        const requestBody = Buffer.concat(bodyChunks).toString('utf8');
        const requestHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === 'string') requestHeaders[k] = v;
          else if (Array.isArray(v)) requestHeaders[k] = v.join(', ');
        }

        // CORS preflight
        if (entry.cors) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
          res.setHeader('Access-Control-Allow-Headers', '*');
          if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }
        }

        // Match endpoint
        const endpoint = this._matchEndpoint(entry.endpoints, method, path);
        const durationMs = Date.now() - startMs;

        if (!endpoint || !endpoint.enabled) {
          // 404 fallback
          if (entry.cors) res.setHeader('Content-Type', 'application/json');
          res.writeHead(404);
          const body = JSON.stringify({ error: 'No matching mock endpoint', path, method });
          res.end(body);
          this._addLog(entry, {
            endpointId: null, method, path, statusCode: 404, matched: false,
            durationMs, requestHeaders, requestBody, responseBody: body,
          });
          entry.requestCount++;
          this.emit('mock-server:evt:request', this.logs.get(entry.id)?.[0]);
          return;
        }

        // Apply delay
        const respond = () => {
          // Set response headers
          const contentTypeMap: Record<string, string> = {
            json: 'application/json',
            text: 'text/plain',
            html: 'text/html',
            xml: 'application/xml',
            empty: 'text/plain',
          };
          res.setHeader('Content-Type', contentTypeMap[endpoint.bodyType] ?? 'application/json');

          for (const h of endpoint.headers) {
            if (h.enabled && h.key) res.setHeader(h.key, h.value);
          }

          res.writeHead(endpoint.statusCode);
          const responseBody = endpoint.bodyType === 'empty' ? '' : endpoint.body;
          res.end(responseBody);

          this._addLog(entry, {
            endpointId: endpoint.id, method, path, statusCode: endpoint.statusCode,
            matched: true, durationMs: Date.now() - startMs,
            requestHeaders, requestBody, responseBody,
          });
          entry.requestCount++;
          this.emit('mock-server:evt:request', this.logs.get(entry.id)?.[0]);
        };

        if (endpoint.delayMs > 0) {
          setTimeout(respond, endpoint.delayMs);
        } else {
          respond();
        }
      });
    });
  }

  private _matchEndpoint(endpoints: MockEndpoint[], method: string, path: string): MockEndpoint | null {
    for (const ep of endpoints) {
      if (!ep.enabled) continue;
      if (ep.method !== 'ANY' && ep.method !== method) continue;
      if (this._matchPath(ep.path, path)) return ep;
    }
    return null;
  }

  private _matchPath(pattern: string, path: string): boolean {
    // Exact match
    if (pattern === path) return true;
    // Wildcard *
    if (pattern === '*') return true;
    // Named params :id, :slug etc.
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return false;
    return patternParts.every((p, i) => p.startsWith(':') || p === pathParts[i]);
  }

  private _addLog(entry: MockServerEntry, log: Omit<MockRequestLog, 'id' | 'serverId' | 'timestamp'>): void {
    const logs = this.logs.get(entry.id) ?? [];
    logs.unshift({ ...log, id: uuidv4(), serverId: entry.id, timestamp: new Date().toISOString() });
    if (logs.length > this.MAX_LOGS) logs.length = this.MAX_LOGS;
    this.logs.set(entry.id, logs);
  }

  // ── Logs ──────────────────────────────────────────────────────────────────

  getLogs(serverId: string): MockRequestLog[] {
    return this.logs.get(serverId) ?? [];
  }

  clearLogs(serverId: string): void {
    this.logs.set(serverId, []);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  async findFreePort(preferred = 3100): Promise<number> {
    for (let port = preferred; port < preferred + 100; port++) {
      if (await this._isPortFree(port)) return port;
    }
    throw new Error('No free port found in range');
  }

  private _isPortFree(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.once('listening', () => s.close(() => resolve(true)));
      s.listen(port, '127.0.0.1');
    });
  }

  copyUrl(serverId: string): string | null {
    const entry = this._getEntry(serverId);
    if (!entry) return null;
    return `http://localhost:${entry.port}`;
  }

  async dispose(): Promise<void> {
    await this.stopAll();
  }
}
