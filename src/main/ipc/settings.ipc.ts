/**
 * Settings IPC Handlers
 */
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { SettingsService } from '../services/SettingsService';

export function registerSettingsIPC(settingsService: SettingsService): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
    return settingsService.get(key);
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (_event, key: string, value: unknown) => {
      settingsService.set(key, value);
      return true;
    },
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return settingsService.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async (_event, key?: string) => {
    if (key) {
      settingsService.reset(key);
    } else {
      settingsService.resetAll();
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_EXPORT, async () => {
    return settingsService.export();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_IMPORT, async (_event, data: string) => {
    return settingsService.import(data);
  });
}
