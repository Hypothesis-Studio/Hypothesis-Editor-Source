/**
 * Tunnel Store - Zustand state management for the Tunnels panel.
 */
import { create } from 'zustand';
import type {
  TunnelEntry,
  TunnelCreateOptions,
  TunnelStatusChangedEvent,
  TunnelRequestEvent,
} from '../../shared/types/tunnel';

export interface TunnelRequestLog {
  id: string;
  tunnelId: string;
  method: string;
  path: string;
  statusCode: number;
  bytesIn: number;
  bytesOut: number;
  durationMs: number;
  timestamp: string;
}

interface TunnelState {
  tunnels: TunnelEntry[];
  requestLogs: TunnelRequestLog[];
  selectedTunnelId: string | null;
  isLoading: boolean;
  // Port input for new tunnel form
  portInput: string;
  labelInput: string;
  subdomainInput: string;
  autoReconnect: boolean;

  // Actions
  setPortInput: (v: string) => void;
  setLabelInput: (v: string) => void;
  setSubdomainInput: (v: string) => void;
  setAutoReconnect: (v: boolean) => void;
  setSelectedTunnel: (id: string | null) => void;

  openTunnel: (options: TunnelCreateOptions) => Promise<void>;
  closeTunnel: (id: string) => Promise<void>;
  closeAllTunnels: () => Promise<void>;
  loadTunnels: () => Promise<void>;
  updateLabel: (id: string, label: string) => Promise<void>;
  copyUrl: (id: string) => Promise<void>;
  openInBrowser: (id: string) => Promise<void>;

  // IPC event handlers
  handleStatusChanged: (event: TunnelStatusChangedEvent) => void;
  handleRequest: (event: TunnelRequestEvent) => void;

  clearRequestLogs: (tunnelId?: string) => void;
}

const MAX_REQUEST_LOGS = 500;

export const useTunnelStore = create<TunnelState>((set, get) => ({
  tunnels: [],
  requestLogs: [],
  selectedTunnelId: null,
  isLoading: false,
  portInput: '',
  labelInput: '',
  subdomainInput: '',
  autoReconnect: true,

  setPortInput: (v) => set({ portInput: v }),
  setLabelInput: (v) => set({ labelInput: v }),
  setSubdomainInput: (v) => set({ subdomainInput: v }),
  setAutoReconnect: (v) => set({ autoReconnect: v }),
  setSelectedTunnel: (id) => set({ selectedTunnelId: id }),

  loadTunnels: async () => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    const result = await api.tunnel.list();
    if (result?.tunnels) set({ tunnels: result.tunnels });
  },

  openTunnel: async (options) => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    set({ isLoading: true });
    try {
      const result = await api.tunnel.open(options);
      if (result?.success && result.tunnel) {
        set((s) => ({
          tunnels: [...s.tunnels, result.tunnel],
          selectedTunnelId: result.tunnel.id,
          portInput: '',
          labelInput: '',
          subdomainInput: '',
        }));
      }
    } finally {
      set({ isLoading: false });
    }
  },

  closeTunnel: async (id) => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    await api.tunnel.close(id);
    set((s) => ({
      tunnels: s.tunnels.filter((t) => t.id !== id),
      selectedTunnelId: s.selectedTunnelId === id ? null : s.selectedTunnelId,
    }));
  },

  closeAllTunnels: async () => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    await api.tunnel.closeAll();
    set({ tunnels: [], selectedTunnelId: null });
  },

  updateLabel: async (id, label) => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    const result = await api.tunnel.updateLabel(id, label);
    if (result?.success && result.tunnel) {
      set((s) => ({
        tunnels: s.tunnels.map((t) => (t.id === id ? result.tunnel : t)),
      }));
    }
  },

  copyUrl: async (id) => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    await api.tunnel.copyUrl(id);
  },

  openInBrowser: async (id) => {
    const api = (window as any).api;
    if (!api?.tunnel) return;
    await api.tunnel.openInBrowser(id);
  },

  handleStatusChanged: (event) => {
    set((s) => ({
      tunnels: s.tunnels.map((t) =>
        t.id === event.tunnelId
          ? {
              ...t,
              status: event.status,
              publicUrl: event.publicUrl ?? t.publicUrl,
              error: event.error,
            }
          : t,
      ),
    }));
  },

  handleRequest: (event) => {
    const log: TunnelRequestLog = {
      id: `${event.tunnelId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tunnelId: event.tunnelId,
      method: event.method,
      path: event.path,
      statusCode: event.statusCode,
      bytesIn: event.bytesIn,
      bytesOut: event.bytesOut,
      durationMs: event.durationMs,
      timestamp: event.timestamp,
    };
    set((s) => {
      const logs = [log, ...s.requestLogs];
      return { requestLogs: logs.slice(0, MAX_REQUEST_LOGS) };
    });
    // Update request count on the tunnel entry
    set((s) => ({
      tunnels: s.tunnels.map((t) =>
        t.id === event.tunnelId
          ? { ...t, requestCount: t.requestCount + 1 }
          : t,
      ),
    }));
  },

  clearRequestLogs: (tunnelId) => {
    set((s) => ({
      requestLogs: tunnelId
        ? s.requestLogs.filter((l) => l.tunnelId !== tunnelId)
        : [],
    }));
  },
}));
