/**
 * Hypothesis Database Explorer - IPC Handlers
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { DatabaseService } from '../services/database/DatabaseService';
import type { DatabaseConnectionConfig, QueryRequest, TableDataRequest } from '../../shared/types/database';
import { DB_IPC } from '../../shared/types/database';

export function registerDatabaseIPC(dbService: DatabaseService, getWindow: () => BrowserWindow | null): void {
  // Forward connection status events to renderer
  dbService.on('connection-status', (data) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(DB_IPC.CONNECTION_STATUS, data);
    }
  });

  // ── Connections ─────────────────────────────────────────────────
  ipcMain.handle(DB_IPC.CONNECTION_LIST, () => dbService.getConnections());

  ipcMain.handle(DB_IPC.CONNECTION_GET, (_e, id: string) => dbService.getConnection(id) ?? null);

  ipcMain.handle(DB_IPC.CONNECTION_CREATE, (_e, config: DatabaseConnectionConfig) => {
    return dbService.createConnection(config);
  });

  ipcMain.handle(DB_IPC.CONNECTION_UPDATE, (_e, id: string, updates: Partial<DatabaseConnectionConfig>) => {
    return dbService.updateConnection(id, updates) ?? null;
  });

  ipcMain.handle(DB_IPC.CONNECTION_DELETE, async (_e, id: string) => {
    return dbService.deleteConnection(id);
  });

  ipcMain.handle(DB_IPC.TEST_CONNECTION, async (_e, config: DatabaseConnectionConfig) => {
    return dbService.testConnection(config);
  });

  ipcMain.handle(DB_IPC.CONNECT, async (_e, id: string) => {
    return dbService.connect(id);
  });

  ipcMain.handle(DB_IPC.DISCONNECT, async (_e, id: string) => {
    await dbService.disconnect(id);
    return true;
  });

  // ── Schema ──────────────────────────────────────────────────────
  ipcMain.handle(DB_IPC.SCHEMA_GET, async (_e, connectionId: string) => {
    try { return await dbService.getSchema(connectionId); }
    catch (err: any) { return { error: err.message }; }
  });

  // ── Query ───────────────────────────────────────────────────────
  ipcMain.handle(DB_IPC.QUERY_EXECUTE, async (_e, req: QueryRequest) => {
    try { return await dbService.executeQuery(req); }
    catch (err: any) { return { columns: [], rows: [], rowCount: 0, executionTime: 0, sql: req.sql, error: err.message }; }
  });

  // ── Table Data ──────────────────────────────────────────────────
  ipcMain.handle(DB_IPC.TABLE_DATA, async (_e, req: TableDataRequest) => {
    try { return await dbService.getTableData(req); }
    catch (err: any) { return { error: err.message }; }
  });

  // ── History ─────────────────────────────────────────────────────
  ipcMain.handle(DB_IPC.HISTORY_LIST, () => dbService.getHistory());
  ipcMain.handle(DB_IPC.HISTORY_CLEAR, () => { dbService.clearHistory(); return true; });

  // ── Saved Queries ───────────────────────────────────────────────
  ipcMain.handle(DB_IPC.SAVED_QUERY_LIST, () => dbService.getSavedQueries());

  ipcMain.handle(DB_IPC.SAVED_QUERY_CREATE, (_e, data: any) => dbService.createSavedQuery(data));

  ipcMain.handle(DB_IPC.SAVED_QUERY_UPDATE, (_e, id: string, updates: any) => {
    return dbService.updateSavedQuery(id, updates) ?? null;
  });

  ipcMain.handle(DB_IPC.SAVED_QUERY_DELETE, (_e, id: string) => dbService.deleteSavedQuery(id));
}
