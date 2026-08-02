/**
 * TableDataViewer — paginated table browser with:
 *   - Inline cell editing (double-click to edit, Enter/Escape to confirm/cancel)
 *   - FK navigation (click the → icon on FK cells to jump to referenced row)
 *   - Export (CSV, JSON, SQL)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDBStore } from '../../stores/dbStore';
import type { ExportFormat } from '../../../shared/types/database';

// ── Helpers ───────────────────────────────────────────────────────

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid var(--theme-fg-muted)', borderTopColor: 'var(--theme-accent)',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
);

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Styles ────────────────────────────────────────────────────────

const S = {
  root: { height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--theme-bg)' },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0, minHeight: 38,
  },
  tableTitle: { fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)' },
  metaText: { fontSize: 11, color: 'var(--theme-fg-muted)' },
  spacer: { flex: 1 },
  pager: { display: 'flex', alignItems: 'center', gap: 4 },
  pageBtn: (disabled: boolean): React.CSSProperties => ({
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, background: 'none',
    border: '1px solid var(--theme-border)', borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--theme-fg-muted)' : 'var(--theme-fg)',
    opacity: disabled ? 0.4 : 1, transition: 'all 0.1s',
  }),
  pageInfo: { fontSize: 11, color: 'var(--theme-fg-muted)', padding: '0 4px', whiteSpace: 'nowrap' as const },
  toolbarBtn: {
    padding: '3px 10px', fontSize: 11, borderRadius: 4,
    border: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))',
    color: 'var(--theme-fg)', cursor: 'pointer',
  } as React.CSSProperties,

  tableWrap: { flex: 1, overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th: {
    padding: '6px 12px', textAlign: 'left' as const, fontWeight: 600, fontSize: 11,
    color: 'var(--theme-fg-muted)', background: 'var(--theme-bg-secondary)',
    borderBottom: '1px solid var(--theme-border)',
    whiteSpace: 'nowrap' as const, position: 'sticky' as const, top: 0,
    userSelect: 'none' as const,
  },
  thNum: {
    padding: '6px 8px', textAlign: 'right' as const, fontWeight: 600, fontSize: 11,
    color: 'var(--theme-fg-muted)', background: 'var(--theme-bg-secondary)',
    borderBottom: '1px solid var(--theme-border)',
    position: 'sticky' as const, top: 0, width: 40, userSelect: 'none' as const,
  },
  td: (editing: boolean, dirty: boolean): React.CSSProperties => ({
    padding: editing ? '0' : '5px 12px',
    borderBottom: '1px solid var(--theme-border)',
    color: dirty ? 'var(--theme-accent)' : 'var(--theme-fg)',
    maxWidth: 300,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    background: editing ? 'var(--theme-bg-tertiary, rgba(255,255,255,0.05))' : undefined,
    outline: editing ? '2px solid var(--theme-accent)' : dirty ? '1px solid var(--theme-accent)' : undefined,
    outlineOffset: editing ? '-2px' : undefined,
  }),
  tdNull: { color: 'var(--theme-fg-muted)', fontStyle: 'italic' as const, opacity: 0.5 },
  tdNum: {
    padding: '5px 8px', borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-fg-muted)', fontSize: 11, textAlign: 'right' as const,
    opacity: 0.4, userSelect: 'none' as const,
  } as React.CSSProperties,
  cellInput: {
    width: '100%', height: '100%', padding: '5px 12px',
    background: 'transparent', border: 'none', outline: 'none',
    color: 'var(--theme-accent)', fontSize: 12,
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  fkBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginLeft: 4, padding: '0 3px', height: 16, fontSize: 10,
    borderRadius: 3, border: '1px solid var(--theme-border)',
    background: 'rgba(163,113,247,0.12)', color: '#a371f7',
    cursor: 'pointer', verticalAlign: 'middle', flexShrink: 0,
    lineHeight: 1,
  } as React.CSSProperties,
  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: 10, color: 'var(--theme-fg-muted)', fontSize: 12,
  },
  exportMenu: {
    position: 'absolute' as const, top: '100%', right: 0, zIndex: 100,
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
    borderRadius: 6, padding: '4px 0', minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  exportItem: {
    display: 'block', width: '100%', padding: '6px 14px', fontSize: 12,
    background: 'none', border: 'none', textAlign: 'left' as const,
    color: 'var(--theme-fg)', cursor: 'pointer',
  } as React.CSSProperties,

  // FK popup
  fkPopup: {
    position: 'fixed' as const, zIndex: 9999,
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-accent)',
    borderRadius: 8, padding: 12, maxWidth: 420, minWidth: 240,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', fontSize: 12,
    color: 'var(--theme-fg)',
  },
  fkPopupTitle: {
    fontSize: 11, fontWeight: 700, color: 'var(--theme-fg-muted)',
    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
  },
  fkPopupRow: {
    display: 'flex', gap: 8, padding: '3px 0',
    borderBottom: '1px solid var(--theme-border)',
  },
  fkPopupKey: { fontWeight: 600, color: 'var(--theme-fg-muted)', minWidth: 90, flexShrink: 0, fontSize: 11 },
  fkPopupVal: { color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  fkPopupNav: {
    marginTop: 8, padding: '4px 12px', fontSize: 11, borderRadius: 4,
    border: 'none', background: 'var(--theme-accent)', color: '#fff', cursor: 'pointer',
  } as React.CSSProperties,
};

// ── FK Popup ──────────────────────────────────────────────────────

interface FKPopupProps {
  row: Record<string, unknown>;
  tableName: string;
  x: number;
  y: number;
  onClose: () => void;
  onNavigate: () => void;
}

const FKPopup: React.FC<FKPopupProps> = ({ row, tableName, x, y, onClose, onNavigate }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Clamp to viewport
  const style: React.CSSProperties = {
    ...S.fkPopup,
    left: Math.min(x, window.innerWidth - 440),
    top: Math.min(y, window.innerHeight - 300),
  };

  const entries = Object.entries(row).slice(0, 12);

  return (
    <div ref={ref} style={style}>
      <div style={S.fkPopupTitle}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="#a371f7">
          <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v2A1.5 1.5 0 0 1 13.5 7h-11A1.5 1.5 0 0 1 1 5.5v-2zm0 5A1.5 1.5 0 0 1 2.5 7h11A1.5 1.5 0 0 1 15 8.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 10.5v-2z"/>
        </svg>
        Referenced row in <strong>{tableName}</strong>
      </div>
      {entries.map(([k, v]) => (
        <div key={k} style={S.fkPopupRow}>
          <span style={S.fkPopupKey}>{k}</span>
          <span style={S.fkPopupVal} title={v === null ? 'NULL' : String(v)}>
            {v === null ? <em style={{ opacity: 0.5 }}>NULL</em> : String(v)}
          </span>
        </div>
      ))}
      {Object.keys(row).length > 12 && (
        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 4 }}>
          +{Object.keys(row).length - 12} more columns…
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button style={S.fkPopupNav} onClick={onNavigate}>Browse table →</button>
        <button style={{ ...S.fkPopupNav, background: 'var(--theme-bg-tertiary, rgba(255,255,255,0.08))', color: 'var(--theme-fg)', border: '1px solid var(--theme-border)' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────

export const TableDataViewer: React.FC = () => {
  const {
    tableDataResult, tableDataLoading, activeTable, activeConnectionId,
    loadTableData, schemas, updateCell, lookupFKRow, exportTable,
  } = useDBStore();

  const [page, setPage] = useState(1);

  // Inline editing state: key = `rowIdx:colName`
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Dirty cells: key = `rowIdx:colName`, value = display string
  const [dirtyCells, setDirtyCells] = useState<Record<string, string>>({});
  // Save error
  const [saveError, setSaveError] = useState<string | null>(null);

  // FK popup
  const [fkPopup, setFkPopup] = useState<{
    row: Record<string, unknown>;
    tableName: string;
    x: number; y: number;
    connId: string;
  } | null>(null);

  // Export dropdown
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Build FK map from schema: colName → { referencedTable, referencedColumn }
  const fkMap = React.useMemo(() => {
    const map = new Map<string, { referencedTable: string; referencedColumn: string }>();
    if (!activeConnectionId || !activeTable) return map;
    const schema = schemas[activeConnectionId];
    if (!schema) return map;
    for (const db of schema.databases) {
      const tableInfo = db.tables.find(t => t.name === activeTable);
      if (!tableInfo) continue;
      for (const fk of tableInfo.foreignKeys) {
        for (let i = 0; i < fk.columns.length; i++) {
          map.set(fk.columns[i], {
            referencedTable: fk.referencedTable,
            referencedColumn: fk.referencedColumns[i] ?? fk.referencedColumns[0],
          });
        }
      }
    }
    return map;
  }, [activeConnectionId, activeTable, schemas]);

  // Primary key columns from schema
  const pkColumns = React.useMemo(() => {
    if (!activeConnectionId || !activeTable) return [] as string[];
    const schema = schemas[activeConnectionId];
    if (!schema) return [] as string[];
    for (const db of schema.databases) {
      const tableInfo = db.tables.find(t => t.name === activeTable);
      if (tableInfo) return tableInfo.primaryKey ?? [];
    }
    return [] as string[];
  }, [activeConnectionId, activeTable, schemas]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExport(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  // ── Paging ─────────────────────────────────────────────────────

  const totalRows = tableDataResult?.totalRows ?? 0;
  const pageSize = tableDataResult?.pageSize ?? 100;
  const columns = tableDataResult?.columns ?? [];
  const rows = tableDataResult?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages || !activeConnectionId || !activeTable) return;
    setPage(p);
    setDirtyCells({});
    setEditingCell(null);
    loadTableData(activeConnectionId, activeTable, p);
  };

  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  // ── Inline editing ─────────────────────────────────────────────

  const startEdit = (rowIdx: number, colName: string, currentVal: unknown) => {
    if (pkColumns.length === 0) return; // can't edit without PK
    const key = `${rowIdx}:${colName}`;
    setEditingCell(key);
    setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal));
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
    setSaveError(null);
  };

  const commitEdit = async (rowIdx: number, colName: string, row: Record<string, unknown>, originalVal: unknown) => {
    if (!activeConnectionId || !activeTable) return;
    const key = `${rowIdx}:${colName}`;

    // If value unchanged, just cancel — no network call, no outline
    const originalStr = originalVal === null || originalVal === undefined ? '' : String(originalVal);
    if (editValue === originalStr) {
      cancelEdit();
      return;
    }

    // Build primary key map
    const primaryKey: Record<string, unknown> = {};
    for (const pk of pkColumns) {
      primaryKey[pk] = row[pk];
    }

    const result = await updateCell({
      connectionId: activeConnectionId,
      table: activeTable,
      primaryKey,
      column: colName,
      value: editValue,
    });

    if (result.success) {
      setDirtyCells(prev => ({ ...prev, [key]: editValue }));
      setEditingCell(null);
      setSaveError(null);
    } else {
      setSaveError(result.error ?? 'Update failed');
      setEditingCell(null); // clear editing state even on error so outline goes away
    }
  };

  const onKeyDown = (e: React.KeyboardEvent, rowIdx: number, colName: string, row: Record<string, unknown>, originalVal: unknown) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(rowIdx, colName, row, originalVal); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    if (e.key === 'Tab') { e.preventDefault(); commitEdit(rowIdx, colName, row, originalVal); }
  };

  // ── FK navigation ──────────────────────────────────────────────

  const handleFKClick = async (
    e: React.MouseEvent,
    colName: string,
    val: unknown,
  ) => {
    e.stopPropagation();
    if (!activeConnectionId) return;
    const fk = fkMap.get(colName);
    if (!fk) return;

    const result = await lookupFKRow({
      connectionId: activeConnectionId,
      referencedTable: fk.referencedTable,
      referencedColumn: fk.referencedColumn,
      value: val,
    });

    if (result.row) {
      setFkPopup({
        row: result.row,
        tableName: fk.referencedTable,
        x: e.clientX + 8,
        y: e.clientY + 8,
        connId: activeConnectionId,
      });
    }
  };

  const navigateToFKTable = () => {
    if (!fkPopup || !activeConnectionId) return;
    loadTableData(activeConnectionId, fkPopup.tableName);
    setFkPopup(null);
  };

  // ── Export ────────────────────────────────────────────────────

  const handleExport = async (format: ExportFormat) => {
    if (!activeConnectionId || !activeTable) return;
    setShowExport(false);
    setExporting(true);
    try {
      const result = await exportTable({
        connectionId: activeConnectionId,
        table: activeTable,
        format,
      });
      if (result.content && result.filename) {
        // Ask user where to save via Electron save dialog
        const ext = format === 'csv' ? 'csv' : format === 'json' ? 'json' : 'sql';
        const dialogResult = await (window as any).api.file.dialogSave({
          defaultPath: result.filename,
          filters: [
            { name: ext.toUpperCase(), extensions: [ext] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });
        if (!dialogResult.canceled && dialogResult.filePath) {
          // Write file via fs bridge
          await (window as any).api.fs.writeFile(dialogResult.filePath, result.content);
        }
      } else if (result.error) {
        setSaveError(result.error);
      }
    } finally {
      setExporting(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────

  if (!activeTable) {
    return (
      <div style={S.center}>
        <span style={{ fontSize: 28, opacity: 0.2 }}>📋</span>
        <span>Click a table in the sidebar to browse its data</span>
      </div>
    );
  }

  if (tableDataLoading) {
    return (
      <div style={S.center}>
        <Spinner />
        <span>Loading {activeTable}…</span>
      </div>
    );
  }

  if (!tableDataResult) {
    return <div style={S.center}><span>No data loaded.</span></div>;
  }

  const canEdit = pkColumns.length > 0;

  return (
    <div style={S.root}>
      {/* Toolbar */}
      <div style={S.toolbar}>
        <span style={S.tableTitle}>{activeTable}</span>
        <span style={S.metaText}>
          {totalRows.toLocaleString()} rows
          {totalRows > 0 && ` · showing ${startRow}–${endRow}`}
          {!canEdit && <span style={{ marginLeft: 6, opacity: 0.5 }}>(no PK — read-only)</span>}
        </span>

        {saveError && (
          <span style={{ fontSize: 11, color: '#f85149', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ⚠ {saveError}
          </span>
        )}

        <div style={S.spacer} />

        {totalPages > 1 && (
          <div style={S.pager}>
            <button style={S.pageBtn(page <= 1)} onClick={() => goPage(1)} disabled={page <= 1} title="First page">«</button>
            <button style={S.pageBtn(page <= 1)} onClick={() => goPage(page - 1)} disabled={page <= 1} title="Previous page">‹</button>
            <span style={S.pageInfo}>Page {page} / {totalPages}</span>
            <button style={S.pageBtn(page >= totalPages)} onClick={() => goPage(page + 1)} disabled={page >= totalPages} title="Next page">›</button>
            <button style={S.pageBtn(page >= totalPages)} onClick={() => goPage(totalPages)} disabled={page >= totalPages} title="Last page">»</button>
          </div>
        )}

        {/* Export button */}
        <div ref={exportRef} style={{ position: 'relative' }}>
          <button
            style={S.toolbarBtn}
            onClick={() => setShowExport(v => !v)}
            disabled={exporting}
            title="Export table data"
          >
            {exporting ? <Spinner /> : 'Export ▾'}
          </button>
          {showExport && (
            <div style={S.exportMenu}>
              {(['csv', 'json', 'sql'] as ExportFormat[]).map(fmt => (
                <button key={fmt} style={S.exportItem} onClick={() => handleExport(fmt)}>
                  Export as .{fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={S.tableWrap}>
        {rows.length === 0 ? (
          <div style={S.center}><span>No rows found in {activeTable}.</span></div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thNum}>#</th>
                {columns.map(col => (
                  <th key={col.name} style={S.th} title={col.type}>
                    {col.name}
                    {fkMap.has(col.name) && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: '#a371f7', fontWeight: 700 }}>FK</span>
                    )}
                    {pkColumns.includes(col.name) && (
                      <span style={{ marginLeft: 4, fontSize: 9, color: '#e3b341', fontWeight: 700 }}>PK</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{ background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                >
                  <td style={S.tdNum}>{startRow + rowIdx}</td>
                  {columns.map(col => {
                    const cellKey = `${rowIdx}:${col.name}`;
                    const isEditing = editingCell === cellKey;
                    const isDirty = cellKey in dirtyCells;
                    const rawVal = isDirty ? dirtyCells[cellKey] : row[col.name];
                    const isNull = rawVal === null || rawVal === undefined;
                    const displayVal = isDirty ? dirtyCells[cellKey] : (isNull ? null : String(rawVal));
                    const isFKCol = fkMap.has(col.name);
                    const isPKCol = pkColumns.includes(col.name);

                    return (
                      <td
                        key={col.name}
                        style={S.td(isEditing, isDirty)}
                        title={isNull ? 'NULL' : String(rawVal)}
                        onDoubleClick={() => {
                          if (canEdit && !isPKCol) startEdit(rowIdx, col.name, row[col.name]);
                        }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            style={S.cellInput}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => onKeyDown(e, rowIdx, col.name, row, row[col.name])}
                            onBlur={() => commitEdit(rowIdx, col.name, row, row[col.name])}
                          />
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <span
                              style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                ...(isNull ? S.tdNull : {}),
                              }}
                            >
                              {isNull ? 'NULL' : displayVal}
                            </span>
                            {isFKCol && !isNull && (
                              <button
                                style={S.fkBtn}
                                title={`View referenced row in ${fkMap.get(col.name)?.referencedTable}`}
                                onClick={e => handleFKClick(e, col.name, rawVal)}
                              >
                                →
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* FK popup */}
      {fkPopup && (
        <FKPopup
          row={fkPopup.row}
          tableName={fkPopup.tableName}
          x={fkPopup.x}
          y={fkPopup.y}
          onClose={() => setFkPopup(null)}
          onNavigate={navigateToFKTable}
        />
      )}
    </div>
  );
};
