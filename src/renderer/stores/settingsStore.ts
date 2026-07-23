/**
 * Settings Store - Manages editor settings with schema validation.
 */
import { create } from 'zustand';
import type { AppSettings } from '../../shared/types';
import type { AIProviderConfig, AIModelConfig } from '../../shared/types/agent';

interface SettingsState {
  settings: Partial<AppSettings>;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  getSetting: <T>(key: string) => T | undefined;
  setSetting: (key: string, value: unknown) => Promise<void>;
  resetSetting: (key: string) => Promise<void>;
  resetAllSettings: () => Promise<void>;
  exportSettings: () => string;
  importSettings: (data: string) => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await window.api.settings.getAll();
      set({ settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  getSetting: <T>(key: string): T | undefined => {
    return get().settings[key] as T;
  },

  setSetting: async (key: string, value: unknown) => {
    await window.api.settings.set(key, value);
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    }));
  },

  resetSetting: async (key: string) => {
    await window.api.settings.reset(key);
    const settings = await window.api.settings.getAll();
    set({ settings });
  },

  resetAllSettings: async () => {
    await window.api.settings.reset();
    const settings = await window.api.settings.getAll();
    set({ settings });
  },

  exportSettings: () => {
    return JSON.stringify(get().settings, null, 2);
  },

  importSettings: async (data: string) => {
    try {
      const result = await window.api.settings.import(data);
      if (result) {
        const settings = await window.api.settings.getAll();
        set({ settings });
      }
      return result;
    } catch {
      return false;
    }
  },
}));
