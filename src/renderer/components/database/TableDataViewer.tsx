/**
 * TableDataViewer — clean paginated table browser
 */
import React, { useState } from 'react';
import { useDBStore } from '../../stores/dbStore';

const Spinner = () => (
  <span style={{
    display: 'inline-block', width: 14, height: 14,
    border: '2px solid var(--theme-fg-muted)', borderTopColor: 'var(--theme-accent)',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  }} />
);

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
  td: {
    padding: '5px 12px', borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-fg)', maxWidth: 300,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  tdNull: { color: 'var(--theme-fg-muted)', fontStyle: 'italic' as const, opacity: 0.5 },
  tdNum: {
    padding: '5px 8px', borderBottom: '1px solid var(--theme-border)',
    color: 'var(--theme-fg-muted)', fontSize: 11, textAlign: 'right' as const,
    opacity: 0.4, userSelect: 'none' as const,
  } as React.CSSProperties,

  center: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: 10, color: 'var(--theme-fg-muted)', fontSize: 12,
  },
};

export const TableDataViewer: React.FC = () => {
  const { tableDataResult, tableDataLoading, activeTable, activeConnectionId, loadTableData } = useDBStore();
  const [page, setPage] = useState(1);

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

  const totalRows = tableDataResult.totalRows ?? 0;
  const pageSize = tableDataResult.pageSize ?? 100;
  const columns = tableDataResult.columns ?? [];
  const rows = tableDataResult.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const goPage = (p: number) => {
    if (p < 1 || p > totalPages || !activeConnectionId) return;
    setPage(p);
    loadTableData(activeConnectionId, activeTable, p);
  };

  const startRow = (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  return (
    <div style={S.root}>
      <div style={S.toolbar}>
        <span style={S.tableTitle}>{activeTable}</span>
        <span style={S.metaText}>
          {(tableDataResult.totalRows ?? 0).toLocaleString()} rows
          {(tableDataResult.totalRows ?? 0) > 0 && ` · showing ${startRow}–${endRow}`}
        </span>
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
      </div>

      <div style={S.tableWrap}>
        {rows.length === 0 ? (
          <div style={S.center}><span>No rows found in {activeTable}.</span></div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thNum}>#</th>
                {columns.map(col => (
                  <th key={col.name} style={S.th} title={col.type}>{col.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}
                >
                  <td style={S.tdNum}>{startRow + i}</td>
                  {columns.map(col => {
                    const val = row[col.name];
                    const isNull = val === null || val === undefined;
                    return (
                      <td
                        key={col.name}
                        style={{ ...S.td, ...(isNull ? S.tdNull : {}) }}
                        title={isNull ? 'NULL' : String(val)}
                      >
                        {isNull ? 'NULL' : String(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
