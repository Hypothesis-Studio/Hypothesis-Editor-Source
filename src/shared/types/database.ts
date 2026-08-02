/**
 * Hypothesis Editor - Database Explorer Types
 */

// ============================================================================
// Connection Types
// ============================================================================

export type DatabaseDriver = 'sqlite' | 'postgresql' | 'mysql' | 'mariadb';

export interface DatabaseConnection {
  id: string;
  name: string;
  driver: DatabaseDriver;
  // SQLite
  filePath?: string;
  // Network DBs
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  // State
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
  createdAt: number;
  lastConnectedAt?: number;
}

export interface DatabaseConnectionConfig {
  name: string;
  driver: DatabaseDriver;
  filePath?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

// ============================================================================
// Schema Types
// ============================================================================

export interface DatabaseSchema {
  connectionId: string;
  databases: DatabaseInfo[];
}

export interface DatabaseInfo {
  name: string;
  tables: TableInfo[];
  views: ViewInfo[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
  primaryKey?: string[];
}

export interface ViewInfo {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
  definition?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  autoIncrement: boolean;
  comment?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface QueryRequest {
  connectionId: string;
  sql: string;
  database?: string;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  executionTime: number;
  sql: string;
  error?: string;
}

export interface QueryColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

// ============================================================================
// Query History
// ============================================================================

export interface QueryHistoryEntry {
  id: string;
  connectionId: string;
  sql: string;
  executionTime: number;
  rowCount: number;
  error?: string;
  executedAt: number;
}

// ============================================================================
// Saved Queries
// ============================================================================

export interface SavedQuery {
  id: string;
  name: string;
  connectionId?: string;
  sql: string;
  description?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Table Data (browsing)
// ============================================================================

export interface TableDataRequest {
  connectionId: string;
  database?: string;
  table: string;
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDir?: 'ASC' | 'DESC';
  filter?: string;
}

export interface TableDataResult {
  columns: QueryColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// ER Diagram Types
// ============================================================================

export interface ERDiagramTable {
  name: string;
  schema?: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ERDiagramRelation {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface ERDiagram {
  connectionId: string;
  databaseName: string;
  tables: ERDiagramTable[];
  relations: ERDiagramRelation[];
}

// ============================================================================
// Row Update (inline editing)
// ============================================================================

export interface RowUpdateRequest {
  connectionId: string;
  table: string;
  primaryKey: Record<string, unknown>; // { colName: value } for WHERE clause
  column: string;
  value: unknown;
}

export interface RowUpdateResult {
  success: boolean;
  affectedRows?: number;
  error?: string;
}

// ============================================================================
// FK Row Lookup
// ============================================================================

export interface FKRowGetRequest {
  connectionId: string;
  referencedTable: string;
  referencedColumn: string;
  value: unknown;
}

export interface FKRowGetResult {
  row: Record<string, unknown> | null;
  error?: string;
}

// ============================================================================
// Table Export
// ============================================================================

export type ExportFormat = 'csv' | 'json' | 'sql';

export interface ExportTableRequest {
  connectionId: string;
  table: string;
  format: ExportFormat;
  filter?: string;
}

export interface ExportTableResult {
  content: string;
  filename: string;
  error?: string;
}

// ============================================================================
// IPC Channels
// ============================================================================

export const DB_IPC = {
  // Connections
  CONNECT: 'db:connect',
  DISCONNECT: 'db:disconnect',
  TEST_CONNECTION: 'db:test-connection',
  CONNECTION_LIST: 'db:connection-list',
  CONNECTION_GET: 'db:connection-get',
  CONNECTION_CREATE: 'db:connection-create',
  CONNECTION_UPDATE: 'db:connection-update',
  CONNECTION_DELETE: 'db:connection-delete',

  // Schema
  SCHEMA_GET: 'db:schema-get',
  TABLES_LIST: 'db:tables-list',
  TABLE_INFO: 'db:table-info',

  // Query
  QUERY_EXECUTE: 'db:query-execute',
  QUERY_CANCEL: 'db:query-cancel',

  // Table data
  TABLE_DATA: 'db:table-data',

  // History & saved queries
  HISTORY_LIST: 'db:history-list',
  HISTORY_CLEAR: 'db:history-clear',
  SAVED_QUERY_LIST: 'db:saved-query-list',
  SAVED_QUERY_CREATE: 'db:saved-query-create',
  SAVED_QUERY_UPDATE: 'db:saved-query-update',
  SAVED_QUERY_DELETE: 'db:saved-query-delete',

  // ER Diagram
  ER_DIAGRAM_GET: 'db:er-diagram-get',

  // Cell editing
  ROW_UPDATE: 'db:row-update',

  // FK lookup
  FK_ROW_GET: 'db:fk-row-get',

  // Export
  EXPORT_TABLE: 'db:export-table',

  // Events (main → renderer)
  CONNECTION_STATUS: 'db:connection-status',
  QUERY_PROGRESS: 'db:query-progress',
} as const;
