/**
 * Security Section — Vulnerability audit results with severity breakdown.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { MetricCard } from '../common/MetricCard';
import { DataTable, Column } from '../common/DataTable';
import { severityColor } from '../utils/format';

interface Props { insights: ProjectInsights; }

export const SecuritySection: React.FC<Props> = ({ insights }) => {
  const { security } = insights;

  const allVulns = [...security.critical, ...security.high, ...security.moderate, ...security.low, ...security.info];

  const columns: Column<typeof allVulns[0]>[] = [
    { key: 'severity', label: 'Severity', width: 80, render: (r) => (
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 3,
        background: `${severityColor(r.severity)}20`,
        color: severityColor(r.severity),
        textTransform: 'uppercase',
      }}>{r.severity}</span>
    ), sortValue: (r) => {
      const order = { critical: 5, high: 4, moderate: 3, low: 2, info: 1 };
      return order[r.severity] || 0;
    }},
    { key: 'name', label: 'Package', width: 160, render: (r) => <span style={{ fontWeight: 500 }}>{r.name}</span>, sortValue: (r) => r.name },
    { key: 'title', label: 'Title', render: (r) => (
      <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--theme-accent)', textDecoration: 'none' }}
             onClick={(e) => e.stopPropagation()}>
            {r.title}
          </a>
        ) : r.title}
      </div>
    ), sortValue: (r) => r.title },
    { key: 'range', label: 'Range', width: 140, render: (r) => <code style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>{r.range}</code>, sortValue: (r) => r.range },
    { key: 'fix', label: 'Fix', width: 80, align: 'center', render: (r) => (
      <span style={{ color: r.fixAvailable ? '#10b981' : 'var(--theme-fg-muted)', fontSize: 11 }}>
        {r.fixAvailable ? 'Yes' : 'No'}
      </span>
    ), sortValue: (r) => r.fixAvailable ? 1 : 0 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="shield" title="Security Audit" subtitle={security.lastScanned ? `Last scanned: ${new Date(security.lastScanned).toLocaleString()}` : 'Not yet scanned'} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <MetricCard label="Total" value={security.totalVulnerabilities.toString()} icon="shield" color={security.totalVulnerabilities > 0 ? '#ef4444' : '#10b981'} />
        <MetricCard label="Critical" value={security.critical.length.toString()} icon="error" color="#dc2626" />
        <MetricCard label="High" value={security.high.length.toString()} icon="warning" color="#f97316" />
        <MetricCard label="Moderate" value={security.moderate.length.toString()} icon="info" color="#f59e0b" />
        <MetricCard label="Low" value={security.low.length.toString()} icon="info" color="#3b82f6" />
      </div>

      {/* Severity visual */}
      {security.totalVulnerabilities > 0 && (
        <div style={{ borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: 12, display: 'flex' }}>
            {security.critical.length > 0 && <div style={{ width: `${(security.critical.length / security.totalVulnerabilities) * 100}%`, background: '#dc2626' }} title={`Critical: ${security.critical.length}`} />}
            {security.high.length > 0 && <div style={{ width: `${(security.high.length / security.totalVulnerabilities) * 100}%`, background: '#f97316' }} title={`High: ${security.high.length}`} />}
            {security.moderate.length > 0 && <div style={{ width: `${(security.moderate.length / security.totalVulnerabilities) * 100}%`, background: '#f59e0b' }} title={`Moderate: ${security.moderate.length}`} />}
            {security.low.length > 0 && <div style={{ width: `${(security.low.length / security.totalVulnerabilities) * 100}%`, background: '#3b82f6' }} title={`Low: ${security.low.length}`} />}
            {security.info.length > 0 && <div style={{ width: `${(security.info.length / security.totalVulnerabilities) * 100}%`, background: '#6b7280' }} title={`Info: ${security.info.length}`} />}
          </div>
        </div>
      )}

      {/* Vuln table */}
      {allVulns.length > 0 ? (
        <DataTable columns={columns} data={allVulns} maxHeight={400} emptyMessage="No vulnerabilities found" />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 13, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          No known vulnerabilities found.
        </div>
      )}
    </div>
  );
};
