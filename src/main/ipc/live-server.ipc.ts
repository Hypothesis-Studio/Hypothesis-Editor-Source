/**
 * Live Server IPC Handlers
 */
import { ipcMain } from 'electron';
import type { LiveServerService } from '../services/live-server/LiveServerService';
import type { LiveServerCreateOptions } from '../../shared/types/live-server';
import { LIVE_SERVER_IPC } from '../../shared/types/live-server';

export function registerLiveServerIPC(service: LiveServerService): void {

  ipcMain.handle(LIVE_SERVER_IPC.START, async (_event, options: LiveServerCreateOptions) => {
    try {
      const server = await service.start(options);
      return { success: true, server };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(LIVE_SERVER_IPC.STOP, async (_event, id: string) => {
    try {
      await service.stop(id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(LIVE_SERVER_IPC.STOP_ALL, async () => {
    try {
      await service.stopAll();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(LIVE_SERVER_IPC.LIST, () => {
    return { servers: service.list() };
  });

  ipcMain.handle(LIVE_SERVER_IPC.GET, (_event, id: string) => {
    return { server: service.get(id) };
  });

  ipcMain.handle(LIVE_SERVER_IPC.UPDATE_LABEL, (_event, id: string, label: string) => {
    const server = service.updateLabel(id, label);
    return server ? { success: true, server } : { success: false, error: 'Server not found' };
  });

  ipcMain.handle(LIVE_SERVER_IPC.COPY_URL, (_event, id: string) => {
    return { success: service.copyUrl(id) };
  });

  ipcMain.handle(LIVE_SERVER_IPC.OPEN_IN_BROWSER, (_event, id: string) => {
    return { success: service.openInBrowser(id) };
  });

  ipcMain.handle(LIVE_SERVER_IPC.OPEN_FOLDER, (_event, id: string) => {
    return { success: service.openFolder(id) };
  });

  ipcMain.handle(LIVE_SERVER_IPC.FIND_FREE_PORT, async (_event, preferredPort?: number) => {
    try {
      const port = await service.findFreePort(preferredPort);
      return { success: true, port };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
