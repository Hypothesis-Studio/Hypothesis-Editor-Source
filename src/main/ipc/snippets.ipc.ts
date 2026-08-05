/**
 * Snippets IPC Handlers
 * Persists user snippets to AppStore under key "snippets".
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { AppStore } from '../services/AppStore';
import type { Snippet } from '../../shared/types';

export function registerSnippetsIPC(appStore: AppStore): void {
  ipcMain.handle(IPC_CHANNELS.SNIPPETS_GET, async () => {
    return appStore.get('snippets') ?? [];
  });

  ipcMain.handle(IPC_CHANNELS.SNIPPETS_SET, async (_event, snippets: Snippet[]) => {
    appStore.set('snippets', snippets);
    return true;
  });
}
