/**
 * Live Server Store - Zustand state management for the Live Server panel.
 */
import { create } from 'zustand';
import type {
  LiveServerEntry,
  LiveServerCreateOptions,
  LiveServerStatusChangedEvent,
  LiveServerRequestEvent,
  LiveServerFileChangedEvent,
} from '../../shared/types/live-server';

export interface LiveServerRequestLog {
  id: string;
  serverId: string;
  method: string;
  path: string;
  statusCode: number;
  bytesSent: number;
  durationMs: number;
  timestamp: string;
  isLiveReload: boolean;
}

export interface LiveServerFileLog {
  id: string;
  serverId: string;
  filePath: string;
  changeType: 'add' | 'change' | 'unlink';
  timestamp: string;
}

interface LiveServerState {
  servers: LiveServerEntry[];
  requestLogs: LiveServerRequestLog[];
  fileLogs: LiveServerFileLog[];
  selectedServerId: string | null;
  isLoading: boolean;

  // Form inputs
  rootPathInput: string;
  portInput: string;
  labelInput: string;
  protocol: 'http' | 'https';
  liveReload: boolean;
  openBrowser: boolean;
  spaMode: boolean;
  cors: boolean;

  // Actions
  setRootPathInput: (v: string) => void;
  setPortInput: (v: string) => void;
  setLabelInput: (v: string) => void;
  setProtocol: (v: 'http' | 'https') => void;
  setLiveReload: (v: boolean) => void;
  setOpenBrowser: (v: boolean) => void;
  setSpaMode: (v: boolean) => void;
  setCors: (v: boolean) => void;
  setSelectedServer: (id: string | null) => void;

  startServer: (options: LiveServerCreateOptions) => Promise<void>;
  stopServer: (id: string) => Promise<void>;
  stopAllServers: () => Promise<void>;
  loadServers: () => Promise<void>;
  updateLabel: (id: string, label: string) => Promise<void>;
  copyUrl: (id: string) => Promise<void>;
  openInBrowser: (id: string) => Promise<void>;
  openFolder: (id: string) => Promise<void>;
  pickFolder: () => Promise<void>;
  findFreePort: (preferredPort?: number) => Promise<number | null>;

  // IPC event handlers
  handleStatusChanged: (event: LiveServerStatusChangedEvent) => void;
  handleRequest: (event: LiveServerRequestEvent) => void;
  handleFileChanged: (event: LiveServerFileChangedEvent) => void;

  clearRequestLogs: (serverId?: string) => void;
  clearFileLogs: (serverId?: string) => void;
}

const MAX_REQUEST_LOGS = 500;
const MAX_FILE_LOGS = 200;

let ipcUnsubscribers: (() => void)[] = [];
let ipcSubscribed = false;

