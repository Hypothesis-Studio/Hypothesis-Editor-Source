/**
 * Database Explorer Store - Zustand state for Database Explorer feature.
 */
import { create } from 'zustand';
import type {
  DatabaseConnection,
  DatabaseConnectionConfig,
  DatabaseSchema,
  QueryResult,
  QueryHistoryEntry,
  SavedQuery,
  TableDataResult,
  TableInfo,
  ERDiagram,
  RowUpdateRequest,
  RowUpdateResult,
  FKRowGetRequest,
  FKRowGetResult,
  ExportTableRequest,
  ExportTableResult,
} from '../../shared/types/database';

interface DBState {
  // Connections
  connections: DatabaseConnection[];
  activeConnectionId: string | null;
  loadingConnections: boolean;

  // Schema
  schemas: Record<string, DatabaseSchema>;
  loadingSchema: Record<string, boolean>;
  expandedTables: Record<string, boolean>;

  // Active query tab
  queryTabs: QueryTab[];
  activeQueryTabId: string | null;

  // Table data browser
  tableDataResult: TableDataResult | null;
  tableDataLoading: boolean;
  activeTable: string | null;

  // History & saved
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];

  // ER Diagram
  erDiagram: ERDiagram | null;
  erDiagramLoading: boolean;

  // UI state
  sidebarWidth: number;
  activeView: 'query' | 'table' | 'history' | 'saved' | 'diagram';

  // Actions
  loadConnections: () => Promise<void>;
  createConnection: (config: DatabaseConnectionConfig) => Promise<DatabaseConnection>;
  updateConnection: (id: string, updates: Partial<DatabaseConnectionConfig>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
  testConnection: (config: DatabaseConnectionConfig) => Promise<{ success: boolean; error?: string; latency?: number }>;
  connect: (id: string) => Promise<{ success: boolean; error?: string }>;
  disconnect: (id: string) => Promise<void>;
  setActiveConnection: (id: string | null) => void;

  loadSchema: (connectionId: string) => Promise<void>;
  toggleTable: (tableKey: string) => void;

  openQueryTab: (connectionId: string, sql?: string, title?: string) => void;
  closeQueryTab: (tabId: string) => void;
  setActiveQueryTab: (tabId: string) => void;
  updateQueryTabSql: (tabId: string, sql: string) => void;
  executeQuery: (tabId: string) => Promise<void>;

  loadTableData: (connectionId: string, table: string, page?: number) => Promise<void>;
  setActiveTable: (table: string | null) => void;

  loadERDiagram: (connectionId: string) => Promise<void>;
  updateCell: (req: RowUpdateRequest) => Promise<RowUpdateResult>;
  lookupFKRow: (req: FKRowGetRequest) => Promise<FKRowGetResult>;
  exportTable: (req: ExportTableRequest) => Promise<ExportTableResult>;

  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;

  loadSavedQueries: () => Promise<void>;
  saveQuery: (name: string, sql: string, connectionId?: string) => Promise<void>;
  deleteSavedQuery: (id: string) => Promise<void>;

  setActiveView: (view: 'query' | 'table' | 'history' | 'saved' | 'diagram') => void;
  setSidebarWidth: (w: number) => void;

  handleConnectionStatus: (data: { id: string; isConnected: boolean; isConnecting: boolean; error?: string }) => void;
}

export interface QueryTab {
  id: string;
  title: string;
  connectionId: string;
  sql: string;
  result: QueryResult | null;
  isExecuting: boolean;
  error: string | null;
}

