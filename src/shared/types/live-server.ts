/**
 * Live Server Types - Shared between main, preload, and renderer processes.
 */

// ============================================================================
// Core Types
// ============================================================================

export type LiveServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export type LiveServerProtocol = 'http' | 'https';

export interface LiveServerEntry {
  id: string;
  /** Root directory being served */
  rootPath: string;
  /** Human-friendly label */
  label: string;
  /** Port the server is listening on */
  port: number;
  /** Protocol */
  protocol: LiveServerProtocol;
  /** Full base URL e.g. http://localhost:3000 */
  url: string;
  /** Server status */
  status: LiveServerStatus;
  /** ISO timestamp when server started */
  startedAt: string | null;
  /** Error message when status === 'error' */
  error: string | null;
  /** Total HTTP requests served */
  requestCount: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Whether live-reload is enabled */
  liveReload: boolean;
  /** Whether to auto-open in browser on start */
  openBrowser: boolean;
  /** SPA mode: serve index.html for all 404s */
  spaMode: boolean;
  /** CORS headers enabled */
  cors: boolean;
  /** File extensions to watch for live-reload */
  watchExtensions: string[];
}

export interface LiveServerCreateOptions {
  rootPath: string;
  port?: number;
  label?: string;
  protocol?: LiveServerProtocol;
  liveReload?: boolean;
  openBrowser?: boolean;
  spaMode?: boolean;
  cors?: boolean;
  watchExtensions?: string[];
}

// ============================================================================
// Request Log
// ============================================================================

export interface LiveServerRequestEvent {
  serverId: string;
  method: string;
  path: string;
  statusCode: number;
  bytesSent: number;
  durationMs: number;
  timestamp: string;
  isLiveReload: boolean;
}

// ============================================================================
// IPC Payload Types
// ============================================================================

export interface LiveServerStartResult {
  success: boolean;
  server?: LiveServerEntry;
  error?: string;
}

export interface LiveServerStopResult {
  success: boolean;
  error?: string;
}

export interface LiveServerListResult {
  servers: LiveServerEntry[];
}

// ============================================================================
// IPC Events (main → renderer)
// ============================================================================

export interface LiveServerStatusChangedEvent {
  serverId: string;
  status: LiveServerStatus;
  url: string | null;
  error: string | null;
}

export interface LiveServerFileChangedEvent {
  serverId: string;
  filePath: string;
  changeType: 'add' | 'change' | 'unlink';
  timestamp: string;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const LIVE_SERVER_IPC = {
  START:            'live-server:start',
  STOP:             'live-server:stop',
  STOP_ALL:         'live-server:stop-all',
  LIST:             'live-server:list',
  GET:              'live-server:get',
  UPDATE_LABEL:     'live-server:update-label',
  COPY_URL:         'live-server:copy-url',
  OPEN_IN_BROWSER:  'live-server:open-browser',
  OPEN_FOLDER:      'live-server:open-folder',
  FIND_FREE_PORT:   'live-server:find-free-port',

  // Events (main → renderer)
  EVT_STATUS:       'live-server:evt:status',
  EVT_REQUEST:      'live-server:evt:request',
  EVT_FILE_CHANGED: 'live-server:evt:file-changed',
} as const;
