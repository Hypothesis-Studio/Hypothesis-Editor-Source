/**
 * Plugin Store - Manages plugin state and lifecycle.
 */
import { create } from 'zustand';
import type { PluginManifest } from '../../shared/types';

interface PluginInfo {
  manifest: PluginManifest;
  enabled: boolean;
  loaded: boolean;
  activated: boolean;
  path: string;
}

interface PluginState {
  plugins: PluginInfo[];
  isLoading: boolean;

  // Actions
  loadPlugins: () => Promise<void>;
  installPlugin: (pluginPath: string) => Promise<void>;
  uninstallPlugin: (pluginId: string) => Promise<void>;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  activatePlugin: (pluginId: string) => Promise<void>;
  getPlugin: (pluginId: string) => PluginInfo | undefined;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  isLoading: false,

  loadPlugins: async () => {
    set({ isLoading: true });
    try {
      const plugins = await window.api.plugin.list();
      set({ plugins: plugins as PluginInfo[], isLoading: false });
    } catch (error) {
      console.error('Failed to load plugins:', error);
      set({ isLoading: false });
    }
  },

  installPlugin: async (pluginPath: string) => {
    try {
      const plugin = await window.api.plugin.install(pluginPath);
      set((state) => ({
        plugins: [...state.plugins, plugin as PluginInfo],
      }));
    } catch (error) {
      console.error('Failed to install plugin:', error);
      throw error;
    }
  },

  uninstallPlugin: async (pluginId: string) => {
    try {
      await window.api.plugin.uninstall(pluginId);
      set((state) => ({
        plugins: state.plugins.filter((p) => p.manifest.id !== pluginId),
      }));
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      throw error;
    }
  },

  enablePlugin: async (pluginId: string) => {
    try {
      await window.api.plugin.enable(pluginId);
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.manifest.id === pluginId ? { ...p, enabled: true } : p,
        ),
      }));
    } catch (error) {
      console.error('Failed to enable plugin:', error);
    }
  },

  disablePlugin: async (pluginId: string) => {
    try {
      await window.api.plugin.disable(pluginId);
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.manifest.id === pluginId ? { ...p, enabled: false } : p,
        ),
      }));
    } catch (error) {
      console.error('Failed to disable plugin:', error);
    }
  },

  activatePlugin: async (pluginId: string) => {
    try {
      await window.api.plugin.activate(pluginId);
      set((state) => ({
        plugins: state.plugins.map((p) =>
          p.manifest.id === pluginId ? { ...p, activated: true } : p,
        ),
      }));
    } catch (error) {
      console.error('Failed to activate plugin:', error);
    }
  },

  getPlugin: (pluginId: string) => {
    return get().plugins.find((p) => p.manifest.id === pluginId);
  },
}));
