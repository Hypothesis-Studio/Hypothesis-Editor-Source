/**
 * Project Insights Panel — Main container with section navigation.
 * Production-grade UI for comprehensive project analysis.
 */
import React, { useEffect, useCallback } from 'react';
import { useInsightsStore } from '../../stores/insightsStore';
import { Icon } from '../common/Icon';
import { OverviewSection } from './sections/OverviewSection';
import { LanguagesSection } from './sections/LanguagesSection';
import { ComplexitySection } from './sections/ComplexitySection';
import { DependenciesSection } from './sections/DependenciesSection';
import { SecuritySection } from './sections/SecuritySection';
import { GitSection } from './sections/GitSection';
import { HealthSection } from './sections/HealthSection';
import { DuplicatesSection } from './sections/DuplicatesSection';
import type { ProjectInsights, ScanProgress } from '../../shared/types/insights';

interface ProjectInsightsPanelProps {
  rootPath: string | null;
}

const SECTIONS = [
  { id: 'overview' as const, label: 'Overview', icon: 'dashboard' },
  { id: 'languages' as const, label: 'Languages', icon: 'code' },
  { id: 'complexity' as const, label: 'Complexity', icon: 'graph' },
  { id: 'dependencies' as const, label: 'Dependencies', icon: 'package' },
  { id: 'security' as const, label: 'Security', icon: 'shield' },
  { id: 'git' as const, label: 'Git', icon: 'git-branch' },
  { id: 'health' as const, label: 'Health', icon: 'pulse' },
  { id: 'duplicates' as const, label: 'Duplicates', icon: 'files' },
];

export const ProjectInsightsPanel: React.FC<ProjectInsightsPanelProps> = ({ rootPath }) => {
  const {
    insights, isScanning, scanProgress, lastScanError,
    activeSection, setActiveSection,
    scanProject, loadCached,
  } = useInsightsStore();

  // Auto-load cached or scan on mount / rootPath change
  useEffect(() => {
    if (!rootPath) return;
    loadCached(rootPath);
  }, [rootPath, loadCached]);

  const handleScan = useCallback(() => {
    if (rootPath) scanProject(rootPath);
  }, [rootPath, scanProject]);

  // ── No workspace open ────────────────────────────────────────
  if (!rootPath) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, gap: 16 }}>
        <Icon name="graph" size={48} style={{ color: 'var(--theme-fg-muted)', opacity: 0.4 }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 14, textAlign: 'center' }}>
          Open a folder to view project insights.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--theme-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="dashboard" size={16} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Project Insights
          </span>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', fontSize: 11, fontWeight: 500,
            color: isScanning ? 'var(--theme-fg-muted)' : '#fff',
            background: isScanning ? 'var(--theme-bg-secondary)' : 'var(--theme-accent)',
            border: 'none', borderRadius: 4, cursor: isScanning ? 'default' : 'pointer',
            opacity: isScanning ? 0.6 : 1,
          }}
        >
          <Icon name={isScanning ? 'loading' : 'refresh'} size={12} />
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Progress bar */}
      {isScanning && scanProgress && (
        <div style={{ padding: '0 16px', flexShrink: 0 }}>
          <div style={{ height: 2, background: 'var(--theme-bg-secondary)', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${scanProgress.progress}%`, background: 'var(--theme-accent)', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 4, marginBottom: 4 }}>
            {scanProgress.message}
          </div>
        </div>
      )}

      {/* Error */}
      {lastScanError && (
        <div style={{ padding: '8px 16px', background: 'rgba(255,0,0,0.1)', color: '#f87171', fontSize: 12, borderBottom: '1px solid var(--theme-border)' }}>
          {lastScanError}
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--theme-border)', flexShrink: 0, overflowX: 'auto' }}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', fontSize: 11, fontWeight: activeSection === section.id ? 600 : 400,
              color: activeSection === section.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeSection === section.id ? '2px solid var(--theme-accent)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => { if (activeSection !== section.id) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { if (activeSection !== section.id) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon name={section.icon} size={14} />
            {section.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!insights && !isScanning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <Icon name="dashboard" size={40} style={{ color: 'var(--theme-fg-muted)', opacity: 0.3 }} />
            <div style={{ color: 'var(--theme-fg-muted)', fontSize: 13 }}>
              Click <strong>Scan</strong> to analyze your project.
            </div>
          </div>
        )}
        {insights && activeSection === 'overview' && <OverviewSection insights={insights} />}
        {insights && activeSection === 'languages' && <LanguagesSection insights={insights} />}
        {insights && activeSection === 'complexity' && <ComplexitySection insights={insights} />}
        {insights && activeSection === 'dependencies' && <DependenciesSection insights={insights} />}
        {insights && activeSection === 'security' && <SecuritySection insights={insights} />}
        {insights && activeSection === 'git' && <GitSection insights={insights} />}
        {insights && activeSection === 'health' && <HealthSection insights={insights} />}
        {insights && activeSection === 'duplicates' && <DuplicatesSection insights={insights} />}
      </div>
    </div>
  );
};
