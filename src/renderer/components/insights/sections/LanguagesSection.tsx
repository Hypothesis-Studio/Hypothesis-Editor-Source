/**
 * Languages Section — Detailed language breakdown with bar chart and table.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { DataTable, Column } from '../common/DataTable';
import { formatNumber, formatBytes } from '../utils/format';

interface Props { insights: ProjectInsights; }

export const LanguagesSection: React.FC<Props> = ({ insights }) => {
  const { languages } = insights;

  const columns: Column<typeof languages[0]>[] = [
    { key: 'lang', label: 'Language', width: 160, render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: `hsl(${hash(r.language) % 360}, 60%, 55%)`, flexShrink: 0 }} />
        <span style={{ fontWeight: 500 }}>{r.language}</span>
      </div>
    ), sortValue: (r) => r.language },
    { key: 'files', label: 'Files', align: 'right', render: (r) => formatNumber(r.fileCount), sortValue: (r) => r.fileCount },
    { key: 'code', label: 'Code', align: 'right', render: (r) => formatNumber(r.codeLines), sortValue: (r) => r.codeLines },
    { key: 'comment', label: 'Comment', align: 'right', render: (r) => formatNumber(r.commentLines), sortValue: (r) => r.commentLines },
    { key: 'blank', label: 'Blank', align: 'right', render: (r) => formatNumber(r.blankLines), sortValue: (r) => r.blankLines },
    { key: 'total', label: 'Total Lines', align: 'right', render: (r) => formatNumber(r.totalLines), sortValue: (r) => r.totalLines },
    { key: 'size', label: 'Size', align: 'right', render: (r) => formatBytes(r.totalSize), sortValue: (r) => r.totalSize },
    { key: 'pct', label: '%', align: 'right', width: 60, render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ width: 50, height: 4, background: 'var(--theme-bg)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${r.percentage}%`, background: `hsl(${hash(r.language) % 360}, 60%, 55%)`, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', minWidth: 36, textAlign: 'right' }}>{r.percentage.toFixed(1)}%</span>
      </div>
    ), sortValue: (r) => r.percentage },
  ];

  const totalCode = languages.reduce((s, l) => s + l.codeLines, 0);
  const totalComment = languages.reduce((s, l) => s + l.commentLines, 0);
  const totalBlank = languages.reduce((s, l) => s + l.blankLines, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="code" title="Language Breakdown" subtitle={`${languages.length} languages detected`} />

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>Code Lines</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>{formatNumber(totalCode)}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>Comment Lines</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>{formatNumber(totalComment)}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: 'var(--theme-bg-secondary)', borderRadius: 6, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>Blank Lines</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-fg-muted)' }}>{formatNumber(totalBlank)}</div>
        </div>
      </div>

      {/* Visual bar */}
      <div style={{ borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: 20, display: 'flex' }}>
          {languages.map((lang) => (
            <div
              key={lang.language}
              title={`${lang.language}: ${lang.percentage.toFixed(1)}%`}
              style={{
                width: `${Math.max(lang.percentage, 0.5)}%`,
                background: `hsl(${hash(lang.language) % 360}, 60%, 55%)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable columns={columns} data={languages} maxHeight={500} emptyMessage="No language data available" />
    </div>
  );
};

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
