/**
 * Theme IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import type { ThemeService } from '../services/ThemeService';

export function registerThemeIPC(themeService: ThemeService): void {
  ipcMain.handle(IPC_CHANNELS.THEME_GET, async () => {
    return themeService.getCurrentTheme();
  });

  ipcMain.handle(IPC_CHANNELS.THEME_SET, async (_event, themeId: string) => {
    themeService.setTheme(themeId);
    // Notify all windows
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC_CHANNELS.THEME_CHANGED, themeService.getCurrentTheme());
    });
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.THEME_LIST, async () => {
    return themeService.getThemes();
  });

  // Get only extension-registered themes (for renderer to restore on mount)
  ipcMain.handle('ext:themes:getAll', async () => {
    return themeService.getExtensionThemes();
  });
}
