/**
 * Extension API IPC Handlers
 * Exposes the full extension API to renderer via IPC.
 * Enables extensions to access editor, settings, terminal, git, etc.
 */
import { ipcMain, BrowserWindow, dialog } from 'electron';
import type { AppStore } from '../services/AppStore';
import type { PluginService } from '../services/PluginService';
import type { SettingsService } from '../services/SettingsService';
import type { ThemeService } from '../services/ThemeService';
import type { FileService } from '../services/FileService';
import type { GitService } from '../services/GitService';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';

export function registerExtensionIPC(
  appStore: AppStore,
  pluginService: PluginService,
  settingsService: SettingsService,
  themeService: ThemeService,
  fileService: FileService,
  gitService: GitService,
): void {
  const getMainWindow = () => BrowserWindow.getAllWindows()[0];

  // ── Editor state sync (renderer pushes updates) ─────────────
  ipcMain.on('ext:editor:stateUpdate', (_e, data: { uri: string; content: string; language: string; filePath: string | null } | null) => {
    pluginService.updateEditorState(data);
  });

  ipcMain.on('ext:editor:selectionUpdate', (_e, data: { start: { line: number; column: number }; end: { line: number; column: number } } | null) => {
    pluginService.updateSelectionState(data);
  });

  // ── Commands ──────────────────────────────────────────────────
  ipcMain.handle('ext:commands:register', (_e, _commandId: string) => {
    // Registration is done via plugin context; this is for renderer-side tracking
    return true;
  });

  ipcMain.handle('ext:commands:execute', async (_e, commandId: string, args: unknown[]) => {
    try {
      return await pluginService.executeCommand(commandId, args);
    } catch (err: any) {
      logger.error(`ext:commands:execute failed for ${commandId}: ${err.message}`);
      throw err;
    }
  });

  ipcMain.handle('ext:commands:list', () => {
    return pluginService.getExtensionCommands();
  });

  // ── Editor ────────────────────────────────────────────────────
  ipcMain.handle('ext:editor:getActiveDocument', () => {
    const win = getMainWindow();
    if (!win) return null;
    // Synchronous read from renderer store via IPC
    return win.webContents.send('ext:editor:getActiveDocument:sync');
  });

  ipcMain.handle('ext:editor:getOpenDocuments', () => {
    const win = getMainWindow();
    if (!win) return [];
    return null; // Handled by renderer-side SDK
  });

  ipcMain.handle('ext:editor:openFile', async (_e, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('ext:editor:openFile', { filePath, content });
      }
      return { filePath, content };
    } catch (err: any) {
      throw new Error(`Failed to open file: ${err.message}`);
    }
  });

  ipcMain.handle('ext:editor:saveFile', async (_e, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('ext:editor:fileSaved', { filePath });
      }
      return true;
    } catch (err: any) {
      throw new Error(`Failed to save file: ${err.message}`);
    }
  });

  ipcMain.handle('ext:editor:getDocumentContent', async (_e, filePath: string) => {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (err: any) {
      throw new Error(`Failed to read file: ${err.message}`);
    }
  });

  // ── Settings ──────────────────────────────────────────────────
  ipcMain.handle('ext:settings:get', (_e, key: string) => {
    const settings = appStore.get('settings') as Record<string, unknown>;
    return settings?.[key];
  });

  ipcMain.handle('ext:settings:set', async (_e, key: string, value: unknown) => {
    const settings = appStore.get('settings') as Record<string, unknown>;
    settings[key] = value;
    appStore.set('settings', settings);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('settings:changed', settings);
    }
    return true;
  });

  ipcMain.handle('ext:settings:getAll', () => {
    return appStore.get('settings');
  });

  ipcMain.handle('ext:settings:getSection', (_e, section: string) => {
    const settings = appStore.get('settings') as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const prefix = section + '.';
    for (const [key, value] of Object.entries(settings || {})) {
      if (key.startsWith(prefix)) {
        result[key.slice(prefix.length)] = value;
      }
    }
    return result;
  });

  // ── Theme ─────────────────────────────────────────────────────
  ipcMain.handle('ext:theme:getCurrent', () => {
    const themeId = appStore.get('theme');
    return themeService.getThemes().find(t => t.id === themeId) || undefined;
  });

  ipcMain.handle('ext:theme:list', () => {
    return themeService.getThemes();
  });

  ipcMain.handle('ext:theme:set', async (_e, themeId: string) => {
    appStore.set('theme', themeId);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('theme:changed', themeId);
    }
    return true;
  });

  ipcMain.handle('ext:theme:register', (_e, themeDef: unknown) => {
    // Store custom theme for renderer to pick up
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:theme:registered', themeDef);
    }
    return true;
  });

  // ── File System ───────────────────────────────────────────────
  ipcMain.handle('ext:fs:readFile', async (_e, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('ext:fs:writeFile', async (_e, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('ext:fs:exists', async (_e, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('ext:fs:readDir', async (_e, dirPath: string) => {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
      isSymbolicLink: e.isSymbolicLink(),
    }));
  });

  ipcMain.handle('ext:fs:mkdir', async (_e, dirPath: string, options?: { recursive?: boolean }) => {
    await fs.mkdir(dirPath, { recursive: options?.recursive ?? false });
    return true;
  });

  ipcMain.handle('ext:fs:delete', async (_e, targetPath: string, options?: { recursive?: boolean }) => {
    await fs.rm(targetPath, { recursive: options?.recursive ?? false, force: true });
    return true;
  });

  ipcMain.handle('ext:fs:rename', async (_e, oldPath: string, newPath: string) => {
    await fs.rename(oldPath, newPath);
    return true;
  });

  ipcMain.handle('ext:fs:stat', async (_e, filePath: string) => {
    const stat = await fs.stat(filePath);
    return {
      size: stat.size,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      isSymbolicLink: stat.isSymbolicLink(),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    };
  });

  ipcMain.handle('ext:fs:watch', (_e, _filePath: string) => {
    // File watching is delegated to renderer's file watcher
    return true;
  });

  ipcMain.handle('ext:fs:unwatch', (_e, _filePath: string) => {
    return true;
  });

  // ── Monaco theme cache (so renderer can request on mount) ─────
  const monacoThemeCache = new Map<string, { baseTheme: string; rules: any[]; colors: Record<string, string> }>();

  ipcMain.handle('ext:monaco:getCachedThemes', () => {
    return Array.from(monacoThemeCache.entries()).map(([themeId, data]) => ({ themeId, ...data }));
  });

  // Also listen for renderer requesting cached themes (one-way)
  ipcMain.on('ext:monaco:requestCachedThemes', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      const themes = Array.from(monacoThemeCache.entries()).map(([themeId, data]) => ({ themeId, ...data }));
      win.webContents.send('ext:monaco:cachedThemes', themes);
    }
  });

  ipcMain.handle('ext:monaco:unregister', (_e, themeIds: string[]) => {
    for (const id of themeIds) monacoThemeCache.delete(id);
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:monaco:unregister', themeIds);
    }
    return true;
  });

  // ── Terminal ──────────────────────────────────────────────────
  ipcMain.handle('ext:terminal:create', (_e, options?: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:terminal:create', options);
    }
    return true;
  });

  ipcMain.handle('ext:terminal:write', (_e, terminalId: string, data: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:terminal:write', { terminalId, data });
    }
    return true;
  });

  ipcMain.handle('ext:terminal:close', (_e, terminalId: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:terminal:close', { terminalId });
    }
    return true;
  });

  ipcMain.handle('ext:terminal:list', () => {
    const win = getMainWindow();
    if (!win) return [];
    // Renderer handles this
    return [];
  });

  ipcMain.handle('ext:terminal:runCommand', (_e, command: string, cwd?: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:terminal:runCommand', { command, cwd });
    }
    return true;
  });

  // ── Git ───────────────────────────────────────────────────────
  ipcMain.handle('ext:git:status', async (_e, repoPath: string) => {
    try {
      return await gitService.getStatus(repoPath);
    } catch (err: any) {
      throw new Error(`Git status failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:log', async (_e, repoPath: string, maxCount?: number) => {
    try {
      return await gitService.log(repoPath, maxCount);
    } catch (err: any) {
      throw new Error(`Git log failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:diff', async (_e, repoPath: string, file?: string) => {
    try {
      return await gitService.diff(repoPath, file);
    } catch (err: any) {
      throw new Error(`Git diff failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:branch', async (_e, repoPath: string) => {
    try {
      return await gitService.getBranches(repoPath);
    } catch (err: any) {
      throw new Error(`Git branch failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:commit', async (_e, repoPath: string, message: string, files?: string[]) => {
    try {
      return await gitService.commit(repoPath, message, files);
    } catch (err: any) {
      throw new Error(`Git commit failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:push', async (_e, repoPath: string, remote?: string) => {
    try {
      return await gitService.push(repoPath, remote);
    } catch (err: any) {
      throw new Error(`Git push failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:pull', async (_e, repoPath: string, remote?: string) => {
    try {
      return await gitService.pull(repoPath, remote);
    } catch (err: any) {
      throw new Error(`Git pull failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:fetch', async (_e, repoPath: string, remote?: string) => {
    try {
      return await gitService.fetch(repoPath, remote);
    } catch (err: any) {
      throw new Error(`Git fetch failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:add', async (_e, repoPath: string, files: string[]) => {
    try {
      return await gitService.add(repoPath, files);
    } catch (err: any) {
      throw new Error(`Git add failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:reset', async (_e, repoPath: string, files?: string[]) => {
    try {
      return await gitService.reset(repoPath, files);
    } catch (err: any) {
      throw new Error(`Git reset failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:stash', async (_e, repoPath: string) => {
    try {
      return await gitService.stash(repoPath);
    } catch (err: any) {
      throw new Error(`Git stash failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:checkout', async (_e, repoPath: string, branch: string) => {
    try {
      return await gitService.checkout(repoPath, branch);
    } catch (err: any) {
      throw new Error(`Git checkout failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:merge', async (_e, repoPath: string, branch: string) => {
    try {
      return await gitService.merge(repoPath, branch);
    } catch (err: any) {
      throw new Error(`Git merge failed: ${err.message}`);
    }
  });

  ipcMain.handle('ext:git:init', async (_e, repoPath: string) => {
    try {
      return await gitService.init(repoPath);
    } catch (err: any) {
      throw new Error(`Git init failed: ${err.message}`);
    }
  });

  // ── Workspace ─────────────────────────────────────────────────
  ipcMain.handle('ext:workspace:getRootPath', () => {
    return appStore.get('recentWorkspaces')?.[0] || undefined;
  });

  ipcMain.handle('ext:workspace:getFolders', () => {
    const recent = appStore.get('recentWorkspaces') || [];
    return recent.length > 0 ? [{ uri: recent[0], name: recent[0].split(/[/\\]/).pop() || '', path: recent[0] }] : [];
  });

  ipcMain.handle('ext:workspace:getRecent', () => {
    return appStore.get('recentWorkspaces') || [];
  });

  ipcMain.handle('ext:workspace:openFolder', async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('ext:workspace:openFile', async () => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // ── UI ────────────────────────────────────────────────────────
  ipcMain.handle('ext:ui:showMessage', (_e, type: 'info' | 'warning' | 'error', message: string, items?: string[]) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:message', { type, message, items });
    }
    return true;
  });

  ipcMain.handle('ext:ui:showInput', (_e, options: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:showInput', options);
    }
    return true;
  });

  ipcMain.handle('ext:ui:showQuickPick', (_e, items: unknown[], options?: unknown) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:showQuickPick', { items, options });
    }
    return true;
  });

  ipcMain.handle('ext:ui:showDialog', async (_e, options: Electron.MessageBoxOptions) => {
    const win = getMainWindow();
    if (!win) return null;
    return dialog.showMessageBox(win, options);
  });

  ipcMain.handle('ext:ui:showOpenDialog', async (_e, options: Electron.OpenDialogOptions) => {
    const win = getMainWindow();
    if (!win) return null;
    return dialog.showOpenDialog(win, options);
  });

  ipcMain.handle('ext:ui:showSaveDialog', async (_e, options: Electron.SaveDialogOptions) => {
    const win = getMainWindow();
    if (!win) return null;
    return dialog.showSaveDialog(win, options);
  });

  ipcMain.handle('ext:ui:setStatusBar', (_e, id: string, text: string, alignment: 'left' | 'right', priority?: number) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:setStatusBar', { id, text, alignment, priority });
    }
    return true;
  });

  ipcMain.handle('ext:ui:updateStatusBar', (_e, id: string, text: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:updateStatusBar', { id, text });
    }
    return true;
  });

  ipcMain.handle('ext:ui:createPanel', (_e, id: string, title: string, content: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:createPanel', { id, title, content });
    }
    return true;
  });

  ipcMain.handle('ext:ui:updatePanel', (_e, id: string, content: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:updatePanel', { id, content });
    }
    return true;
  });

  ipcMain.handle('ext:ui:showPanel', (_e, id: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:showPanel', { id });
    }
    return true;
  });

  ipcMain.handle('ext:ui:hidePanel', (_e, id: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:hidePanel', { id });
    }
    return true;
  });

  ipcMain.handle('ext:ui:createSidebarView', (_e, id: string, title: string, content: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:createSidebarView', { id, title, content });
    }
    return true;
  });

  ipcMain.handle('ext:ui:showSidebarView', (_e, id: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:ui:showSidebarView', { id });
    }
    return true;
  });

  // ── Clipboard ─────────────────────────────────────────────────
  ipcMain.handle('ext:clipboard:read', async () => {
    const { clipboard } = require('electron');
    return clipboard.readText();
  });

  ipcMain.handle('ext:clipboard:write', async (_e, text: string) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    return true;
  });

  // ── Notifications ─────────────────────────────────────────────
  ipcMain.handle('ext:notification:show', (_e, message: string, type?: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('ext:notification', { message, type: type || 'info' });
    }
    return true;
  });

  // ── Monaco theme registration (cached for renderer to request) ──
  ipcMain.handle('ext:monaco:defineTheme', (_e, data: { themeId: string; baseTheme: string; rules: any[]; colors: Record<string, string> }) => {
    if (data?.themeId) {
      monacoThemeCache.set(data.themeId, { baseTheme: data.baseTheme, rules: data.rules, colors: data.colors });
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('ext:monaco:defineTheme', data);
      }
    }
    return true;
  });

  // ── Storage (per-extension key-value store) ───────────────────
  ipcMain.handle('ext:storage:get', (_e, pluginId: string, key: string) => {
    const states = appStore.get('pluginStates');
    const pluginState = states[pluginId];
    const storage = (pluginState?.config as Record<string, unknown>) || {};
    return storage[key];
  });

  ipcMain.handle('ext:storage:set', (_e, pluginId: string, key: string, value: unknown) => {
    const states = appStore.get('pluginStates');
    if (!states[pluginId]) {
      states[pluginId] = { enabled: true, config: {} };
    }
    const config = (states[pluginId].config as Record<string, unknown>) || {};
    config[key] = value;
    states[pluginId].config = config;
    appStore.set('pluginStates', states);
    return true;
  });

  ipcMain.handle('ext:storage:getAll', (_e, pluginId: string) => {
    const states = appStore.get('pluginStates');
    return states[pluginId]?.config || {};
  });

  ipcMain.handle('ext:storage:delete', (_e, pluginId: string, key: string) => {
    const states = appStore.get('pluginStates');
    const config = (states[pluginId]?.config as Record<string, unknown>) || {};
    delete config[key];
    if (states[pluginId]) states[pluginId].config = config;
    appStore.set('pluginStates', states);
    return true;
  });

  ipcMain.handle('ext:storage:clear', (_e, pluginId: string) => {
    const states = appStore.get('pluginStates');
    if (states[pluginId]) states[pluginId].config = {};
    appStore.set('pluginStates', states);
    return true;
  });

  // ── HTTP (fetch from extensions) ──────────────────────────────
  ipcMain.handle('ext:http:fetch', async (_e, url: string, options?: RequestInit) => {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: text,
      };
    } catch (err: any) {
      throw new Error(`HTTP fetch failed: ${err.message}`);
    }
  });

  // ── Process ───────────────────────────────────────────────────
  ipcMain.handle('ext:process:exec', async (_e, command: string, options?: { cwd?: string; env?: Record<string, string>; timeout?: number }) => {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    try {
      const result = await execAsync(command, {
        cwd: options?.cwd,
        env: { ...process.env, ...options?.env },
        timeout: options?.timeout || 30000,
        windowsHide: true,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
      };
    }
  });

  ipcMain.handle('ext:process:getEnv', (_e, key: string) => {
    return process.env[key];
  });

  ipcMain.handle('ext:process:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('ext:process:getArch', () => {
    return process.arch;
  });

  ipcMain.handle('ext:process:getVersion', () => {
    return process.version;
  });

  ipcMain.handle('ext:process:getAppPath', () => {
    return process.cwd();
  });

  ipcMain.handle('ext:process:getExtensionPath', (_e, pluginId: string) => {
    const plugin = pluginService.getPlugin?.(pluginId);
    return plugin?.path || null;
  });

  ipcMain.handle('ext:process:getTempPath', () => {
    return require('os').tmpdir();
  });

  ipcMain.handle('ext:process:getHomePath', () => {
    return require('os').homedir();
  });

  logger.info('Extension API IPC handlers registered');
}
