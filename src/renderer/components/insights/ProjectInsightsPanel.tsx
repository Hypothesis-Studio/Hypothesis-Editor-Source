/**
 * Project Insights Panel — Multi-root workspace aware container.
 * Supports scanning individual folders or all workspace folders merged.
 */
import React, { useEffect, useCallback, useState, useRef } from 'react';
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

interface ProjectInsightsPanelProps {
  rootPath: string | null;
  workspaceFolders?: string[];
}

const SECTIONS = [
  { id: 'overview'     as const, label: 'Overview',      icon: 'dashboard'   },
  { id: 'languages'    as const, label: 'Languages',     icon: 'code'        },
  { id: 'complexity'   as const, label: 'Complexity',    icon: 'graph'       },
  { id: 'dependencies' as const, label: 'Dependencies',  icon: 'package'     },
  { id: 'security'     as const, label: 'Security',      icon: 'shield'      },
  { id: 'git'          as const, label: 'Git',           icon: 'git-branch'  },
  { id: 'health'       as const, label: 'Health',        icon: 'pulse'       },
  { id: 'duplicates'   as const, label: 'Duplicates',    icon: 'files'       },
];

/** Returns the last path segment as a short display name. */
function folderName(p: string): string {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p;
}

export const ProjectInsightsPanel: React.FC<ProjectInsightsPanelProps> = ({
  rootPath,
  workspaceFolders = [],
}) => {
  const {
    insights, isScanning, scanProgress, lastScanError,
    activeSection, setActiveSection,
    scanProject, loadCached,
  } = useInsightsStore();

  // Deduplicated, non-empty list of all workspace folders.
  const allFolders = React.useMemo(() => {
    const base = workspaceFolders.length > 0 ? workspaceFolders : (rootPath ? [rootPath] : []);
    return [...new Set(base.filter(Boolean))];
  }, [workspaceFolders, rootPath]);

  // "all" = scan/show merged across all folders; otherwise the selected path.
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keep selectedTarget valid when allFolders changes.
  useEffect(() => {
    if (allFolders.length === 0) return;
    if (selectedTarget !== 'all' && !allFolders.includes(selectedTarget)) {
      setSelectedTarget(allFolders.length > 1 ? 'all' : allFolders[0]);
    }
  }, [allFolders, selectedTarget]);

  // Close folder dropdown on outside click.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setFolderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-load cached results when target or folders change.
  useEffect(() => {
    if (allFolders.length === 0) return;
    const target = selectedTarget === 'all' ? allFolders : selectedTarget;
    loadCached(target);
  }, [selectedTarget, allFolders.join('|'), loadCached]);

  const handleScan = useCallback(() => {
    if (allFolders.length === 0) return;
    const target = selectedTarget === 'all' ? allFolders : selectedTarget;
    scanProject(target);
  }, [selectedTarget, allFolders, scanProject]);

  const selectTarget = useCallback((t: string) => {
    setSelectedTarget(t);
    setFolderDropdownOpen(false);
  }, []);

  // ── No workspace open ─────────────────────────────────────────
  if (allFolders.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', padding: 32, gap: 16,
      }}>
        <Icon name="graph" size={48} style={{ color: 'var(--theme-fg-muted)', opacity: 0.4 }} />
        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 14, textAlign: 'center' }}>
          Open a folder to view project insights.
        </div>
      </div>
    );
  }

  // Current display label for the selected target.
  const targetLabel = selectedTarget === 'all'
    ? `All Folders (${allFolders.length})`
    : folderName(selectedTarget);

  const isMulti = allFolders.length > 1;

  // Progress: show which folder is currently being scanned in multi-root mode.
  const progressLabel = scanProgress
    ? scanProgress.currentFolder
      ? `[${(scanProgress.folderIndex ?? 0) + 1}/${scanProgress.totalFolders}] ${folderName(scanProgress.currentFolder)}: ${scanProgress.message}`
      : scanProgress.message
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--theme-border)', flexShrink: 0, gap: 8,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Icon name="dashboard" size={16} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)',
            textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          }}>
            Project Insights
          </span>
        </div>

        {/* Folder selector + scan button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>

          {/* Folder picker — only shown when multiple folders are open */}
          {isMulti && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setFolderDropdownOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', fontSize: 11, fontWeight: 500,
                  color: 'var(--theme-fg)', background: 'var(--theme-bg-secondary)',
                  border: '1px solid var(--theme-border)', borderRadius: 4,
                  cursor: 'pointer', maxWidth: 160, overflow: 'hidden',
                }}
                title={selectedTarget === 'all' ? 'Scanning all workspace folders' : selectedTarget}
              >
                <Icon name="folder" size={11} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {targetLabel}
                </span>
                <Icon name="chevron-down" size={10} style={{ flexShrink: 0 }} />
              </button>

              {folderDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                  background: 'var(--theme-bg-elevated, var(--theme-bg-secondary))',
                  border: '1px solid var(--theme-border)', borderRadius: 6,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  zIndex: 9999, minWidth: 200, maxWidth: 320,
                  overflow: 'hidden',
                }}>
                  {/* All folders option */}
                  <button
                    onClick={() => selectTarget('all')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 12px', fontSize: 12,
                      color: selectedTarget === 'all' ? 'var(--theme-accent)' : 'var(--theme-fg)',
                      background: selectedTarget === 'all' ? 'var(--theme-accent-bg, rgba(99,102,241,0.12))' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      borderBottom: '1px solid var(--theme-border)',
                    }}
                    onMouseEnter={e => { if (selectedTarget !== 'all') e.currentTarget.style.background = 'var(--theme-bg-hover, rgba(255,255,255,0.06))'; }}
                    onMouseLeave={e => { if (selectedTarget !== 'all') e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Icon name="layers" size={13} />
                    <div>
                      <div style={{ fontWeight: 600 }}>All Folders</div>
                      <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 1 }}>
                        Merge scan across {allFolders.length} folders
                      </div>
                    </div>
                    {selectedTarget === 'all' && <Icon name="check" size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                  </button>

                  {/* Individual folders */}
                  {allFolders.map(folder => (
                    <button
                      key={folder}
                      onClick={() => selectTarget(folder)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '7px 12px', fontSize: 12,
                        color: selectedTarget === folder ? 'var(--theme-accent)' : 'var(--theme-fg)',
                        background: selectedTarget === folder ? 'var(--theme-accent-bg, rgba(99,102,241,0.12))' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseEnter={e => { if (selectedTarget !== folder) e.currentTarget.style.background = 'var(--theme-bg-hover, rgba(255,255,255,0.06))'; }}
                      onMouseLeave={e => { if (selectedTarget !== folder) e.currentTarget.style.background = 'transparent'; }}
                      title={folder}
                    >
                      <Icon name="folder" size={13} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {folderName(folder)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {folder}
                        </div>
                      </div>
                      {selectedTarget === folder && <Icon name="check" size={12} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scan button */}
          <button
            onClick={handleScan}
            disabled={isScanning}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', fontSize: 11, fontWeight: 500,
              color: isScanning ? 'var(--theme-fg-muted)' : '#fff',
              background: isScanning ? 'var(--theme-bg-secondary)' : 'var(--theme-accent)',
              border: 'none', borderRadius: 4,
              cursor: isScanning ? 'default' : 'pointer',
              opacity: isScanning ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name={isScanning ? 'loading' : 'refresh'} size={12} />
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      </div>

      {/* ── Progress ──────────────────────────────────────────── */}
      {isScanning && scanProgress && (
        <div style={{ padding: '0 16px 6px', flexShrink: 0 }}>
          <div style={{ height: 2, background: 'var(--theme-bg-secondary)', borderRadius: 1, overflow: 'hidden', marginTop: 6 }}>
            <div style={{
              height: '100%', width: `${scanProgress.progress}%`,
              background: 'var(--theme-accent)', transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 3 }}>
            {progressLabel}
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {lastScanError && (
        <div style={{
          padding: '8px 16px', background: 'rgba(255,0,0,0.08)',
          color: '#f87171', fontSize: 12, borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
        }}>
          {lastScanError}
        </div>
      )}

      {/* ── Currently scanned info bar ────────────────────────── */}
      {insights && !isScanning && (
        <div style={{
          padding: '4px 16px', fontSize: 10, color: 'var(--theme-fg-muted)',
          borderBottom: '1px solid var(--theme-border)', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="clock" size={10} />
          Scanned {insights.projectPaths?.length > 1
            ? `${insights.projectPaths.length} folders`
            : folderName(insights.projectPath)
          } · {new Date(insights.scannedAt).toLocaleTimeString()} · {(insights.scanDuration / 1000).toFixed(1)}s
        </div>
      )}

      {/* ── Section tabs ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', fontSize: 11,
              fontWeight: activeSection === section.id ? 600 : 400,
              color: activeSection === section.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              background: 'transparent', border: 'none',
              borderBottom: activeSection === section.id
                ? '2px solid var(--theme-accent)'
                : '2px solid transparent',
              cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (activeSection !== section.id) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { if (activeSection !== section.id) e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon name={section.icon} size={14} />
            {section.label}
          </button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {!insights && !isScanning && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 12,
          }}>
            <Icon name="dashboard" size={40} style={{ color: 'var(--theme-fg-muted)', opacity: 0.3 }} />
            <div style={{ color: 'var(--theme-fg-muted)', fontSize: 13, textAlign: 'center' }}>
              {isMulti
                ? `Click Scan to analyze ${selectedTarget === 'all' ? `all ${allFolders.length} folders` : folderName(selectedTarget)}.`
                : 'Click Scan to analyze your project.'
              }
            </div>
            {isMulti && selectedTarget === 'all' && (
              <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', opacity: 0.7 }}>
                {allFolders.map(f => folderName(f)).join(' · ')}
              </div>
            )}
          </div>
        )}
        {insights && activeSection === 'overview'      && <OverviewSection insights={insights} />}
        {insights && activeSection === 'languages'     && <LanguagesSection insights={insights} />}
        {insights && activeSection === 'complexity'    && <ComplexitySection insights={insights} />}
        {insights && activeSection === 'dependencies'  && <DependenciesSection insights={insights} />}
        {insights && activeSection === 'security'      && <SecuritySection insights={insights} />}
        {insights && activeSection === 'git'           && <GitSection insights={insights} />}
        {insights && activeSection === 'health'        && <HealthSection insights={insights} />}
        {insights && activeSection === 'duplicates'    && <DuplicatesSection insights={insights} />}
      </div>
    </div>
  );
};
