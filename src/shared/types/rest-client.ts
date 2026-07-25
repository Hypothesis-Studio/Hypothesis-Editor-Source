/**
 * Hypothesis REST Client - API Client Types
 * Production-grade API testing and request management types.
 */

// ============================================================================
// HTTP Methods & Core Enums
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey' | 'oauth2' | 'digest' | 'awsv4' | 'hawk';
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql';
export type ResponseFormat = 'json' | 'xml' | 'html' | 'text' | 'binary' | 'auto';
export type VariableScope = 'collection' | 'environment' | 'global';
export type AssertionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'not_exists' | 'matches' | 'is_type' | 'is_empty' | 'is_not_empty';
export type AssertionTarget = 'status' | 'header' | 'body' | 'response_time' | 'url';

// ============================================================================
// Variable System
// ============================================================================

export interface RestClientVariable {
  key: string;
  value: string;
  enabled: boolean;
  scope: VariableScope;
  description?: string;
  isSecret?: boolean;
}

export interface RestClientEnvironment {
  id: string;
  name: string;
  description?: string;
  variables: RestClientVariable[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Auth Configurations
// ============================================================================

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerAuth {
  token: string;
  prefix?: string;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
  headerName?: string;
  queryParam?: string;
}

export interface OAuth2Config {
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit';
  authUrl?: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  scope?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  callbackUrl?: string;
  codeVerifier?: string;
  codeChallengeMethod?: 'S256' | 'plain';
}

export interface DigestAuth {
  username: string;
  password: string;
}

export interface AwsV4Auth {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  service: string;
  sessionToken?: string;
}

export interface HawkAuth {
  id: string;
  key: string;
  algorithm?: 'sha256' | 'sha1';
  ext?: string;
}

export interface RestClientAuth {
  type: AuthType;
  basic?: BasicAuth;
  bearer?: BearerAuth;
  apikey?: ApiKeyAuth;
  oauth2?: OAuth2Config;
  digest?: DigestAuth;
  awsv4?: AwsV4Auth;
  hawk?: HawkAuth;
}

// ============================================================================
// Request Components
// ============================================================================

export interface KeyValue {
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export interface RestClientBody {
  type: BodyType;
  raw?: string;
  rawLanguage?: string;
  formData?: KeyValue[];
  urlEncoded?: KeyValue[];
  graphql?: {
    query: string;
    variables?: string;
    operationName?: string;
  };
  binary?: {
    filePath: string;
    fileName?: string;
    mimeType?: string;
  };
}

export interface RestClientRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: RestClientBody;
  auth: RestClientAuth;
  preRequestScript?: string;
  testScript?: string;
  proxy?: ProxyConfig;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
  withCredentials?: boolean;
  ipVersion?: 'auto' | 'ipv4' | 'ipv6';
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Response Types
// ============================================================================

export interface RestClientResponse {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodySize: number;
  parsedBody?: unknown;
  responseTime: number;
  responseSize: number;
  contentType?: string;
  redirects?: RedirectInfo[];
  cookies?: KeyValue[];
  httpVersion?: string;
  tlsInfo?: TlsInfo;
  error?: string;
  serverIp?: string;
  timeline?: RequestTimeline;
}

export interface RedirectInfo {
  statusCode: number;
  url: string;
  headers: Record<string, string>;
}

export interface TlsInfo {
  protocol?: string;
  cipher?: string;
  certificate?: {
    subject: string;
    issuer: string;
    validFrom: string;
    validTo: string;
    serialNumber: string;
    fingerprint: string;
  };
}

export interface RequestTimeline {
  start: number;
  phases: {
    dns?: number;
    tcp?: number;
    tls?: number;
    request: number;
    firstByte: number;
    download: number;
    total: number;
  };
}

// ============================================================================
// Assertions / Tests
// ============================================================================

export interface RestClientAssertion {
  id: string;
  target: AssertionTarget;
  path?: string;
  operator: AssertionOperator;
  expected?: string;
  enabled: boolean;
}

export interface AssertionResult {
  assertion: RestClientAssertion;
  passed: boolean;
  actual?: string;
  message: string;
}

// ============================================================================
// Proxy Configuration
// ============================================================================

export interface ProxyConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  username?: string;
  password?: string;
  bypass?: string[];
}

// ============================================================================
// Collections & Folders
// ============================================================================

export interface RestClientFolder {
  id: string;
  name: string;
  description?: string;
  parentId: string | null;
  auth?: RestClientAuth;
  headers?: KeyValue[];
  preRequestScript?: string;
  testScript?: string;
  variables?: RestClientVariable[];
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface RestClientCollection {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  variables: RestClientVariable[];
  auth?: RestClientAuth;
  headers?: KeyValue[];
  preRequestScript?: string;
  testScript?: string;
  proxy?: ProxyConfig;
  folders: RestClientFolder[];
  requests: RestClientRequest[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// History
// ============================================================================

export interface RestClientHistoryEntry {
  id: string;
  requestId?: string;
  collectionId?: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body?: RestClientBody;
  response: RestClientResponse;
  assertions?: AssertionResult[];
  timestamp: number;
  duration: number;
  environmentId?: string;
  tags?: string[];
}

// ============================================================================
// Runner / Batch
// ============================================================================

export interface RestClientRunnerConfig {
  iterations: number;
  delay?: number;
  stopOnError?: boolean;
  environmentId?: string;
  dataFile?: {
    type: 'json' | 'csv';
    content: string;
  };
}

export interface RestClientRunnerResult {
  id: string;
  collectionId: string;
  startedAt: number;
  finishedAt: number;
  totalRequests: number;
  passed: number;
  failed: number;
  skipped: number;
  iterations: RestClientIterationResult[];
  summary: RestClientRunnerSummary;
}

export interface RestClientIterationResult {
  iteration: number;
  requests: RestClientRunRequestResult[];
  passed: boolean;
  duration: number;
}

export interface RestClientRunRequestResult {
  requestId: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  response?: RestClientResponse;
  assertions: AssertionResult[];
  passed: boolean;
  duration: number;
  error?: string;
  extractedVariables?: Record<string, string>;
}

export interface RestClientRunnerSummary {
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  totalDataReceived: number;
  totalDataSent: number;
  assertionStats: {
    total: number;
    passed: number;
    failed: number;
  };
}

// ============================================================================
// Request Templates
// ============================================================================

export interface RestClientTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body?: RestClientBody;
  auth?: RestClientAuth;
  icon?: string;
}

// ============================================================================
// Import / Export
// ============================================================================

export type ImportFormat = 'postman_v2' | 'postman_v2.1' | 'openapi_3' | 'swagger_2' | 'insomnia' | 'curl' | 'har' | 'rest_client';
export type ExportFormat = 'rest_client' | 'postman_v2.1' | 'openapi_3' | 'curl' | 'har';

export interface RestClientImportResult {
  collections: RestClientCollection[];
  environments: RestClientEnvironment[];
  errors: string[];
  warnings: string[];
}

export interface RestClientExportOptions {
  format: ExportFormat;
  collectionIds?: string[];
  environmentIds?: string[];
  includeHistory?: boolean;
  pretty?: boolean;
}

// ============================================================================
// Workspace State
// ============================================================================

export interface RestClientWorkspace {
  collections: RestClientCollection[];
  environments: RestClientEnvironment[];
  history: RestClientHistoryEntry[];
  activeCollectionId: string | null;
  activeEnvironmentId: string | null;
  activeRequestId: string | null;
  globalVariables: RestClientVariable[];
  examples: Record<string, RestClientResponse[]>;
  runnerResults: RestClientRunnerResult[];
  globalProxy?: ProxyConfig;
  globalTimeout?: number;
  maxHistory: number;
}

// ============================================================================
// Variable Resolution
// ============================================================================

export interface VariableResolution {
  raw: string;
  resolved: string;
  variables: Array<{
    key: string;
    value: string;
    scope: VariableScope;
    found: boolean;
  }>;
}

// ============================================================================
// Script Execution
// ============================================================================

export interface ScriptContext {
  request: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body: string | undefined;
    auth: RestClientAuth;
    setMethod: (method: HttpMethod) => void;
    setUrl: (url: string) => void;
    setHeader: (name: string, value: string) => void;
    setBody: (body: string) => void;
    setAuth: (auth: RestClientAuth) => void;
  };
  variables: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string, scope?: VariableScope) => void;
    unset: (key: string) => void;
    getAll: () => Record<string, string>;
  };
  environment: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
    json: () => unknown;
    text: () => string;
    header: (name: string) => string | undefined;
    responseTime: number;
  };
  assertions: {
    equal: (actual: unknown, expected: unknown, message?: string) => void;
    notEqual: (actual: unknown, expected: unknown, message?: string) => void;
    contains: (actual: string, expected: string, message?: string) => void;
    ok: (value: unknown, message?: string) => void;
    notOk: (value: unknown, message?: string) => void;
    greaterThan: (actual: number, expected: number, message?: string) => void;
    lessThan: (actual: number, expected: number, message?: string) => void;
    hasProperty: (obj: unknown, prop: string, message?: string) => void;
    type: (value: unknown, type: string, message?: string) => void;
    matches: (actual: string, pattern: string | RegExp, message?: string) => void;
  };
  log: (...args: unknown[]) => void;
  stop: (message: string) => void;
}

