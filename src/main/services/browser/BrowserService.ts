/**
 * Hypothesis Browser - Main Process Service
 * Manages browser sessions, history, bookmarks, downloads via Electron session API.
 */
import { session, shell, app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import type {
  BrowserTab, BrowserHistoryEntry, BrowserBookmark, BrowserBookmarkFolder,
  BrowserDownload, BrowserSettings, BrowserSearchResult, ProxySettings,
} from '../../../shared/types/browser';
import { BROWSER_IPC } from '../../../shared/types/browser';

/** Strip non-serializable fields (e.g. _item DownloadItem) before sending over IPC */
function serializeDl(dl: BrowserDownload): BrowserDownload {
  const { ...plain } = dl as any;
  delete plain._item;
  return plain as BrowserDownload;
}

const DATA_DIR = path.join(app.getPath('userData'), 'browser');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const BOOKMARKS_FILE = path.join(DATA_DIR, 'bookmarks.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const DOWNLOADS_FILE = path.join(DATA_DIR, 'downloads.json');
const TABS_FILE = path.join(DATA_DIR, 'tabs.json');

const DEFAULT_SETTINGS: BrowserSettings = {
  homepage: 'https://www.google.com',
  searchEngine: 'google',
  newTabPage: 'default',
  enableJavaScript: true,
  enableImages: true,
  blockAds: false,
  enableDevTools: true,
  defaultZoom: 0,
  downloadPath: app.getPath('downloads'),
  askDownloadLocation: false,
  enableSpellCheck: true,
  userAgent: null,
  proxySettings: null,
};

const SEARCH_ENGINES: Record<string, string> = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
  brave: 'https://search.brave.com/search?q=',
  ecosia: 'https://www.ecosia.org/search?q=',
};

function nanoid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch { /* ignore */ }
  return fallback;
}

function writeJson(file: string, data: unknown): void {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'file:';
  } catch { return false; }
}

function resolveUrl(input: string, settings: BrowserSettings): string {
  const trimmed = input.trim();
  if (!trimmed) return settings.homepage;
  if (isValidUrl(trimmed)) return trimmed;
  // Domain-like (has dot, no spaces)
  if (!trimmed.includes(' ') && trimmed.includes('.') && !trimmed.startsWith('/')) {
    return `https://${trimmed}`;
  }
  // Search
  const engine = SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google;
  return engine + encodeURIComponent(trimmed);
}

export class BrowserService extends EventEmitter {
  private tabs: Map<string, BrowserTab> = new Map();
  private history: BrowserHistoryEntry[] = [];
  private bookmarks: BrowserBookmark[] = [];
  private bookmarkFolders: BrowserBookmarkFolder[] = [];
  private downloads: Map<string, BrowserDownload> = new Map();
  private settings: BrowserSettings = { ...DEFAULT_SETTINGS };
  private activeTabId: string | null = null;
  private getWindow: () => BrowserWindow | null;

