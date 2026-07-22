/**
 * Plugin Manager - Runtime plugin loading, activation, and lifecycle management.
 */
import type { PluginManifest, PluginContext } from '../../shared/types';
import { createPluginContext, CommandAPIImpl, Disposable } from './PluginSDK';

interface LoadedPlugin {
  manifest: PluginManifest;
  context: PluginContext;
  instance: PluginInstance | null;
  enabled: boolean;
  loaded: boolean;
  activated: boolean;
  path: string;
}

interface PluginInstance {
  activate?(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private activationEvents = new Map<string, Set<string>>();
  private commandRegistry = new CommandAPIImpl();

  /**
   * Wire renderer stores so the SDK can access live state.
   * Call once during app initialization.
   */
  wireStores(stores: {
    editorStore?: any;
    appStore?: any;
    settingsStore?: any;
  }) {
    if (stores.editorStore) (window as any).__hypothesisEditorStore = stores.editorStore;
    if (stores.appStore) (window as any).__hypothesisAppStore = stores.appStore;
    if (stores.settingsStore) (window as any).__hypothesisSettingsStore = stores.settingsStore;
  }

  async loadPlugin(manifest: PluginManifest, pluginPath: string): Promise<void> {
    const context = createPluginContext(manifest);

    const loaded: LoadedPlugin = {
      manifest,
      context,
      instance: null,
      enabled: true,
      loaded: false,
      activated: false,
      path: pluginPath,
    };

    this.plugins.set(manifest.id, loaded);

    // Register activation events
    for (const event of manifest.activationEvents) {
      if (!this.activationEvents.has(event)) {
        this.activationEvents.set(event, new Set());
      }
      this.activationEvents.get(event)!.add(manifest.id);
    }

    // Register contributed commands
    if (manifest.contributes?.commands) {
      for (const cmd of manifest.contributes.commands) {
        this.commandRegistry.registerCommand(cmd.command, (...args) => {
          this.executePluginCommand(manifest.id, cmd.command, args);
        });
      }
    }

    console.log(`Plugin loaded: ${manifest.id}`);
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.activated) return;

    try {
      // Dynamic import of plugin module
      const module = await import(/* @vite-ignore */ `${plugin.path}/${plugin.manifest.main}`);
      plugin.instance = module.default || module;

      if (plugin.instance?.activate) {
        await plugin.instance.activate(plugin.context);
      }

      plugin.activated = true;
      console.log(`Plugin activated: ${pluginId}`);
    } catch (error) {
      console.error(`Failed to activate plugin ${pluginId}:`, error);
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.activated) return;

    try {
      if (plugin.instance?.deactivate) {
        await plugin.instance.deactivate();
      }

      // Dispose all subscriptions
      for (const disposable of plugin.context.subscriptions) {
        disposable.dispose();
      }
      plugin.context.subscriptions.length = 0;

      plugin.activated = false;
      plugin.instance = null;
      console.log(`Plugin deactivated: ${pluginId}`);
    } catch (error) {
      console.error(`Failed to deactivate plugin ${pluginId}:`, error);
    }
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    await this.deactivatePlugin(pluginId);
    this.plugins.delete(pluginId);

    // Remove from activation events
    for (const [, plugins] of this.activationEvents) {
      plugins.delete(pluginId);
    }
  }

  enablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  disablePlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
      this.deactivatePlugin(pluginId);
    }
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.enabled);
  }

  getActivatedPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.activated);
  }

  // Trigger activation events
  async triggerActivationEvent(event: string): Promise<void> {
    const pluginIds = this.activationEvents.get(event);
    if (!pluginIds) return;

    for (const pluginId of pluginIds) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.enabled && !plugin.activated) {
        await this.activatePlugin(pluginId);
      }
    }
  }

  // Execute plugin command
  private async executePluginCommand(pluginId: string, commandId: string, args: unknown[]): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.activated) {
      throw new Error(`Plugin ${pluginId} is not activated`);
    }

    // Find command handler in plugin instance
    const handler = (plugin.instance as Record<string, unknown>)?.[commandId];
    if (typeof handler === 'function') {
      return handler(...args);
    }

    throw new Error(`Command ${commandId} not found in plugin ${pluginId}`);
  }

  // Get all registered commands from all plugins
  getAllCommands(): Array<{ pluginId: string; command: string; manifest: PluginManifest }> {
    const commands: Array<{ pluginId: string; command: string; manifest: PluginManifest }> = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.manifest.contributes?.commands) {
        for (const cmd of plugin.manifest.contributes.commands) {
          commands.push({
            pluginId,
            command: cmd.command,
            manifest: plugin.manifest,
          });
        }
      }
    }

    return commands;
  }

  // Get all contributed sidebar views
  getSidebarViews(): Array<{ pluginId: string; view: { id: string; name: string } }> {
    const views: Array<{ pluginId: string; view: { id: string; name: string } }> = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.manifest.contributes?.views) {
        for (const view of plugin.manifest.contributes.views) {
          views.push({ pluginId, view });
        }
      }
    }

    return views;
  }

  // Get all contributed themes
  getThemes(): Array<{ pluginId: string; theme: { id: string; label: string; path: string } }> {
    const themes: Array<{ pluginId: string; theme: { id: string; label: string; path: string } }> = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.manifest.contributes?.themes) {
        for (const theme of plugin.manifest.contributes.themes) {
          themes.push({ pluginId, theme });
        }
      }
    }

    return themes;
  }

  // Get all contributed languages
  getLanguages(): Array<{ pluginId: string; language: { id: string; extensions: string[] } }> {
    const languages: Array<{ pluginId: string; language: { id: string; extensions: string[] } }> = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.manifest.contributes?.languages) {
        for (const lang of plugin.manifest.contributes.languages) {
          languages.push({ pluginId, language: lang });
        }
      }
    }

    return languages;
  }

  // Get all contributed snippets
  getSnippets(): Array<{ pluginId: string; snippet: { language: string; path: string } }> {
    const snippets: Array<{ pluginId: string; snippet: { language: string; path: string } }> = [];

    for (const [pluginId, plugin] of this.plugins) {
      if (plugin.manifest.contributes?.snippets) {
        for (const snippet of plugin.manifest.contributes.snippets) {
          snippets.push({ pluginId, snippet });
        }
      }
    }

    return snippets;
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
