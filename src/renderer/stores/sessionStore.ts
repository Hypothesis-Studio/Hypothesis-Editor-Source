/**
 * Session Store - Persists workspace state (open folder, tabs, sidebar, panel) for session restore.
 */
import { create } from 'zustand';

interface SessionState {
  rootPath: string | null;
  sidebarVisible: boolean;
  activeSidebarView: string;
  sidebarWidth: number;
  panelVisible: boolean;
  activePanel: string;
  panelHeight: number;
}

const STORAGE_KEY = 'hypothesis-session';

const DEFAULT_SESSION: SessionState = {
  rootPath: null,
  sidebarVisible: true,
  activeSidebarView: 'explorer',
  sidebarWidth: 260,
  panelVisible: false,
  activePanel: 'terminal',
  panelHeight: 250,
};

function loadSession(): SessionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SESSION, ...parsed };
    }
  } catch {}
  return DEFAULT_SESSION;
}

function saveSession(state: Partial<SessionState>) {
  try {
    const current = loadSession();
    const merged = { ...current, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

export const useSessionStore = create<SessionState & {
  setRootPath: (path: string | null) => void;
  setSidebarVisible: (v: boolean) => void;
  setActiveSidebarView: (v: string) => void;
  setSidebarWidth: (w: number) => void;
  setPanelVisible: (v: boolean) => void;
  setActivePanel: (v: string) => void;
  setPanelHeight: (h: number) => void;
  restoreSession: () => SessionState;
}>((set, get) => ({
  ...loadSession(),

  setRootPath: (path) => { set({ rootPath: path }); saveSession({ rootPath: path }); },
  setSidebarVisible: (v) => { set({ sidebarVisible: v }); saveSession({ sidebarVisible: v }); },
  setActiveSidebarView: (v) => { set({ activeSidebarView: v }); saveSession({ activeSidebarView: v }); },
  setSidebarWidth: (w) => { set({ sidebarWidth: w }); saveSession({ sidebarWidth: w }); },
  setPanelVisible: (v) => { set({ panelVisible: v }); saveSession({ panelVisible: v }); },
  setActivePanel: (v) => { set({ activePanel: v }); saveSession({ activePanel: v }); },
  setPanelHeight: (h) => { set({ panelHeight: h }); saveSession({ panelHeight: h }); },

  restoreSession: () => {
    const session = loadSession();
    set(session);
    return session;
  },
}));
