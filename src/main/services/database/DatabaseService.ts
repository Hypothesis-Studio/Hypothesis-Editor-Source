/**
 * DatabaseService - Manages database connections and query execution.
 * Supports SQLite (sql.js - pure WASM, no native build), PostgreSQL, MySQL/MariaDB.
 */
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import type {
  DatabaseConnection,
  DatabaseConnectionConfig,
  DatabaseDriver,
  DatabaseSchema,
  DatabaseInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  QueryRequest,
  QueryResult,
  QueryColumn,
  QueryHistoryEntry,
  SavedQuery,
  TableDataRequest,
  TableDataResult,
} from '../../../shared/types/database';

// Dynamic requires for optional drivers
let sqlJs: any = null;
let pg: any = null;
let mysql2: any = null;

function tryRequire(mod: string): any {
  try { return require(mod); } catch { return null; }
}

// sql.js SQLite wrapper — mimics better-sqlite3 sync API
// sql.js CJS returns an async init function; we resolve it once at startup
let sqlJsReady: any = null; // holds the resolved SQL namespace

async function getSqlJs(): Promise<any> {
  if (sqlJsReady) return sqlJsReady;
  if (!sqlJs) sqlJs = tryRequire('sql.js');
  if (!sqlJs) throw new Error('sql.js not installed');
  // Use app.getAppPath() for a robust path that works regardless of build structure
  let wasmDir: string;
  try {
    const { app } = require('electron');
    wasmDir = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist');
  } catch {
    // Fallback for non-Electron environments
    wasmDir = path.join(__dirname, '..', '..', '..', '..', '..', 'node_modules', 'sql.js', 'dist');
  }
  sqlJsReady = await sqlJs({
    locateFile: (f: string) => path.join(wasmDir, f),
  });
  return sqlJsReady;
}

class SqlJsDatabase {
  private db: any = null;
  private filePath: string;
  public ready: Promise<void>;

  constructor(filePath: string, _opts?: any) {
    this.filePath = filePath;
    this.ready = getSqlJs().then((SQL) => {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        this.db = new SQL.Database(buf);
      } else {
        this.db = new SQL.Database();
      }
    });
  }

  private async ensureReady() {
    await this.ready;
    if (!this.db) throw new Error('sql.js database not initialized');
  }

  prepare(sql: string) {
    return {
      all: async (params?: any[]) => {
        await this.ensureReady();
        const results = this.db.exec(sql, params);
        if (!results.length) return [];
        const { columns, values } = results[0];
        return values.map((row: any[]) => {
          const obj: Record<string, any> = {};
          columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
          return obj;
        });
      },
      get: async (params?: any[]) => {
        await this.ensureReady();
        const results = this.db.exec(sql, params);
        if (!results.length || !results[0].values.length) return undefined;
        const { columns, values } = results[0];
        const obj: Record<string, any> = {};
        columns.forEach((col: string, i: number) => { obj[col] = values[0][i]; });
        return obj;
      },
      run: async (params?: any[]) => {
        await this.ensureReady();
        this.db.run(sql, params);
        const changes = this.db.getRowsModified();
        this._saveFile();
        return { changes };
      },
    };
  }

  async execSql(sql: string) {
    await this.ensureReady();
    this.db.run(sql);
    this._saveFile();
  }

  async close() {
    await this.ensureReady();
    this._saveFile();
    this.db.close();
  }

  private _saveFile() {
    try {
      const data = this.db.export();
      fs.writeFileSync(this.filePath, Buffer.from(data));
    } catch { /* ignore */ }
  }
}

interface ActiveConnection {
  config: DatabaseConnection;
  client: any;
  driver: DatabaseDriver;
}

export class DatabaseService extends EventEmitter {
  private connections: Map<string, DatabaseConnection> = new Map();
  private activeClients: Map<string, ActiveConnection> = new Map();
  private queryHistory: QueryHistoryEntry[] = [];
  private savedQueries: SavedQuery[] = [];
  private persistPath: string;
  private cancelTokens: Map<string, boolean> = new Map();

  constructor(userDataPath: string) {
    super();
    this.persistPath = path.join(userDataPath, 'database-explorer.json');
    this.loadPersisted();
  }

