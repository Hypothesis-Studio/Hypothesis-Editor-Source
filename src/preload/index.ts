/**
 * Hypothesis Editor - Preload Script (Self-contained for sandbox compatibility)
 * Secure bridge between renderer and main process using contextBridge.
 */
import { contextBridge, ipcRenderer } from 'electron';

// IPC Channel names (inlined to avoid external requires)
const CH = {
  APP_READY: 'app:ready', APP_QUIT: 'app:quit', APP_RELAUNCH: 'app:relaunch', APP_VERSION: 'app:version', APP_FOCUS: 'app:focus',
  WINDOW_CLOSE: 'window:close', WINDOW_MINIMIZE: 'window:minimize', WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_RESTORE: 'window:restore', WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_SET_TITLE: 'window:set-title', WINDOW_NEW: 'window:new', WINDOW_GET_ALL: 'window:get-all',
  FILE_OPEN: 'file:open', FILE_SAVE: 'file:save', FILE_SAVE_AS: 'file:save-as', FILE_SAVE_ALL: 'file:save-all',
  FILE_READ: 'file:read', FILE_WRITE: 'file:write', FILE_EXISTS: 'file:exists', FILE_CREATE: 'file:create',
  FILE_DELETE: 'file:delete', FILE_RENAME: 'file:rename', FILE_COPY: 'file:copy', FILE_MOVE: 'file:move',
  FILE_STAT: 'file:stat', FILE_WATCH: 'file:watch', FILE_UNWATCH: 'file:unwatch',
  FILE_DIALOG_OPEN: 'file:dialog-open', FILE_DIALOG_SAVE: 'file:dialog-save',
  DIR_READ: 'dir:read', DIR_CREATE: 'dir:create', DIR_DELETE: 'dir:delete', DIR_TREE: 'dir:tree',
  EDITOR_OPEN: 'editor:open', EDITOR_CLOSE: 'editor:close', EDITOR_SAVE: 'editor:save',
  EDITOR_FORMAT: 'editor:format', EDITOR_UNDO: 'editor:undo', EDITOR_REDO: 'editor:redo',
  TERMINAL_CREATE: 'terminal:create', TERMINAL_WRITE: 'terminal:write', TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close', TERMINAL_KILL: 'terminal:kill', TERMINAL_LIST: 'terminal:list',
  TERMINAL_DATA: 'terminal:data', TERMINAL_EXIT: 'terminal:exit', TERMINAL_TITLE: 'terminal:title',
  GIT_STATUS: 'git:status', GIT_COMMIT: 'git:commit', GIT_PUSH: 'git:push', GIT_PULL: 'git:pull',
  GIT_FETCH: 'git:fetch', GIT_CLONE: 'git:clone', GIT_BRANCH: 'git:branch', GIT_CHECKOUT: 'git:checkout',
  GIT_MERGE: 'git:merge', GIT_DIFF: 'git:diff', GIT_LOG: 'git:log', GIT_STASH: 'git:stash',
  GIT_ADD: 'git:add', GIT_RESET: 'git:reset', GIT_INIT: 'git:init',
  SEARCH: 'search:find', SEARCH_REPLACE: 'search:replace', SEARCH_REPLACE_ALL: 'search:replace-all',
  SETTINGS_GET: 'settings:get', SETTINGS_SET: 'settings:set', SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_RESET: 'settings:reset', SETTINGS_EXPORT: 'settings:export', SETTINGS_IMPORT: 'settings:import',
  SETTINGS_CHANGED: 'settings:changed',
  THEME_GET: 'theme:get', THEME_SET: 'theme:set', THEME_LIST: 'theme:list', THEME_CHANGED: 'theme:changed',
  KEYBINDING_GET_ALL: 'keybinding:get-all', KEYBINDING_SET: 'keybinding:set',
  KEYBINDING_RESET: 'keybinding:reset', KEYBINDING_CONFLICTS: 'keybinding:conflicts',
  WORKSPACE_OPEN: 'workspace:open', WORKSPACE_SAVE: 'workspace:save', WORKSPACE_GET: 'workspace:get',
  WORKSPACE_RECENT: 'workspace:recent', WORKSPACE_ADD_FOLDER: 'workspace:add-folder',
  WORKSPACE_REMOVE_FOLDER: 'workspace:remove-folder',
  PLUGIN_LIST: 'plugin:list', PLUGIN_INSTALL: 'plugin:install', PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable', PLUGIN_DISABLE: 'plugin:disable', PLUGIN_ACTIVATE: 'plugin:activate',
  PLUGIN_INSTALL_HYP: 'plugin:installHyp', PLUGIN_PACK: 'plugin:pack',
  UPDATE_CHECK: 'update:check', UPDATE_DOWNLOAD: 'update:download', UPDATE_INSTALL: 'update:install',
  UPDATE_AVAILABLE: 'update:available', UPDATE_DOWNLOADED: 'update:downloaded', UPDATE_PROGRESS: 'update:progress',
  LOG_INFO: 'log:info', LOG_WARN: 'log:warn', LOG_ERROR: 'log:error', LOG_DEBUG: 'log:debug',
  MENU_POPUP_CONTEXT: 'menu:popup-context', MENU_SET_MENU: 'menu:set-menu',
  DIALOG_MESSAGE: 'dialog:message', DIALOG_CONFIRM: 'dialog:confirm', DIALOG_INPUT: 'dialog:input',
  CLIPBOARD_READ: 'clipboard:read', CLIPBOARD_WRITE: 'clipboard:write', CLIPBOARD_HISTORY: 'clipboard:history',
  CRASH_REPORT: 'crash:report', CRASH_RECOVERY: 'crash:recovery',
  SNIPPETS_GET: 'snippets:get',
  SNIPPETS_SET: 'snippets:set',
};

