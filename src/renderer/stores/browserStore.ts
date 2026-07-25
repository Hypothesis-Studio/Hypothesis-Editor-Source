/**
 * Hypothesis Browser - Renderer Store (Zustand)
 */
import { create } from 'zustand';
import type {
  BrowserTab, BrowserHistoryEntry, BrowserBookmark, BrowserBookmarkFolder,
  BrowserDownload, BrowserSettings, BrowserSearchResult,
} from '../../shared/types/browser';
import { BROWSER_IPC } from '../../shared/types/browser';

interface BrowserStore {
  // Tabs
  tabs: BrowserTab[];
  activeTabId: string | null;

  // UI state
  sidebarView: 'history' | 'bookmarks' | 'downloads' | null;
  isAddressBarFocused: boolean;
  addressBarValue: string;
  findBarVisible: boolean;
  findQuery: string;
  findResults: { activeMatchOrdinal: number; matches: number } | null;

  // Data
  history: BrowserHistoryEntry[];
  bookmarks: BrowserBookmark[];
  bookmarkFolders: BrowserBookmarkFolder[];
  downloads: BrowserDownload[];
  settings: BrowserSettings | null;
  searchSuggestions: BrowserSearchResult[];

  // Actions
  init: () => Promise<void>;
  createTab: (url?: string) => Promise<void>;
  closeTab: (id: string) => Promise<void>;
  activateTab: (id: string) => void;
  navigate: (tabId: string, url: string) => Promise<string>;
  updateTab: (id: string, updates: Partial<BrowserTab>) => void;

  loadHistory: () => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  addHistory: (url: string, title: string, favicon: string | null) => Promise<void>;

  loadBookmarks: () => Promise<void>;
  addBookmark: (url: string, title: string, favicon: string | null, folderId?: string | null) => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  updateBookmark: (id: string, updates: Partial<BrowserBookmark>) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  isBookmarked: (url: string) => BrowserBookmark | null;

  loadDownloads: () => Promise<void>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  clearDownloads: () => Promise<void>;
  showDownloadInFolder: (id: string) => Promise<void>;

