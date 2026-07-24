/**
 * Duplicates Section — Duplicate file detection results.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { MetricCard } from '../common/MetricCard';
import { formatNumber, formatBytes } from '../utils/format';
import { DataTable, Column } from '../common/DataTable';

interface Props { insights: ProjectInsights; }

export const DuplicatesSection: React.FC<Props> = ({ insights }) => {
  const { duplicates } = insights;

  const columns: Column<typeof duplicates.groups[0]>[] = [
    { key: 'files', label: 'Files', render: (r) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {r.files.map((f, i) => (
          <div key={i} style={{ fontSize: 11, color: 'var(--theme-fg-muted)', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {f}
          </div>
        ))}
      </div>
    ) },
    { key: 'copies', label: 'Copies', align: 'center', width: 70, render: (r) => (
      <span style={{ fontWeight: 600, color: '#f59e0b' }}>{r.files.length}</span>
    ), sortValue: (r) => r.files.length },
    { key: 'lines', label: 'Lines', align: 'right', width: 80, render: (r) => formatNumber(r.lineCount), sortValue: (r) => r.lineCount },
    { key: 'wasted', label: 'Wasted Lines', align: 'right', width: 100, render: (r) => (
      <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatNumber(r.wastedLines)}</span>
    ), sortValue: (r) => r.wastedLines },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="files" title="Duplicate Files" subtitle={`${duplicates.totalDuplicateGroups} duplicate groups found`} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <MetricCard label="Duplicate Groups" value={duplicates.totalDuplicateGroups.toString()} icon="files" color={duplicates.totalDuplicateGroups > 0 ? '#f59e0b' : '#10b981'} />
        <MetricCard label="Wasted Lines" value={formatNumber(duplicates.totalWastedLines)} icon="code" color={duplicates.totalWastedLines > 0 ? '#ef4444' : '#10b981'} />
        <MetricCard label="Wasted Space" value={formatBytes(duplicates.totalWastedBytes)} icon="database" color={duplicates.totalWastedBytes > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Duplicate table */}
      {duplicates.groups.length > 0 ? (
        <DataTable columns={columns} data={duplicates.groups} maxHeight={400} emptyMessage="No duplicate files detected" />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 13, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          No duplicate files detected.
        </div>
      )}
    </div>
  );
};
