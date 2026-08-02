/**
 * DatabasePanel — main container for Database Explorer.
 * Renders as an editor tab with sidebar + resizer + main content area.
 */
import React, { useEffect } from 'react';
import { useDBStore } from '../../stores/dbStore';
import { DatabaseSidebar } from './DatabaseSidebar';
import { QueryEditor } from './QueryEditor';
import { TableDataViewer } from './TableDataViewer';
import { QueryHistory } from './QueryHistory';
import { ERDiagramView } from './ERDiagramView';

// ── View tab definitions ──────────────────────────────────────────
const VIEWS = [
  {
    id: 'query' as const,
    label: 'Query Editor',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M3.24 1.178a1.5 1.5 0 0 1 1.56.12l8.5 5.5a1.5 1.5 0 0 1 0 2.4l-8.5 5.5A1.5 1.5 0 0 1 2.5 13.5v-11a1.5 1.5 0 0 1 .74-1.322z"/>
      </svg>
    ),
  },
  {
    id: 'table' as const,
    label: 'Table Data',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v2A1.5 1.5 0 0 1 13.5 7h-11A1.5 1.5 0 0 1 1 5.5v-2zm0 5A1.5 1.5 0 0 1 2.5 7h11A1.5 1.5 0 0 1 15 8.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 10.5v-2z"/>
      </svg>
    ),
  },
  {
    id: 'history' as const,
    label: 'History',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0zm7-3.25v3.5l2.25 2.25a.75.75 0 0 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1-.22-.53v-3.78a.75.75 0 0 1 1.5 0z"/>
      </svg>
    ),
  },
  {
    id: 'diagram' as const,
    label: 'ER Diagram',
    icon: (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3A1.5 1.5 0 0 1 7 3.5v1A1.5 1.5 0 0 1 5.5 6h-3A1.5 1.5 0 0 1 1 4.5v-1zm8 0A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5v1A1.5 1.5 0 0 1 13.5 6h-3A1.5 1.5 0 0 1 9 4.5v-1zm-8 7A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v1A1.5 1.5 0 0 1 5.5 13h-3A1.5 1.5 0 0 1 1 11.5v-1zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v1A1.5 1.5 0 0 1 13.5 13h-3A1.5 1.5 0 0 1 9 11.5v-1zM4 6v1.5M4 9V7.5M12 6v1.5M12 9V7.5M7 4h2M7 11h2"/>
      </svg>
    ),
  },
] as const;

type ViewId = typeof VIEWS[number]['id'];

// ── Styles ────────────────────────────────────────────────────────
const S = {
  root: {
    height: '100%', display: 'flex', background: 'var(--theme-bg)', overflow: 'hidden',
  },
  sidebar: (w: number): React.CSSProperties => ({
    width: w, minWidth: w, flexShrink: 0, overflow: 'hidden',
    borderRight: '1px solid var(--theme-border)',
  }),
  resizer: {
    width: 4, flexShrink: 0, cursor: 'col-resize',
    background: 'transparent', transition: 'background 0.15s',
    zIndex: 1,
  } as React.CSSProperties,
  main: {
    flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
    minWidth: 0,
  },
  viewBar: {
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', flexShrink: 0,
  },
  viewTab: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '0 16px', height: 38, fontSize: 12, cursor: 'pointer',
    background: 'transparent', border: 'none',
    color: active ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
    borderBottom: active ? '2px solid var(--theme-accent)' : '2px solid transparent',
    fontWeight: active ? 500 : 400,
    transition: 'color 0.1s',
    whiteSpace: 'nowrap' as const,
  }),
  content: { flex: 1, overflow: 'hidden' },
  dragOverlay: {
    position: 'fixed' as const, inset: 0, zIndex: 9999, cursor: 'col-resize',
  },
};

export const DatabasePanel: React.FC = () => {
  const { activeView, setActiveView, sidebarWidth, setSidebarWidth, loadHistory } = useDBStore();
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizerHov, setResizerHov] = React.useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      setSidebarWidth(Math.max(180, Math.min(420, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <div style={S.sidebar(sidebarWidth)}>
        <DatabaseSidebar />
      </div>

      {/* Resize handle */}
      <div
        style={{
          ...S.resizer,
          background: isResizing || resizerHov ? 'var(--theme-accent)' : 'transparent',
        }}
        onMouseDown={startResize}
        onMouseEnter={() => setResizerHov(true)}
        onMouseLeave={() => setResizerHov(false)}
      />

      {/* Main area */}
      <div style={S.main}>
        {/* View tabs */}
        <div style={S.viewBar}>
          {VIEWS.map(v => (
            <button
              key={v.id}
              style={S.viewTab(activeView === v.id)}
              onClick={() => setActiveView(v.id as ViewId)}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          {activeView === 'query'   && <QueryEditor />}
          {activeView === 'table'   && <TableDataViewer />}
          {activeView === 'history' && <QueryHistory />}
          {activeView === 'diagram' && <ERDiagramView />}
        </div>
      </div>

      {/* Drag overlay prevents iframe/editor stealing mouse */}
      {isResizing && <div style={S.dragOverlay} />}
    </div>
  );
};