  getSearchSuggestions: (query: string) => Promise<void>;
  clearSuggestions: () => void;

  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<BrowserSettings>) => Promise<void>;

  setSidebarView: (view: 'history' | 'bookmarks' | 'downloads' | null) => void;
  setAddressBarFocused: (v: boolean) => void;
  setAddressBarValue: (v: string) => void;
  setFindBarVisible: (v: boolean) => void;
  setFindQuery: (v: string) => void;
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  sidebarView: null,
  isAddressBarFocused: false,
  addressBarValue: '',
  findBarVisible: false,
  findQuery: '',
  findResults: null,
  history: [],
  bookmarks: [],
  bookmarkFolders: [],
  downloads: [],
  settings: null,
  searchSuggestions: [],

  init: async () => {
    const api = (window as any).api?.browser;
    if (!api) return;

    // Load settings first
    const settings = await api.settings.get();
    set({ settings });

    // Create initial tab if none
    const tabs = await api.tabs.list();
    if (tabs.length === 0) {
      const tab = await api.tabs.create();
      set({ tabs: [tab], activeTabId: tab.id });
    } else {
      set({ tabs, activeTabId: tabs[tabs.length - 1].id });
    }

    // Subscribe to download progress events
    const { ipcRenderer } = (window as any).electron ?? {};
    if (ipcRenderer) {
      ipcRenderer.on(BROWSER_IPC.EVT_DOWNLOAD_PROGRESS, (_e: any, dl: BrowserDownload) => {
        set(state => ({
          downloads: state.downloads.some(d => d.id === dl.id)
            ? state.downloads.map(d => d.id === dl.id ? dl : d)
            : [dl, ...state.downloads],
        }));
      });
    }
  },

  createTab: async (url) => {
    const tab = await (window as any).api.browser.tabs.create(url);
    set(state => ({ tabs: [...state.tabs, tab], activeTabId: tab.id, addressBarValue: tab.url }));
  },

  closeTab: async (id) => {
    const result = await (window as any).api.browser.tabs.close(id);
    set(state => ({
      tabs: state.tabs.filter(t => t.id !== id),
      activeTabId: result.nextActiveId ?? state.activeTabId,
    }));
  },

  activateTab: (id) => {
    const tab = get().tabs.find(t => t.id === id);
    (window as any).api.browser.tabs.activate(id);
    set({ activeTabId: id, addressBarValue: tab?.url ?? '' });
  },

  navigate: async (tabId, url) => {
    const resolved = await (window as any).api.browser.nav.loadUrl(tabId, url);
    set(state => ({
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, url: resolved, isLoading: true, title: 'Loading...' } : t),
      addressBarValue: resolved,
    }));
    return resolved;
  },

  updateTab: (id, updates) => {
    set(state => ({ tabs: state.tabs.map(t => t.id === id ? { ...t, ...updates } : t) }));
    (window as any).api.browser.tabs.update(id, updates);
  },

  loadHistory: async () => {
    const history = await (window as any).api.browser.history.list();
    set({ history });
  },
  deleteHistory: async (id) => {
    await (window as any).api.browser.history.delete(id);
    set(state => ({ history: state.history.filter(h => h.id !== id) }));
  },
  clearHistory: async () => {
    await (window as any).api.browser.history.clear();
    set({ history: [] });
  },
  addHistory: async (url, title, favicon) => {
    await (window as any).api.browser.history.add(url, title, favicon);
  },

  loadBookmarks: async () => {
    const { bookmarks, folders } = await (window as any).api.browser.bookmarks.list();
    set({ bookmarks, bookmarkFolders: folders });
  },
  addBookmark: async (url, title, favicon, folderId = null) => {
    const bm = await (window as any).api.browser.bookmarks.add(url, title, favicon, folderId);
    set(state => ({ bookmarks: [bm, ...state.bookmarks] }));
  },
  deleteBookmark: async (id) => {
    await (window as any).api.browser.bookmarks.delete(id);
    set(state => ({ bookmarks: state.bookmarks.filter(b => b.id !== id) }));
  },
  updateBookmark: async (id, updates) => {
    await (window as any).api.browser.bookmarks.update(id, updates);
    set(state => ({ bookmarks: state.bookmarks.map(b => b.id === id ? { ...b, ...updates } : b) }));
  },
  createFolder: async (name, parentId = null) => {
    const folder = await (window as any).api.browser.bookmarks.createFolder(name, parentId);
    set(state => ({ bookmarkFolders: [...state.bookmarkFolders, folder] }));
  },
  deleteFolder: async (id) => {
    await (window as any).api.browser.bookmarks.deleteFolder(id);
    set(state => ({
      bookmarkFolders: state.bookmarkFolders.filter(f => f.id !== id),
      bookmarks: state.bookmarks.filter(b => b.folderId !== id),
    }));
  },
  isBookmarked: (url) => get().bookmarks.find(b => b.url === url) ?? null,

  loadDownloads: async () => {
    const downloads = await (window as any).api.browser.downloads.list();
    set({ downloads });
  },
  pauseDownload: async (id) => { await (window as any).api.browser.downloads.pause(id); },
  resumeDownload: async (id) => { await (window as any).api.browser.downloads.resume(id); },
  cancelDownload: async (id) => { await (window as any).api.browser.downloads.cancel(id); },
  clearDownloads: async () => {
    await (window as any).api.browser.downloads.clear();
    set(state => ({ downloads: state.downloads.filter(d => d.state === 'progressing') }));
  },
  showDownloadInFolder: async (id) => { await (window as any).api.browser.downloads.show(id); },

  getSearchSuggestions: async (query) => {
    if (!query.trim()) { set({ searchSuggestions: [] }); return; }
    const suggestions = await (window as any).api.browser.search.suggest(query);
    set({ searchSuggestions: suggestions });
  },
  clearSuggestions: () => set({ searchSuggestions: [] }),

  loadSettings: async () => {
    const settings = await (window as any).api.browser.settings.get();
    set({ settings });
  },
  updateSettings: async (updates) => {
    const settings = await (window as any).api.browser.settings.set(updates);
    set({ settings });
  },

  setSidebarView: (view) => set(state => ({ sidebarView: state.sidebarView === view ? null : view })),
  setAddressBarFocused: (v) => set({ isAddressBarFocused: v }),
  setAddressBarValue: (v) => set({ addressBarValue: v }),
  setFindBarVisible: (v) => set({ findBarVisible: v }),
  setFindQuery: (v) => set({ findQuery: v }),
}));