function genId() {
  return `qt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export const useDBStore = create<DBState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  loadingConnections: false,
  schemas: {},
  loadingSchema: {},
  expandedTables: {},
  queryTabs: [],
  activeQueryTabId: null,
  tableDataResult: null,
  tableDataLoading: false,
  activeTable: null,
  history: [],
  savedQueries: [],
  erDiagram: null,
  erDiagramLoading: false,
  sidebarWidth: 240,
  activeView: 'query',

  // ── Connections ─────────────────────────────────────────────────

  loadConnections: async () => {
    set({ loadingConnections: true });
    try {
      const api = (window as any).api;
      const conns = await api.db.connection.list();
      set({ connections: conns, loadingConnections: false });
    } catch {
      set({ loadingConnections: false });
    }
  },

  createConnection: async (config) => {
    const api = (window as any).api;
    const conn = await api.db.connection.create(config);
    set((s) => ({ connections: [...s.connections, conn] }));
    return conn;
  },

  updateConnection: async (id, updates) => {
    const api = (window as any).api;
    const updated = await api.db.connection.update(id, updates);
    if (updated) {
      set((s) => ({ connections: s.connections.map((c) => c.id === id ? updated : c) }));
    }
  },

  deleteConnection: async (id) => {
    const api = (window as any).api;
    await api.db.connection.delete(id);
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId,
    }));
  },

  testConnection: async (config) => {
    const api = (window as any).api;
    return api.db.connection.test(config);
  },

  connect: async (id) => {
    const api = (window as any).api;
    set((s) => ({
      connections: s.connections.map((c) => c.id === id ? { ...c, isConnecting: true } : c),
    }));
    const result = await api.db.connection.connect(id);
    return result;
  },

  disconnect: async (id) => {
    const api = (window as any).api;
    await api.db.connection.disconnect(id);
    set((s) => ({
      connections: s.connections.map((c) => c.id === id ? { ...c, isConnected: false, isConnecting: false } : c),
    }));
  },

  setActiveConnection: (id) => set({ activeConnectionId: id }),

  handleConnectionStatus: (data) => {
    set((s) => ({
      connections: s.connections.map((c) =>
        c.id === data.id
          ? { ...c, isConnected: data.isConnected, isConnecting: data.isConnecting, error: data.error }
          : c
      ),
    }));
  },

  // ── Schema ───────────────────────────────────────────────────────

  loadSchema: async (connectionId) => {
    set((s) => ({ loadingSchema: { ...s.loadingSchema, [connectionId]: true } }));
    try {
      const api = (window as any).api;
      const schema = await api.db.schema.get(connectionId);
      if (!schema.error) {
        set((s) => ({
          schemas: { ...s.schemas, [connectionId]: schema },
          loadingSchema: { ...s.loadingSchema, [connectionId]: false },
        }));
      } else {
        set((s) => ({ loadingSchema: { ...s.loadingSchema, [connectionId]: false } }));
      }
    } catch {
      set((s) => ({ loadingSchema: { ...s.loadingSchema, [connectionId]: false } }));
    }
  },

  toggleTable: (tableKey) => {
    set((s) => ({ expandedTables: { ...s.expandedTables, [tableKey]: !s.expandedTables[tableKey] } }));
  },

  // ── Query Tabs ───────────────────────────────────────────────────

  openQueryTab: (connectionId, sql = '', title) => {
    const id = genId();
    const conn = get().connections.find((c) => c.id === connectionId);
    const tab: QueryTab = {
      id,
      title: title || `Query (${conn?.name || connectionId})`,
      connectionId,
      sql,
      result: null,
      isExecuting: false,
      error: null,
    };
    set((s) => ({ queryTabs: [...s.queryTabs, tab], activeQueryTabId: id, activeView: 'query' }));
  },

  closeQueryTab: (tabId) => {
    set((s) => {
      const tabs = s.queryTabs.filter((t) => t.id !== tabId);
      const activeId = s.activeQueryTabId === tabId
        ? (tabs.length > 0 ? tabs[tabs.length - 1].id : null)
        : s.activeQueryTabId;
      return { queryTabs: tabs, activeQueryTabId: activeId };
    });
  },

  setActiveQueryTab: (tabId) => set({ activeQueryTabId: tabId }),

  updateQueryTabSql: (tabId, sql) => {
    set((s) => ({
      queryTabs: s.queryTabs.map((t) => t.id === tabId ? { ...t, sql } : t),
    }));
  },

  executeQuery: async (tabId) => {
    const tab = get().queryTabs.find((t) => t.id === tabId);
    if (!tab || !tab.sql.trim()) return;

    set((s) => ({
      queryTabs: s.queryTabs.map((t) => t.id === tabId ? { ...t, isExecuting: true, error: null } : t),
    }));

    try {
      const api = (window as any).api;
      const result = await api.db.query.execute({ connectionId: tab.connectionId, sql: tab.sql });
      set((s) => ({
        queryTabs: s.queryTabs.map((t) =>
          t.id === tabId ? { ...t, isExecuting: false, result, error: result.error || null } : t
        ),
      }));
    } catch (err: any) {
      set((s) => ({
        queryTabs: s.queryTabs.map((t) =>
          t.id === tabId ? { ...t, isExecuting: false, error: err.message } : t
        ),
      }));
    } finally {
      // Refresh history so the History tab stays in sync
      try {
        const api = (window as any).api;
        const history = await api.db.history.list();
        set({ history });
      } catch { /* ignore */ }
    }
  },

  // ── Table Data ───────────────────────────────────────────────────

  loadTableData: async (connectionId, table, page = 1) => {
    set({ tableDataLoading: true, activeTable: table, activeView: 'table' });
    try {
      const api = (window as any).api;
      const result = await api.db.table.data({ connectionId, table, page, pageSize: 100 });
      set({ tableDataResult: result, tableDataLoading: false });
    } catch {
      set({ tableDataLoading: false });
    }
  },

  setActiveTable: (table) => set({ activeTable: table }),

  updateCell: async (req) => {
    const api = (window as any).api;
    return api.db.row.update(req);
  },

  lookupFKRow: async (req) => {
    const api = (window as any).api;
    return api.db.fk.getRow(req);
  },

  exportTable: async (req) => {
    const api = (window as any).api;
    return api.db.table.export(req);
  },

  loadERDiagram: async (connectionId: string) => {
    set({ erDiagramLoading: true, activeView: 'diagram' });
    try {
      const api = (window as any).api;
      const result = await api.db.erDiagram.get(connectionId);
      if (result && !result.error) {
        set({ erDiagram: result, erDiagramLoading: false });
      } else {
        set({ erDiagramLoading: false });
      }
    } catch {
      set({ erDiagramLoading: false });
    }
  },

  // ── History ──────────────────────────────────────────────────────

  loadHistory: async () => {
    const api = (window as any).api;
    const history = await api.db.history.list();
    set({ history });
  },

  clearHistory: async () => {
    const api = (window as any).api;
    await api.db.history.clear();
    set({ history: [] });
  },

  // ── Saved Queries ────────────────────────────────────────────────

  loadSavedQueries: async () => {
    const api = (window as any).api;
    const savedQueries = await api.db.savedQuery.list();
    set({ savedQueries });
  },

  saveQuery: async (name, sql, connectionId) => {
    const api = (window as any).api;
    const q = await api.db.savedQuery.create({ name, sql, connectionId, tags: [] });
    set((s) => ({ savedQueries: [...s.savedQueries, q] }));
  },

  deleteSavedQuery: async (id) => {
    const api = (window as any).api;
    await api.db.savedQuery.delete(id);
    set((s) => ({ savedQueries: s.savedQueries.filter((q) => q.id !== id) }));
  },

  // ── UI ───────────────────────────────────────────────────────────

  setActiveView: (view) => set({ activeView: view }),
  setSidebarWidth: (w) => set({ sidebarWidth: w }),
}));
