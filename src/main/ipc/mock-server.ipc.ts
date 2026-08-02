/**
 * Mock Server IPC Handlers
 */
import { ipcMain, clipboard } from 'electron';
import type { MockServerService } from '../services/mock-server/MockServerService';
import type { MockServerCreateOptions, MockEndpoint } from '../../shared/types/mock-server';
import { MOCK_SERVER_IPC } from '../../shared/types/mock-server';

export function registerMockServerIPC(service: MockServerService): void {

  ipcMain.handle(MOCK_SERVER_IPC.CREATE, async (_e, options: MockServerCreateOptions) => {
    try {
      const server = await service.create(options);
      return { success: true, server };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.DELETE, (_e, id: string) => {
    try {
      service.delete(id);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.LIST, () => {
    return { success: true, servers: service.list() };
  });

  ipcMain.handle(MOCK_SERVER_IPC.GET, (_e, id: string) => {
    const server = service.get(id);
    return server ? { success: true, server } : { success: false, error: 'Not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.UPDATE, (_e, id: string, updates: Partial<Pick<any, 'name' | 'port' | 'cors' | 'endpoints'>>) => {
    const server = service.update(id, updates);
    return server ? { success: true, server } : { success: false, error: 'Not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.START, async (_e, id: string) => {
    try {
      const server = await service.start(id);
      return { success: true, server };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.STOP, async (_e, id: string) => {
    try {
      await service.stop(id);
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.STOP_ALL, async () => {
    try {
      await service.stopAll();
      return { success: true };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.ENDPOINT_ADD, (_e, serverId: string, endpoint: Omit<MockEndpoint, 'id'>) => {
    const server = service.addEndpoint(serverId, endpoint);
    return server ? { success: true, server } : { success: false, error: 'Server not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.ENDPOINT_UPDATE, (_e, serverId: string, endpointId: string, updates: Partial<MockEndpoint>) => {
    const server = service.updateEndpoint(serverId, endpointId, updates);
    return server ? { success: true, server } : { success: false, error: 'Not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.ENDPOINT_DELETE, (_e, serverId: string, endpointId: string) => {
    const server = service.deleteEndpoint(serverId, endpointId);
    return server ? { success: true, server } : { success: false, error: 'Not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.ENDPOINT_REORDER, (_e, serverId: string, orderedIds: string[]) => {
    const server = service.reorderEndpoints(serverId, orderedIds);
    return server ? { success: true, server } : { success: false, error: 'Not found' };
  });

  ipcMain.handle(MOCK_SERVER_IPC.LOGS_GET, (_e, serverId: string) => {
    return { success: true, logs: service.getLogs(serverId) };
  });

  ipcMain.handle(MOCK_SERVER_IPC.LOGS_CLEAR, (_e, serverId: string) => {
    service.clearLogs(serverId);
    return { success: true };
  });

  ipcMain.handle(MOCK_SERVER_IPC.FIND_FREE_PORT, async (_e, preferred?: number) => {
    try {
      const port = await service.findFreePort(preferred);
      return { success: true, port };
    } catch (err: any) { return { success: false, error: err.message }; }
  });

  ipcMain.handle(MOCK_SERVER_IPC.COPY_URL, (_e, serverId: string) => {
    const url = service.copyUrl(serverId);
    if (url) clipboard.writeText(url);
    return { success: !!url, url };
  });
}
