/**
 * Plugin Service - Manages editor plugins/extensions.
 * Extensions are distributed as .hyp files (tar archives).
 * Installed extensions are stored in ~/.hypothesis/extensions/
 * 
 * Extensions are loaded and activated in the main process using require().
 * Commands are exposed to the renderer via IPC.
 */
import type { AppStore } from './AppStore';
import type { PluginManifest } from '../../shared/types';
import type { GitService } from './GitService';
import type { ThemeService } from './ThemeService';
import { logger } from '../utils/logger';
import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const HYP_EXTENSION_DIR = path.join(os.homedir(), '.hypothesis', 'extensions');

interface InstalledPlugin {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  loaded: boolean;
  instance: any | null;
  registeredCommands: Map<string, (...args: any[]) => any>;
}

export class PluginService {
  private appStore: AppStore;
  private plugins: Map<string, InstalledPlugin> = new Map();
  private gitService: GitService | null = null;
  private themeService: ThemeService | null = null;

  // Cached editor state from renderer (pushed via IPC)
  private _activeDocument: { uri: string; content: string; language: string; filePath: string | null } | null = null;
  private _activeSelection: { start: { line: number; column: number }; end: { line: number; column: number } } | null = null;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
  }

  /** Called by IPC when renderer pushes editor state updates */
  updateEditorState(doc: { uri: string; content: string; language: string; filePath: string | null } | null) {
    this._activeDocument = doc;
  }

  updateSelectionState(sel: { start: { line: number; column: number }; end: { line: number; column: number } } | null) {
    this._activeSelection = sel;
  }

  /** Inject services needed for extension context */
  setDependencies(deps: { gitService?: GitService; themeService?: ThemeService }) {
    if (deps.gitService) this.gitService = deps.gitService;
    if (deps.themeService) this.themeService = deps.themeService;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(HYP_EXTENSION_DIR, { recursive: true });

    const states = this.appStore.get('pluginStates');
    const installedPaths: Record<string, string> = (states as any).__installedPaths || {};
    let restored = 0;

    for (const [id, pluginPath] of Object.entries(installedPaths)) {
      try {
        const manifestPath = path.join(pluginPath, 'package.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest: PluginManifest = JSON.parse(manifestContent);
        const pluginState = states[id];
        this.plugins.set(id, {
          manifest,
          path: pluginPath,
          enabled: pluginState?.enabled !== false,
          loaded: false,
          instance: null,
          registeredCommands: new Map(),
        });
        restored++;
      } catch (e) {
        try {
          const dirExists = await fs.stat(pluginPath).then(s => s.isDirectory()).catch(() => false);
          if (dirExists) {
            logger.warn(`Extension manifest missing for ${id} at ${pluginPath}, keeping path for retry`);
          } else {
            delete installedPaths[id];
            delete states[id];
          }
        } catch {
          delete installedPaths[id];
          delete states[id];
        }
      }
    }

    (states as any).__installedPaths = installedPaths;
    this.appStore.set('pluginStates', states);

    // Auto-activate enabled plugins
    for (const [id, plugin] of this.plugins) {
      if (plugin.enabled) {
        try {
          await this.activate(id);
        } catch (e) {
          logger.error(`Failed to auto-activate plugin ${id}: ${e}`);
          // Try to recover by running npm install
          try {
            const extPkgPath = path.join(plugin.path, 'package.json');
            const extPkg = JSON.parse(await fs.readFile(extPkgPath, 'utf-8'));
            if (extPkg.dependencies && Object.keys(extPkg.dependencies).length > 0) {
              const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
              await execFileAsync(npmCmd, ['install', '--omit=dev'], { cwd: plugin.path, timeout: 60000, shell: true });
              await this.activate(id);
            }
          } catch (retryErr) {
            logger.error(`Recovery failed for plugin ${id}: ${retryErr}`);
          }
        }
      }
    }

    logger.info(`Plugin service initialized`, { restored, total: Object.keys(installedPaths).length });
  }

  /**
   * Get all plugins (serializable for IPC).
   */
  getPlugins(): Array<{ manifest: PluginManifest; path: string; enabled: boolean; loaded: boolean; activated: boolean }> {
    return Array.from(this.plugins.values()).map(p => ({
      manifest: p.manifest,
      path: p.path,
      enabled: p.enabled,
      loaded: p.loaded,
      activated: p.loaded,
    }));
  }

  /**
   * Get a specific plugin by ID (for extension API).
   */
  getPlugin(pluginId: string): InstalledPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered commands from all active extensions.
   */
  getExtensionCommands(): Array<{ id: string; label: string; category: string; pluginId: string }> {
    const commands: Array<{ id: string; label: string; category: string; pluginId: string }> = [];
    for (const [pluginId, plugin] of this.plugins) {
      if (!plugin.enabled) continue;
      const contribs = plugin.manifest.contributes?.commands || [];
      for (const cmd of contribs) {
        commands.push({
          id: cmd.command,
          label: cmd.title,
          category: plugin.manifest.name || pluginId,
          pluginId,
        });
      }
    }
    return commands;
  }

  /**
   * Execute an extension command by ID.
   */
  async executeCommand(commandId: string, args?: unknown): Promise<any> {
    // First: find a handler that's already loaded
    for (const [, plugin] of this.plugins) {
      if (!plugin.enabled || !plugin.loaded) continue;
      const handler = plugin.registeredCommands.get(commandId);
      if (handler) {
        return handler(args);
      }
    }
    // Second: find which plugin owns this command from manifest and activate it on-demand
    for (const [, plugin] of this.plugins) {
      if (!plugin.enabled) continue;
      const contribs = plugin.manifest.contributes?.commands || [];
      if (contribs.some(c => c.command === commandId)) {
        try {
          await this.activate(plugin.manifest.id);
          const handler = plugin.registeredCommands.get(commandId);
          if (handler) return handler(args);
        } catch (e: any) {
          logger.error(`Failed to activate plugin for command ${commandId}: ${e.message}`);
          throw new Error(`Extension ${plugin.manifest.name} failed to activate: ${e.message}`);
        }
      }
    }
    throw new Error(`Extension command not found: ${commandId}`);
  }

  /**
   * Pack an extension folder into a .hyp file.
   */
  async packExtension(folderPath: string, outputPath?: string): Promise<string> {
    const manifestPath = path.join(folderPath, 'package.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    const output = outputPath || path.join(
      path.dirname(folderPath),
      `${manifest.id}-${manifest.version}.hyp`
    );

    try {
      await execFileAsync('tar', ['-cf', output, '-C', path.dirname(folderPath), path.basename(folderPath)], { timeout: 30000 });
    } catch {
      await this.createHypArchive(folderPath, output);
    }

    logger.info(`Extension packed: ${output}`);
    return output;
  }

  /**
   * Install a .hyp extension file.
   */
  async installHyp(hypFilePath: string): Promise<InstalledPlugin> {
    const tempDir = path.join(os.tmpdir(), `hyp-install-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    try {
      await execFileAsync('tar', ['-xf', hypFilePath, '-C', tempDir], { timeout: 30000 });
    } catch {
      throw new Error('Failed to extract .hyp file. Ensure tar is available.');
    }

    let manifestPath: string;
    let extensionDir: string;

    const directManifest = path.join(tempDir, 'package.json');
    try {
      await fs.access(directManifest);
      manifestPath = directManifest;
      extensionDir = tempDir;
    } catch {
      const entries = await fs.readdir(tempDir, { withFileTypes: true });
      const subfolder = entries.find(e => e.isDirectory());
      if (subfolder) {
        extensionDir = path.join(tempDir, subfolder.name);
        manifestPath = path.join(extensionDir, 'package.json');
      } else {
        throw new Error('Invalid .hyp file: no package.json found');
      }
    }

    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    const installPath = path.join(HYP_EXTENSION_DIR, manifest.id);
    await fs.rm(installPath, { recursive: true, force: true });
    await fs.cp(extensionDir, installPath, { recursive: true });
    await fs.rm(tempDir, { recursive: true, force: true });

    // Install npm dependencies
    const extPkgPath = path.join(installPath, 'package.json');
    try {
      const extPkg = JSON.parse(await fs.readFile(extPkgPath, 'utf-8'));
      if (extPkg.dependencies && Object.keys(extPkg.dependencies).length > 0) {
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execFileAsync(npmCmd, ['install', '--omit=dev'], { cwd: installPath, timeout: 60000, shell: true });
      }
    } catch (e) {
      logger.warn(`Failed to install dependencies for ${manifest.id}: ${e}`);
    }

    const plugin: InstalledPlugin = {
      manifest,
      path: installPath,
      enabled: true,
      loaded: false,
      instance: null,
      registeredCommands: new Map(),
    };

    this.plugins.set(manifest.id, plugin);

    const states = this.appStore.get('pluginStates');
    states[manifest.id] = { enabled: true, config: {} };
    const installedPaths: Record<string, string> = (states as any).__installedPaths || {};
    installedPaths[manifest.id] = installPath;
    (states as any).__installedPaths = installedPaths;
    this.appStore.set('pluginStates', states);

    // Auto-activate the newly installed plugin
    await this.activate(manifest.id);

    // Notify renderer to refresh extension commands
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('extension:commands-changed');
    }

    logger.info(`Extension installed from .hyp: ${manifest.id} -> ${installPath}`);
    return plugin;
  }

  /**
   * Install from folder path.
   */
  async install(pluginPath: string): Promise<InstalledPlugin> {
    const manifestPath = path.join(pluginPath, 'package.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    const installPath = path.join(HYP_EXTENSION_DIR, manifest.id);
    await fs.rm(installPath, { recursive: true, force: true });
    await fs.cp(pluginPath, installPath, { recursive: true, filter: (src) => !src.includes('node_modules') });

    const plugin: InstalledPlugin = {
      manifest,
      path: installPath,
      enabled: true,
      loaded: false,
      instance: null,
      registeredCommands: new Map(),
    };

    this.plugins.set(manifest.id, plugin);

    const states = this.appStore.get('pluginStates');
    states[manifest.id] = { enabled: true, config: {} };
    const installedPaths: Record<string, string> = (states as any).__installedPaths || {};
    installedPaths[manifest.id] = installPath;
    (states as any).__installedPaths = installedPaths;
    this.appStore.set('pluginStates', states);

    // Install npm dependencies (same as installHyp)
    const extPkgPath = path.join(installPath, 'package.json');
    try {
      const extPkg = JSON.parse(await fs.readFile(extPkgPath, 'utf-8'));
      if (extPkg.dependencies && Object.keys(extPkg.dependencies).length > 0) {
        logger.info(`Installing dependencies for ${manifest.id}...`);
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execFileAsync(npmCmd, ['install', '--omit=dev'], { cwd: installPath, timeout: 60000, shell: true });
        logger.info(`Dependencies installed for ${manifest.id}`);
      }
    } catch (e) {
      logger.warn(`Failed to install dependencies for ${manifest.id}: ${e}`);
    }

    await this.activate(manifest.id);

    // Notify renderer to refresh extension commands
    const win = BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) {
      win.webContents.send('extension:commands-changed');
    }

    logger.info(`Plugin installed: ${manifest.id} from ${pluginPath}`);
    return plugin;
  }

  async uninstall(pluginId: string): Promise<void> {
    // Deactivate first
    await this.deactivate(pluginId);

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await fs.rm(plugin.path, { recursive: true, force: true }).catch(() => {});
    }

    this.plugins.delete(pluginId);

    const states = this.appStore.get('pluginStates');
    delete states[pluginId];
    const installedPaths: Record<string, string> = (states as any).__installedPaths || {};
    delete installedPaths[pluginId];
    (states as any).__installedPaths = installedPaths;
    this.appStore.set('pluginStates', states);

    logger.info(`Plugin uninstalled: ${pluginId}`);
  }

  async enable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
      const states = this.appStore.get('pluginStates');
      states[pluginId] = { ...states[pluginId], enabled: true };
      this.appStore.set('pluginStates', states);
      if (!plugin.loaded) {
        await this.activate(pluginId);
      }
    }
  }

  async disable(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      await this.deactivate(pluginId);
      plugin.enabled = false;
      const states = this.appStore.get('pluginStates');
      states[pluginId] = { ...states[pluginId], enabled: false };
      this.appStore.set('pluginStates', states);
    }
  }

  /**
   * Activate a plugin: load its main file and call activate(context).
   */
  async activate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.loaded) return;

    try {
      const mainFile = plugin.manifest.main || 'extension.js';
      const mainPath = path.join(plugin.path, mainFile);

      // Clear require cache to allow re-loading
      delete require.cache[require.resolve(mainPath)];

      // require() the extension module
      const module = require(mainPath);
      plugin.instance = module.default || module;

      // Build plugin context
      const context = this.createPluginContext(plugin);

      if (plugin.instance?.activate) {
        await plugin.instance.activate(context);
      }

      plugin.loaded = true;
      logger.info(`Plugin activated: ${pluginId} (${plugin.registeredCommands.size} commands)`);
    } catch (error) {
      logger.error(`Failed to activate plugin ${pluginId}: ${error}`);
      throw error;
    }
  }

  /**
   * Deactivate a plugin: call deactivate() and clean up.
   */
  async deactivate(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.loaded) return;

    try {
      if (plugin.instance?.deactivate) {
        await plugin.instance.deactivate();
      }
    } catch (e) {
      logger.error(`Error deactivating plugin ${pluginId}: ${e}`);
    }

    plugin.registeredCommands.clear();
    plugin.instance = null;
    plugin.loaded = false;
    logger.info(`Plugin deactivated: ${pluginId}`);
  }

  /**
   * Create a context object for the plugin to interact with the editor.
   * Full API: commands, editor, settings, theme, fs, git, terminal, ui, storage, etc.
   */
  private createPluginContext(plugin: InstalledPlugin) {
    const getMainWindow = () => BrowserWindow.getAllWindows()[0];
    const sendToRenderer = (channel: string, ...args: unknown[]) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    };

    const subscriptions: Array<{ dispose: () => void }> = [];

    return {
      subscriptions,

      // ── Commands ──────────────────────────────────────────────
      commands: {
        registerCommand: (id: string, handler: (...args: any[]) => any) => {
          plugin.registeredCommands.set(id, handler);
          sendToRenderer('extension:command-registered', { pluginId: plugin.manifest.id, commandId: id });
          return { dispose: () => plugin.registeredCommands.delete(id) };
        },
        executeCommand: async (id: string, ...args: any[]) => {
          return this.executeCommand(id, ...args);
        },
      },

      // ── Window (legacy compat) ────────────────────────────────
      window: {
        activeEditor: null,
        showInformationMessage: (msg: string, ...items: string[]) => {
          sendToRenderer('extension:message', { type: 'info', text: msg, items });
          return Promise.resolve(undefined);
        },
        showWarningMessage: (msg: string, ...items: string[]) => {
          sendToRenderer('extension:message', { type: 'warning', text: msg, items });
          return Promise.resolve(undefined);
        },
        showErrorMessage: (msg: string, ...items: string[]) => {
          sendToRenderer('extension:message', { type: 'error', text: msg, items });
          return Promise.resolve(undefined);
        },
        showInputBox: async (options: any) => {
          sendToRenderer('extension:inputBox', options);
          return undefined;
        },
        showQuickPick: async (items: any[], options?: any) => {
          sendToRenderer('extension:quickPick', { items, options });
          return undefined;
        },
        createOutputChannel: (name: string) => {
          const channel = {
            name,
            lines: [] as string[],
            append: (value: string) => { channel.lines.push(value); },
            appendLine: (value: string) => { channel.lines.push(value + '\n'); },
            clear: () => { channel.lines.length = 0; },
            show: () => { sendToRenderer('extension:outputChannel:show', { name, content: channel.lines.join('') }); },
            hide: () => {},
            dispose: () => {},
          };
          return channel;
        },
        registerWebviewPanel: (viewType: string, title: string) => {
          sendToRenderer('extension:webview:register', { viewType, title });
          return {
            webview: {
              html: '',
              postMessage: (msg: unknown) => sendToRenderer('extension:webview:message', { viewType, message: msg }),
              onDidReceiveMessage: (handler: (msg: unknown) => void) => {
                // Listen for messages from renderer
                const listener = (_event: any, data: any) => {
                  if (data.viewType === viewType) handler(data.message);
                };
                ipcMain.on('extension:webview:fromRenderer', listener);
                return { dispose: () => ipcMain.removeListener('extension:webview:fromRenderer', listener) };
              },
            },
            title,
            visible: true,
            active: true,
            reveal: () => sendToRenderer('extension:webview:reveal', { viewType }),
            dispose: () => sendToRenderer('extension:webview:dispose', { viewType }),
            onDidDispose: (handler: () => void) => {
              // Simplified - in real impl, listen for dispose event
              return { dispose: () => {} };
            },
            onDidChangeViewState: (_handler: (e: any) => void) => {
              return { dispose: () => {} };
            },
          };
        },
      },

      // ── Workspace ─────────────────────────────────────────────
      workspace: {
        rootPath: undefined as string | undefined,
        workspaceFolders: undefined as any,
        getConfiguration: (section: string) => {
          const settings = this.appStore.get('settings') as any;
          const result: Record<string, any> = {};
          for (const [key, value] of Object.entries(settings || {})) {
            if (key.startsWith(section + '.')) {
              result[key.slice(section.length + 1)] = value;
            }
          }
          return {
            get: (key: string, defaultValue?: any) => result[key] ?? defaultValue,
            has: (key: string) => key in result,
            update: async (key: string, value: unknown) => {
              const fullKey = section ? `${section}.${key}` : key;
              const s = this.appStore.get('settings') as any;
              s[fullKey] = value;
              this.appStore.set('settings', s);
              sendToRenderer('settings:changed', s);
            },
            inspect: (key: string) => {
              const fullKey = section ? `${section}.${key}` : key;
              return { key: fullKey, defaultValue: undefined, globalValue: (this.appStore.get('settings') as any)?.[fullKey] };
            },
          };
        },
        onDidChangeConfiguration: (listener: () => void) => {
          const handler = () => listener();
          ipcMain.on('settings:changed', handler);
          return { dispose: () => ipcMain.removeListener('settings:changed', handler) };
        },
        onDidOpenTextDocument: (_listener: (doc: any) => void) => {
          return { dispose: () => {} };
        },
        onDidSaveTextDocument: (_listener: (doc: any) => void) => {
          return { dispose: () => {} };
        },
        onDidCloseTextDocument: (_listener: (doc: any) => void) => {
          return { dispose: () => {} };
        },
        openTextDocument: async (uri: string) => {
          const content = await fs.readFile(uri, 'utf-8');
          return { uri, fileName: uri, languageId: 'plaintext', version: 1, getText: () => content, lineAt: () => ({}) };
        },
        applyEdit: async (_edit: any) => {
          return true;
        },
      },

      // ── Languages ─────────────────────────────────────────────
      languages: {
        registerCompletionItemProvider: (selector: string, provider: any, ...triggers: string[]) => {
          sendToRenderer('extension:language:registerProvider', { type: 'completion', selector, triggers, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerHoverProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'hover', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerDefinitionProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'definition', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerDocumentFormattingEditProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'formatting', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerDocumentSymbolProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'symbols', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerCodeActionProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'codeAction', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerCodeLensProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'codeLens', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerReferenceProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'reference', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerRenameProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'rename', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerSignatureHelpProvider: (selector: string, provider: any, ...triggers: string[]) => {
          sendToRenderer('extension:language:registerProvider', { type: 'signatureHelp', selector, triggers, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerFoldingRangeProvider: (selector: string, provider: any) => {
          sendToRenderer('extension:language:registerProvider', { type: 'folding', selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
      },

      // ── Editor ────────────────────────────────────────────────
      editor: {
        getActiveDocument: () => {
          return this._activeDocument;
        },
        getSelection: () => {
          return this._activeSelection;
        },
        insertText: async (uri: string, position: any, text: string) => {
          sendToRenderer('extension:editor:insertText', { uri, position, text });
        },
        replaceText: async (uri: string, range: any, text: string) => {
          sendToRenderer('extension:editor:replaceText', { uri, range, text });
        },
        openDocument: async (uri: string) => {
          const content = await fs.readFile(uri, 'utf-8');
          sendToRenderer('extension:editor:openFile', { filePath: uri, content });
        },
        closeDocument: async (uri: string) => {
          sendToRenderer('extension:editor:closeFile', { uri });
        },
        onDidChangeActiveEditor: (listener: (editor: { uri: string } | null) => void) => {
          const handler = (_event: any, data: any) => listener(data);
          ipcMain.on('extension:editor:activeChanged', handler);
          return { dispose: () => ipcMain.removeListener('extension:editor:activeChanged', handler) };
        },
      },

      // ── Terminal ──────────────────────────────────────────────
      terminal: {
        create: async (options?: { shell?: string; cwd?: string; name?: string }) => {
          const id = `ext-term-${Date.now()}`;
          sendToRenderer('ext:terminal:create', { ...options, id });
          return id;
        },
        write: (terminalId: string, data: string) => {
          sendToRenderer('ext:terminal:write', { terminalId, data });
        },
        close: async (terminalId: string) => {
          sendToRenderer('ext:terminal:close', { terminalId });
        },
        onDidWriteData: (listener: (data: { terminalId: string; data: string }) => void) => {
          const handler = (_event: any, data: any) => listener(data);
          ipcMain.on('ext:terminal:data', handler);
          return { dispose: () => ipcMain.removeListener('ext:terminal:data', handler) };
        },
        onDidCloseTerminal: (listener: (terminalId: string) => void) => {
          const handler = (_event: any, data: any) => listener(data.terminalId);
          ipcMain.on('ext:terminal:exit', handler);
          return { dispose: () => ipcMain.removeListener('ext:terminal:exit', handler) };
        },
      },

      // ── Status Bar ────────────────────────────────────────────
      statusbar: {
        createItem: (id: string, text: string, alignment: 'left' | 'right', priority?: number) => {
          sendToRenderer('ext:ui:setStatusBar', { id, text, alignment, priority });
          return {
            dispose: () => sendToRenderer('ext:ui:hideStatusBar', { id }),
          };
        },
        updateItem: (id: string, text: string) => {
          sendToRenderer('ext:ui:updateStatusBar', { id, text });
        },
        showItem: (id: string) => {
          sendToRenderer('ext:ui:showStatusBar', { id });
        },
        hideItem: (id: string) => {
          sendToRenderer('ext:ui:hideStatusBar', { id });
        },
      },

      // ── Panels ────────────────────────────────────────────────
      panels: {
        createPanel: (id: string, title: string, content: string) => {
          sendToRenderer('ext:ui:createPanel', { id, title, content });
          return {
            dispose: () => sendToRenderer('ext:ui:hidePanel', { id }),
          };
        },
        showPanel: (id: string) => sendToRenderer('ext:ui:showPanel', { id }),
        hidePanel: (id: string) => sendToRenderer('ext:ui:hidePanel', { id }),
        updatePanel: (id: string, content: string) => sendToRenderer('ext:ui:updatePanel', { id, content }),
      },

      // ── Menus ─────────────────────────────────────────────────
      menus: {
        registerMenu: (menuId: string, items: any[]) => {
          sendToRenderer('extension:menu:register', { menuId, items, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
        registerContextMenu: (menuId: string, items: any[]) => {
          sendToRenderer('extension:contextMenu:register', { menuId, items, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
      },

      // ── Events ────────────────────────────────────────────────
      events: {
        onDidSaveTextDocument: (listener: (doc: any) => void) => {
          const handler = (_event: any, doc: any) => listener(doc);
          ipcMain.on('extension:event:fileSaved', handler);
          return { dispose: () => ipcMain.removeListener('extension:event:fileSaved', handler) };
        },
        onDidOpenTextDocument: (listener: (doc: any) => void) => {
          const handler = (_event: any, doc: any) => listener(doc);
          ipcMain.on('extension:event:fileOpened', handler);
          return { dispose: () => ipcMain.removeListener('extension:event:fileOpened', handler) };
        },
        onDidCloseTextDocument: (listener: (doc: any) => void) => {
          const handler = (_event: any, doc: any) => listener(doc);
          ipcMain.on('extension:event:fileClosed', handler);
          return { dispose: () => ipcMain.removeListener('extension:event:fileClosed', handler) };
        },
        onDidChangeActiveEditor: (listener: (editor: any) => void) => {
          const handler = (_event: any, editor: any) => listener(editor);
          ipcMain.on('extension:editor:activeChanged', handler);
          return { dispose: () => ipcMain.removeListener('extension:editor:activeChanged', handler) };
        },
      },

      // ── Formatters ────────────────────────────────────────────
      formatters: {
        registerFormatter: (selector: string, formatter: any) => {
          sendToRenderer('extension:formatter:register', { selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
      },

      // ── Linters ───────────────────────────────────────────────
      linters: {
        registerLinter: (selector: string, linter: any) => {
          sendToRenderer('extension:linter:register', { selector, pluginId: plugin.manifest.id });
          return { dispose: () => {} };
        },
      },

      // ── Settings ──────────────────────────────────────────────
      settings: {
        get: <T>(key: string, defaultValue?: T): T | undefined => {
          const settings = this.appStore.get('settings') as any;
          return settings?.[key] ?? defaultValue;
        },
        set: async (key: string, value: unknown) => {
          const settings = this.appStore.get('settings') as any;
          settings[key] = value;
          this.appStore.set('settings', settings);
          sendToRenderer('settings:changed', settings);
          return true;
        },
        getAll: () => {
          return this.appStore.get('settings') as any;
        },
        getSection: (section: string) => {
          const settings = this.appStore.get('settings') as any;
          const result: Record<string, unknown> = {};
          const prefix = section + '.';
          for (const [key, value] of Object.entries(settings || {})) {
            if (key.startsWith(prefix)) {
              result[key.slice(prefix.length)] = value;
            }
          }
          return result;
        },
        onDidChange: (listener: (settings: any) => void) => {
          const handler = (_event: any, settings: any) => listener(settings);
          ipcMain.on('settings:changed', handler);
          return { dispose: () => ipcMain.removeListener('settings:changed', handler) };
        },
      },

      // ── Theme ─────────────────────────────────────────────────
      theme: {
        getCurrent: () => {
          const themeId = this.appStore.get('theme');
          return (this as any).themeService?.getThemes?.().find((t: any) => t.id === themeId) || undefined;
        },
        list: () => {
          return (this as any).themeService?.getThemes?.() || [];
        },
        set: async (themeId: string) => {
          this.appStore.set('theme', themeId);
          sendToRenderer('theme:changed', themeId);
          return true;
        },
        register: (themeDef: any) => {
          sendToRenderer('ext:theme:registered', themeDef);
          return { dispose: () => {} };
        },
        onDidChange: (listener: (themeId: string) => void) => {
          const handler = (_event: any, themeId: string) => listener(themeId);
          ipcMain.on('theme:changed', handler);
          return { dispose: () => ipcMain.removeListener('theme:changed', handler) };
        },
      },

      // ── File System ───────────────────────────────────────────
      fs: {
        readFile: async (filePath: string) => fs.readFile(filePath, 'utf-8'),
        writeFile: async (filePath: string, content: string) => {
          await fs.writeFile(filePath, content, 'utf-8');
          return true;
        },
        exists: async (filePath: string) => {
          try { await fs.access(filePath); return true; } catch { return false; }
        },
        readDir: async (dirPath: string) => {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          return entries.map(e => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile(), isSymbolicLink: e.isSymbolicLink() }));
        },
        mkdir: async (dirPath: string, options?: { recursive?: boolean }) => {
          await fs.mkdir(dirPath, { recursive: options?.recursive ?? false });
          return true;
        },
        delete: async (targetPath: string, options?: { recursive?: boolean }) => {
          await fs.rm(targetPath, { recursive: options?.recursive ?? false, force: true });
          return true;
        },
        rename: async (oldPath: string, newPath: string) => {
          await fs.rename(oldPath, newPath);
          return true;
        },
        stat: async (filePath: string) => {
          const stat = await fs.stat(filePath);
          return {
            size: stat.size,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory(),
            isSymbolicLink: stat.isSymbolicLink(),
            createdAt: stat.birthtime.toISOString(),
            modifiedAt: stat.mtime.toISOString(),
          };
        },
        watch: (filePath: string, listener: (event: { type: string; path: string }) => void) => {
          // Simplified file watcher
          return { dispose: () => {} };
        },
        getWorkspacePath: () => {
          return (this.appStore.get('recentWorkspaces') as any)?.[0] || undefined;
        },
        resolvePath: (...segments: string[]) => {
          return path.resolve(...segments);
        },
      },

      // ── Git ───────────────────────────────────────────────────
      git: {
        status: async (repoPath: string) => {
          try { return await (this as any).gitService?.getStatus?.(repoPath); } catch (e: any) { throw new Error(`Git status failed: ${e.message}`); }
        },
        log: async (repoPath: string, maxCount?: number) => {
          try { return await (this as any).gitService?.log?.(repoPath, maxCount); } catch (e: any) { throw new Error(`Git log failed: ${e.message}`); }
        },
        diff: async (repoPath: string, file?: string) => {
          try { return await (this as any).gitService?.diff?.(repoPath, file); } catch (e: any) { throw new Error(`Git diff failed: ${e.message}`); }
        },
        branch: async (repoPath: string) => {
          try { return await (this as any).gitService?.getBranches?.(repoPath); } catch (e: any) { throw new Error(`Git branch failed: ${e.message}`); }
        },
        commit: async (repoPath: string, message: string, files?: string[]) => {
          try { return await (this as any).gitService?.commit?.(repoPath, message, files); } catch (e: any) { throw new Error(`Git commit failed: ${e.message}`); }
        },
        push: async (repoPath: string, remote?: string) => {
          try { return await (this as any).gitService?.push?.(repoPath, remote); } catch (e: any) { throw new Error(`Git push failed: ${e.message}`); }
        },
        pull: async (repoPath: string, remote?: string) => {
          try { return await (this as any).gitService?.pull?.(repoPath, remote); } catch (e: any) { throw new Error(`Git pull failed: ${e.message}`); }
        },
        fetch: async (repoPath: string, remote?: string) => {
          try { return await (this as any).gitService?.fetch?.(repoPath, remote); } catch (e: any) { throw new Error(`Git fetch failed: ${e.message}`); }
        },
        add: async (repoPath: string, files: string[]) => {
          try { return await (this as any).gitService?.add?.(repoPath, files); } catch (e: any) { throw new Error(`Git add failed: ${e.message}`); }
        },
        reset: async (repoPath: string, files?: string[]) => {
          try { return await (this as any).gitService?.reset?.(repoPath, files); } catch (e: any) { throw new Error(`Git reset failed: ${e.message}`); }
        },
        stash: async (repoPath: string) => {
          try { return await (this as any).gitService?.stash?.(repoPath); } catch (e: any) { throw new Error(`Git stash failed: ${e.message}`); }
        },
        checkout: async (repoPath: string, branch: string) => {
          try { return await (this as any).gitService?.checkout?.(repoPath, branch); } catch (e: any) { throw new Error(`Git checkout failed: ${e.message}`); }
        },
        merge: async (repoPath: string, branch: string) => {
          try { return await (this as any).gitService?.merge?.(repoPath, branch); } catch (e: any) { throw new Error(`Git merge failed: ${e.message}`); }
        },
        init: async (repoPath: string) => {
          try { return await (this as any).gitService?.init?.(repoPath); } catch (e: any) { throw new Error(`Git init failed: ${e.message}`); }
        },
      },

      // ── Storage (per-extension key-value) ─────────────────────
      storage: {
        get: <T>(key: string): T | undefined => {
          const states = this.appStore.get('pluginStates');
          const config = (states[plugin.manifest.id]?.config as Record<string, unknown>) || {};
          return config[key] as T;
        },
        set: async (key: string, value: unknown) => {
          const states = this.appStore.get('pluginStates');
          if (!states[plugin.manifest.id]) states[plugin.manifest.id] = { enabled: true, config: {} };
          const config = (states[plugin.manifest.id].config as Record<string, unknown>) || {};
          config[key] = value;
          states[plugin.manifest.id].config = config;
          this.appStore.set('pluginStates', states);
          return true;
        },
        delete: async (key: string) => {
          const states = this.appStore.get('pluginStates');
          const config = (states[plugin.manifest.id]?.config as Record<string, unknown>) || {};
          delete config[key];
          if (states[plugin.manifest.id]) states[plugin.manifest.id].config = config;
          this.appStore.set('pluginStates', states);
          return true;
        },
        getAll: () => {
          const states = this.appStore.get('pluginStates');
          return (states[plugin.manifest.id]?.config as Record<string, unknown>) || {};
        },
        clear: async () => {
          const states = this.appStore.get('pluginStates');
          if (states[plugin.manifest.id]) states[plugin.manifest.id].config = {};
          this.appStore.set('pluginStates', states);
          return true;
        },
      },

      // ── Clipboard ─────────────────────────────────────────────
      clipboard: {
        read: async () => {
          const { clipboard } = require('electron');
          return clipboard.readText();
        },
        write: async (text: string) => {
          const { clipboard } = require('electron');
          clipboard.writeText(text);
          return true;
        },
      },

      // ── HTTP ──────────────────────────────────────────────────
      http: {
        fetch: async (url: string, options?: any) => {
          try {
            const response = await globalThis.fetch(url, options);
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
        },
      },

      // ── Process ───────────────────────────────────────────────
      process: {
        exec: async (command: string, options?: { cwd?: string; env?: Record<string, string>; timeout?: number }) => {
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
            return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
          } catch (err: any) {
            return { stdout: err.stdout || '', stderr: err.stderr || err.message, exitCode: err.code || 1 };
          }
        },
        getEnv: (key: string) => process.env[key],
        getPlatform: () => process.platform,
        getArch: () => process.arch,
        getVersion: () => process.version,
        getAppPath: () => process.cwd(),
        getExtensionPath: (_pluginId: string) => plugin.path,
        getTempPath: () => require('os').tmpdir(),
        getHomePath: () => require('os').homedir(),
      },

      // ── UI ────────────────────────────────────────────────────
      ui: {
        showMessage: async (type: 'info' | 'warning' | 'error', message: string, items?: string[]) => {
          sendToRenderer('extension:message', { type, text: message, items });
          return undefined;
        },
        showDialog: async (options: any) => {
          const win = getMainWindow();
          if (!win) return { response: 0, checkboxChecked: false };
          return dialog.showMessageBox(win, options);
        },
        showOpenDialog: async (options: any) => {
          const win = getMainWindow();
          if (!win) return { canceled: true, filePaths: [] };
          return dialog.showOpenDialog(win, options);
        },
        showSaveDialog: async (options: any) => {
          const win = getMainWindow();
          if (!win) return { canceled: true, filePath: '' };
          return dialog.showSaveDialog(win, options);
        },
        createStatusBarItem: (id: string, text: string, alignment: 'left' | 'right', priority?: number) => {
          sendToRenderer('ext:ui:setStatusBar', { id, text, alignment, priority });
          return { dispose: () => sendToRenderer('ext:ui:updateStatusBar', { id, text: '' }) };
        },
        updateStatusBarItem: (id: string, text: string) => sendToRenderer('ext:ui:updateStatusBar', { id, text }),
        createPanel: (id: string, title: string, content: string) => {
          sendToRenderer('ext:ui:createPanel', { id, title, content });
          return { dispose: () => sendToRenderer('ext:ui:hidePanel', { id }) };
        },
        updatePanel: (id: string, content: string) => sendToRenderer('ext:ui:updatePanel', { id, content }),
        showPanel: (id: string) => sendToRenderer('ext:ui:showPanel', { id }),
        hidePanel: (id: string) => sendToRenderer('ext:ui:hidePanel', { id }),
        createSidebarView: (id: string, title: string, content: string) => {
          sendToRenderer('ext:ui:createSidebarView', { id, title, content });
          return { dispose: () => {} };
        },
        showSidebarView: (id: string) => sendToRenderer('ext:ui:showSidebarView', { id }),
      },

      // ── Notifications ─────────────────────────────────────────
      notifications: {
        info: (message: string) => sendToRenderer('ext:notification', { message, type: 'info' }),
        warn: (message: string) => sendToRenderer('ext:notification', { message, type: 'warning' }),
        error: (message: string) => sendToRenderer('ext:notification', { message, type: 'error' }),
        success: (message: string) => sendToRenderer('ext:notification', { message, type: 'success' }),
      },
    };
  }

  private async createHypArchive(folderPath: string, outputPath: string): Promise<void> {
    try {
      const archiverModule = require('archiver');
      const output = await fs.open(outputPath, 'w');
      const stream = output.createWriteStream();
      const archive = archiverModule('tar', { gzip: true });
      archive.pipe(stream);
      archive.directory(folderPath, false);
      await archive.finalize();
      await output.close();
    } catch {
      await fs.cp(folderPath, outputPath.replace('.hyp', '-dir'), { recursive: true });
      throw new Error('tar not available. Extension folder copied instead.');
    }
  }

  private async extractHypArchive(hypFilePath: string, outputDir: string): Promise<void> {
    throw new Error('Cannot extract .hyp file. Ensure tar is available in PATH.');
  }
}
