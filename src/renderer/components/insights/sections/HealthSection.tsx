/**
 * Health Section — Project health score with detailed breakdown and recommendations.
 */
import React from 'react';
import type { ProjectInsights } from '../../../../shared/types/insights';
import { SectionHeader } from '../common/SectionHeader';
import { HealthRing } from '../common/HealthRing';

interface Props { insights: ProjectInsights; }

export const HealthSection: React.FC<Props> = ({ insights }) => {
  const { healthScore } = insights;

  const breakdownLabels: Record<string, string> = {
    codeQuality: 'Code Quality',
    documentation: 'Documentation',
    testing: 'Testing',
    security: 'Security',
    dependencies: 'Dependencies',
    gitHygiene: 'Git Hygiene',
  };

  const breakdownIcons: Record<string, string> = {
    codeQuality: 'code',
    documentation: 'book',
    testing: 'beaker',
    security: 'shield',
    dependencies: 'package',
    gitHygiene: 'git-branch',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader icon="pulse" title="Project Health" subtitle={`Overall score: ${healthScore.overall}/100`} />

      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 24, background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
        <HealthRing score={healthScore.overall} size={100} strokeWidth={8} />
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>
            {healthScore.overall >= 80 ? '🟢 Healthy' : healthScore.overall >= 50 ? '🟡 Needs Attention' : '🔴 Critical'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--theme-fg-muted)' }}>
            {healthScore.recommendations.length === 0
              ? 'No issues detected. Project is in great shape!'
              : `${healthScore.recommendations.length} recommendation${healthScore.recommendations.length > 1 ? 's' : ''} for improvement.`}
          </div>
        </div>
      </div>

      {/* Breakdown cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {Object.entries(healthScore.breakdown).map(([key, value]) => {
          const color = value > 70 ? '#10b981' : value > 40 ? '#f59e0b' : '#ef4444';
          return (
            <div key={key} style={{ padding: '14px 16px', background: 'var(--theme-bg-secondary)', borderRadius: 8, border: '1px solid var(--theme-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-fg-muted)', textTransform: 'capitalize' }}>
                  {breakdownLabels[key] || key}
                </span>
                <span style={{ fontSize: 18, fontWeight: 700, color }}>{value}</span>
              </div>
              <div style={{ height: 4, background: 'var(--theme-bg)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {healthScore.recommendations.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12 }}>Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {healthScore.recommendations.map((rec) => {
              const borderColor = rec.severity === 'critical' ? '#ef4444' : rec.severity === 'warning' ? '#f59e0b' : '#3b82f6';
              const badge = rec.severity === 'critical' ? '🔴' : rec.severity === 'warning' ? '🟡' : 'ℹ️';
              return (
                <div key={rec.id} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderLeft: `4px solid ${borderColor}` }}>
                  <div style={{ fontSize: 16, flexShrink: 0 }}>{badge}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 4 }}>{rec.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)', lineHeight: 1.5 }}>{rec.description}</div>
                    {rec.action && (
                      <div style={{ fontSize: 12, color: 'var(--theme-accent)', marginTop: 6, fontWeight: 500 }}>
                        💡 {rec.action}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', flexShrink: 0 }}>{rec.category}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
