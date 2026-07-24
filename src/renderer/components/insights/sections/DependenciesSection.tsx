/**
 * Dependencies Section — Dependency analysis with outdated and severity info.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { MetricCard } from '../common/MetricCard';
import { DataTable, Column } from '../common/DataTable';
import { severityColor } from '../utils/format';

interface Props { insights: ProjectInsights; }

export const DependenciesSection: React.FC<Props> = ({ insights }) => {
  const { dependencies } = insights;

  const majorOutdated = dependencies.outdated.filter(d => d.severity === 'major');
  const minorOutdated = dependencies.outdated.filter(d => d.severity === 'minor');
  const patchOutdated = dependencies.outdated.filter(d => d.severity === 'patch');

  const columns: Column<typeof dependencies.outdated[0]>[] = [
    { key: 'name', label: 'Package', width: 200, render: (r) => (
      <span style={{ fontWeight: 500 }}>{r.name}</span>
    ), sortValue: (r) => r.name },
    { key: 'type', label: 'Type', width: 100, render: (r) => (
      <span style={{
        fontSize: 10, padding: '2px 6px', borderRadius: 3,
        background: r.type === 'dependency' ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)',
        color: r.type === 'dependency' ? '#3b82f6' : '#8b5cf6',
      }}>{r.type === 'dependency' ? 'prod' : 'dev'}</span>
    ), sortValue: (r) => r.type },
    { key: 'current', label: 'Current', render: (r) => <code style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{r.current}</code>, sortValue: (r) => r.current },
    { key: 'latest', label: 'Latest', render: (r) => <code style={{ fontSize: 11, color: 'var(--theme-fg)' }}>{r.latest}</code>, sortValue: (r) => r.latest },
    { key: 'severity', label: 'Severity', width: 80, render: (r) => (
      <span style={{
        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 3,
        background: `${severityColor(r.severity)}20`,
        color: severityColor(r.severity),
        textTransform: 'uppercase',
      }}>{r.severity}</span>
    ), sortValue: (r) => r.severity === 'major' ? 3 : r.severity === 'minor' ? 2 : 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="package" title="Dependencies" subtitle={`${dependencies.totalDependencies} prod + ${dependencies.totalDevDependencies} dev dependencies`} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Production" value={dependencies.totalDependencies.toString()} icon="package" color="#3b82f6" />
        <MetricCard label="Development" value={dependencies.totalDevDependencies.toString()} icon="tools" color="#8b5cf6" />
        <MetricCard label="Outdated" value={dependencies.outdated.length.toString()} icon="refresh" color={dependencies.outdated.length > 0 ? '#f59e0b' : '#10b981'} />
        <MetricCard label="Major Updates" value={majorOutdated.length.toString()} icon="warning" color={majorOutdated.length > 0 ? '#ef4444' : '#10b981'} />
      </div>

      {/* Severity breakdown */}
      {dependencies.outdated.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Major', count: majorOutdated.length, color: '#ef4444' },
            { label: 'Minor', count: minorOutdated.length, color: '#f59e0b' },
            { label: 'Patch', count: patchOutdated.length, color: '#3b82f6' },
          ].map(({ label, count, color }) => (
            <div key={label} style={{ flex: 1, padding: '10px 14px', background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)', borderLeft: `3px solid ${color}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Outdated table */}
      {dependencies.outdated.length > 0 ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8 }}>Outdated Packages</div>
          <DataTable columns={columns} data={dependencies.outdated} maxHeight={400} emptyMessage="All dependencies are up to date" />
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 13, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          All dependencies are up to date.
        </div>
      )}
    </div>
  );
};