const api = {
  // App
  app: {
    getVersion: () => ipcRenderer.invoke(CH.APP_VERSION),
    quit: () => ipcRenderer.invoke(CH.APP_QUIT),
    relaunch: () => ipcRenderer.invoke(CH.APP_RELAUNCH),
    onFocus: (callback: () => void) => {
      ipcRenderer.on(CH.APP_FOCUS, callback);
      return () => ipcRenderer.removeListener(CH.APP_FOCUS, callback);
    },
  },

  // Window
  window: {
    close: () => ipcRenderer.invoke(CH.WINDOW_CLOSE),
    minimize: () => ipcRenderer.invoke(CH.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(CH.WINDOW_MAXIMIZE),
    restore: () => ipcRenderer.invoke(CH.WINDOW_RESTORE),
    isMaximized: () => ipcRenderer.invoke(CH.WINDOW_IS_MAXIMIZED),
    setTitle: (title: string) => ipcRenderer.invoke(CH.WINDOW_SET_TITLE, title),
    newWindow: () => ipcRenderer.invoke(CH.WINDOW_NEW),
    getAll: () => ipcRenderer.invoke(CH.WINDOW_GET_ALL),
  },

  // File
  file: {
    open: () => ipcRenderer.invoke(CH.FILE_OPEN),
    save: (filePath: string, content: string) => ipcRenderer.invoke(CH.FILE_SAVE, filePath, content),
    saveAs: (content: string) => ipcRenderer.invoke(CH.FILE_SAVE_AS, content),
    read: (filePath: string) => ipcRenderer.invoke(CH.FILE_READ, filePath),
    exists: (filePath: string) => ipcRenderer.invoke(CH.FILE_EXISTS, filePath),
    create: (filePath: string, content?: string) => ipcRenderer.invoke(CH.FILE_CREATE, filePath, content),
    delete: (filePath: string) => ipcRenderer.invoke(CH.FILE_DELETE, filePath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke(CH.FILE_RENAME, oldPath, newPath),
    copy: (source: string, destination: string) => ipcRenderer.invoke(CH.FILE_COPY, source, destination),
    move: (source: string, destination: string) => ipcRenderer.invoke(CH.FILE_MOVE, source, destination),
    stat: (filePath: string) => ipcRenderer.invoke(CH.FILE_STAT, filePath),
    dialogOpen: (options: unknown) => ipcRenderer.invoke(CH.FILE_DIALOG_OPEN, options),
    dialogSave: (options: unknown) => ipcRenderer.invoke(CH.FILE_DIALOG_SAVE, options),
    revealInFileManager: (filePath: string) => ipcRenderer.invoke('file:revealInFileManager', filePath),
    openInTerminal: (dirPath: string) => ipcRenderer.invoke('file:openInTerminal', dirPath),
  },

  // Directory
  directory: {
    read: (dirPath: string) => ipcRenderer.invoke(CH.DIR_READ, dirPath),
    create: (dirPath: string) => ipcRenderer.invoke(CH.DIR_CREATE, dirPath),
    tree: (dirPath: string, depth?: number) => ipcRenderer.invoke(CH.DIR_TREE, dirPath, depth),
  },

  // File Watcher
  fileWatcher: {
    start: (dirPath: string) => ipcRenderer.send('file-watcher:start', dirPath),
    stop: (dirPath: string) => ipcRenderer.send('file-watcher:stop', dirPath),
    onEvent: (callback: (event: { type: string; path: string; dirPath: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { type: string; path: string; dirPath: string }) => callback(data);
      ipcRenderer.on('file-watcher:event', handler);
      return () => ipcRenderer.removeListener('file-watcher:event', handler);
    },
  },

  // Terminal
  terminal: {
    create: (options?: { shell?: string; cwd?: string; name?: string }) =>
      ipcRenderer.invoke(CH.TERMINAL_CREATE, options),
    write: (id: string, data: string) => ipcRenderer.send(CH.TERMINAL_WRITE, { id, data }),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke(CH.TERMINAL_RESIZE, { id, cols, rows }),
    close: (id: string) => ipcRenderer.invoke(CH.TERMINAL_CLOSE, id),
    kill: (id: string) => ipcRenderer.invoke(CH.TERMINAL_KILL, id),
    list: () => ipcRenderer.invoke(CH.TERMINAL_LIST),
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; data: string }) => callback(data);
      ipcRenderer.on(CH.TERMINAL_DATA, handler);
      return () => ipcRenderer.removeListener(CH.TERMINAL_DATA, handler);
    },
    onExit: (callback: (data: { id: string; exitCode: number; signal: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; exitCode: number; signal: number }) => callback(data);
      ipcRenderer.on(CH.TERMINAL_EXIT, handler);
      return () => ipcRenderer.removeListener(CH.TERMINAL_EXIT, handler);
    },
    onTitle: (callback: (data: { id: string; title: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; title: string }) => callback(data);
      ipcRenderer.on(CH.TERMINAL_TITLE, handler);
      return () => ipcRenderer.removeListener(CH.TERMINAL_TITLE, handler);
    },
  },

  // Git
  git: {
    status: (repoPath: string) => ipcRenderer.invoke(CH.GIT_STATUS, repoPath),
    commit: (repoPath: string, message: string, files?: string[]) =>
      ipcRenderer.invoke(CH.GIT_COMMIT, repoPath, message, files),
    push: (repoPath: string, remote?: string) => ipcRenderer.invoke(CH.GIT_PUSH, repoPath, remote),
    pull: (repoPath: string, remote?: string) => ipcRenderer.invoke(CH.GIT_PULL, repoPath, remote),
    fetch: (repoPath: string, remote?: string) => ipcRenderer.invoke(CH.GIT_FETCH, repoPath, remote),
    clone: (url: string, destination: string) => ipcRenderer.invoke(CH.GIT_CLONE, url, destination),
    branch: (repoPath: string) => ipcRenderer.invoke(CH.GIT_BRANCH, repoPath),
    checkout: (repoPath: string, branch: string) => ipcRenderer.invoke(CH.GIT_CHECKOUT, repoPath, branch),
    merge: (repoPath: string, branch: string) => ipcRenderer.invoke(CH.GIT_MERGE, repoPath, branch),
    diff: (repoPath: string, file?: string) => ipcRenderer.invoke(CH.GIT_DIFF, repoPath, file),
    log: (repoPath: string, maxCount?: number) => ipcRenderer.invoke(CH.GIT_LOG, repoPath, maxCount),
    stash: (repoPath: string) => ipcRenderer.invoke(CH.GIT_STASH, repoPath),
    add: (repoPath: string, files: string[]) => ipcRenderer.invoke(CH.GIT_ADD, repoPath, files),
    reset: (repoPath: string, files?: string[]) => ipcRenderer.invoke(CH.GIT_RESET, repoPath, files),
    discardFile: (repoPath: string, file: string) => ipcRenderer.invoke('git:discardFile', repoPath, file),
    discardAll: (repoPath: string) => ipcRenderer.invoke('git:discardAll', repoPath),
    isGitRepo: (repoPath: string) => ipcRenderer.invoke('git:isGitRepo', repoPath),
    stagedDiff: (repoPath: string) => ipcRenderer.invoke('git:stagedDiff', repoPath),
    init: (repoPath: string) => ipcRenderer.invoke(CH.GIT_INIT, repoPath),
  },

  // Settings
  settings: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke(CH.SETTINGS_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(CH.SETTINGS_SET, key, value),
    getAll: () => ipcRenderer.invoke(CH.SETTINGS_GET_ALL),
    reset: (key?: string) => ipcRenderer.invoke(CH.SETTINGS_RESET, key),
    export: () => ipcRenderer.invoke(CH.SETTINGS_EXPORT),
    import: (data: string) => ipcRenderer.invoke(CH.SETTINGS_IMPORT, data),
    onChanged: (callback: (settings: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, settings: Record<string, unknown>) => callback(settings);
      ipcRenderer.on(CH.SETTINGS_CHANGED, handler);
      return () => ipcRenderer.removeListener(CH.SETTINGS_CHANGED, handler);
    },
  },

  // Theme
  theme: {
    get: () => ipcRenderer.invoke(CH.THEME_GET),
    set: (themeId: string) => ipcRenderer.invoke(CH.THEME_SET, themeId),
    list: () => ipcRenderer.invoke(CH.THEME_LIST),
    onChanged: (callback: (theme: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, theme: unknown) => callback(theme);
      ipcRenderer.on(CH.THEME_CHANGED, handler);
      return () => ipcRenderer.removeListener(CH.THEME_CHANGED, handler);
    },
  },

  // Plugin
  plugin: {
    list: () => ipcRenderer.invoke(CH.PLUGIN_LIST),
    install: (pluginPath: string) => ipcRenderer.invoke(CH.PLUGIN_INSTALL, pluginPath),
    uninstall: (pluginId: string) => ipcRenderer.invoke(CH.PLUGIN_UNINSTALL, pluginId),
    enable: (pluginId: string) => ipcRenderer.invoke(CH.PLUGIN_ENABLE, pluginId),
    disable: (pluginId: string) => ipcRenderer.invoke(CH.PLUGIN_DISABLE, pluginId),
    activate: (pluginId: string) => ipcRenderer.invoke(CH.PLUGIN_ACTIVATE, pluginId),
    installHyp: (hypPath: string) => ipcRenderer.invoke(CH.PLUGIN_INSTALL_HYP, hypPath),
    pack: (folderPath: string, outputPath?: string) => ipcRenderer.invoke(CH.PLUGIN_PACK, folderPath, outputPath),
    getExtensionCommands: () => ipcRenderer.invoke('plugin:getExtensionCommands'),
    executeCommand: (commandId: string, args?: unknown) => ipcRenderer.invoke('plugin:executeCommand', commandId, args),
  },

  // Search
  search: {
    find: (options: unknown) => ipcRenderer.invoke(CH.SEARCH, options),
    replace: (options: unknown) => ipcRenderer.invoke(CH.SEARCH_REPLACE, options),
    replaceAll: (options: unknown) => ipcRenderer.invoke(CH.SEARCH_REPLACE_ALL, options),
  },

  // Clipboard
  clipboard: {
    read: () => ipcRenderer.invoke(CH.CLIPBOARD_READ),
    write: (text: string) => ipcRenderer.invoke(CH.CLIPBOARD_WRITE, text),
    history: () => ipcRenderer.invoke(CH.CLIPBOARD_HISTORY),
  },

  // Update
  update: {
    check: () => ipcRenderer.invoke(CH.UPDATE_CHECK),
    download: () => ipcRenderer.invoke(CH.UPDATE_DOWNLOAD),
    install: () => ipcRenderer.invoke(CH.UPDATE_INSTALL),
    openRelease: (url: string) => ipcRenderer.invoke('update:openRelease', url),
    onAvailable: (callback: (info: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
      ipcRenderer.on(CH.UPDATE_AVAILABLE, handler);
      return () => ipcRenderer.removeListener(CH.UPDATE_AVAILABLE, handler);
    },
    onDownloaded: (callback: (info: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: unknown) => callback(info);
      ipcRenderer.on(CH.UPDATE_DOWNLOADED, handler);
      return () => ipcRenderer.removeListener(CH.UPDATE_DOWNLOADED, handler);
    },
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
      ipcRenderer.on(CH.UPDATE_PROGRESS, handler);
      return () => ipcRenderer.removeListener(CH.UPDATE_PROGRESS, handler);
    },
  },

  // Dialog
  dialog: {
    message: (options: unknown) => ipcRenderer.invoke(CH.DIALOG_MESSAGE, options),
    confirm: (options: unknown) => ipcRenderer.invoke(CH.DIALOG_CONFIRM, options),
    input: (options: unknown) => ipcRenderer.invoke(CH.DIALOG_INPUT, options),
  },

  // Menu
  menu: {
    popupContext: (menuId: string) => ipcRenderer.invoke(CH.MENU_POPUP_CONTEXT, menuId),
    setMenu: (menuId: string) => ipcRenderer.invoke(CH.MENU_SET_MENU, menuId),
    /** Listen for a menu IPC channel sent from main process. Returns unsubscribe function. */
    onChannel: (channel: string, callback: (...args: any[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },

  // Crash
  crash: {
    report: (report: unknown) => ipcRenderer.invoke(CH.CRASH_REPORT, report),
    recovery: () => ipcRenderer.invoke(CH.CRASH_RECOVERY),
  },

  // Extension API - Full access for plugins
  extension: {
    // Commands
    commands: {
      register: (commandId: string) => ipcRenderer.invoke('ext:commands:register', commandId),
      execute: (commandId: string, args?: unknown[]) => ipcRenderer.invoke('ext:commands:execute', commandId, args),
      list: () => ipcRenderer.invoke('ext:commands:list'),
    },

    // Editor
    editor: {
      getActiveDocument: () => ipcRenderer.invoke('ext:editor:getActiveDocument'),
      getOpenDocuments: () => ipcRenderer.invoke('ext:editor:getOpenDocuments'),
      openFile: (filePath: string) => ipcRenderer.invoke('ext:editor:openFile', filePath),
      saveFile: (filePath: string, content: string) => ipcRenderer.invoke('ext:editor:saveFile', filePath, content),
      getDocumentContent: (filePath: string) => ipcRenderer.invoke('ext:editor:getDocumentContent', filePath),
      pushState: (doc: { uri: string; content: string; language: string; filePath: string | null } | null) => ipcRenderer.send('ext:editor:stateUpdate', doc),
      pushSelection: (sel: { start: { line: number; column: number }; end: { line: number; column: number } } | null) => ipcRenderer.send('ext:editor:selectionUpdate', sel),
      onOpenFile: (callback: (data: { filePath: string; content: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string; content: string }) => callback(data);
        ipcRenderer.on('ext:editor:openFile', handler);
        return () => ipcRenderer.removeListener('ext:editor:openFile', handler);
      },
      onFileSaved: (callback: (data: { filePath: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string }) => callback(data);
        ipcRenderer.on('ext:editor:fileSaved', handler);
        return () => ipcRenderer.removeListener('ext:editor:fileSaved', handler);
      },
    },

    // Format
    format: (payload: { text: string; languageId: string; filePath: string }) =>
      ipcRenderer.invoke('editor:format', payload),

    // Settings
    settings: {
      get: <T>(key: string): Promise<T> => ipcRenderer.invoke('ext:settings:get', key),
      set: (key: string, value: unknown) => ipcRenderer.invoke('ext:settings:set', key, value),
      getAll: () => ipcRenderer.invoke('ext:settings:getAll'),
      getSection: (section: string) => ipcRenderer.invoke('ext:settings:getSection', section),
    },

    // Theme
    theme: {
      getCurrent: () => ipcRenderer.invoke('ext:theme:getCurrent'),
      list: () => ipcRenderer.invoke('ext:theme:list'),
      set: (themeId: string) => ipcRenderer.invoke('ext:theme:set', themeId),
      register: (themeDef: unknown) => ipcRenderer.invoke('ext:theme:register', themeDef),
      onRegistered: (callback: (themeDef: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, themeDef: unknown) => callback(themeDef);
        ipcRenderer.on('ext:theme:registered', handler);
        return () => ipcRenderer.removeListener('ext:theme:registered', handler);
      },
    },

    // File System
    fs: {
      readFile: (filePath: string) => ipcRenderer.invoke('ext:fs:readFile', filePath),
      writeFile: (filePath: string, content: string) => ipcRenderer.invoke('ext:fs:writeFile', filePath, content),
      exists: (filePath: string) => ipcRenderer.invoke('ext:fs:exists', filePath),
      readDir: (dirPath: string) => ipcRenderer.invoke('ext:fs:readDir', dirPath),
      mkdir: (dirPath: string, options?: { recursive?: boolean }) => ipcRenderer.invoke('ext:fs:mkdir', dirPath, options),
      delete: (targetPath: string, options?: { recursive?: boolean }) => ipcRenderer.invoke('ext:fs:delete', targetPath, options),
      rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('ext:fs:rename', oldPath, newPath),
      stat: (filePath: string) => ipcRenderer.invoke('ext:fs:stat', filePath),
      watch: (filePath: string) => ipcRenderer.invoke('ext:fs:watch', filePath),
      unwatch: (filePath: string) => ipcRenderer.invoke('ext:fs:unwatch', filePath),
    },

    // Terminal
    terminal: {
      create: (options?: unknown) => ipcRenderer.invoke('ext:terminal:create', options),
      write: (terminalId: string, data: string) => ipcRenderer.invoke('ext:terminal:write', terminalId, data),
      close: (terminalId: string) => ipcRenderer.invoke('ext:terminal:close', terminalId),
      list: () => ipcRenderer.invoke('ext:terminal:list'),
      runCommand: (command: string, cwd?: string) => ipcRenderer.invoke('ext:terminal:runCommand', command, cwd),
      onData: (callback: (data: { terminalId: string; data: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { terminalId: string; data: string }) => callback(data);
        ipcRenderer.on('ext:terminal:data', handler);
        return () => ipcRenderer.removeListener('ext:terminal:data', handler);
      },
      onExit: (callback: (data: { terminalId: string; exitCode: number }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { terminalId: string; exitCode: number }) => callback(data);
        ipcRenderer.on('ext:terminal:exit', handler);
        return () => ipcRenderer.removeListener('ext:terminal:exit', handler);
      },
    },

    // Git
    git: {
      status: (repoPath: string) => ipcRenderer.invoke('ext:git:status', repoPath),
      log: (repoPath: string, maxCount?: number) => ipcRenderer.invoke('ext:git:log', repoPath, maxCount),
      diff: (repoPath: string, file?: string) => ipcRenderer.invoke('ext:git:diff', repoPath, file),
      branch: (repoPath: string) => ipcRenderer.invoke('ext:git:branch', repoPath),
      commit: (repoPath: string, message: string, files?: string[]) => ipcRenderer.invoke('ext:git:commit', repoPath, message, files),
      push: (repoPath: string, remote?: string) => ipcRenderer.invoke('ext:git:push', repoPath, remote),
      pull: (repoPath: string, remote?: string) => ipcRenderer.invoke('ext:git:pull', repoPath, remote),
      fetch: (repoPath: string, remote?: string) => ipcRenderer.invoke('ext:git:fetch', repoPath, remote),
      add: (repoPath: string, files: string[]) => ipcRenderer.invoke('ext:git:add', repoPath, files),
      reset: (repoPath: string, files?: string[]) => ipcRenderer.invoke('ext:git:reset', repoPath, files),
      stash: (repoPath: string) => ipcRenderer.invoke('ext:git:stash', repoPath),
      checkout: (repoPath: string, branch: string) => ipcRenderer.invoke('ext:git:checkout', repoPath, branch),
      merge: (repoPath: string, branch: string) => ipcRenderer.invoke('ext:git:merge', repoPath, branch),
      init: (repoPath: string) => ipcRenderer.invoke('ext:git:init', repoPath),
    },

    // Workspace
    workspace: {
      getRootPath: () => ipcRenderer.invoke('ext:workspace:getRootPath'),
      getFolders: () => ipcRenderer.invoke('ext:workspace:getFolders'),
      getRecent: () => ipcRenderer.invoke('ext:workspace:getRecent'),
      openFolder: () => ipcRenderer.invoke('ext:workspace:openFolder'),
      openFile: () => ipcRenderer.invoke('ext:workspace:openFile'),
    },

    // UI
    ui: {
      showMessage: (type: 'info' | 'warning' | 'error', message: string, items?: string[]) => ipcRenderer.invoke('ext:ui:showMessage', type, message, items),
      showInput: (options: unknown) => ipcRenderer.invoke('ext:ui:showInput', options),
      showQuickPick: (items: unknown[], options?: unknown) => ipcRenderer.invoke('ext:ui:showQuickPick', items, options),
      showDialog: (options: unknown) => ipcRenderer.invoke('ext:ui:showDialog', options),
      showOpenDialog: (options: unknown) => ipcRenderer.invoke('ext:ui:showOpenDialog', options),
      showSaveDialog: (options: unknown) => ipcRenderer.invoke('ext:ui:showSaveDialog', options),
      setStatusBar: (id: string, text: string, alignment: 'left' | 'right', priority?: number) => ipcRenderer.invoke('ext:ui:setStatusBar', id, text, alignment, priority),
      updateStatusBar: (id: string, text: string) => ipcRenderer.invoke('ext:ui:updateStatusBar', id, text),
      createPanel: (id: string, title: string, content: string) => ipcRenderer.invoke('ext:ui:createPanel', id, title, content),
      updatePanel: (id: string, content: string) => ipcRenderer.invoke('ext:ui:updatePanel', id, content),
      showPanel: (id: string) => ipcRenderer.invoke('ext:ui:showPanel', id),
      hidePanel: (id: string) => ipcRenderer.invoke('ext:ui:hidePanel', id),
      createSidebarView: (id: string, title: string, content: string) => ipcRenderer.invoke('ext:ui:createSidebarView', id, title, content),
      showSidebarView: (id: string) => ipcRenderer.invoke('ext:ui:showSidebarView', id),
      // Event listeners
      onMessage: (callback: (data: { type: string; message: string; items?: string[] }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { type: string; message: string; items?: string[] }) => callback(data);
        ipcRenderer.on('ext:ui:message', handler);
        return () => ipcRenderer.removeListener('ext:ui:message', handler);
      },
      onNotification: (callback: (data: { message: string; type: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { message: string; type: string }) => callback(data);
        ipcRenderer.on('ext:notification', handler);
        return () => ipcRenderer.removeListener('ext:notification', handler);
      },
      onSetStatusBar: (callback: (data: { id: string; text: string; alignment: string; priority?: number }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string; alignment: string; priority?: number }) => callback(data);
        ipcRenderer.on('ext:ui:setStatusBar', handler);
        return () => ipcRenderer.removeListener('ext:ui:setStatusBar', handler);
      },
      onUpdateStatusBar: (callback: (data: { id: string; text: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string; text: string }) => callback(data);
        ipcRenderer.on('ext:ui:updateStatusBar', handler);
        return () => ipcRenderer.removeListener('ext:ui:updateStatusBar', handler);
      },
      onCreatePanel: (callback: (data: { id: string; title: string; content: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string; title: string; content: string }) => callback(data);
        ipcRenderer.on('ext:ui:createPanel', handler);
        return () => ipcRenderer.removeListener('ext:ui:createPanel', handler);
      },
      onUpdatePanel: (callback: (data: { id: string; content: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string; content: string }) => callback(data);
        ipcRenderer.on('ext:ui:updatePanel', handler);
        return () => ipcRenderer.removeListener('ext:ui:updatePanel', handler);
      },
      onShowPanel: (callback: (data: { id: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string }) => callback(data);
        ipcRenderer.on('ext:ui:showPanel', handler);
        return () => ipcRenderer.removeListener('ext:ui:showPanel', handler);
      },
      onHidePanel: (callback: (data: { id: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string }) => callback(data);
        ipcRenderer.on('ext:ui:hidePanel', handler);
        return () => ipcRenderer.removeListener('ext:ui:hidePanel', handler);
      },
      onCreateSidebarView: (callback: (data: { id: string; title: string; content: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string; title: string; content: string }) => callback(data);
        ipcRenderer.on('ext:ui:createSidebarView', handler);
        return () => ipcRenderer.removeListener('ext:ui:createSidebarView', handler);
      },
      onShowSidebarView: (callback: (data: { id: string }) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: { id: string }) => callback(data);
        ipcRenderer.on('ext:ui:showSidebarView', handler);
        return () => ipcRenderer.removeListener('ext:ui:showSidebarView', handler);
      },
    },

    // Clipboard
    clipboard: {
      read: () => ipcRenderer.invoke('ext:clipboard:read'),
      write: (text: string) => ipcRenderer.invoke('ext:clipboard:write', text),
    },

    // Storage (per-extension key-value)
    storage: {
      get: <T>(pluginId: string, key: string): Promise<T> => ipcRenderer.invoke('ext:storage:get', pluginId, key),
      set: (pluginId: string, key: string, value: unknown) => ipcRenderer.invoke('ext:storage:set', pluginId, key, value),
      getAll: (pluginId: string) => ipcRenderer.invoke('ext:storage:getAll', pluginId),
      delete: (pluginId: string, key: string) => ipcRenderer.invoke('ext:storage:delete', pluginId, key),
      clear: (pluginId: string) => ipcRenderer.invoke('ext:storage:clear', pluginId),
    },

    // HTTP
    http: {
      fetch: (url: string, options?: { method?: string; headers?: Record<string, string>; body?: string; timeout?: number }) =>
        ipcRenderer.invoke('ext:http:fetch', url, options),
    },

    // Process
    process: {
      exec: (command: string, options?: { cwd?: string; env?: Record<string, string>; timeout?: number }) =>
        ipcRenderer.invoke('ext:process:exec', command, options),
      getEnv: (key: string) => ipcRenderer.invoke('ext:process:getEnv', key),
      getPlatform: () => ipcRenderer.invoke('ext:process:getPlatform'),
      getArch: () => ipcRenderer.invoke('ext:process:getArch'),
      getVersion: () => ipcRenderer.invoke('ext:process:getVersion'),
      getAppPath: () => ipcRenderer.invoke('ext:process:getAppPath'),
      getExtensionPath: (pluginId: string) => ipcRenderer.invoke('ext:process:getExtensionPath', pluginId),
      getTempPath: () => ipcRenderer.invoke('ext:process:getTempPath'),
      getHomePath: () => ipcRenderer.invoke('ext:process:getHomePath'),
    },
  },

  // Agent
  agent: {
    chat: {
      send: (sessionId: string, content: string, agentId?: string, workspacePath?: string, workspaceFolders?: string[]) => ipcRenderer.invoke('agent:chat:send', sessionId, content, agentId, workspacePath, workspaceFolders),
      stream: (sessionId: string, content: string, agentId?: string, workspacePath?: string, workspaceFolders?: string[]) => ipcRenderer.invoke('agent:chat:stream', sessionId, content, agentId, workspacePath, workspaceFolders),
      cancel: (sessionId: string) => ipcRenderer.invoke('agent:chat:cancel', sessionId),
      history: (sessionId: string) => ipcRenderer.invoke('agent:chat:history', sessionId),
    },
    session: {
      create: (agentId: string, title?: string) => ipcRenderer.invoke('agent:session:create', agentId, title),
      list: (agentId?: string, limit?: number) => ipcRenderer.invoke('agent:session:list', agentId, limit),
      delete: (sessionId: string) => ipcRenderer.invoke('agent:session:delete', sessionId),
      get: (sessionId: string) => ipcRenderer.invoke('agent:session:get', sessionId),
    },
    provider: {
      list: () => ipcRenderer.invoke('agent:provider:list'),
      add: (config: unknown) => ipcRenderer.invoke('agent:provider:add', config),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('agent:provider:update', id, updates),
      remove: (id: string) => ipcRenderer.invoke('agent:provider:remove', id),
      test: (id: string) => ipcRenderer.invoke('agent:provider:test', id),
      models: (id: string) => ipcRenderer.invoke('agent:provider:models', id),
    },
    config: {
      list: () => ipcRenderer.invoke('agent:config:list'),
      get: (id: string) => ipcRenderer.invoke('agent:config:get', id),
      create: (config: unknown) => ipcRenderer.invoke('agent:config:create', config),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('agent:config:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('agent:config:delete', id),
    },
    task: {
      list: (filters?: unknown) => ipcRenderer.invoke('agent:task:list', filters),
      get: (id: string) => ipcRenderer.invoke('agent:task:get', id),
      cancel: (id: string) => ipcRenderer.invoke('agent:task:cancel', id),
      delete: (id: string) => ipcRenderer.invoke('agent:task:delete', id),
    },
    tool: {
      list: () => ipcRenderer.invoke('agent:tool:list'),
      enable: (id: string) => ipcRenderer.invoke('agent:tool:enable', id),
      disable: (id: string) => ipcRenderer.invoke('agent:tool:disable', id),
    },
    memory: {
      search: (query: unknown) => ipcRenderer.invoke('agent:memory:search', query),
      list: (limit?: number) => ipcRenderer.invoke('agent:memory:list', limit),
      clear: (sessionId?: string) => ipcRenderer.invoke('agent:memory:clear', sessionId),
    },
    log: {
      list: (filters?: unknown) => ipcRenderer.invoke('agent:log:list', filters),
      clear: () => ipcRenderer.invoke('agent:log:clear'),
    },
    status: () => ipcRenderer.invoke('agent:status'),
    stream: {
      onEvent: (callback: (event: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('agent:stream:event', handler);
        return () => { ipcRenderer.removeListener('agent:stream:event', handler); };
      },
      onEnd: (callback: (data: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('agent:stream:end', handler);
        return () => { ipcRenderer.removeListener('agent:stream:end', handler); };
      },
    },
    onLogEntry: (callback: (entry: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, entry: unknown) => callback(entry);
      ipcRenderer.on('agent:log:entry', handler);
      return () => { ipcRenderer.removeListener('agent:log:entry', handler); };
    },
    onFileChanged: (callback: (data: { filePath: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string }) => callback(data);
      ipcRenderer.on('agent:file-changed', handler);
      return () => { ipcRenderer.removeListener('agent:file-changed', handler); };
    },
  },

  // Insights - Project analysis
  insights: {
    scanProject: (projectPath: string) => ipcRenderer.invoke('insights:scan-project', projectPath),
    getCached: (projectPath: string) => ipcRenderer.invoke('insights:get-cached', projectPath),
    clearCache: (projectPath?: string) => ipcRenderer.invoke('insights:clear-cache', projectPath),
    runAudit: (projectPath: string) => ipcRenderer.invoke('insights:run-audit', projectPath),
    checkOutdated: (projectPath: string) => ipcRenderer.invoke('insights:check-outdated', projectPath),
    findDuplicates: (projectPath: string) => ipcRenderer.invoke('insights:find-duplicates', projectPath),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
      ipcRenderer.on('insights:scan-progress', handler);
      return () => { ipcRenderer.removeListener('insights:scan-progress', handler); };
    },
  },

  // REST Client - API Testing
  restClient: {
    sendRequest: (requestId: string, collectionId: string) => ipcRenderer.invoke('rest-client:send-request', requestId, collectionId),
    cancelRequest: (requestId: string) => ipcRenderer.invoke('rest-client:cancel-request', requestId),
    collection: {
      list: () => ipcRenderer.invoke('rest-client:collection:list'),
      get: (id: string) => ipcRenderer.invoke('rest-client:collection:get', id),
      create: (name: string, description?: string) => ipcRenderer.invoke('rest-client:collection:create', name, description),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('rest-client:collection:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('rest-client:collection:delete', id),
      export: (options: unknown) => ipcRenderer.invoke('rest-client:collection:export', options),
      import: (content: string, format: string) => ipcRenderer.invoke('rest-client:collection:import', content, format),
    },
    request: {
      create: (collectionId: string, request: unknown) => ipcRenderer.invoke('rest-client:request:create', collectionId, request),
      update: (collectionId: string, requestId: string, updates: unknown) => ipcRenderer.invoke('rest-client:request:update', collectionId, requestId, updates),
      delete: (collectionId: string, requestId: string) => ipcRenderer.invoke('rest-client:request:delete', collectionId, requestId),
      duplicate: (collectionId: string, requestId: string) => ipcRenderer.invoke('rest-client:request:duplicate', collectionId, requestId),
      move: (fromCollectionId: string, requestId: string, toCollectionId: string, index?: number) => ipcRenderer.invoke('rest-client:request:move', fromCollectionId, requestId, toCollectionId, index),
    },
    folder: {
      create: (collectionId: string, name: string, parentId?: string) => ipcRenderer.invoke('rest-client:folder:create', collectionId, name, parentId),
      update: (collectionId: string, folderId: string, updates: unknown) => ipcRenderer.invoke('rest-client:folder:update', collectionId, folderId, updates),
      delete: (collectionId: string, folderId: string) => ipcRenderer.invoke('rest-client:folder:delete', collectionId, folderId),
    },
    env: {
      list: () => ipcRenderer.invoke('rest-client:env:list'),
      get: (id: string) => ipcRenderer.invoke('rest-client:env:get', id),
      create: (name: string, variables?: unknown[]) => ipcRenderer.invoke('rest-client:env:create', name, variables),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('rest-client:env:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('rest-client:env:delete', id),
      activate: (id: string) => ipcRenderer.invoke('rest-client:env:activate', id),
      deactivate: () => ipcRenderer.invoke('rest-client:env:deactivate'),
      duplicate: (id: string) => ipcRenderer.invoke('rest-client:env:duplicate', id),
    },
    history: {
      list: () => ipcRenderer.invoke('rest-client:history:list'),
      clear: () => ipcRenderer.invoke('rest-client:history:clear'),
      delete: (id: string) => ipcRenderer.invoke('rest-client:history:delete', id),
      search: (query: string) => ipcRenderer.invoke('rest-client:history:search', query),
    },
    var: {
      set: (key: string, value: string) => ipcRenderer.invoke('rest-client:var:set', key, value),
      get: (key: string) => ipcRenderer.invoke('rest-client:var:get', key),
      delete: (key: string) => ipcRenderer.invoke('rest-client:var:delete', key),
      getAll: () => ipcRenderer.invoke('rest-client:var:get-all'),
      resolve: (raw: string, collectionId?: string) => ipcRenderer.invoke('rest-client:var:resolve', raw, collectionId),
    },
    runner: {
      start: (collectionId: string, config: unknown) => ipcRenderer.invoke('rest-client:runner:start', collectionId, config),
      stop: () => ipcRenderer.invoke('rest-client:runner:stop'),
      status: () => ipcRenderer.invoke('rest-client:runner:status'),
    },
    import: {
      file: (content: string, format: string) => ipcRenderer.invoke('rest-client:import:file', content, format),
      curl: (curlCommand: string) => ipcRenderer.invoke('rest-client:import:curl', curlCommand),
    },
    export: (options: unknown) => ipcRenderer.invoke('rest-client:export', options),
    template: {
      list: () => ipcRenderer.invoke('rest-client:template:list'),
    },
    generateCurl: (requestId: string, collectionId: string) => ipcRenderer.invoke('rest-client:generate-curl', requestId, collectionId),
    events: {
      onResponse: (callback: (data: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('rest-client:event:response', handler);
        return () => { ipcRenderer.removeListener('rest-client:event:response', handler); };
      },
      onRunnerProgress: (callback: (data: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('rest-client:event:runner-progress', handler);
        return () => { ipcRenderer.removeListener('rest-client:event:runner-progress', handler); };
      },
      onRunnerComplete: (callback: (data: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('rest-client:event:runner-complete', handler);
        return () => { ipcRenderer.removeListener('rest-client:event:runner-complete', handler); };
      },
    },
  },

  // Preview - File preview for HTML, Markdown, SVG, images, audio, video
  preview: {
    loadPreview: (filePath: string) => ipcRenderer.invoke('preview:load', filePath),
    renderMarkdown: (markdown: string) => ipcRenderer.invoke('preview:render-markdown', markdown),
    getFileType: (ext: string) => ipcRenderer.invoke('preview:get-file-type', ext),
    watchFile: (filePath: string) => ipcRenderer.invoke('preview:watch', filePath),
    unwatchFile: (filePath: string) => ipcRenderer.invoke('preview:unwatch', filePath),
    onFileChanged: (callback: (data: { filePath: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { filePath: string }) => callback(data);
      ipcRenderer.on('preview:file-changed', handler);
      return () => { ipcRenderer.removeListener('preview:file-changed', handler); };
    },
  },

  // Run - Execute scripts with structured output capture
  run: {
    execute: (options: { command: string; cwd?: string; env?: Record<string, string> }) =>
      ipcRenderer.invoke('run:execute', options),
    kill: (runId: string) => ipcRenderer.invoke('run:kill', runId),
    killAll: () => ipcRenderer.invoke('run:kill-all'),
    list: () => ipcRenderer.invoke('run:list'),
    onStarted: (callback: (data: { runId: string; command: string; pid: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { runId: string; command: string; pid: number }) => callback(data);
      ipcRenderer.on('run:started', handler);
      return () => ipcRenderer.removeListener('run:started', handler);
    },
    onStdout: (callback: (data: { runId: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { runId: string; data: string }) => callback(data);
      ipcRenderer.on('run:stdout', handler);
      return () => ipcRenderer.removeListener('run:stdout', handler);
    },
    onStderr: (callback: (data: { runId: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { runId: string; data: string }) => callback(data);
      ipcRenderer.on('run:stderr', handler);
      return () => ipcRenderer.removeListener('run:stderr', handler);
    },
    onExit: (callback: (data: { runId: string; exitCode: number | null; signal: string | null }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { runId: string; exitCode: number | null; signal: string | null }) => callback(data);
      ipcRenderer.on('run:exit', handler);
      return () => ipcRenderer.removeListener('run:exit', handler);
    },
    onError: (callback: (data: { runId: string; error: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { runId: string; error: string }) => callback(data);
      ipcRenderer.on('run:error', handler);
      return () => ipcRenderer.removeListener('run:error', handler);
    },
  },

  // Database Explorer
  db: {
    connection: {
      list: () => ipcRenderer.invoke('db:connection-list'),
      get: (id: string) => ipcRenderer.invoke('db:connection-get', id),
      create: (config: unknown) => ipcRenderer.invoke('db:connection-create', config),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('db:connection-update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:connection-delete', id),
      test: (config: unknown) => ipcRenderer.invoke('db:test-connection', config),
      connect: (id: string) => ipcRenderer.invoke('db:connect', id),
      disconnect: (id: string) => ipcRenderer.invoke('db:disconnect', id),
      onStatus: (callback: (data: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
        ipcRenderer.on('db:connection-status', handler);
        return () => ipcRenderer.removeListener('db:connection-status', handler);
      },
    },
    schema: {
      get: (connectionId: string) => ipcRenderer.invoke('db:schema-get', connectionId),
    },
    erDiagram: {
      get: (connectionId: string) => ipcRenderer.invoke('db:er-diagram-get', connectionId),
    },
    query: {
      execute: (req: unknown) => ipcRenderer.invoke('db:query-execute', req),
    },
    history: {
      list: () => ipcRenderer.invoke('db:history-list'),
      clear: () => ipcRenderer.invoke('db:history-clear'),
    },
    savedQuery: {
      list: () => ipcRenderer.invoke('db:saved-query-list'),
      create: (data: unknown) => ipcRenderer.invoke('db:saved-query-create', data),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('db:saved-query-update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:saved-query-delete', id),
    },
    row: {
      update: (req: unknown) => ipcRenderer.invoke('db:row-update', req),
    },
    fk: {
      getRow: (req: unknown) => ipcRenderer.invoke('db:fk-row-get', req),
    },
    table: {
      data: (req: unknown) => ipcRenderer.invoke('db:table-data', req),
      export: (req: unknown) => ipcRenderer.invoke('db:export-table', req),
    },
  },

  // Browser
  browser: {
    tabs: {
      list: () => ipcRenderer.invoke('browser:tab:list'),
      create: (url?: string) => ipcRenderer.invoke('browser:tab:create', url),
      close: (id: string) => ipcRenderer.invoke('browser:tab:close', id),
      activate: (id: string) => ipcRenderer.invoke('browser:tab:activate', id),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('browser:tab:update', id, updates),
      getActiveId: () => ipcRenderer.invoke('browser:tab:get-active-id'),
    },
    nav: {
      loadUrl: (tabId: string, url: string) => ipcRenderer.invoke('browser:nav:load-url', tabId, url),
      goBack: (tabId: string) => ipcRenderer.invoke('browser:nav:go-back', tabId),
      goForward: (tabId: string) => ipcRenderer.invoke('browser:nav:go-forward', tabId),
      reload: (tabId: string) => ipcRenderer.invoke('browser:nav:reload', tabId),
      stop: (tabId: string) => ipcRenderer.invoke('browser:nav:stop', tabId),
    },
    history: {
      list: (limit?: number) => ipcRenderer.invoke('browser:history:list', limit),
      search: (query: string) => ipcRenderer.invoke('browser:history:search', query),
      delete: (id: string) => ipcRenderer.invoke('browser:history:delete', id),
      clear: () => ipcRenderer.invoke('browser:history:clear'),
      add: (url: string, title: string, favicon: string | null) => ipcRenderer.invoke('browser:history:add', url, title, favicon),
    },
    bookmarks: {
      list: () => ipcRenderer.invoke('browser:bookmark:list'),
      add: (url: string, title: string, favicon: string | null, folderId: string | null) => ipcRenderer.invoke('browser:bookmark:add', url, title, favicon, folderId),
      update: (id: string, updates: unknown) => ipcRenderer.invoke('browser:bookmark:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('browser:bookmark:delete', id),
      createFolder: (name: string, parentId: string | null) => ipcRenderer.invoke('browser:bookmark:folder:create', name, parentId),
      deleteFolder: (id: string) => ipcRenderer.invoke('browser:bookmark:folder:delete', id),
    },
    downloads: {
      list: () => ipcRenderer.invoke('browser:download:list'),
      pause: (id: string) => ipcRenderer.invoke('browser:download:pause', id),
      resume: (id: string) => ipcRenderer.invoke('browser:download:resume', id),
      cancel: (id: string) => ipcRenderer.invoke('browser:download:cancel', id),
      clear: () => ipcRenderer.invoke('browser:download:clear'),
      show: (id: string) => ipcRenderer.invoke('browser:download:show', id),
      onProgress: (callback: (dl: unknown) => void) => {
        const handler = (_event: Electron.IpcRendererEvent, dl: unknown) => callback(dl);
        ipcRenderer.on('browser:evt:download-progress', handler);
        return () => ipcRenderer.removeListener('browser:evt:download-progress', handler);
      },
    },
    search: {
      suggest: (query: string) => ipcRenderer.invoke('browser:search:suggest', query),
    },
    settings: {
      get: () => ipcRenderer.invoke('browser:settings:get'),
      set: (updates: unknown) => ipcRenderer.invoke('browser:settings:set', updates),
    },
    openExternal: (url: string) => ipcRenderer.invoke('browser:open:external', url),
    clearData: (options: unknown) => ipcRenderer.invoke('browser:clear:data', options),
  },

  // Tunnel
  tunnel: {
    open: (options: { localPort: number; label?: string; subdomain?: string; autoReconnect?: boolean }) =>
      ipcRenderer.invoke('tunnel:open', options),
    close: (id: string) => ipcRenderer.invoke('tunnel:close', id),
    closeAll: () => ipcRenderer.invoke('tunnel:close-all'),
    list: () => ipcRenderer.invoke('tunnel:list'),
    get: (id: string) => ipcRenderer.invoke('tunnel:get', id),
    updateLabel: (id: string, label: string) => ipcRenderer.invoke('tunnel:update-label', id, label),
    copyUrl: (id: string) => ipcRenderer.invoke('tunnel:copy-url', id),
    openInBrowser: (id: string) => ipcRenderer.invoke('tunnel:open-browser', id),
    onStatusChanged: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('tunnel:evt:status', handler);
      return () => ipcRenderer.removeListener('tunnel:evt:status', handler);
    },
    onRequest: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('tunnel:evt:request', handler);
      return () => ipcRenderer.removeListener('tunnel:evt:request', handler);
    },
    onDownloadProgress: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('tunnel:evt:download-progress', handler);
      return () => ipcRenderer.removeListener('tunnel:evt:download-progress', handler);
    },
  },

  // Live Server
  liveServer: {
    start: (options: {
      rootPath: string;
      port?: number;
      label?: string;
      protocol?: 'http' | 'https';
      liveReload?: boolean;
      openBrowser?: boolean;
      spaMode?: boolean;
      cors?: boolean;
      watchExtensions?: string[];
    }) => ipcRenderer.invoke('live-server:start', options),
    stop: (id: string) => ipcRenderer.invoke('live-server:stop', id),
    stopAll: () => ipcRenderer.invoke('live-server:stop-all'),
    list: () => ipcRenderer.invoke('live-server:list'),
    get: (id: string) => ipcRenderer.invoke('live-server:get', id),
    updateLabel: (id: string, label: string) => ipcRenderer.invoke('live-server:update-label', id, label),
    copyUrl: (id: string) => ipcRenderer.invoke('live-server:copy-url', id),
    openInBrowser: (id: string) => ipcRenderer.invoke('live-server:open-browser', id),
    openFolder: (id: string) => ipcRenderer.invoke('live-server:open-folder', id),
    findFreePort: (preferredPort?: number) => ipcRenderer.invoke('live-server:find-free-port', preferredPort),
    onStatusChanged: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('live-server:evt:status', handler);
      return () => ipcRenderer.removeListener('live-server:evt:status', handler);
    },
    onRequest: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('live-server:evt:request', handler);
      return () => ipcRenderer.removeListener('live-server:evt:request', handler);
    },
    onFileChanged: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('live-server:evt:file-changed', handler);
      return () => ipcRenderer.removeListener('live-server:evt:file-changed', handler);
    },
  },

  // Chat Collaboration
  chat: {
    create: (options: { name: string; userName: string; localPort?: number; openJoin?: boolean; tunnelId?: string | null; aiEnabled?: boolean; aiAgentId?: string }) =>
      ipcRenderer.invoke('chat:create', options),
    join: (options: { url: string; userName: string }) =>
      ipcRenderer.invoke('chat:join', options),
    leave: (roomId: string) => ipcRenderer.invoke('chat:leave', roomId),
    close: (roomId: string) => ipcRenderer.invoke('chat:close', roomId),
    list: () => ipcRenderer.invoke('chat:list'),
    get: (roomId: string) => ipcRenderer.invoke('chat:get', roomId),
    send: (roomId: string, content: string, replyToId?: string) => ipcRenderer.invoke('chat:send', roomId, content, replyToId),
    sendCode: (roomId: string, code: string, language: string, replyToId?: string) => ipcRenderer.invoke('chat:send-code', roomId, code, language, replyToId),
    sendFile: (roomId: string, fileName: string, fileData: string, fileMimeType: string) => ipcRenderer.invoke('chat:send-file', roomId, fileName, fileData, fileMimeType),
    editMessage: (roomId: string, messageId: string, newContent: string, senderId: string) => ipcRenderer.invoke('chat:edit-message', roomId, messageId, newContent, senderId),
    deleteMessage: (roomId: string, messageId: string, senderId: string) => ipcRenderer.invoke('chat:delete-message', roomId, messageId, senderId),
    updateName: (roomId: string, name: string) => ipcRenderer.invoke('chat:update-name', roomId, name),
    copyUrl: (roomId: string) => ipcRenderer.invoke('chat:copy-url', roomId),
    findFreePort: (preferred?: number) => ipcRenderer.invoke('chat:find-free-port', preferred),
    updatePublicUrl: (roomId: string, publicUrl: string, tunnelId: string) => ipcRenderer.invoke('chat:update-public-url', roomId, publicUrl, tunnelId),
    kick: (roomId: string, userId: string) => ipcRenderer.invoke('chat:kick', roomId, userId),
    typing: (roomId: string, userId: string, userName: string, isTyping: boolean) => ipcRenderer.invoke('chat:typing', roomId, userId, userName, isTyping),
    react: (roomId: string, messageId: string, emoji: string, userId: string, userName: string) => ipcRenderer.invoke('chat:react', roomId, messageId, emoji, userId, userName),
    read: (roomId: string, messageId: string, userId: string) => ipcRenderer.invoke('chat:read', roomId, messageId, userId),
    presence: (roomId: string, userId: string, activeFile?: string, activeLine?: number) => ipcRenderer.invoke('chat:presence', roomId, userId, activeFile, activeLine),
    approveJoin: (roomId: string, requestId: string) => ipcRenderer.invoke('chat:approve-join', roomId, requestId),
    denyJoin: (roomId: string, requestId: string) => ipcRenderer.invoke('chat:deny-join', roomId, requestId),
    toggleAi: (roomId: string, enabled: boolean, agentId?: string) => ipcRenderer.invoke('chat:toggle-ai', roomId, enabled, agentId),
    downloadFile: (fileName: string, fileData: string, mimeType: string) => ipcRenderer.invoke('chat:download-file', fileName, fileData, mimeType),
    showNotification: (title: string, body: string, roomId: string) => ipcRenderer.invoke('chat:show-notification', title, body, roomId),
    onMessage: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:message', handler);
      return () => ipcRenderer.removeListener('chat:evt:message', handler);
    },
    onUserJoined: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:user-joined', handler);
      return () => ipcRenderer.removeListener('chat:evt:user-joined', handler);
    },
    onUserLeft: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:user-left', handler);
      return () => ipcRenderer.removeListener('chat:evt:user-left', handler);
    },
    onStatus: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:status', handler);
      return () => ipcRenderer.removeListener('chat:evt:status', handler);
    },
    onRoomClosed: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:room-closed', handler);
      return () => ipcRenderer.removeListener('chat:evt:room-closed', handler);
    },
    onTyping: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:typing', handler);
      return () => ipcRenderer.removeListener('chat:evt:typing', handler);
    },
    onReaction: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:reaction', handler);
      return () => ipcRenderer.removeListener('chat:evt:reaction', handler);
    },
    onRead: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:read', handler);
      return () => ipcRenderer.removeListener('chat:evt:read', handler);
    },
    onPresence: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:presence', handler);
      return () => ipcRenderer.removeListener('chat:evt:presence', handler);
    },
    onJoinRequest: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:join-request', handler);
      return () => ipcRenderer.removeListener('chat:evt:join-request', handler);
    },
    onJoinResponse: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:join-response', handler);
      return () => ipcRenderer.removeListener('chat:evt:join-response', handler);
    },
    onMessageEdited: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:message-edited', handler);
      return () => ipcRenderer.removeListener('chat:evt:message-edited', handler);
    },
    onMessageDeleted: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('chat:evt:message-deleted', handler);
      return () => ipcRenderer.removeListener('chat:evt:message-deleted', handler);
    },
  },

  // Mock Server
  mockServer: {
    create: (options: { name: string; port?: number; cors?: boolean }) => ipcRenderer.invoke('mock-server:create', options),
    delete: (id: string) => ipcRenderer.invoke('mock-server:delete', id),
    list: () => ipcRenderer.invoke('mock-server:list'),
    get: (id: string) => ipcRenderer.invoke('mock-server:get', id),
    update: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('mock-server:update', id, updates),
    start: (id: string) => ipcRenderer.invoke('mock-server:start', id),
    stop: (id: string) => ipcRenderer.invoke('mock-server:stop', id),
    stopAll: () => ipcRenderer.invoke('mock-server:stop-all'),
    endpointAdd: (serverId: string, endpoint: Record<string, unknown>) => ipcRenderer.invoke('mock-server:endpoint:add', serverId, endpoint),
    endpointUpdate: (serverId: string, endpointId: string, updates: Record<string, unknown>) => ipcRenderer.invoke('mock-server:endpoint:update', serverId, endpointId, updates),
    endpointDelete: (serverId: string, endpointId: string) => ipcRenderer.invoke('mock-server:endpoint:delete', serverId, endpointId),
    endpointReorder: (serverId: string, orderedIds: string[]) => ipcRenderer.invoke('mock-server:endpoint:reorder', serverId, orderedIds),
    logsGet: (serverId: string) => ipcRenderer.invoke('mock-server:logs:get', serverId),
    logsClear: (serverId: string) => ipcRenderer.invoke('mock-server:logs:clear', serverId),
    findFreePort: (preferred?: number) => ipcRenderer.invoke('mock-server:find-free-port', preferred),
    copyUrl: (serverId: string) => ipcRenderer.invoke('mock-server:copy-url', serverId),
    onStatusChanged: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('mock-server:evt:status', handler);
      return () => ipcRenderer.removeListener('mock-server:evt:status', handler);
    },
    onRequest: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('mock-server:evt:request', handler);
      return () => ipcRenderer.removeListener('mock-server:evt:request', handler);
    },
  },

  // Snippets
  snippets: {
    get: () => ipcRenderer.invoke(CH.SNIPPETS_GET),
    set: (snippets: unknown[]) => ipcRenderer.invoke(CH.SNIPPETS_SET, snippets),
  },

  // Log
  log: {
    info: (message: string, ...args: unknown[]) => ipcRenderer.send(CH.LOG_INFO, message, ...args),
    warn: (message: string, ...args: unknown[]) => ipcRenderer.send(CH.LOG_WARN, message, ...args),
    error: (message: string, ...args: unknown[]) => ipcRenderer.send(CH.LOG_ERROR, message, ...args),
    debug: (message: string, ...args: unknown[]) => ipcRenderer.send(CH.LOG_DEBUG, message, ...args),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type HypothesisAPI = typeof api;
