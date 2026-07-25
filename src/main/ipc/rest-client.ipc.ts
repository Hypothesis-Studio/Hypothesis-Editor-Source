/**
 * Hypothesis REST Client - IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { RestClientService } from '../services/rest-client/RestClientService';
import type { RestClientRunnerConfig, RestClientExportOptions, RestClientEnvironment } from '../../shared/types/rest-client';
import { REST_CLIENT_IPC } from '../../shared/types/rest-client';

export function registerRestClientIPC(restClientService: RestClientService): void {
  ipcMain.handle(REST_CLIENT_IPC.SEND_REQUEST, async (_e, requestId: string, collectionId: string) => {
    try { return await restClientService.sendRequest(requestId, collectionId); }
    catch (err: any) { return { error: err.message }; }
  });
  ipcMain.handle(REST_CLIENT_IPC.CANCEL_REQUEST, (_e, requestId: string) => restClientService.cancelRequest(requestId));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_LIST, () => restClientService.getCollections());
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_GET, (_e, id: string) => restClientService.getCollection(id));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_CREATE, (_e, name: string, description?: string) => restClientService.createCollection(name, description));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_UPDATE, (_e, id: string, updates: any) => restClientService.updateCollection(id, updates));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_DELETE, (_e, id: string) => restClientService.deleteCollection(id));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_EXPORT, (_e, options: RestClientExportOptions) => restClientService.exportCollections(options));
  ipcMain.handle(REST_CLIENT_IPC.COLLECTION_IMPORT, async (_e, content: string, format: string) => {
    try { return await restClientService.importCollections(content, format); }
    catch (err: any) { return { error: err.message }; }
  });
  ipcMain.handle(REST_CLIENT_IPC.REQUEST_CREATE, (_e, collectionId: string, request: any) => restClientService.createRequest(collectionId, request));
  ipcMain.handle(REST_CLIENT_IPC.REQUEST_UPDATE, (_e, collectionId: string, requestId: string, updates: any) => restClientService.updateRequest(collectionId, requestId, updates));
  ipcMain.handle(REST_CLIENT_IPC.REQUEST_DELETE, (_e, collectionId: string, requestId: string) => restClientService.deleteRequest(collectionId, requestId));
  ipcMain.handle(REST_CLIENT_IPC.REQUEST_DUPLICATE, (_e, collectionId: string, requestId: string) => restClientService.duplicateRequest(collectionId, requestId));
  ipcMain.handle(REST_CLIENT_IPC.REQUEST_MOVE, (_e, fromCollectionId: string, requestId: string, toCollectionId: string, index?: number) => restClientService.moveRequest(fromCollectionId, requestId, toCollectionId, index));
  ipcMain.handle(REST_CLIENT_IPC.FOLDER_CREATE, (_e, collectionId: string, name: string, parentId?: string) => restClientService.createFolder(collectionId, name, parentId || null));
  ipcMain.handle(REST_CLIENT_IPC.FOLDER_UPDATE, (_e, collectionId: string, folderId: string, updates: any) => restClientService.updateFolder(collectionId, folderId, updates));
  ipcMain.handle(REST_CLIENT_IPC.FOLDER_DELETE, (_e, collectionId: string, folderId: string) => restClientService.deleteFolder(collectionId, folderId));
  ipcMain.handle(REST_CLIENT_IPC.ENV_LIST, () => restClientService.getEnvironments());
  ipcMain.handle(REST_CLIENT_IPC.ENV_GET, (_e, id: string) => restClientService.getEnvironment(id));
  ipcMain.handle(REST_CLIENT_IPC.ENV_CREATE, (_e, name: string, variables?: any[]) => restClientService.createEnvironment(name, variables));
  ipcMain.handle(REST_CLIENT_IPC.ENV_UPDATE, (_e, id: string, updates: Partial<RestClientEnvironment>) => restClientService.updateEnvironment(id, updates));
  ipcMain.handle(REST_CLIENT_IPC.ENV_DELETE, (_e, id: string) => restClientService.deleteEnvironment(id));
  ipcMain.handle(REST_CLIENT_IPC.ENV_ACTIVATE, (_e, id: string) => { restClientService.activateEnvironment(id); return true; });
  ipcMain.handle(REST_CLIENT_IPC.ENV_DEACTIVATE, () => { restClientService.deactivateAllEnvironments(); return true; });
  ipcMain.handle(REST_CLIENT_IPC.ENV_DUPLICATE, (_e, id: string) => restClientService.duplicateEnvironment(id));
  ipcMain.handle(REST_CLIENT_IPC.HISTORY_LIST, () => restClientService.getHistory());
  ipcMain.handle(REST_CLIENT_IPC.HISTORY_CLEAR, () => { restClientService.clearHistory(); return true; });
  ipcMain.handle(REST_CLIENT_IPC.HISTORY_DELETE, (_e, id: string) => restClientService.deleteHistoryEntry(id));
  ipcMain.handle(REST_CLIENT_IPC.HISTORY_SEARCH, (_e, query: string) => restClientService.searchHistory(query));
  ipcMain.handle(REST_CLIENT_IPC.VAR_SET, (_e, key: string, value: string) => { restClientService.setGlobalVariable(key, value); return true; });
  ipcMain.handle(REST_CLIENT_IPC.VAR_GET, (_e, key: string) => restClientService.getGlobalVariables().find(v => v.key === key)?.value);
  ipcMain.handle(REST_CLIENT_IPC.VAR_GET_ALL, () => restClientService.getGlobalVariables());
  ipcMain.handle(REST_CLIENT_IPC.VAR_DELETE, (_e, key: string) => restClientService.deleteGlobalVariable(key));
  ipcMain.handle(REST_CLIENT_IPC.VAR_RESOLVE, (_e, raw: string, collectionId?: string) => restClientService.resolveVariables(raw, collectionId));
  ipcMain.handle(REST_CLIENT_IPC.RUNNER_START, async (_e, collectionId: string, config: RestClientRunnerConfig) => {
    try { return await restClientService.runCollection(collectionId, config); }
    catch (err: any) { return { error: err.message }; }
  });
  ipcMain.handle(REST_CLIENT_IPC.RUNNER_STOP, () => restClientService.stopRunner());
  ipcMain.handle(REST_CLIENT_IPC.RUNNER_STATUS, () => restClientService.getRunnerStatus());
  ipcMain.handle(REST_CLIENT_IPC.IMPORT_FILE, async (_e, content: string, format: string) => {
    try { return await restClientService.importCollections(content, format); }
    catch (err: any) { return { error: err.message }; }
  });
  ipcMain.handle(REST_CLIENT_IPC.IMPORT_CURL, async (_e, curlCommand: string) => {
    try { return await restClientService.importCollections(curlCommand, 'curl'); }
    catch (err: any) { return { error: err.message }; }
  });
  ipcMain.handle(REST_CLIENT_IPC.EXPORT, (_e, options: RestClientExportOptions) => restClientService.exportCollections(options));
  ipcMain.handle(REST_CLIENT_IPC.TEMPLATE_LIST, () => restClientService.getTemplates());
  ipcMain.handle('rest-client:generate-curl', (_e, requestId: string, collectionId: string) => restClientService.generateCurl(requestId, collectionId));
}
