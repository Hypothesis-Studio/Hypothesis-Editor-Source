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
import { logger } from '../utils/logger';
import { BrowserWindow } from 'electron';
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

  constructor(appStore: AppStore) {
    this.appStore = appStore;
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
   */
  private createPluginContext(plugin: InstalledPlugin) {
    const getMainWindow = () => BrowserWindow.getAllWindows()[0];

    return {
      subscriptions: [] as Array<{ dispose: () => void }>,

      commands: {
        registerCommand: (id: string, handler: (...args: any[]) => any) => {
          plugin.registeredCommands.set(id, handler);
          // Notify renderer about new command
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('extension:command-registered', {
              pluginId: plugin.manifest.id,
              commandId: id,
            });
          }
          return { dispose: () => plugin.registeredCommands.delete(id) };
        },
        executeCommand: async (id: string, ...args: any[]) => {
          return this.executeCommand(id, ...args);
        },
      },

      window: {
        activeEditor: null, // Editor access is limited from main process
        showInformationMessage: (msg: string) => {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('extension:message', { type: 'info', text: msg });
          }
        },
        showWarningMessage: (msg: string) => {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('extension:message', { type: 'warning', text: msg });
          }
        },
        showErrorMessage: (msg: string) => {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('extension:message', { type: 'error', text: msg });
          }
        },
      },

      workspace: {
        rootPath: undefined as string | undefined,
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
          };
        },
        onDidSaveTextDocument: (_listener: (doc: any) => void) => {
          return { dispose: () => {} };
        },
      },

      languages: {
        registerCompletionItemProvider: (_selector: string, _provider: any, ..._triggers: string[]) => {
          return { dispose: () => {} };
        },
        registerHoverProvider: (_selector: string, _provider: any) => {
          return { dispose: () => {} };
        },
        registerDefinitionProvider: (_selector: string, _provider: any) => {
          return { dispose: () => {} };
        },
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