export const useLiveServerStore = create<LiveServerState>((set, get) => {
  // Subscribe to IPC events — called explicitly from loadServers
  const subscribeIPC = () => {
    if (ipcSubscribed) return;
    const api = (window as any).api;
    if (!api?.liveServer) return;
    ipcSubscribed = true;

    const u1 = api.liveServer.onStatusChanged((evt: LiveServerStatusChangedEvent) => {
      useLiveServerStore.getState().handleStatusChanged(evt);
    });
    const u2 = api.liveServer.onRequest((evt: LiveServerRequestEvent) => {
      useLiveServerStore.getState().handleRequest(evt);
    });
    const u3 = api.liveServer.onFileChanged((evt: LiveServerFileChangedEvent) => {
      useLiveServerStore.getState().handleFileChanged(evt);
    });

    ipcUnsubscribers = [u1, u2, u3];
  };

  return {
    servers: [],
    requestLogs: [],
    fileLogs: [],
    selectedServerId: null,
    isLoading: false,
    rootPathInput: '',
    portInput: '',
    labelInput: '',
    protocol: 'http',
    liveReload: true,
    openBrowser: false,
    spaMode: false,
    cors: true,

    setRootPathInput: (v) => set({ rootPathInput: v }),
    setPortInput: (v) => set({ portInput: v }),
    setLabelInput: (v) => set({ labelInput: v }),
    setProtocol: (v) => set({ protocol: v }),
    setLiveReload: (v) => set({ liveReload: v }),
    setOpenBrowser: (v) => set({ openBrowser: v }),
    setSpaMode: (v) => set({ spaMode: v }),
    setCors: (v) => set({ cors: v }),
    setSelectedServer: (id) => set({ selectedServerId: id }),

    loadServers: async () => {
      subscribeIPC();
      const api = (window as any).api;
      if (!api?.liveServer) return;
      const result = await api.liveServer.list();
      if (result?.servers) set({ servers: result.servers });
    },

    startServer: async (options) => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      set({ isLoading: true });
      try {
        const result = await api.liveServer.start(options);
        if (result?.success && result.server) {
          set((s) => ({
            servers: [...s.servers, result.server],
            selectedServerId: result.server.id,
            rootPathInput: '',
            portInput: '',
            labelInput: '',
          }));
        }
      } finally {
        set({ isLoading: false });
      }
    },

    stopServer: async (id) => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      await api.liveServer.stop(id);
      set((s) => ({
        servers: s.servers.filter((sv) => sv.id !== id),
        selectedServerId: s.selectedServerId === id ? null : s.selectedServerId,
      }));
    },

    stopAllServers: async () => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      await api.liveServer.stopAll();
      set({ servers: [], selectedServerId: null });
    },

    updateLabel: async (id, label) => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      const result = await api.liveServer.updateLabel(id, label);
      if (result?.success && result.server) {
        set((s) => ({
          servers: s.servers.map((sv) => (sv.id === id ? result.server : sv)),
        }));
      }
    },

    copyUrl: async (id) => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      await api.liveServer.copyUrl(id);
    },

    openInBrowser: async (id) => {
      const server = get().servers.find((s) => s.id === id);
      if (!server || server.status !== 'running') return;
      const openInternal = (window as any).__openInternalBrowser;
      if (typeof openInternal === 'function') {
        openInternal(server.url);
      } else {
        const api = (window as any).api;
        if (api?.liveServer) await api.liveServer.openInBrowser(id);
      }
    },

    openFolder: async (id) => {
      const api = (window as any).api;
      if (!api?.liveServer) return;
      await api.liveServer.openFolder(id);
    },

    pickFolder: async () => {
      const api = (window as any).api;
      if (!api?.file) return;
      const result = await api.file.dialogOpen({ properties: ['openDirectory'] });
      if (result && !result.canceled && result.filePaths?.[0]) {
        set({ rootPathInput: result.filePaths[0] });
      }
    },

    findFreePort: async (preferredPort) => {
      const api = (window as any).api;
      if (!api?.liveServer) return null;
      const result = await api.liveServer.findFreePort(preferredPort);
      return result?.success ? result.port : null;
    },

    handleStatusChanged: (event) => {
      set((s) => ({
        servers: s.servers.map((sv) =>
          sv.id === event.serverId
            ? {
                ...sv,
                status: event.status,
                url: event.url ?? sv.url,
                error: event.error,
              }
            : sv,
        ),
      }));
    },

    handleRequest: (event) => {
      const log: LiveServerRequestLog = {
        id: `${event.serverId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        serverId: event.serverId,
        method: event.method,
        path: event.path,
        statusCode: event.statusCode,
        bytesSent: event.bytesSent,
        durationMs: event.durationMs,
        timestamp: event.timestamp,
        isLiveReload: event.isLiveReload,
      };
      set((s) => {
        const logs = [log, ...s.requestLogs];
        return { requestLogs: logs.slice(0, MAX_REQUEST_LOGS) };
      });
      set((s) => ({
        servers: s.servers.map((sv) =>
          sv.id === event.serverId
            ? { ...sv, requestCount: sv.requestCount + 1, bytesSent: sv.bytesSent + event.bytesSent }
            : sv,
        ),
      }));
    },

    handleFileChanged: (event) => {
      const log: LiveServerFileLog = {
        id: `${event.serverId}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        serverId: event.serverId,
        filePath: event.filePath,
        changeType: event.changeType,
        timestamp: event.timestamp,
      };
      set((s) => {
        const logs = [log, ...s.fileLogs];
        return { fileLogs: logs.slice(0, MAX_FILE_LOGS) };
      });
    },

    clearRequestLogs: (serverId) => {
      set((s) => ({
        requestLogs: serverId
          ? s.requestLogs.filter((l) => l.serverId !== serverId)
          : [],
      }));
    },

    clearFileLogs: (serverId) => {
      set((s) => ({
        fileLogs: serverId
          ? s.fileLogs.filter((l) => l.serverId !== serverId)
          : [],
      }));
    },
  };
});
