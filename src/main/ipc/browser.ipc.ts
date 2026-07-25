/**
 * Hypothesis Browser - IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { BrowserService } from '../services/browser/BrowserService';
import { BROWSER_IPC } from '../../shared/types/browser';
import type { BrowserSettings, BrowserBookmark, BrowserBookmarkFolder } from '../../shared/types/browser';

export function registerBrowserIPC(browserService: BrowserService, _getWindow: () => BrowserWindow | null): void {
  // ── Tab Management ────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.TAB_CREATE, (_e, url?: string) => browserService.createTab(url));
  ipcMain.handle(BROWSER_IPC.TAB_CLOSE, (_e, id: string) => browserService.closeTab(id));
  ipcMain.handle(BROWSER_IPC.TAB_LIST, () => browserService.getTabs());
  ipcMain.handle(BROWSER_IPC.TAB_ACTIVATE, (_e, id: string) => { browserService.activateTab(id); return true; });
  ipcMain.handle(BROWSER_IPC.TAB_UPDATE, (_e, id: string, updates: any) => browserService.updateTab(id, updates));

  // ── Navigation ────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.NAV_LOAD_URL, (_e, tabId: string, url: string) => {
    const resolved = browserService.resolveUrl(url);
    browserService.updateTab(tabId, { url: resolved, isLoading: true });
    return resolved;
  });

  // ── History ───────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.HISTORY_LIST, (_e, limit?: number) => browserService.getHistory(limit));
  ipcMain.handle(BROWSER_IPC.HISTORY_SEARCH, (_e, query: string) => browserService.searchHistory(query));
  ipcMain.handle(BROWSER_IPC.HISTORY_DELETE, (_e, id: string) => { browserService.deleteHistory(id); return true; });
  ipcMain.handle(BROWSER_IPC.HISTORY_CLEAR, () => { browserService.clearHistory(); return true; });
  ipcMain.handle(BROWSER_IPC.HISTORY_ADD, (_e, url: string, title: string, favicon: string | null) => {
    browserService.addHistory(url, title, favicon);
    return true;
  });

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.BOOKMARK_LIST, () => browserService.getBookmarks());
  ipcMain.handle(BROWSER_IPC.BOOKMARK_ADD, (_e, url: string, title: string, favicon: string | null, folderId: string | null) =>
    browserService.addBookmark(url, title, favicon, folderId));
  ipcMain.handle(BROWSER_IPC.BOOKMARK_UPDATE, (_e, id: string, updates: Partial<BrowserBookmark>) =>
    browserService.updateBookmark(id, updates));
  ipcMain.handle(BROWSER_IPC.BOOKMARK_DELETE, (_e, id: string) => { browserService.deleteBookmark(id); return true; });
  ipcMain.handle(BROWSER_IPC.BOOKMARK_FOLDER_CREATE, (_e, name: string, parentId: string | null) =>
    browserService.createFolder(name, parentId));
  ipcMain.handle(BROWSER_IPC.BOOKMARK_FOLDER_DELETE, (_e, id: string) => { browserService.deleteFolder(id); return true; });

  // ── Downloads ─────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_LIST, () => browserService.getDownloads());
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_PAUSE, (_e, id: string) => { browserService.pauseDownload(id); return true; });
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_RESUME, (_e, id: string) => { browserService.resumeDownload(id); return true; });
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_CANCEL, (_e, id: string) => { browserService.cancelDownload(id); return true; });
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_CLEAR, () => { browserService.clearDownloads(); return true; });
  ipcMain.handle(BROWSER_IPC.DOWNLOAD_SHOW, (_e, id: string) => { browserService.showDownloadInFolder(id); return true; });

  // ── Search Suggestions ────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.SEARCH_SUGGEST, async (_e, query: string) => browserService.getSearchSuggestions(query));

  // ── Settings ──────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.SETTINGS_GET, () => browserService.getSettings());
  ipcMain.handle(BROWSER_IPC.SETTINGS_SET, (_e, updates: Partial<BrowserSettings>) => browserService.updateSettings(updates));

  // ── Utility ───────────────────────────────────────────────────────────────
  ipcMain.handle(BROWSER_IPC.OPEN_EXTERNAL, (_e, url: string) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return true;
  });
  ipcMain.handle(BROWSER_IPC.CLEAR_DATA, async (_e, options: any) => {
    await browserService.clearBrowsingData(options);
    return true;
  });
}