  constructor(getWindow: () => BrowserWindow | null) {
    super();
    this.getWindow = getWindow;
    this.load();
    this.setupDownloadHandler();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private load(): void {
    this.history = readJson<BrowserHistoryEntry[]>(HISTORY_FILE, []);
    const bm = readJson<{ bookmarks: BrowserBookmark[]; folders: BrowserBookmarkFolder[] }>(
      BOOKMARKS_FILE, { bookmarks: [], folders: [] }
    );
    this.bookmarks = bm.bookmarks;
    this.bookmarkFolders = bm.folders;
    this.settings = { ...DEFAULT_SETTINGS, ...readJson<Partial<BrowserSettings>>(SETTINGS_FILE, {}) };
    // Restore completed downloads list (not in-progress)
    const saved = readJson<BrowserDownload[]>(DOWNLOADS_FILE, []);
    for (const d of saved.filter(x => x.state === 'completed' || x.state === 'cancelled')) {
      this.downloads.set(d.id, d);
    }
    // Restore tabs from last session
    const savedTabs = readJson<{ tabs: BrowserTab[]; activeTabId: string | null }>(TABS_FILE, { tabs: [], activeTabId: null });
    for (const t of savedTabs.tabs) {
      // Reset transient loading state on restore
      this.tabs.set(t.id, { ...t, isLoading: false, canGoBack: false, canGoForward: false });
    }
    if (savedTabs.activeTabId && this.tabs.has(savedTabs.activeTabId)) {
      this.activeTabId = savedTabs.activeTabId;
    } else if (this.tabs.size > 0) {
      this.activeTabId = Array.from(this.tabs.keys()).at(-1) ?? null;
    }
  }

  private saveHistory(): void { writeJson(HISTORY_FILE, this.history.slice(0, 10000)); }
  private saveBookmarks(): void { writeJson(BOOKMARKS_FILE, { bookmarks: this.bookmarks, folders: this.bookmarkFolders }); }
  private saveSettings(): void { writeJson(SETTINGS_FILE, this.settings); }
  private saveTabs(): void {
    writeJson(TABS_FILE, {
      tabs: Array.from(this.tabs.values()),
      activeTabId: this.activeTabId,
    });
  }
  private saveDownloads(): void {
    writeJson(DOWNLOADS_FILE, Array.from(this.downloads.values()).filter(d => d.state === 'completed' || d.state === 'cancelled').slice(0, 500));
  }

  // ── Tab Management ────────────────────────────────────────────────────────

  createTab(url?: string): BrowserTab {
    const id = nanoid();
    const resolvedUrl = url ? resolveUrl(url, this.settings) : this.settings.homepage;
    const tab: BrowserTab = {
      id,
      url: resolvedUrl,
      title: 'New Tab',
      favicon: null,
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      isAudioMuting: false,
      zoomLevel: this.settings.defaultZoom,
      isPinned: false,
      createdAt: Date.now(),
    };
    this.tabs.set(id, tab);
    this.activeTabId = id;
    this.saveTabs();
    return tab;
  }

  closeTab(id: string): { nextActiveId: string | null } {
    this.tabs.delete(id);
    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.keys());
      this.activeTabId = remaining[remaining.length - 1] ?? null;
    }
    this.saveTabs();
    return { nextActiveId: this.activeTabId };
  }

  getTabs(): BrowserTab[] { return Array.from(this.tabs.values()); }

  getTab(id: string): BrowserTab | null { return this.tabs.get(id) ?? null; }

  getActiveTabId(): string | null { return this.activeTabId; }

  activateTab(id: string): void {
    if (this.tabs.has(id)) {
      this.activeTabId = id;
      this.saveTabs();
    }
  }

  updateTab(id: string, updates: Partial<BrowserTab>): BrowserTab | null {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    Object.assign(tab, updates);
    this.tabs.set(id, tab);
    // Save tabs when url/title/favicon changes (persistent fields)
    if ('url' in updates || 'title' in updates || 'favicon' in updates || 'isPinned' in updates) {
      this.saveTabs();
    }
    return tab;
  }

  resolveUrl(input: string): string { return resolveUrl(input, this.settings); }

  // ── History ───────────────────────────────────────────────────────────────

  addHistory(url: string, title: string, favicon: string | null): void {
    if (!url || url === 'about:blank') return;
    const existing = this.history.find(h => h.url === url);
    if (existing) {
      existing.visitCount++;
      existing.visitedAt = Date.now();
      existing.title = title || existing.title;
      if (favicon) existing.favicon = favicon;
    } else {
      this.history.unshift({ id: nanoid(), url, title: title || url, favicon, visitedAt: Date.now(), visitCount: 1 });
    }
    this.saveHistory();
  }

  getHistory(limit = 500): BrowserHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  searchHistory(query: string): BrowserHistoryEntry[] {
    const q = query.toLowerCase();
    return this.history.filter(h => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q)).slice(0, 50);
  }

  deleteHistory(id: string): void {
    this.history = this.history.filter(h => h.id !== id);
    this.saveHistory();
  }

  clearHistory(): void { this.history = []; this.saveHistory(); }

  // ── Bookmarks ─────────────────────────────────────────────────────────────

  getBookmarks(): { bookmarks: BrowserBookmark[]; folders: BrowserBookmarkFolder[] } {
    return { bookmarks: this.bookmarks, folders: this.bookmarkFolders };
  }

  addBookmark(url: string, title: string, favicon: string | null, folderId: string | null = null): BrowserBookmark {
    const bm: BrowserBookmark = { id: nanoid(), url, title, favicon, folderId, createdAt: Date.now(), tags: [] };
    this.bookmarks.unshift(bm);
    this.saveBookmarks();
    return bm;
  }

  updateBookmark(id: string, updates: Partial<BrowserBookmark>): BrowserBookmark | null {
    const bm = this.bookmarks.find(b => b.id === id);
    if (!bm) return null;
    Object.assign(bm, updates);
    this.saveBookmarks();
    return bm;
  }

  deleteBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter(b => b.id !== id);
    this.saveBookmarks();
  }

  isBookmarked(url: string): BrowserBookmark | null {
    return this.bookmarks.find(b => b.url === url) ?? null;
  }

  createFolder(name: string, parentId: string | null = null): BrowserBookmarkFolder {
    const folder: BrowserBookmarkFolder = { id: nanoid(), name, parentId, createdAt: Date.now() };
    this.bookmarkFolders.push(folder);
    this.saveBookmarks();
    return folder;
  }

  deleteFolder(id: string): void {
    this.bookmarkFolders = this.bookmarkFolders.filter(f => f.id !== id);
    this.bookmarks = this.bookmarks.filter(b => b.folderId !== id);
    this.saveBookmarks();
  }

  // ── Downloads ─────────────────────────────────────────────────────────────

  private setupDownloadHandler(): void {
    const sess = session.defaultSession;
    sess.on('will-download', (_event, item) => {
      const id = nanoid();
      const savePath = path.join(this.settings.downloadPath, item.getFilename());
      if (!this.settings.askDownloadLocation) item.setSavePath(savePath);

      const dl: BrowserDownload = {
        id, url: item.getURL(), filename: item.getFilename(),
        savePath, mimeType: item.getMimeType(),
        totalBytes: item.getTotalBytes(), receivedBytes: 0,
        state: 'progressing', startedAt: Date.now(), completedAt: null,
        speed: 0, paused: false,
      };
      this.downloads.set(id, dl);
      this.emit('download-update', dl);
      this.sendToRenderer(BROWSER_IPC.EVT_DOWNLOAD_PROGRESS, serializeDl(dl));

      let lastBytes = 0;
      let lastTime = Date.now();

      item.on('updated', (_e, state) => {
        const now = Date.now();
        const received = item.getReceivedBytes();
        const elapsed = (now - lastTime) / 1000;
        const speed = elapsed > 0 ? (received - lastBytes) / elapsed : 0;
        lastBytes = received; lastTime = now;
        Object.assign(dl, {
          receivedBytes: received, totalBytes: item.getTotalBytes(),
          state: state === 'interrupted' ? 'interrupted' : 'progressing',
          paused: item.isPaused(), speed,
        });
        this.downloads.set(id, dl);
        this.sendToRenderer(BROWSER_IPC.EVT_DOWNLOAD_PROGRESS, serializeDl(dl));
      });

      item.once('done', (_e, state) => {
        Object.assign(dl, {
          state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted',
          completedAt: Date.now(), receivedBytes: item.getReceivedBytes(), speed: 0,
        });
        this.downloads.set(id, dl);
        this.saveDownloads();
        this.sendToRenderer(BROWSER_IPC.EVT_DOWNLOAD_PROGRESS, serializeDl(dl));
      });

      // Store item reference for pause/resume/cancel (not sent over IPC)
      (dl as any)._item = item;
    });
  }

  getDownloads(): BrowserDownload[] {
    return Array.from(this.downloads.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(serializeDl);
  }

  pauseDownload(id: string): void { (this.downloads.get(id) as any)?._item?.pause(); }
  resumeDownload(id: string): void { (this.downloads.get(id) as any)?._item?.resume(); }
  cancelDownload(id: string): void { (this.downloads.get(id) as any)?._item?.cancel(); }

  clearDownloads(): void {
    for (const [id, dl] of this.downloads) {
      if (dl.state === 'completed' || dl.state === 'cancelled' || dl.state === 'interrupted') {
        this.downloads.delete(id);
      }
    }
    this.saveDownloads();
  }

  showDownloadInFolder(id: string): void {
    const dl = this.downloads.get(id);
    if (dl?.savePath) shell.showItemInFolder(dl.savePath);
  }

  // ── Search Suggestions ────────────────────────────────────────────────────

  async getSearchSuggestions(query: string): Promise<BrowserSearchResult[]> {
    const results: BrowserSearchResult[] = [];

    // History matches
    const histMatches = this.searchHistory(query).slice(0, 4);
    for (const h of histMatches) {
      results.push({ url: h.url, title: h.title, favicon: h.favicon, type: 'history' });
    }

    // Bookmark matches
    const bmMatches = this.bookmarks
      .filter(b => b.url.toLowerCase().includes(query.toLowerCase()) || b.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3);
    for (const b of bmMatches) {
      results.push({ url: b.url, title: b.title, favicon: b.favicon, type: 'bookmark' });
    }

    // If looks like URL
    if (!query.includes(' ') && query.includes('.')) {
      const guessed = query.startsWith('http') ? query : `https://${query}`;
      if (!results.find(r => r.url === guessed)) {
        results.push({ url: guessed, title: guessed, favicon: null, type: 'url' });
      }
    }

    return results.slice(0, 8);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  getSettings(): BrowserSettings { return { ...this.settings }; }

  updateSettings(updates: Partial<BrowserSettings>): BrowserSettings {
    Object.assign(this.settings, updates);
    this.saveSettings();
    this.applySettings();
    return { ...this.settings };
  }

  private applySettings(): void {
    const sess = session.defaultSession;
    if (this.settings.proxySettings) {
      const p = this.settings.proxySettings;
      if (p.mode === 'direct') sess.setProxy({ mode: 'direct' });
      else if (p.mode === 'pac' && p.pacScript) sess.setProxy({ pacScript: p.pacScript });
      else if (p.mode === 'manual') {
        sess.setProxy({
          proxyRules: [p.httpProxy, p.httpsProxy].filter(Boolean).join(';'),
          proxyBypassRules: p.bypassList,
        });
      }
    }
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  async clearBrowsingData(options: { history?: boolean; cache?: boolean; cookies?: boolean; localStorage?: boolean }): Promise<void> {
    const sess = session.defaultSession;
    const storages: string[] = [];
    if (options.localStorage) storages.push('localstorage', 'indexdb', 'websql', 'serviceworkers', 'cachestorage');
    if (options.cookies) storages.push('cookies');
    if (storages.length > 0) {
      await sess.clearStorageData({ storages: storages as any });
    }
    if (options.cache) await sess.clearCache();
    if (options.history) this.clearHistory();
  }

  private sendToRenderer(channel: string, data: unknown): void {
    const win = this.getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  }

  dispose(): void { this.removeAllListeners(); }
}