  // ── Persistence ──────────────────────────────────────────────────

  private loadPersisted(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
        if (data.connections) {
          for (const conn of data.connections) {
            conn.isConnected = false;
            conn.isConnecting = false;
            this.connections.set(conn.id, conn);
          }
        }
        if (data.queryHistory) this.queryHistory = data.queryHistory;
        if (data.savedQueries) this.savedQueries = data.savedQueries;
      }
    } catch { /* ignore */ }
  }

  private savePersisted(): void {
    try {
      const data = {
        connections: Array.from(this.connections.values()),
        queryHistory: this.queryHistory.slice(0, 500),
        savedQueries: this.savedQueries,
      };
      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch { /* ignore */ }
  }

  private genId(): string {
    return `db_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ── Connection Management ─────────────────────────────────────────

  getConnections(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(id: string): DatabaseConnection | undefined {
    return this.connections.get(id);
  }

  createConnection(config: DatabaseConnectionConfig): DatabaseConnection {
    const conn: DatabaseConnection = {
      id: this.genId(),
      name: config.name,
      driver: config.driver,
      filePath: config.filePath,
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.ssl,
      isConnected: false,
      isConnecting: false,
      createdAt: Date.now(),
    };
    this.connections.set(conn.id, conn);
    this.savePersisted();
    return conn;
  }

  updateConnection(id: string, updates: Partial<DatabaseConnectionConfig>): DatabaseConnection | null {
    const conn = this.connections.get(id);
    if (!conn) return null;
    Object.assign(conn, updates);
    this.connections.set(id, conn);
    this.savePersisted();
    return conn;
  }

  async deleteConnection(id: string): Promise<boolean> {
    await this.disconnect(id);
    const deleted = this.connections.delete(id);
    if (deleted) this.savePersisted();
    return deleted;
  }

  async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; error?: string; latency?: number }> {
    const start = Date.now();
    try {
      if (config.driver === 'sqlite') {
        if (!config.filePath) return { success: false, error: 'SQLite file path is required' };
        const db = new SqlJsDatabase(config.filePath, { readonly: true });
        await db.close();
        return { success: true, latency: Date.now() - start };
      }

      if (config.driver === 'postgresql') {
        if (!pg) pg = tryRequire('pg');
        if (!pg) return { success: false, error: 'pg not installed. Run: npm install pg' };
        const client = new pg.Client({
          host: config.host || 'localhost',
          port: config.port || 5432,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 5000,
        });
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        return { success: true, latency: Date.now() - start };
      }

      if (config.driver === 'mysql' || config.driver === 'mariadb') {
        if (!mysql2) mysql2 = tryRequire('mysql2/promise');
        if (!mysql2) return { success: false, error: 'mysql2 not installed. Run: npm install mysql2' };
        const conn = await mysql2.createConnection({
          host: config.host || 'localhost',
          port: config.port || 3306,
          database: config.database,
          user: config.username,
          password: config.password,
          ssl: config.ssl ? {} : undefined,
          connectTimeout: 5000,
        });
        await conn.query('SELECT 1');
        await conn.end();
        return { success: true, latency: Date.now() - start };
      }

      return { success: false, error: 'Unsupported driver' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async connect(id: string): Promise<{ success: boolean; error?: string }> {
    const conn = this.connections.get(id);
    if (!conn) return { success: false, error: 'Connection not found' };
    if (conn.isConnected) return { success: true };

    conn.isConnecting = true;
    this.emit('connection-status', { id, isConnecting: true, isConnected: false });

    try {
      if (conn.driver === 'sqlite') {
        if (!conn.filePath) throw new Error('SQLite file path required');
        const client = new SqlJsDatabase(conn.filePath);
        await client.ready;
        this.activeClients.set(id, { config: conn, client, driver: 'sqlite' });
      } else if (conn.driver === 'postgresql') {
        if (!pg) pg = tryRequire('pg');
        if (!pg) throw new Error('pg not installed. Run: npm install pg');
        const pool = new pg.Pool({
          host: conn.host || 'localhost',
          port: conn.port || 5432,
          database: conn.database,
          user: conn.username,
          password: conn.password,
          ssl: conn.ssl ? { rejectUnauthorized: false } : false,
          max: 5,
        });
        await pool.query('SELECT 1');
        this.activeClients.set(id, { config: conn, client: pool, driver: 'postgresql' });
      } else if (conn.driver === 'mysql' || conn.driver === 'mariadb') {
        if (!mysql2) mysql2 = tryRequire('mysql2/promise');
        if (!mysql2) throw new Error('mysql2 not installed. Run: npm install mysql2');
        const pool = await mysql2.createPool({
          host: conn.host || 'localhost',
          port: conn.port || 3306,
          database: conn.database,
          user: conn.username,
          password: conn.password,
          ssl: conn.ssl ? {} : undefined,
          connectionLimit: 5,
        });
        await pool.query('SELECT 1');
        this.activeClients.set(id, { config: conn, client: pool, driver: conn.driver });
      }

      conn.isConnected = true;
      conn.isConnecting = false;
      conn.error = undefined;
      conn.lastConnectedAt = Date.now();
      this.savePersisted();
      this.emit('connection-status', { id, isConnecting: false, isConnected: true });
      return { success: true };
    } catch (err: any) {
      conn.isConnected = false;
      conn.isConnecting = false;
      conn.error = err.message;
      this.emit('connection-status', { id, isConnecting: false, isConnected: false, error: err.message });
      return { success: false, error: err.message };
    }
  }

  async disconnect(id: string): Promise<void> {
    const active = this.activeClients.get(id);
    if (active) {
      try {
        if (active.driver === 'sqlite') await active.client.close();
        else if (active.driver === 'postgresql') await active.client.end?.();
        else await active.client.end?.();
      } catch { /* ignore */ }
      this.activeClients.delete(id);
    }
    const conn = this.connections.get(id);
    if (conn) {
      conn.isConnected = false;
      conn.isConnecting = false;
      this.emit('connection-status', { id, isConnecting: false, isConnected: false });
    }
  }

  // ── Schema ────────────────────────────────────────────────────────

  async getSchema(connectionId: string): Promise<DatabaseSchema> {
    const active = this.activeClients.get(connectionId);
    if (!active) throw new Error('Not connected');

    if (active.driver === 'sqlite') return this.getSQLiteSchema(connectionId, active.client);
    if (active.driver === 'postgresql') return this.getPGSchema(connectionId, active.client);
    if (active.driver === 'mysql' || active.driver === 'mariadb') return this.getMySQLSchema(connectionId, active.client);
    throw new Error('Unsupported driver');
  }

  private async getSQLiteSchema(connectionId: string, db: any): Promise<DatabaseSchema> {
    const tables: TableInfo[] = [];
    const tableList = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

    for (const t of tableList) {
      const columns: ColumnInfo[] = [];
      const pragma = await db.prepare(`PRAGMA table_info("${t.name}")`).all();
      const pkCols = pragma.filter((c: any) => c.pk > 0).map((c: any) => c.name);

      for (const col of pragma) {
        columns.push({
          name: col.name,
          type: col.type || 'TEXT',
          nullable: col.notnull === 0,
          defaultValue: col.dflt_value ?? undefined,
          isPrimaryKey: col.pk > 0,
          isForeignKey: false,
          isUnique: false,
          autoIncrement: col.pk === 1 && col.type?.toUpperCase() === 'INTEGER',
        });
      }

      // Indexes
      const indexes: IndexInfo[] = [];
      const idxList = await db.prepare(`PRAGMA index_list("${t.name}")`).all();
      for (const idx of idxList) {
        const idxInfo = await db.prepare(`PRAGMA index_info("${idx.name}")`).all();
        indexes.push({
          name: idx.name,
          columns: idxInfo.map((i: any) => i.name),
          isUnique: idx.unique === 1,
          isPrimary: idx.origin === 'pk',
        });
      }

      // Foreign keys
      const foreignKeys: ForeignKeyInfo[] = [];
      const fkList = await db.prepare(`PRAGMA foreign_key_list("${t.name}")`).all();
      const fkMap = new Map<number, ForeignKeyInfo>();
      for (const fk of fkList) {
        if (!fkMap.has(fk.id)) {
          fkMap.set(fk.id, {
            name: `fk_${t.name}_${fk.id}`,
            columns: [],
            referencedTable: fk.table,
            referencedColumns: [],
            onDelete: fk.on_delete,
            onUpdate: fk.on_update,
          });
        }
        const entry = fkMap.get(fk.id)!;
        entry.columns.push(fk.from);
        entry.referencedColumns.push(fk.to);
        // Mark FK columns
        const col = columns.find(c => c.name === fk.from);
        if (col) col.isForeignKey = true;
      }
      foreignKeys.push(...fkMap.values());

      // Row count estimate
      let rowCount: number | undefined;
      try { rowCount = (await db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get())?.c; } catch { /* skip */ }

      tables.push({ name: t.name, columns, indexes, foreignKeys, primaryKey: pkCols, rowCount });
    }

    // Views
    const viewList = await db.prepare("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name").all();
    const views = viewList.map((v: any) => ({ name: v.name, columns: [] as ColumnInfo[] }));

    return { connectionId, databases: [{ name: 'main', tables, views }] };
  }

  private async getPGSchema(connectionId: string, pool: any): Promise<DatabaseSchema> {
    const tables: TableInfo[] = [];

    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    for (const row of tablesRes.rows) {
      const name = row.table_name;
      const colRes = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [name]);

      const pkRes = await pool.query(`
        SELECT kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
      `, [name]);
      const pkCols = new Set(pkRes.rows.map((r: any) => r.column_name));

      const columns: ColumnInfo[] = colRes.rows.map((col: any) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        defaultValue: col.column_default,
        isPrimaryKey: pkCols.has(col.column_name),
        isForeignKey: false,
        isUnique: false,
        autoIncrement: (col.column_default || '').includes('nextval'),
      }));

      tables.push({ name, columns, indexes: [], foreignKeys: [], primaryKey: [...pkCols] as string[] });
    }

    const viewsRes = await pool.query(`SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name`);
    const views = viewsRes.rows.map((r: any) => ({ name: r.table_name, columns: [] as ColumnInfo[] }));

    const dbNameRes = await pool.query('SELECT current_database() as db');
    const dbName = dbNameRes.rows[0]?.db || 'postgres';

    return { connectionId, databases: [{ name: dbName, tables, views }] };
  }

  private async getMySQLSchema(connectionId: string, pool: any): Promise<DatabaseSchema> {
    const tables: TableInfo[] = [];
    const [dbRows] = await pool.query('SELECT DATABASE() as db');
    const dbName = dbRows[0]?.db || 'database';

    const [tableRows] = await pool.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    for (const row of tableRows) {
      const name = row.TABLE_NAME;
      const [colRows] = await pool.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [name]);

      const columns: ColumnInfo[] = colRows.map((col: any) => ({
        name: col.COLUMN_NAME,
        type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === 'YES',
        defaultValue: col.COLUMN_DEFAULT,
        isPrimaryKey: col.COLUMN_KEY === 'PRI',
        isForeignKey: col.COLUMN_KEY === 'MUL',
        isUnique: col.COLUMN_KEY === 'UNI',
        autoIncrement: col.EXTRA?.includes('auto_increment'),
      }));

      const pkCols = columns.filter(c => c.isPrimaryKey).map(c => c.name);
      tables.push({ name, columns, indexes: [], foreignKeys: [], primaryKey: pkCols });
    }

    const [viewRows] = await pool.query(`SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`);
    const views = viewRows.map((r: any) => ({ name: r.TABLE_NAME, columns: [] as ColumnInfo[] }));

    return { connectionId, databases: [{ name: dbName, tables, views }] };
  }

  // ── Query Execution ───────────────────────────────────────────────

  /** Internal query runner — skips history (used by getTableData, getSchema etc.) */
  private async runQuery(req: QueryRequest): Promise<QueryResult> {
    const active = this.activeClients.get(req.connectionId);
    if (!active) throw new Error('Not connected');
    if (active.driver === 'sqlite') return this.executeSQLiteQuery(active.client, req, '');
    if (active.driver === 'postgresql') return this.executePGQuery(active.client, req);
    return this.executeMySQLQuery(active.client, req);
  }

  async executeQuery(req: QueryRequest): Promise<QueryResult> {
    const active = this.activeClients.get(req.connectionId);
    if (!active) throw new Error('Not connected');

    const start = Date.now();
    const cancelKey = `${req.connectionId}_${start}`;
    this.cancelTokens.set(cancelKey, false);

    try {
      let result: QueryResult;

      if (active.driver === 'sqlite') {
        result = await this.executeSQLiteQuery(active.client, req, cancelKey);
      } else if (active.driver === 'postgresql') {
        result = await this.executePGQuery(active.client, req);
      } else {
        result = await this.executeMySQLQuery(active.client, req);
      }

      result.executionTime = Date.now() - start;
      this.addHistory({ connectionId: req.connectionId, sql: req.sql, executionTime: result.executionTime, rowCount: result.rowCount });
      return result;
    } catch (err: any) {
      const executionTime = Date.now() - start;
      this.addHistory({ connectionId: req.connectionId, sql: req.sql, executionTime, rowCount: 0, error: err.message });
      return { columns: [], rows: [], rowCount: 0, executionTime, sql: req.sql, error: err.message };
    } finally {
      this.cancelTokens.delete(cancelKey);
    }
  }

  private async executeSQLiteQuery(db: any, req: QueryRequest, _cancelKey: string): Promise<QueryResult> {
    const sql = req.sql.trim();
    const isSelect = /^(SELECT|WITH|EXPLAIN|PRAGMA)/i.test(sql);

    if (isSelect) {
      const stmt = db.prepare(sql);
      const rows = await stmt.all();
      const columns: QueryColumn[] = rows.length > 0
        ? Object.keys(rows[0]).map(k => ({ name: k, type: 'TEXT' }))
        : [];
      return { columns, rows, rowCount: rows.length, executionTime: 0, sql };
    } else {
      const stmt = db.prepare(sql);
      const info = await stmt.run();
      return { columns: [], rows: [], rowCount: 0, affectedRows: info.changes, executionTime: 0, sql };
    }
  }

  private async executePGQuery(pool: any, req: QueryRequest): Promise<QueryResult> {
    const res = await pool.query(req.sql);
    const rows = res.rows || [];
    const columns: QueryColumn[] = (res.fields || []).map((f: any) => ({ name: f.name, type: String(f.dataTypeID) }));
    return { columns, rows, rowCount: rows.length, affectedRows: res.rowCount ?? undefined, executionTime: 0, sql: req.sql };
  }

  private async executeMySQLQuery(pool: any, req: QueryRequest): Promise<QueryResult> {
    const [rows, fields] = await pool.query(req.sql);
    if (Array.isArray(rows)) {
      const columns: QueryColumn[] = (fields || []).map((f: any) => ({ name: f.name, type: f.type?.toString() || 'TEXT' }));
      return { columns, rows: rows as Record<string, unknown>[], rowCount: rows.length, executionTime: 0, sql: req.sql };
    }
    return { columns: [], rows: [], rowCount: 0, affectedRows: (rows as any).affectedRows, executionTime: 0, sql: req.sql };
  }

  async getTableData(req: TableDataRequest): Promise<TableDataResult> {
    const active = this.activeClients.get(req.connectionId);
    if (!active) throw new Error('Not connected');

    // Each driver uses different identifier quoting
    const q = active.driver === 'mysql' ? '`' : '"';

    const offset = (req.page - 1) * req.pageSize;
    const orderClause = req.orderBy ? ` ORDER BY ${q}${req.orderBy}${q} ${req.orderDir || 'ASC'}` : '';
    const whereClause = req.filter ? ` WHERE ${req.filter}` : '';
    const sql = `SELECT * FROM ${q}${req.table}${q}${whereClause}${orderClause} LIMIT ${req.pageSize} OFFSET ${offset}`;
    const countSql = `SELECT COUNT(*) as total FROM ${q}${req.table}${q}${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      this.runQuery({ connectionId: req.connectionId, sql, database: req.database }),
      this.runQuery({ connectionId: req.connectionId, sql: countSql, database: req.database }),
    ]);

    // COUNT(*) column name differs by driver: sqlite/pg=total, mysql=total (aliased)
    const countRow = countResult.rows[0] ?? {};
    const totalRows = Number(
      countRow.total ?? countRow.count ?? countRow['COUNT(*)'] ?? countRow['TOTAL'] ?? 0
    );

    return {
      columns: dataResult.columns,
      rows: dataResult.rows,
      totalRows,
      page: req.page,
      pageSize: req.pageSize,
    };
  }

  // ── History & Saved Queries ───────────────────────────────────────

  private addHistory(entry: Omit<QueryHistoryEntry, 'id' | 'executedAt'>): void {
    this.queryHistory.unshift({ id: this.genId(), executedAt: Date.now(), ...entry });
    if (this.queryHistory.length > 500) this.queryHistory = this.queryHistory.slice(0, 500);
    this.savePersisted();
  }

  getHistory(): QueryHistoryEntry[] { return this.queryHistory; }
  clearHistory(): void { this.queryHistory = []; this.savePersisted(); }

  getSavedQueries(): SavedQuery[] { return this.savedQueries; }

  createSavedQuery(data: Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>): SavedQuery {
    const q: SavedQuery = { id: this.genId(), createdAt: Date.now(), updatedAt: Date.now(), ...data };
    this.savedQueries.push(q);
    this.savePersisted();
    return q;
  }

  updateSavedQuery(id: string, updates: Partial<SavedQuery>): SavedQuery | null {
    const q = this.savedQueries.find(q => q.id === id);
    if (!q) return null;
    Object.assign(q, updates, { updatedAt: Date.now() });
    this.savePersisted();
    return q;
  }

  deleteSavedQuery(id: string): boolean {
    const before = this.savedQueries.length;
    this.savedQueries = this.savedQueries.filter(q => q.id !== id);
    if (this.savedQueries.length !== before) { this.savePersisted(); return true; }
    return false;
  }

  // ── ER Diagram ─────────────────────────────────────────────────────

  async getERDiagram(connectionId: string): Promise<import('../../../shared/types/database').ERDiagram> {
    const schema = await this.getSchema(connectionId);
    const db = schema.databases[0];
    if (!db) throw new Error('No database found for connection');

    const relations: import('../../../shared/types/database').ERDiagramRelation[] = [];
    for (const table of db.tables) {
      for (const fk of table.foreignKeys) {
        for (let i = 0; i < fk.columns.length; i++) {
          relations.push({
            fromTable: table.name,
            fromColumn: fk.columns[i],
            toTable: fk.referencedTable,
            toColumn: fk.referencedColumns[i] ?? fk.referencedColumns[0],
            constraintName: fk.name,
            onDelete: fk.onDelete,
            onUpdate: fk.onUpdate,
          });
        }
      }
    }

    // Auto-layout: arrange tables in a grid, spacing based on column count
    const CARD_WIDTH = 200;
    const COL_HEIGHT = 22;
    const HEADER_HEIGHT = 32;
    const H_GAP = 60;
    const V_GAP = 40;
    const COLS_PER_ROW = Math.max(1, Math.ceil(Math.sqrt(db.tables.length)));

    const tables: import('../../../shared/types/database').ERDiagramTable[] = db.tables.map((t, i) => {
      const col = i % COLS_PER_ROW;
      const row = Math.floor(i / COLS_PER_ROW);
      const height = HEADER_HEIGHT + t.columns.length * COL_HEIGHT + 8;
      // Offset x by accumulated widths in this row slot
      const x = col * (CARD_WIDTH + H_GAP) + 24;
      const y = row * (220 + V_GAP) + 24;
      return {
        name: t.name,
        schema: t.schema,
        columns: t.columns,
        primaryKey: t.primaryKey ?? [],
        x,
        y,
        width: CARD_WIDTH,
        height,
      };
    });

    return { connectionId, databaseName: db.name, tables, relations };
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  async dispose(): Promise<void> {
    for (const id of this.activeClients.keys()) await this.disconnect(id);
  }
}
