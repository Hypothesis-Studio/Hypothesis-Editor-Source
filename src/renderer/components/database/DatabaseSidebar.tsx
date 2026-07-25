/**
 * DatabaseSidebar — clean professional connection + schema tree
 */
import React, { useEffect, useState } from 'react';
import { useDBStore } from '../../stores/dbStore';
import { ConnectionDialog } from './ConnectionDialog';
import { ConfirmDialog } from '../dialogs';
import type { DatabaseConnection } from '../../../shared/types/database';

// ── Icons ─────────────────────────────────────────────────────────
const IcoPlus = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
  </svg>
);
const IcoRefresh = ({ spinning }: { spinning?: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={spinning ? { animation: 'spin 0.8s linear infinite' } : {}}>
    <path d="M8 3a5 5 0 1 0 4.546 2.914.75.75 0 0 1 1.36-.636A6.5 6.5 0 1 1 8 1.5v1A.75.75 0 0 1 8 3z"/>
    <path d="M8 1.5a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 1.5z"/>
  </svg>
);
const IcoEdit = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61z"/>
  </svg>
);
const IcoDisconnect = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
  </svg>
);
const IcoTrash = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15z"/>
  </svg>
);
const IcoTable = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v2A1.5 1.5 0 0 1 13.5 7h-11A1.5 1.5 0 0 1 1 5.5v-2zm0 5A1.5 1.5 0 0 1 2.5 7h11A1.5 1.5 0 0 1 15 8.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 10.5v-2z"/>
  </svg>
);
const IcoView = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2a5.97 5.97 0 0 0-4.192 1.694A7.967 7.967 0 0 0 2 8a7.967 7.967 0 0 0 1.808 4.306A5.97 5.97 0 0 0 8 14a5.97 5.97 0 0 0 4.192-1.694A7.967 7.967 0 0 0 14 8a7.967 7.967 0 0 0-1.808-4.306A5.97 5.97 0 0 0 8 2zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
  </svg>
);
const IcoBrowse = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
  </svg>
);
const IcoQuery = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.24 1.178a1.5 1.5 0 0 1 1.56.12l8.5 5.5a1.5 1.5 0 0 1 0 2.4l-8.5 5.5A1.5 1.5 0 0 1 2.5 13.5v-11a1.5 1.5 0 0 1 .74-1.322z"/>
  </svg>
);

// ── Styles ────────────────────────────────────────────────────────
const S = {
  root: {
    height: '100%', display: 'flex', flexDirection: 'column' as const,
    background: 'var(--theme-bg-secondary)',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 8px', borderBottom: '1px solid var(--theme-border)', flexShrink: 0,
  },
  headerTitle: {
    flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--theme-fg-muted)',
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--theme-fg-muted)', padding: '3px', borderRadius: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.1s, background 0.1s',
  } as React.CSSProperties,
  scroll: { flex: 1, overflowY: 'auto' as const, padding: '4px 0' },

  // Connection row
  connRow: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '6px 10px 6px 8px', cursor: 'pointer',
    background: active ? 'var(--theme-list-active-bg, rgba(255,255,255,0.07))' : 'transparent',
    borderLeft: `2px solid ${active ? 'var(--theme-accent)' : 'transparent'}`,
    transition: 'background 0.1s',
  }),
  connDot: (connected: boolean, connecting: boolean): React.CSSProperties => ({
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
    background: connecting ? '#e5a50a' : connected ? '#3fb950' : 'var(--theme-fg-muted)',
    boxShadow: connected ? '0 0 4px #3fb95066' : 'none',
    transition: 'background 0.2s',
  }),
  connName: {
    flex: 1, fontSize: 12, fontWeight: 500,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    color: 'var(--theme-fg)',
  },
  connDriver: {
    fontSize: 10, color: 'var(--theme-fg-muted)',
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
    padding: '1px 5px', borderRadius: 3, flexShrink: 0,
  },
  connActions: {
    display: 'flex', gap: 1, flexShrink: 0,
  },

  // Schema tree
  schemaWrap: { paddingBottom: 4 },
  dbSection: { margin: '4px 0' },
  dbLabel: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 10px 3px 24px', fontSize: 10, fontWeight: 700,
    color: 'var(--theme-fg-muted)', textTransform: 'uppercase' as const,
    letterSpacing: '0.07em',
  },
  sectionLabel: {
    padding: '2px 10px 2px 28px', fontSize: 10, fontWeight: 600,
    color: 'var(--theme-fg-muted)', opacity: 0.6,
    textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  },

  tableRow: (hovered: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '3px 8px 3px 28px', cursor: 'pointer', fontSize: 12,
    background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
    borderRadius: 3, margin: '1px 4px',
    color: 'var(--theme-fg)',
    transition: 'background 0.1s',
  }),
  tableChevron: { fontSize: 8, color: 'var(--theme-fg-muted)', width: 10, flexShrink: 0 },
  tableName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  tableRowCount: { fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.7 },
  tableActions: { display: 'flex', gap: 1 },

  colRow: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '2px 8px 2px 44px', fontSize: 11,
    color: 'var(--theme-fg-muted)',
  },
  colName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  colType: { fontSize: 10, color: 'var(--theme-accent)', opacity: 0.8 },
  badge: (color: string): React.CSSProperties => ({
    fontSize: 9, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
    background: `${color}20`, color, flexShrink: 0,
  }),

  // Loading / empty
  loading: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 24px',
    fontSize: 11, color: 'var(--theme-fg-muted)',
  },
  emptyWrap: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    justifyContent: 'center', padding: '32px 16px', gap: 10,
  },
  emptyIcon: { fontSize: 28, opacity: 0.3 },
  emptyText: { fontSize: 12, color: 'var(--theme-fg-muted)', textAlign: 'center' as const },
  emptyBtn: {
    padding: '5px 14px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
    background: 'var(--theme-accent)', color: '#fff', border: 'none',
    marginTop: 4,
  },
};

