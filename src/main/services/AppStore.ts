/**
 * Application Store - Persistent state management for main process.
 * Uses electron-store for persistence.
 */
import Store from 'electron-store';
import type { StoreSchema } from '../../shared/types';
import { logger } from '../utils/logger';

export class AppStore {
  private store: Store<StoreSchema>;

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'hypothesis-config',
      defaults: {
        settings: {},
        keybindings: [],
        recentWorkspaces: [],
        recentFiles: [],
        windowState: {
          width: 1400,
          height: 900,
          isMaximized: false,
          isFullScreen: false,
        },
        sidebarState: {
          activeView: 'explorer',
          width: 260,
          isVisible: true,
        },
        panelState: {
          activePanel: 'terminal',
          height: 250,
          isVisible: false,
        },
        theme: 'hypothesis-dark',
        iconTheme: 'material',
        language: 'en',
        snippets: [],
        pluginStates: {},
        'agent.providers': [],
        'agent.configs': [],
        'agent.sessions': [],
        'agent.memory': [],
        'agent.tasks': [],
      },
      watch: true,
    });

    logger.info('AppStore initialized');
  }

  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.store.get(key);
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.store.set(key, value);
  }

  delete(key: keyof StoreSchema): void {
    this.store.delete(key);
  }

  has(key: keyof StoreSchema): boolean {
    return this.store.has(key);
  }

  clear(): void {
    this.store.clear();
  }

  getAll(): StoreSchema {
    return this.store.store;
  }

  async save(): Promise<void> {
    logger.info('App state saved');
  }

  onChange<K extends keyof StoreSchema>(
    key: K,
    callback: (newValue: StoreSchema[K], oldValue: StoreSchema[K]) => void,
  ): () => void {
    return this.store.onDidChange(key, callback as (newValue?: StoreSchema[K], oldValue?: StoreSchema[K]) => void);
  }
}
