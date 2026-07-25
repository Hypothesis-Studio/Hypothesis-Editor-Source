/**
 * Hypothesis REST Client - Zustand Store
 * State management for the REST Client UI.
 */
import { create } from 'zustand';
import type {
  RestClientCollection,
  RestClientEnvironment,
  RestClientHistoryEntry,
  RestClientRequest,
  RestClientResponse,
  RestClientRunnerResult,
  RestClientTemplate,
  RestClientVariable,
} from '../../shared/types/rest-client';

const api = (window as any).api;

interface RestClientState {
  collections: RestClientCollection[];
  environments: RestClientEnvironment[];
  history: RestClientHistoryEntry[];
  templates: RestClientTemplate[];
  globalVariables: RestClientVariable[];
  activeCollectionId: string | null;
  activeRequestId: string | null;
  activeEnvironmentId: string | null;
  currentResponse: RestClientResponse | null;
  isLoading: boolean;
  error: string | null;
  runnerResult: RestClientRunnerResult | null;
  isRunning: boolean;
  runnerProgress: {
    iteration: number;
    totalIterations: number;
    requestIndex: number;
    totalRequests: number;
    currentRequest: string;
    passed: boolean;
    duration: number;
  } | null;
  sidebarWidth: number;
  activeTab: 'params' | 'headers' | 'body' | 'auth' | 'pre-script' | 'test-script' | 'settings';
  responseTab: 'body' | 'headers' | 'cookies' | 'timeline' | 'tests' | 'console';
  historySearch: string;
  showRunner: boolean;
  showImportDialog: boolean;
  showExportDialog: boolean;
  showEnvironmentManager: boolean;
  showVariableViewer: boolean;
  showCurlImport: boolean;
  curlInput: string;
  responseBodyFormat: 'pretty' | 'raw' | 'preview';
  responseWrap: boolean;
  showHiddenHeaders: boolean;
  draftRequest: Partial<RestClientRequest> | null;
  draftHeaders: Array<{ key: string; value: string; enabled: boolean; id: string }>;
  draftParams: Array<{ key: string; value: string; enabled: boolean; id: string }>;