// ── Hover-aware icon button ───────────────────────────────────────
const IconBtn: React.FC<{ title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode; danger?: boolean }> = ({ title, onClick, children, danger }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      style={{
        ...S.iconBtn,
        color: hov ? (danger ? '#f85149' : 'var(--theme-fg)') : 'var(--theme-fg-muted)',
        background: hov ? (danger ? 'rgba(248,81,73,0.12)' : 'rgba(255,255,255,0.07)') : 'transparent',
      }}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
};

// ── Spinner ───────────────────────────────────────────────────────
const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 11, height: 11, flexShrink: 0,
    border: '2px solid var(--theme-fg-muted)', borderTopColor: 'var(--theme-accent)',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
);

// ── Main component ────────────────────────────────────────────────
export const DatabaseSidebar: React.FC = () => {
  const {
    connections, activeConnectionId, schemas, loadingSchema, expandedTables,
    loadConnections, connect, disconnect, deleteConnection,
    setActiveConnection, loadSchema, toggleTable, loadTableData, openQueryTab,
  } = useDBStore();

  const [showNewConn, setShowNewConn] = useState(false);
  const [editConn, setEditConn] = useState<DatabaseConnection | undefined>();
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DatabaseConnection | null>(null);

  useEffect(() => {
    loadConnections();
    const api = (window as any).api;
    if (api?.db?.connection?.onStatus) {
      const unsub = api.db.connection.onStatus((data: any) => {
        useDBStore.getState().handleConnectionStatus(data);
      });
      return unsub;
    }
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadConnections();
    // Re-load schema for all connected connections
    const conns = useDBStore.getState().connections;
    await Promise.all(conns.filter(c => c.isConnected).map(c => loadSchema(c.id)));
    setRefreshing(false);
  };

  const handleConnClick = async (conn: DatabaseConnection) => {
    setActiveConnection(conn.id);
    if (!conn.isConnected && !conn.isConnecting) {
      const result = await connect(conn.id);
      if (result.success) loadSchema(conn.id);
    } else if (conn.isConnected) {
      loadSchema(conn.id);
    }
  };

  const handleTableClick = (connId: string, tableName: string) => {
    toggleTable(`${connId}::${tableName}`);
  };

  const handleBrowse = (e: React.MouseEvent, connId: string, tableName: string) => {
    e.stopPropagation(); e.preventDefault();
    loadTableData(connId, tableName);
    useDBStore.getState().setActiveView('table');
  };

  const handleQuery = (e: React.MouseEvent, connId: string, tableName: string) => {
    e.stopPropagation(); e.preventDefault();
    openQueryTab(connId, `SELECT * FROM "${tableName}" LIMIT 100;`, tableName);
    useDBStore.getState().setActiveView('query');
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={S.headerTitle}>Connections</span>
        <IconBtn title="Refresh / Sync" onClick={handleRefresh}>
          <IcoRefresh spinning={refreshing} />
        </IconBtn>
        <IconBtn title="New Connection" onClick={() => setShowNewConn(true)}>
          <IcoPlus />
        </IconBtn>
      </div>

      <div style={S.scroll}>
        {connections.length === 0 ? (
          <div style={S.emptyWrap}>
            <span style={S.emptyIcon}>🗄️</span>
            <span style={S.emptyText}>No database connections yet.</span>
            <button style={S.emptyBtn} onClick={() => setShowNewConn(true)}>Add Connection</button>
          </div>
        ) : (
          connections.map((conn) => {
            const schema = schemas[conn.id];
            const isLoading = loadingSchema[conn.id];
            const isActive = activeConnectionId === conn.id;
            const isHov = hoveredConn === conn.id;

            return (
              <div key={conn.id}>
                {/* Connection row */}
                <div
                  style={S.connRow(isActive)}
                  onClick={() => handleConnClick(conn)}
                  onMouseEnter={() => setHoveredConn(conn.id)}
                  onMouseLeave={() => setHoveredConn(null)}
                >
                  {conn.isConnecting
                    ? <Spinner />
                    : <div style={S.connDot(conn.isConnected, conn.isConnecting)} title={conn.isConnected ? 'Connected' : 'Disconnected'} />
                  }
                  <span style={S.connName} title={conn.name}>{conn.name}</span>
                  {!isHov && <span style={S.connDriver}>{conn.driver}</span>}
                  {isHov && (
                    <div style={S.connActions} onClick={e => e.stopPropagation()}>
                      <IconBtn title="Edit connection" onClick={(e) => { e.stopPropagation(); setEditConn(conn); }}>
                        <IcoEdit />
                      </IconBtn>
                      {conn.isConnected && (
                        <IconBtn title="Disconnect" onClick={(e) => { e.stopPropagation(); disconnect(conn.id); }}>
                          <IcoDisconnect />
                        </IconBtn>
                      )}
                      <IconBtn title="Delete connection" danger onClick={(e) => { e.stopPropagation(); setConfirmDelete(conn); }}>
                        <IcoTrash />
                      </IconBtn>
                    </div>
                  )}
                </div>

                {/* Schema tree — only for active + connected */}
                {isActive && conn.isConnected && (
                  <div style={S.schemaWrap}>
                    {isLoading ? (
                      <div style={S.loading}><Spinner /><span>Loading schema…</span></div>
                    ) : schema?.databases?.map((db) => (
                      <div key={db.name} style={S.dbSection}>
                        <div style={S.dbLabel}>
                          <span>📁</span>
                          <span>{db.name}</span>
                          <span style={{ opacity: 0.5 }}>({db.tables.length} tables)</span>
                        </div>

                        {/* Tables */}
                        {db.tables.length > 0 && (
                          <>
                            <div style={S.sectionLabel}>Tables</div>
                            {db.tables.map((table) => {
                              const key = `${conn.id}::${table.name}`;
                              const expanded = expandedTables[key];
                              const isHovTable = hoveredTable === key;

                              return (
                                <div key={table.name}>
                                  <div
                                    style={S.tableRow(isHovTable)}
                                    onClick={() => handleTableClick(conn.id, table.name)}
                                    onMouseEnter={() => setHoveredTable(key)}
                                    onMouseLeave={() => setHoveredTable(null)}
                                  >
                                    <span style={S.tableChevron}>{expanded ? '▾' : '▸'}</span>
                                    <IcoTable />
                                    <span style={S.tableName} title={table.name}>{table.name}</span>
                                    {!isHovTable && table.rowCount !== undefined && (
                                      <span style={S.tableRowCount}>{table.rowCount.toLocaleString()}</span>
                                    )}
                                    {isHovTable && (
                                      <div style={S.tableActions} onClick={e => e.stopPropagation()}>
                                        <IconBtn title="Browse data" onClick={(e) => handleBrowse(e, conn.id, table.name)}>
                                          <IcoBrowse />
                                        </IconBtn>
                                        <IconBtn title="Open in Query Editor" onClick={(e) => handleQuery(e, conn.id, table.name)}>
                                          <IcoQuery />
                                        </IconBtn>
                                      </div>
                                    )}
                                  </div>

                                  {/* Columns */}
                                  {expanded && table.columns.map((col) => (
                                    <div key={col.name} style={S.colRow}>
                                      {col.isPrimaryKey && <span style={S.badge('#e3b341')}>PK</span>}
                                      {col.isForeignKey && !col.isPrimaryKey && <span style={S.badge('#a371f7')}>FK</span>}
                                      <span style={S.colName} title={col.name}>{col.name}</span>
                                      <span style={S.colType}>{col.type}</span>
                                      {col.nullable && <span style={{ fontSize: 9, color: 'var(--theme-fg-muted)', opacity: 0.5 }}>null</span>}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </>
                        )}

                        {/* Views */}
                        {db.views.length > 0 && (
                          <>
                            <div style={{ ...S.sectionLabel, marginTop: 6 }}>Views</div>
                            {db.views.map((view) => (
                              <div key={view.name} style={S.tableRow(hoveredTable === `${conn.id}::view::${view.name}`)}
                                onMouseEnter={() => setHoveredTable(`${conn.id}::view::${view.name}`)}
                                onMouseLeave={() => setHoveredTable(null)}>
                                <span style={S.tableChevron} />
                                <IcoView />
                                <span style={S.tableName}>{view.name}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {(showNewConn || editConn) && (
        <ConnectionDialog
          connection={editConn}
          onClose={() => { setShowNewConn(false); setEditConn(undefined); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => { if (confirmDelete) deleteConnection(confirmDelete.id); }}
        title="Delete Connection"
        message={`Delete "${confirmDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
};
