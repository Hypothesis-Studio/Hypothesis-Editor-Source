/**
 * Tunnel Types - Shared between main, preload, and renderer processes.
 */

// ============================================================================
// Core Tunnel Types
// ============================================================================

export type TunnelStatus = 'connecting' | 'connected' | 'error' | 'closed';

export type TunnelProtocol = 'http' | 'https';

export interface TunnelEntry {
  id: string;
  /** Local port being forwarded */
  localPort: number;
  /** Human-friendly label (editable) */
  label: string;
  /** The public URL assigned by localtunnel */
  publicUrl: string | null;
  /** Preferred subdomain (may not be honored by the server) */
  subdomain: string | null;
  status: TunnelStatus;
  /** ISO timestamp when the tunnel was opened */
  startedAt: string | null;
  /** Error message when status === 'error' */
  error: string | null;
  /** Total requests forwarded through the tunnel */
  requestCount: number;
  /** Bytes forwarded in */
  bytesIn: number;
  /** Bytes forwarded out */
  bytesOut: number;
  /** Whether this tunnel should auto-reconnect on disconnect */
  autoReconnect: boolean;
}

export interface TunnelCreateOptions {
  localPort: number;
  label?: string;
  subdomain?: string;
  autoReconnect?: boolean;
}

export interface TunnelStats {
  tunnelId: string;
  requestCount: number;
  bytesIn: number;
  bytesOut: number;
}

// ============================================================================
// IPC Payload Types
// ============================================================================

export interface TunnelOpenResult {
  success: boolean;
  tunnel?: TunnelEntry;
  error?: string;
}

export interface TunnelCloseResult {
  success: boolean;
  error?: string;
}

export interface TunnelListResult {
  tunnels: TunnelEntry[];
}

// ============================================================================
// IPC Events (main → renderer)
// ============================================================================

export interface TunnelStatusChangedEvent {
  tunnelId: string;
  status: TunnelStatus;
  publicUrl: string | null;
  error: string | null;
}

export interface TunnelRequestEvent {
  tunnelId: string;
  method: string;
  path: string;
  statusCode: number;
  bytesIn: number;
  bytesOut: number;
  durationMs: number;
  timestamp: string;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

export const TUNNEL_IPC = {
  OPEN:           'tunnel:open',
  CLOSE:          'tunnel:close',
  CLOSE_ALL:      'tunnel:close-all',
  LIST:           'tunnel:list',
  GET:            'tunnel:get',
  UPDATE_LABEL:   'tunnel:update-label',
  COPY_URL:       'tunnel:copy-url',
  OPEN_BROWSER:   'tunnel:open-browser',

  // Events (main → renderer)
  EVT_STATUS:     'tunnel:evt:status',
  EVT_REQUEST:    'tunnel:evt:request',
  EVT_ERROR:      'tunnel:evt:error',
} as const;
