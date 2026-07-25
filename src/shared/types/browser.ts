/**
 * Hypothesis Browser - Shared Type Definitions
 */

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isAudioMuting: boolean;
  zoomLevel: number; // 0 = 100%, 1 = 110%, -1 = 90%
  isPinned: boolean;
  createdAt: number;
}

export interface BrowserHistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  visitedAt: number;
  visitCount: number;
}

export interface BrowserBookmark {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  folderId: string | null;
  createdAt: number;
  tags: string[];
}

export interface BrowserBookmarkFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface BrowserDownload {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  mimeType: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  startedAt: number;
  completedAt: number | null;
  speed: number; // bytes/sec
  paused: boolean;
}

export interface BrowserSearchResult {
  url: string;
  title: string;
  favicon: string | null;
  type: 'history' | 'bookmark' | 'suggestion' | 'url';
}

export interface BrowserPermissionRequest {
  tabId: string;
  permission: 'geolocation' | 'notifications' | 'camera' | 'microphone' | 'fullscreen' | 'pointerLock' | 'openExternal';
  origin: string;
}

export interface BrowserCertificateError {
  tabId: string;
  url: string;
  error: string;
  certificate: {
    issuerName: string;
    subjectName: string;
    validStart: number;
    validExpiry: number;
  };
}

export interface BrowserFindResult {
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

export interface BrowserPageInfo {
  url: string;
  title: string;
  isSecure: boolean;
  certIssuer: string | null;
  responseCode: number | null;
}

export interface BrowserSettings {
  homepage: string;
  searchEngine: 'google' | 'duckduckgo' | 'bing' | 'brave' | 'ecosia';
  newTabPage: 'default' | 'blank' | 'homepage';
  enableJavaScript: boolean;
  enableImages: boolean;
  blockAds: boolean;
  enableDevTools: boolean;
  defaultZoom: number;
  downloadPath: string;
  askDownloadLocation: boolean;
  enableSpellCheck: boolean;
  userAgent: string | null;
  proxySettings: ProxySettings | null;
}

export interface ProxySettings {
  mode: 'direct' | 'pac' | 'manual';
  pacScript?: string;
  httpProxy?: string;
  httpsProxy?: string;
  bypassList?: string;
}

// IPC channel constants
export const BROWSER_IPC = {
  // Tab management
  TAB_CREATE: 'browser:tab:create',
  TAB_CLOSE: 'browser:tab:close',
  TAB_LIST: 'browser:tab:list',
  TAB_ACTIVATE: 'browser:tab:activate',
  TAB_UPDATE: 'browser:tab:update',

  // Navigation
  NAV_LOAD_URL: 'browser:nav:load-url',
  NAV_GO_BACK: 'browser:nav:go-back',
  NAV_GO_FORWARD: 'browser:nav:go-forward',
  NAV_RELOAD: 'browser:nav:reload',
  NAV_STOP: 'browser:nav:stop',

  // History
  HISTORY_LIST: 'browser:history:list',
  HISTORY_SEARCH: 'browser:history:search',
  HISTORY_DELETE: 'browser:history:delete',
  HISTORY_CLEAR: 'browser:history:clear',
  HISTORY_ADD: 'browser:history:add',

  // Bookmarks
  BOOKMARK_LIST: 'browser:bookmark:list',
  BOOKMARK_ADD: 'browser:bookmark:add',
  BOOKMARK_UPDATE: 'browser:bookmark:update',
  BOOKMARK_DELETE: 'browser:bookmark:delete',
  BOOKMARK_FOLDER_CREATE: 'browser:bookmark:folder:create',
  BOOKMARK_FOLDER_DELETE: 'browser:bookmark:folder:delete',

  // Downloads
  DOWNLOAD_LIST: 'browser:download:list',
  DOWNLOAD_PAUSE: 'browser:download:pause',
  DOWNLOAD_RESUME: 'browser:download:resume',
  DOWNLOAD_CANCEL: 'browser:download:cancel',
  DOWNLOAD_CLEAR: 'browser:download:clear',
  DOWNLOAD_SHOW: 'browser:download:show',

  // Search
  SEARCH_SUGGEST: 'browser:search:suggest',
  FIND_IN_PAGE: 'browser:find:in-page',
  FIND_STOP: 'browser:find:stop',

  // Settings
  SETTINGS_GET: 'browser:settings:get',
  SETTINGS_SET: 'browser:settings:set',

  // Utility
  ZOOM_SET: 'browser:zoom:set',
  ZOOM_RESET: 'browser:zoom:reset',
  SCREENSHOT: 'browser:screenshot',
  PRINT: 'browser:print',
  DEVTOOLS_TOGGLE: 'browser:devtools:toggle',
  OPEN_EXTERNAL: 'browser:open:external',
  CLEAR_DATA: 'browser:clear:data',

  // Events (main → renderer)
  EVT_FAVICON: 'browser:evt:favicon',
  EVT_TITLE: 'browser:evt:title',
  EVT_LOADING: 'browser:evt:loading',
  EVT_NAV_STATE: 'browser:evt:nav-state',
  EVT_DOWNLOAD_PROGRESS: 'browser:evt:download-progress',
  EVT_PERMISSION: 'browser:evt:permission',
  EVT_CERT_ERROR: 'browser:evt:cert-error',
  EVT_FIND_RESULT: 'browser:evt:find-result',
  EVT_CONTEXT_MENU: 'browser:evt:context-menu',
} as const;