  loadData: () => Promise<void>;
  setActiveCollection: (id: string | null) => void;
  setActiveRequest: (id: string | null) => void;
  setActiveEnvironment: (id: string | null) => void;
  setActiveTab: (tab: RestClientState['activeTab']) => void;
  setResponseTab: (tab: RestClientState['responseTab']) => void;
  createCollection: (name: string, description?: string) => Promise<RestClientCollection>;
  updateCollection: (id: string, updates: Partial<RestClientCollection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  createRequest: (collectionId: string, request?: Partial<RestClientRequest>) => Promise<RestClientRequest | undefined>;
  updateRequest: (collectionId: string, requestId: string, updates: Partial<RestClientRequest>) => Promise<void>;
  deleteRequest: (collectionId: string, requestId: string) => Promise<void>;
  duplicateRequest: (collectionId: string, requestId: string) => Promise<void>;
  sendRequest: (requestId: string, collectionId: string) => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  createEnvironment: (name: string, variables?: RestClientVariable[]) => Promise<void>;
  updateEnvironment: (id: string, updates: Partial<RestClientEnvironment>) => Promise<void>;
  deleteEnvironment: (id: string) => Promise<void>;
  activateEnvironment: (id: string) => Promise<void>;
  deactivateEnvironment: () => Promise<void>;
  duplicateEnvironment: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  searchHistory: (query: string) => Promise<void>;
  importCollections: (content: string, format: string) => Promise<void>;
  importCurl: (curl: string) => Promise<void>;
  exportCollections: (format: string) => Promise<string>;
  startRunner: (collectionId: string, config: any) => Promise<void>;
  stopRunner: () => Promise<void>;
  setDraftRequest: (request: Partial<RestClientRequest> | null) => void;
  updateDraftField: (field: string, value: any) => void;
  saveDraft: (collectionId: string, requestId: string) => Promise<void>;
  setSidebarWidth: (width: number) => void;
  toggleRunner: () => void;
  setShowImportDialog: (show: boolean) => void;
  setShowExportDialog: (show: boolean) => void;
  setShowEnvironmentManager: (show: boolean) => void;
  setShowVariableViewer: (show: boolean) => void;
  setShowCurlImport: (show: boolean) => void;
  setCurlInput: (input: string) => void;
  setResponseBodyFormat: (format: 'pretty' | 'raw' | 'preview') => void;
  setResponseWrap: (wrap: boolean) => void;
}

export const useRestClientStore = create<RestClientState>((set, get) => ({
  collections: [],
  environments: [],
  history: [],
  templates: [],
  globalVariables: [],
  activeCollectionId: null,
  activeRequestId: null,
  activeEnvironmentId: null,
  currentResponse: null,
  isLoading: false,
  error: null,
  runnerResult: null,
  isRunning: false,
  runnerProgress: null,
  sidebarWidth: 280,
  activeTab: 'params',
  responseTab: 'body',
  historySearch: '',
  showRunner: false,
  showImportDialog: false,
  showExportDialog: false,
  showEnvironmentManager: false,
  showVariableViewer: false,
  showCurlImport: false,
  curlInput: '',
  responseBodyFormat: 'pretty',
  responseWrap: false,
  showHiddenHeaders: false,
  draftRequest: null,
  draftHeaders: [],
  draftParams: [],

  loadData: async () => {
    try {
      const [collections, environments, history, templates, globalVariables] = await Promise.all([
        api.restClient.collection.list(),
        api.restClient.env.list(),
        api.restClient.history.list(),
        api.restClient.template.list(),
        api.restClient.var.getAll?.() ?? Promise.resolve([]),
      ]);
      set({ collections, environments, history, templates, globalVariables });
    } catch (err: any) {
      console.error('Failed to load REST Client data:', err);
    }
  },

  setActiveCollection: (id) => set({ activeCollectionId: id }),
  setActiveRequest: (id) => set({ activeRequestId: id, currentResponse: null, draftRequest: null }),
  setActiveEnvironment: async (id) => {
    if (id) {
      await api.restClient.env.activate(id);
    } else {
      await api.restClient.env.deactivate();
    }
    set({ activeEnvironmentId: id });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setResponseTab: (tab) => set({ responseTab: tab }),

  createCollection: async (name, description) => {
    const collection = await api.restClient.collection.create(name, description);
    set(s => ({ collections: [...s.collections, collection] }));
    return collection;
  },
  updateCollection: async (id, updates) => {
    await api.restClient.collection.update(id, updates);
    set(s => ({
      collections: s.collections.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  },
  deleteCollection: async (id) => {
    await api.restClient.collection.delete(id);
    set(s => ({
      collections: s.collections.filter(c => c.id !== id),
      activeCollectionId: s.activeCollectionId === id ? null : s.activeCollectionId,
    }));
  },

  createRequest: async (collectionId, request) => {
    const created = await api.restClient.request.create(collectionId, request);
    if (created) {
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, requests: [...c.requests, created] } : c
        ),
      }));
    }
    return created;
  },
  updateRequest: async (collectionId, requestId, updates) => {
    await api.restClient.request.update(collectionId, requestId, updates);
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collectionId
          ? { ...c, requests: c.requests.map(r => r.id === requestId ? { ...r, ...updates } : r) }
          : c
      ),
    }));
  },
  deleteRequest: async (collectionId, requestId) => {
    await api.restClient.request.delete(collectionId, requestId);
    set(s => ({
      collections: s.collections.map(c =>
        c.id === collectionId
          ? { ...c, requests: c.requests.filter(r => r.id !== requestId) }
          : c
      ),
      activeRequestId: s.activeRequestId === requestId ? null : s.activeRequestId,
    }));
  },
  duplicateRequest: async (collectionId, requestId) => {
    const dup = await api.restClient.request.duplicate(collectionId, requestId);
    if (dup) {
      set(s => ({
        collections: s.collections.map(c =>
          c.id === collectionId ? { ...c, requests: [...c.requests, dup] } : c
        ),
      }));
    }
  },
  sendRequest: async (requestId, collectionId) => {
    set({ isLoading: true, error: null, currentResponse: null });
    try {
      const response = await api.restClient.sendRequest(requestId, collectionId);
      if (response?.error) {
        set({ error: response.error, isLoading: false });
      } else {
        set({ currentResponse: response, isLoading: false });
        const history = await api.restClient.history.list();
        set({ history });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
  cancelRequest: async (requestId) => {
    await api.restClient.cancelRequest(requestId);
    set({ isLoading: false });
  },

  createEnvironment: async (name, variables) => {
    const env = await api.restClient.env.create(name, variables);
    set(s => ({ environments: [...s.environments, env] }));
  },
  updateEnvironment: async (id, updates) => {
    await api.restClient.env.update(id, updates);
    set(s => ({
      environments: s.environments.map(e => e.id === id ? { ...e, ...updates } : e),
    }));
  },
  deleteEnvironment: async (id) => {
    await api.restClient.env.delete(id);
    set(s => ({
      environments: s.environments.filter(e => e.id !== id),
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId,
    }));
  },
  activateEnvironment: async (id) => {
    await api.restClient.env.activate(id);
    set({ activeEnvironmentId: id });
  },
  deactivateEnvironment: async () => {
    await api.restClient.env.deactivate();
    set({ activeEnvironmentId: null });
  },
  duplicateEnvironment: async (id) => {
    await api.restClient.env.duplicate(id);
    const environments = await api.restClient.env.list();
    set({ environments });
  },

  clearHistory: async () => {
    await api.restClient.history.clear();
    set({ history: [] });
  },
  deleteHistoryEntry: async (id) => {
    await api.restClient.history.delete(id);
    set(s => ({ history: s.history.filter(h => h.id !== id) }));
  },
  searchHistory: async (query) => {
    if (!query.trim()) {
      const history = await api.restClient.history.list();
      set({ history, historySearch: query });
    } else {
      const results = await api.restClient.history.search(query);
      set({ history: results, historySearch: query });
    }
  },

  importCollections: async (content, format) => {
    const result = await api.restClient.import.file(content, format);
    if (!result?.error) {
      const collections = await api.restClient.collection.list();
      const environments = await api.restClient.env.list();
      set({ collections, environments });
    }
  },
  importCurl: async (curl) => {
    const result = await api.restClient.import.curl(curl);
    if (!result?.error) {
      const collections = await api.restClient.collection.list();
      set({ collections });
    }
  },
  exportCollections: async (format) => {
    return await api.restClient.export({ format });
  },

  startRunner: async (collectionId, config) => {
    set({ isRunning: true, runnerResult: null, runnerProgress: null });
    try {
      const result = await api.restClient.runner.start(collectionId, config);
      set({ runnerResult: result, isRunning: false });
    } catch (err: any) {
      set({ isRunning: false, error: err.message });
    }
  },
  stopRunner: async () => {
    await api.restClient.runner.stop();
    set({ isRunning: false });
  },

  setDraftRequest: (request) => set({ draftRequest: request }),
  updateDraftField: (field, value) => {
    set(s => ({ draftRequest: { ...s.draftRequest, [field]: value } }));
  },
  saveDraft: async (collectionId, requestId) => {
    const { draftRequest } = get();
    if (!draftRequest) return;
    await get().updateRequest(collectionId, requestId, draftRequest);
    set({ draftRequest: null });
  },

  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleRunner: () => set(s => ({ showRunner: !s.showRunner })),
  setShowImportDialog: (show) => set({ showImportDialog: show }),
  setShowExportDialog: (show) => set({ showExportDialog: show }),
  setShowEnvironmentManager: (show) => set({ showEnvironmentManager: show }),
  setShowVariableViewer: (show) => set({ showVariableViewer: show }),
  setShowCurlImport: (show) => set({ showCurlImport: show }),
  setCurlInput: (input) => set({ curlInput: input }),
  setResponseBodyFormat: (format) => set({ responseBodyFormat: format }),
  setResponseWrap: (wrap) => set({ responseWrap: wrap }),
}));

// Initialize event listeners
if (api?.restClient?.events) {
  api.restClient.events.onRunnerProgress((data: any) => {
    useRestClientStore.setState({ runnerProgress: data });
  });
  api.restClient.events.onRunnerComplete((result: any) => {
    useRestClientStore.setState({ runnerResult: result, isRunning: false, runnerProgress: null });
  });
}
