/**
 * Mock Server Types - Shared between main, preload, and renderer processes.
 */

// ── Core Types ────────────────────────────────────────────────────────────────

export type MockServerStatus = 'stopped' | 'starting' | 'running' | 'error';

export type MockEndpointMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'ANY';

export type MockResponseBodyType = 'json' | 'text' | 'html' | 'xml' | 'empty';

export interface MockEndpointHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface MockEndpoint {
  id: string;
  /** HTTP method or ANY to match all */
  method: MockEndpointMethod;
  /** Path e.g. /api/users or /api/users/:id */
  path: string;
  /** HTTP status code to return */
  statusCode: number;
  /** Response body type */
  bodyType: MockResponseBodyType;
  /** Response body content */
  body: string;
  /** Response headers */
  headers: MockEndpointHeader[];
  /** Simulated delay in ms (0 = no delay) */
  delayMs: number;
  /** Whether this endpoint is enabled */
  enabled: boolean;
  /** Description / notes */
  description: string;
}

export interface MockServerEntry {
  id: string;
  /** Human-friendly name */
  name: string;
  /** Port the server listens on */
  port: number;
  /** Server status */
  status: MockServerStatus;
  /** CORS headers enabled */
  cors: boolean;
  /** List of mock endpoints */
  endpoints: MockEndpoint[];
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last started */
  startedAt: string | null;
  /** Error message when status === 'error' */
  error: string | null;
  /** Total requests received since start */
  requestCount: number;
}

export interface MockServerCreateOptions {
  name: string;
  port?: number;
  cors?: boolean;
  endpoints?: Omit<MockEndpoint, 'id'>[];
}

// ── Request Log ───────────────────────────────────────────────────────────────

export interface MockRequestLog {
  id: string;
  serverId: string;
  endpointId: string | null;
  method: string;
  path: string;
  statusCode: number;
  matched: boolean;
  durationMs: number;
  timestamp: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  responseBody: string;
}

// ── IPC Result Types ──────────────────────────────────────────────────────────

export interface MockServerResult {
  success: boolean;
  server?: MockServerEntry;
  error?: string;
}

export interface MockServerListResult {
  servers: MockServerEntry[];
}

export interface MockServerLogsResult {
  logs: MockRequestLog[];
}

// ── IPC Channel Names ─────────────────────────────────────────────────────────

export const MOCK_SERVER_IPC = {
  // Server CRUD
  CREATE:           'mock-server:create',
  DELETE:           'mock-server:delete',
  LIST:             'mock-server:list',
  GET:              'mock-server:get',
  UPDATE:           'mock-server:update',

  // Lifecycle
  START:            'mock-server:start',
  STOP:             'mock-server:stop',
  STOP_ALL:         'mock-server:stop-all',

  // Endpoints
  ENDPOINT_ADD:     'mock-server:endpoint:add',
  ENDPOINT_UPDATE:  'mock-server:endpoint:update',
  ENDPOINT_DELETE:  'mock-server:endpoint:delete',
  ENDPOINT_REORDER: 'mock-server:endpoint:reorder',

  // Logs
  LOGS_GET:         'mock-server:logs:get',
  LOGS_CLEAR:       'mock-server:logs:clear',

  // Misc
  FIND_FREE_PORT:   'mock-server:find-free-port',
  COPY_URL:         'mock-server:copy-url',

  // Events (main → renderer)
  EVT_STATUS:       'mock-server:evt:status',
  EVT_REQUEST:      'mock-server:evt:request',
} as const;
