/**
 * Git Section — Git repository health and activity overview.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { MetricCard } from '../common/MetricCard';
import { timeAgo } from '../utils/format';
import { formatNumber } from '../utils/format';
import { DataTable, Column } from '../common/DataTable';

interface Props { insights: ProjectInsights; }

export const GitSection: React.FC<Props> = ({ insights }) => {
  const { git } = insights;

  if (!git.isRepo) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader icon="git-branch" title="Git Health" />
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8 }}>Not a Git Repository</div>
          <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)' }}>Initialize a git repository to track changes and enable collaboration.</div>
        </div>
      </div>
    );
  }

  const commitColumns: Column<typeof git.recentCommits[0]>[] = [
    { key: 'hash', label: 'Hash', width: 80, render: (r) => <code style={{ fontSize: 11, color: 'var(--theme-accent)' }}>{r.hash}</code>, sortValue: (r) => r.hash },
    { key: 'message', label: 'Message', render: (r) => (
      <div style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.message}</div>
    ), sortValue: (r) => r.message },
    { key: 'author', label: 'Author', width: 120, render: (r) => <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{r.author}</span>, sortValue: (r) => r.author },
    { key: 'date', label: 'Date', width: 100, render: (r) => <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{timeAgo(r.date)}</span>, sortValue: (r) => r.date },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="git-branch" title="Git Health" subtitle={`Branch: ${git.branch}`} />

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <MetricCard label="Branch" value={git.branch} icon="git-branch" color="#6366f1" />
        <MetricCard label="Commits" value={formatNumber(git.totalCommits)} icon="git-commit" color="#3b82f6" />
        <MetricCard label="Uncommitted" value={git.uncommittedChanges.toString()} icon="diff-modified" color={git.uncommittedChanges > 0 ? '#f59e0b' : '#10b981'} />
        <MetricCard label="Untracked" value={git.untrackedFiles.toString()} icon="file" color={git.untrackedFiles > 0 ? '#f59e0b' : '#10b981'} />
        <MetricCard label="Ahead" value={git.aheadBehind.ahead.toString()} icon="arrow-up" color="#10b981" />
        <MetricCard label="Behind" value={git.aheadBehind.behind.toString()} icon="arrow-down" color={git.aheadBehind.behind > 0 ? '#ef4444' : '#10b981'} />
        <MetricCard label="Stashes" value={git.stashCount.toString()} icon="archive" color="#8b5cf6" />
        {git.lastCommitDate && <MetricCard label="Last Commit" value={timeAgo(git.lastCommitDate)} icon="history" color="#6b7280" />}
      </div>

      {/* Contributors */}
      {git.contributors.length > 0 && (
        <div style={{ padding: 16, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12 }}>Top Contributors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {git.contributors.slice(0, 10).map((c, i) => {
              const maxCommits = git.contributors[0]?.commits || 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, fontSize: 11, color: 'var(--theme-fg-muted)', textAlign: 'right' }}>#{i + 1}</div>
                  <div style={{ width: 140, fontSize: 12, fontWeight: 500, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ flex: 1, height: 6, background: 'var(--theme-bg)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(c.commits / maxCommits) * 100}%`, background: '#6366f1', borderRadius: 3 }} />
                  </div>
                  <div style={{ width: 60, fontSize: 11, color: 'var(--theme-fg-muted)', textAlign: 'right' }}>{formatNumber(c.commits)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent commits */}
      {git.recentCommits.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8 }}>Recent Commits</div>
          <DataTable columns={commitColumns} data={git.recentCommits} maxHeight={300} emptyMessage="No commits" />
        </div>
      )}
    </div>
  );
};