export interface ScriptResult {
  success: boolean;
  logs: string[];
  errors: string[];
  assertions: AssertionResult[];
  variables: Record<string, string>;
  modifiedRequest?: Partial<RestClientRequest>;
  duration: number;
}

// ============================================================================
// IPC Channels
// ============================================================================

export const REST_CLIENT_IPC = {
  SEND_REQUEST: 'rest-client:send-request',
  CANCEL_REQUEST: 'rest-client:cancel-request',
  COLLECTION_LIST: 'rest-client:collection:list',
  COLLECTION_GET: 'rest-client:collection:get',
  COLLECTION_CREATE: 'rest-client:collection:create',
  COLLECTION_UPDATE: 'rest-client:collection:update',
  COLLECTION_DELETE: 'rest-client:collection:delete',
  COLLECTION_EXPORT: 'rest-client:collection:export',
  COLLECTION_IMPORT: 'rest-client:collection:import',
  REQUEST_CREATE: 'rest-client:request:create',
  REQUEST_UPDATE: 'rest-client:request:update',
  REQUEST_DELETE: 'rest-client:request:delete',
  REQUEST_DUPLICATE: 'rest-client:request:duplicate',
  REQUEST_MOVE: 'rest-client:request:move',
  FOLDER_CREATE: 'rest-client:folder:create',
  FOLDER_UPDATE: 'rest-client:folder:update',
  FOLDER_DELETE: 'rest-client:folder:delete',
  ENV_LIST: 'rest-client:env:list',
  ENV_GET: 'rest-client:env:get',
  ENV_CREATE: 'rest-client:env:create',
  ENV_UPDATE: 'rest-client:env:update',
  ENV_DELETE: 'rest-client:env:delete',
  ENV_ACTIVATE: 'rest-client:env:activate',
  ENV_DEACTIVATE: 'rest-client:env:deactivate',
  ENV_DUPLICATE: 'rest-client:env:duplicate',
  HISTORY_LIST: 'rest-client:history:list',
  HISTORY_CLEAR: 'rest-client:history:clear',
  HISTORY_DELETE: 'rest-client:history:delete',
  HISTORY_SEARCH: 'rest-client:history:search',
  VAR_SET: 'rest-client:var:set',
  VAR_GET: 'rest-client:var:get',
  VAR_GET_ALL: 'rest-client:var:get-all',
  VAR_DELETE: 'rest-client:var:delete',
  VAR_RESOLVE: 'rest-client:var:resolve',
  RUNNER_START: 'rest-client:runner:start',
  RUNNER_STOP: 'rest-client:runner:stop',
  RUNNER_STATUS: 'rest-client:runner:status',
  RUNNER_PROGRESS: 'rest-client:runner:progress',
  RUNNER_RESULT: 'rest-client:runner:result',
  SCRIPT_RUN_PRE: 'rest-client:script:pre',
  SCRIPT_RUN_TEST: 'rest-client:script:test',
  IMPORT_FILE: 'rest-client:import:file',
  IMPORT_CURL: 'rest-client:import:curl',
  EXPORT: 'rest-client:export',
  TEMPLATE_LIST: 'rest-client:template:list',
  SETTINGS_GET: 'rest-client:settings:get',
  SETTINGS_SET: 'rest-client:settings:set',
  EVENT_RESPONSE: 'rest-client:event:response',
  EVENT_RUNNER_PROGRESS: 'rest-client:event:runner-progress',
  EVENT_RUNNER_COMPLETE: 'rest-client:event:runner-complete',
  EVENT_SCRIPT_LOG: 'rest-client:event:script-log',
} as const;
