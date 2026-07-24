/**
 * DataTable — Generic sortable table for insights data.
 */
import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  maxHeight?: number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({ columns, data, maxHeight = 400, emptyMessage = 'No data', onRowClick }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  if (data.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 12 }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', maxHeight, borderRadius: 6, border: '1px solid var(--theme-border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--theme-bg-secondary)', position: 'sticky', top: 0, zIndex: 1 }}>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => col.sortValue && handleSort(col.key)}
                style={{
                  padding: '8px 10px', textAlign: col.align || 'left', fontWeight: 600,
                  color: 'var(--theme-fg-muted)', borderBottom: '1px solid var(--theme-border)',
                  cursor: col.sortValue ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', userSelect: 'none',
                  width: col.width,
                }}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{
                borderBottom: '1px solid var(--theme-border)',
                cursor: onRowClick ? 'pointer' : 'default',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'; }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{ padding: '6px 10px', textAlign: col.align || 'left', color: 'var(--theme-fg)' }}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
