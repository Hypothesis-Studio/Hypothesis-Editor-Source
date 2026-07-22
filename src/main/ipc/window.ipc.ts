/**
 * Window IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';

export function registerWindowIPC(): void {
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_RESTORE, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.restore();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_TITLE, async (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.setTitle(title);
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_NEW, async () => {
    // This is handled by the window manager via app-level logic
    // For now, just emit an event
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC_CHANNELS.WINDOW_NEW);
    });
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_ALL, async () => {
    return BrowserWindow.getAllWindows().map((win) => ({
      id: win.id,
      title: win.getTitle(),
      isFocused: win.isFocused(),
      isMaximized: win.isMaximized(),
      isMinimized: win.isMinimized(),
    }));
  });
}
