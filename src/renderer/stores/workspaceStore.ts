/**
 * Workspace Store - Multi-root workspace support + session persistence.
 */
import { create } from 'zustand';

interface WorkspaceFolder {
  path: string;
  name: string;
}

interface Workspace {
  id: string;
  name: string;
  folders: WorkspaceFolder[];
  createdAt: number;
  modifiedAt: number;
}

interface WorkspaceState {
  // Current workspace
  currentWorkspace: Workspace | null;
  folders: string[]; // Multi-root folder paths

  // Recent
  recentWorkspaces: string[]; // paths to .hypoth…ion-workspace files

  // Actions
  addFolder: (path: string) => void;
  removeFolder: (path: string) => void;
  setFolders: (folders: string[]) => void;
  getActiveFolder: () => string | null;

  // Workspace management
  saveWorkspace: (name: string) => void;
  loadWorkspace: (id: string) => void;
  newWorkspace: () => void;

  // Session persistence
  saveSession: () => void;
  restoreSession: () => void;

  // Recent
  addRecentWorkspace: (path: string) => void;
  getRecentWorkspaces: () => string[];
}

const STORAGE_KEY = 'hypothesis-workspace';
const RECENT_KEY = 'hypothesis-recent-workspaces';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  folders: [],
  recentWorkspaces: [],

  addFolder: (path: string) => {
    set((state) => {
      if (state.folders.includes(path)) return state;
      const newFolders = [...state.folders, path];
      saveToStorage(STORAGE_KEY, { folders: newFolders, currentWorkspace: state.currentWorkspace });
      return { folders: newFolders };
    });
  },

  removeFolder: (path: string) => {
    set((state) => {
      const newFolders = state.folders.filter((f) => f !== path);
      saveToStorage(STORAGE_KEY, { folders: newFolders, currentWorkspace: state.currentWorkspace });
      return { folders: newFolders };
    });
  },

  setFolders: (folders: string[]) => {
    set({ folders });
    saveToStorage(STORAGE_KEY, { folders, currentWorkspace: get().currentWorkspace });
  },

  getActiveFolder: () => {
    const { folders } = get();
    return folders.length > 0 ? folders[0] : null;
  },

  saveWorkspace: (name: string) => {
    const { folders } = get();
    const workspace: Workspace = {
      id: `ws-${Date.now()}`,
      name,
      folders: folders.map((f) => ({ path: f, name: f.split(/[/\\]/).pop() || f })),
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };
    set({ currentWorkspace: workspace });
    saveToStorage(STORAGE_KEY, { folders, currentWorkspace: workspace });
    get().addRecentWorkspace(workspace.id);
  },

  loadWorkspace: (id: string) => {
    // In a real app, this would load from a .hypothesis-workspace file
    const workspaces = loadFromStorage<Workspace[]>('hypothesis-workspaces', []);
    const ws = workspaces.find((w) => w.id === id);
    if (ws) {
      set({
        currentWorkspace: ws,
        folders: ws.folders.map((f) => f.path),
      });
    }
  },

  newWorkspace: () => {
    set({ currentWorkspace: null, folders: [] });
    saveToStorage(STORAGE_KEY, { folders: [], currentWorkspace: null });
  },

  saveSession: () => {
    const { folders, currentWorkspace } = get();
    saveToStorage(STORAGE_KEY, { folders, currentWorkspace });
  },

  restoreSession: () => {
    const data = loadFromStorage<{ folders: string[]; currentWorkspace: Workspace | null }>(STORAGE_KEY, {
      folders: [],
      currentWorkspace: null,
    });
    const folders = data.folders || [];
    set({
      folders,
      currentWorkspace: data.currentWorkspace,
    });
    // Validate that restored folders still exist on disk
    if (folders.length > 0) {
      (async () => {
        const valid: string[] = [];
        for (const f of folders) {
          try {
            const exists = await window.api.file.exists(f);
            if (exists) valid.push(f);
          } catch { /* skip missing */ }
        }
        if (valid.length !== folders.length) {
          set({ folders: valid });
          saveToStorage(STORAGE_KEY, { folders: valid, currentWorkspace: data.currentWorkspace });
        }
      })();
    }
  },

  addRecentWorkspace: (path: string) => {
    set((state) => {
      const filtered = state.recentWorkspaces.filter((w) => w !== path);
      const newRecent = [path, ...filtered].slice(0, 10);
      saveToStorage(RECENT_KEY, newRecent);
      return { recentWorkspaces: newRecent };
    });
  },

  getRecentWorkspaces: () => {
    return loadFromStorage<string[]>(RECENT_KEY, []);
  },
}));
