/**
 * Mock Server Store - Zustand state management for the Mock Server panel.
 */
import { create } from 'zustand';
import type {
  MockServerEntry,
  MockServerCreateOptions,
  MockEndpoint,
  MockRequestLog,
} from '../../shared/types/mock-server';

const api = (window as any).api;

interface MockServerState {
  servers: MockServerEntry[];
  logs: Record<string, MockRequestLog[]>; // serverId → logs
  selectedServerId: string | null;
  selectedEndpointId: string | null;
  isLoading: boolean;
  activeView: 'endpoints' | 'logs';

  // Create-server form
  createName: string;
  createPort: string;
  createCors: boolean;
  showCreateForm: boolean;

  // Actions
  setSelectedServer: (id: string | null) => void;
  setSelectedEndpoint: (id: string | null) => void;
  setActiveView: (view: 'endpoints' | 'logs') => void;
  setCreateName: (v: string) => void;
  setCreatePort: (v: string) => void;
  setCreateCors: (v: boolean) => void;
  setShowCreateForm: (v: boolean) => void;

  loadServers: () => Promise<void>;
  createServer: (options: MockServerCreateOptions) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  startServer: (id: string) => Promise<void>;
  stopServer: (id: string) => Promise<void>;
  copyUrl: (id: string) => Promise<void>;
  findFreePort: (preferred?: number) => Promise<number | null>;

  addEndpoint: (serverId: string, endpoint: Omit<MockEndpoint, 'id'>) => Promise<void>;
  updateEndpoint: (serverId: string, endpointId: string, updates: Partial<MockEndpoint>) => Promise<void>;
  deleteEndpoint: (serverId: string, endpointId: string) => Promise<void>;
  reorderEndpoints: (serverId: string, orderedIds: string[]) => Promise<void>;

  loadLogs: (serverId: string) => Promise<void>;
  clearLogs: (serverId: string) => Promise<void>;

  // IPC event handlers
  handleStatusChanged: (event: { serverId: string; status: string; error: string | null }) => void;
  handleRequest: (log: MockRequestLog) => void;
}

const MAX_LOGS = 200;
let ipcSubscribed = false;

export const useMockServerStore = create<MockServerState>((set, get) => {
  const subscribeIPC = () => {
    if (ipcSubscribed) return;
    if (!api?.mockServer) return;
    ipcSubscribed = true;

    api.mockServer.onStatusChanged((evt: { serverId: string; status: string; error: string | null }) => {
      useMockServerStore.getState().handleStatusChanged(evt);
    });
    api.mockServer.onRequest((log: MockRequestLog) => {
      useMockServerStore.getState().handleRequest(log);
    });
  };

  return {
    servers: [],
    logs: {},
    selectedServerId: null,
    selectedEndpointId: null,
    isLoading: false,
    activeView: 'endpoints',
    createName: '',
    createPort: '',
    createCors: true,
    showCreateForm: false,

    setSelectedServer: (id) => set({ selectedServerId: id, selectedEndpointId: null, activeView: 'endpoints' }),
    setSelectedEndpoint: (id) => set({ selectedEndpointId: id }),
    setActiveView: (view) => set({ activeView: view }),
    setCreateName: (v) => set({ createName: v }),
    setCreatePort: (v) => set({ createPort: v }),
    setCreateCors: (v) => set({ createCors: v }),
    setShowCreateForm: (v) => set({ showCreateForm: v }),

    loadServers: async () => {
      subscribeIPC();
      if (!api?.mockServer) return;
      const result = await api.mockServer.list();
      if (result?.servers) set({ servers: result.servers });
    },

    createServer: async (options) => {
      if (!api?.mockServer) return;
      set({ isLoading: true });
      try {
        const result = await api.mockServer.create(options);
        if (result?.success && result.server) {
          set(s => ({
            servers: [...s.servers, result.server],
            selectedServerId: result.server.id,
            showCreateForm: false,
            createName: '',
            createPort: '',
            createCors: true,
          }));
        }
      } finally {
        set({ isLoading: false });
      }
    },

    deleteServer: async (id) => {
      if (!api?.mockServer) return;
      await api.mockServer.delete(id);
      set(s => ({
        servers: s.servers.filter(sv => sv.id !== id),
        selectedServerId: s.selectedServerId === id ? (s.servers.find(sv => sv.id !== id)?.id ?? null) : s.selectedServerId,
        logs: Object.fromEntries(Object.entries(s.logs).filter(([k]) => k !== id)),
      }));
    },

    startServer: async (id) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.start(id);
      if (result?.success && result.server) {
        set(s => ({ servers: s.servers.map(sv => sv.id === id ? result.server : sv) }));
      }
    },

    stopServer: async (id) => {
      if (!api?.mockServer) return;
      await api.mockServer.stop(id);
      // status update comes via IPC event
    },

    copyUrl: async (id) => {
      if (!api?.mockServer) return;
      await api.mockServer.copyUrl(id);
    },

    findFreePort: async (preferred) => {
      if (!api?.mockServer) return null;
      const result = await api.mockServer.findFreePort(preferred);
      return result?.success ? result.port : null;
    },

    addEndpoint: async (serverId, endpoint) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.endpointAdd(serverId, endpoint);
      if (result?.success && result.server) {
        set(s => ({ servers: s.servers.map(sv => sv.id === serverId ? result.server : sv) }));
      }
    },

    updateEndpoint: async (serverId, endpointId, updates) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.endpointUpdate(serverId, endpointId, updates);
      if (result?.success && result.server) {
        set(s => ({ servers: s.servers.map(sv => sv.id === serverId ? result.server : sv) }));
      }
    },

    deleteEndpoint: async (serverId, endpointId) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.endpointDelete(serverId, endpointId);
      if (result?.success && result.server) {
        set(s => ({
          servers: s.servers.map(sv => sv.id === serverId ? result.server : sv),
          selectedEndpointId: s.selectedEndpointId === endpointId ? null : s.selectedEndpointId,
        }));
      }
    },

    reorderEndpoints: async (serverId, orderedIds) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.endpointReorder(serverId, orderedIds);
      if (result?.success && result.server) {
        set(s => ({ servers: s.servers.map(sv => sv.id === serverId ? result.server : sv) }));
      }
    },

    loadLogs: async (serverId) => {
      if (!api?.mockServer) return;
      const result = await api.mockServer.logsGet(serverId);
      if (result?.logs) {
        set(s => ({ logs: { ...s.logs, [serverId]: result.logs } }));
      }
    },

    clearLogs: async (serverId) => {
      if (!api?.mockServer) return;
      await api.mockServer.logsClear(serverId);
      set(s => ({ logs: { ...s.logs, [serverId]: [] } }));
    },

    handleStatusChanged: (event) => {
      set(s => ({
        servers: s.servers.map(sv =>
          sv.id === event.serverId
            ? { ...sv, status: event.status as any, error: event.error }
            : sv
        ),
      }));
    },

    handleRequest: (log) => {
      set(s => {
        const existing = s.logs[log.serverId] ?? [];
        const updated = [log, ...existing].slice(0, MAX_LOGS);
        return {
          logs: { ...s.logs, [log.serverId]: updated },
          servers: s.servers.map(sv =>
            sv.id === log.serverId ? { ...sv, requestCount: sv.requestCount + 1 } : sv
          ),
        };
      });
    },
  };
});
