/**
 * Overview Section — Dashboard summary with key metrics and health score.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { MetricCard } from '../common/MetricCard';
import { HealthRing } from '../common/HealthRing';
import { formatBytes, formatNumber, formatDuration } from '../utils/format';

interface Props { insights: ProjectInsights; }

export const OverviewSection: React.FC<Props> = ({ insights }) => {
  const { fileStats, languages, complexity, security, git, healthScore, scanDuration, duplicates } = insights;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Health score hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 20, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
        <HealthRing score={healthScore.overall} size={80} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>
            Project Health: {healthScore.overall}/100
          </div>
          <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)' }}>
            Scanned {fileStats.totalFiles} files ({formatBytes(fileStats.totalSize)}) in {formatDuration(scanDuration)}
          </div>
        </div>
      </div>

      {/* Metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <MetricCard label="Files" value={formatNumber(fileStats.totalFiles)} icon="file" color="#3b82f6" />
        <MetricCard label="Lines of Code" value={formatNumber(fileStats.codeLines)} icon="code" color="#10b981" />
        <MetricCard label="Languages" value={languages.length.toString()} icon="symbol-keyword" color="#8b5cf6" />
        <MetricCard label="Total Size" value={formatBytes(fileStats.totalSize)} icon="database" color="#f59e0b" />
        <MetricCard label="Dependencies" value={insights.dependencies.totalDependencies.toString()} icon="package" color="#ec4899" />
        <MetricCard label="Vulnerabilities" value={security.totalVulnerabilities.toString()} icon="shield" color={security.totalVulnerabilities > 0 ? '#ef4444' : '#10b981'} />
        <MetricCard label="Duplicates" value={duplicates.totalDuplicateGroups.toString()} icon="files" color={duplicates.totalDuplicateGroups > 0 ? '#f59e0b' : '#10b981'} />
        <MetricCard label="Git Commits" value={git.isRepo ? formatNumber(git.totalCommits) : 'N/A'} icon="git-commit" color="#6366f1" />
      </div>

      {/* Health breakdown bars */}
      <div style={{ padding: 16, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12 }}>Health Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(healthScore.breakdown).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 100, fontSize: 11, color: 'var(--theme-fg-muted)', textTransform: 'capitalize', flexShrink: 0 }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div style={{ flex: 1, height: 6, background: 'var(--theme-bg)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: value > 70 ? '#10b981' : value > 40 ? '#f59e0b' : '#ef4444', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ width: 30, fontSize: 11, color: 'var(--theme-fg-muted)', textAlign: 'right' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top languages */}
      {languages.length > 0 && (
        <div style={{ padding: 16, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12 }}>Language Distribution</div>
          <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 8 }}>
            {languages.slice(0, 8).map((lang) => (
              <div
                key={lang.language}
                title={`${lang.language}: ${lang.percentage.toFixed(1)}%`}
                style={{
                  width: `${lang.percentage}%`,
                  background: `hsl(${hashCode(lang.language) % 360}, 60%, 55%)`,
                  minWidth: lang.percentage > 0 ? 2 : 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {languages.slice(0, 8).map((lang) => (
              <div key={lang.language} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: `hsl(${hashCode(lang.language) % 360}, 60%, 55%)` }} />
                <span style={{ color: 'var(--theme-fg-muted)' }}>{lang.language}</span>
                <span style={{ color: 'var(--theme-fg-muted)', opacity: 0.6 }}>{lang.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <div style={{ padding: 16, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12 }}>Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {healthScore.recommendations.map((rec) => (
              <div key={rec.id} style={{ display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 6, background: 'var(--theme-bg)', borderLeft: `3px solid ${rec.severity === 'critical' ? '#ef4444' : rec.severity === 'warning' ? '#f59e0b' : '#3b82f6'}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 2 }}>{rec.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{rec.description}</div>
                  {rec.action && <div style={{ fontSize: 11, color: 'var(--theme-accent)', marginTop: 4 }}>→ {rec.action}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}
