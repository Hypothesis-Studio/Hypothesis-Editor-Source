/**
 * Complexity Section — Code complexity metrics with file lists.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { MetricCard } from '../common/MetricCard';
import { DataTable, Column } from '../common/DataTable';
import { formatNumber } from '../utils/format';

interface Props { insights: ProjectInsights; }

export const ComplexitySection: React.FC<Props> = ({ insights }) => {
  const { complexity } = insights;

  const fileColumns: Column<{ name: string; path: string; value: number; metric: string }>[] = [
    { key: 'name', label: 'File', render: (r) => (
      <div>
        <div style={{ fontWeight: 500, fontSize: 12 }}>{r.name}</div>
        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.7, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.path}</div>
      </div>
    ), sortValue: (r) => r.name },
    { key: 'value', label: 'Value', align: 'right', render: (r) => (
      <span style={{ fontWeight: 600, color: r.value > 1000 ? '#ef4444' : r.value > 500 ? '#f59e0b' : 'var(--theme-fg)' }}>
        {formatNumber(r.value)}
      </span>
    ), sortValue: (r) => r.value },
    { key: 'metric', label: 'Metric', render: (r) => (
      <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', textTransform: 'capitalize' }}>{r.metric}</span>
    ), sortValue: (r) => r.metric },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="graph" title="Code Complexity" subtitle={`Overall complexity score: ${complexity.overallScore}/100`} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <MetricCard label="Avg File Size" value={`${complexity.averageFileSize} lines`} icon="file" color="#3b82f6" />
        <MetricCard label="Max File Size" value={`${formatNumber(complexity.maxFileSize)} lines`} icon="file" color={complexity.maxFileSize > 1000 ? '#ef4444' : '#10b981'} />
        <MetricCard label="Avg Function Len" value={`${complexity.averageFunctionLength} lines`} icon="symbol-method" color="#8b5cf6" />
        <MetricCard label="Max Function Len" value={`${complexity.maxFunctionLength} lines`} icon="symbol-method" color={complexity.maxFunctionLength > 100 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Long files */}
      {complexity.longFiles.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#f59e0b' }}>⚠</span> Long Files (&gt;500 lines)
          </div>
          <DataTable columns={fileColumns} data={complexity.longFiles} maxHeight={300} emptyMessage="No excessively long files" />
        </div>
      )}

      {/* Deeply nested files */}
      {complexity.deeplyNestedFiles.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#ef4444' }}>🔴</span> Deeply Nested Files (&gt;8 levels)
          </div>
          <DataTable columns={fileColumns} data={complexity.deeplyNestedFiles} maxHeight={300} emptyMessage="No deeply nested files" />
        </div>
      )}

      {/* Large files */}
      {complexity.largeFiles.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#f59e0b' }}>📦</span> Large Files (&gt;100KB)
          </div>
          <DataTable columns={fileColumns} data={complexity.largeFiles} maxHeight={300} emptyMessage="No excessively large files" />
        </div>
      )}

      {/* All clear */}
      {complexity.longFiles.length === 0 && complexity.deeplyNestedFiles.length === 0 && complexity.largeFiles.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 13, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          No complexity issues detected. Codebase is well-structured.
        </div>
      )}
    </div>
  );
};
