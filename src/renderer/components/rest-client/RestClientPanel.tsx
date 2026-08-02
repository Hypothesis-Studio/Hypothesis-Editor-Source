/**
 * REST Client - Main Panel
 * Split layout: sidebar | request editor | response viewer.
 */
import React, { useEffect, useCallback, useState } from 'react';
import { useRestClientStore } from '../../stores/restClientStore';
import { RestClientSidebar } from './RestClientSidebar';
import { RequestEditor } from './RequestEditor';
import { ResponseViewer } from './ResponseViewer';
import { RunnerPanel } from './RunnerPanel';
import { EnvironmentManager } from './EnvironmentManager';
import { ImportDialog } from './ImportDialog';
import { ExportDialog } from './ExportDialog';
import { CurlImportDialog } from './CurlImportDialog';
import { MockServerPanel } from './MockServerPanel';
import { Icon } from '../common/Icon';

// ── Styles ───────────────────────────────────────────────────────────

const S = {
  panel: {
    display: 'flex', height: '100%', background: 'var(--theme-bg)',
    color: 'var(--theme-fg)', fontSize: 13, position: 'relative' as const, overflow: 'hidden' as const,
  },
  sidebar: { width: 280, flexShrink: 0, borderRight: '1px solid var(--theme-border)', display: 'flex', flexDirection: 'column' as const },
  main: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' as const },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 12px', borderBottom: '1px solid var(--theme-border)',
    background: 'var(--theme-bg-secondary)', height: 36, flexShrink: 0,
  },
  toolbarTitle: { display: 'flex', alignItems: 'center', gap: 8 },
  toolbarActions: { display: 'flex', alignItems: 'center', gap: 12 },
  envBtn: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 4,
    border: '1px solid var(--theme-border)',
    background: active ? 'rgba(66,133,244,0.1)' : 'transparent',
    color: 'var(--theme-fg)', cursor: 'pointer', fontSize: 11,
  }),
  envDot: (active: boolean): React.CSSProperties => ({
    width: 8, height: 8, borderRadius: '50%',
    background: active ? '#4ade80' : 'var(--theme-fg-muted)',
  }),
  envDropdown: {
    position: 'absolute' as const, top: '100%', right: 0, marginTop: 4,
    minWidth: 200, zIndex: 100, background: 'var(--theme-bg-secondary)',
    border: '1px solid var(--theme-border)', borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden' as const,
  },
  envItem: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '6px 12px',
    background: active ? 'var(--theme-bg-active)' : 'transparent',
    border: 'none', color: 'var(--theme-fg)', cursor: 'pointer', fontSize: 12, textAlign: 'left' as const,
  }),
  envItemDot: (active: boolean): React.CSSProperties => ({
    width: 6, height: 6, borderRadius: '50%',
    background: active ? '#4ade80' : 'transparent',
    border: `1px solid ${active ? '#4ade80' : 'var(--theme-fg-muted)'}`,
  }),
  iconBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, border: 'none', borderRadius: 4,
    background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer',
  },
  resizeHandle: (resizing: boolean): React.CSSProperties => ({
    width: 4, cursor: 'col-resize',
    background: resizing ? 'var(--theme-accent)' : 'transparent',
    flexShrink: 0, zIndex: 10,
    transition: resizing ? 'none' : 'background 0.15s',
  }),
  emptyState: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    height: '100%', gap: 16, color: 'var(--theme-fg-muted)',
  },
};

// ── Component ────────────────────────────────────────────────────────

export const RestClientPanel: React.FC = () => {
  const store = useRestClientStore();
  const {
    collections, activeCollectionId, activeRequestId, isLoading,
    showRunner, showImportDialog, showExportDialog, showEnvironmentManager,
    showCurlImport, currentResponse, error, templates,
    loadData, setActiveCollection, setActiveRequest,
    setShowImportDialog, setShowExportDialog, setShowEnvironmentManager,
    setShowCurlImport, toggleRunner, setActiveEnvironment, setShowVariableViewer,
  } = store;

  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizing, setIsResizing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<'collections' | 'history' | 'templates' | 'mock'>('collections');

  const environments = useRestClientStore(s => s.environments);
  const activeEnvironmentId = useRestClientStore(s => s.activeEnvironmentId);
  const activeEnv = environments.find(e => e.id === activeEnvironmentId);
  const activeCollection = collections.find(c => c.id === activeCollectionId);
  const activeRequest = activeCollection?.requests.find(r => r.id === activeRequestId);

  useEffect(() => { if (!initialized) { loadData(); setInitialized(true); } }, [initialized, loadData]);

  const handleNewRequest = useCallback(async (templateId?: string) => {
    if (!activeCollectionId) {
      const col = await useRestClientStore.getState().createCollection('My Collection', 'API requests');
      setActiveCollection(col.id);
    }
    const targetId = activeCollectionId || useRestClientStore.getState().collections[0]?.id;
    if (!targetId) return;
    const tpl = templateId ? templates.find(t => t.id === templateId) : undefined;
    const req = await useRestClientStore.getState().createRequest(targetId, {
      name: tpl?.name || 'New Request', method: tpl?.method || 'GET', url: tpl?.url || '',
      headers: tpl?.headers || [], body: tpl?.body || { type: 'none' }, auth: tpl?.auth || { type: 'none' },
    });
    if (req) setActiveRequest(req.id);
  }, [activeCollectionId, setActiveCollection, setActiveRequest, templates]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeRequest && activeCollectionId) {
        e.preventDefault();
        useRestClientStore.getState().sendRequest(activeRequest.id, activeCollectionId);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewRequest();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [activeRequest, activeCollectionId, handleNewRequest]);

  // Split resize
  const handleResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const container = (e.target as HTMLElement).closest('.rest-client-panel')!;
    const containerWidth = container.getBoundingClientRect().width;
    const startRatio = splitRatio;
    const onMove = (ev: MouseEvent) => {
      setSplitRatio(Math.max(0.2, Math.min(0.6, startRatio + (ev.clientX - startX) / containerWidth)));
    };
    const onUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitRatio]);

  return (
    <div className="rest-client-panel" style={S.panel}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <RestClientSidebar
          collections={collections}
          activeCollectionId={activeCollectionId}
          activeRequestId={activeRequestId}
          onSelectCollection={setActiveCollection}
          onSelectRequest={setActiveRequest}
          onNewRequest={handleNewRequest}
          onOpenImport={() => setShowImportDialog(true)}
          onOpenExport={() => setShowExportDialog(true)}
          onOpenCurlImport={() => setShowCurlImport(true)}
          onOpenEnvironmentManager={() => setShowEnvironmentManager(true)}
          onToggleRunner={toggleRunner}
          onViewChange={v => setSidebarView(v)}
          activeView={sidebarView === 'mock' ? 'collections' : sidebarView}
        />
      </div>

      {/* Main content */}
      <div style={S.main}>
        {/* Toolbar */}
        <div style={S.toolbar}>
          <div style={S.toolbarTitle}>
            <Icon name="plug" size={16} style={{ color: 'var(--theme-accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>REST Client</span>
          </div>
          <div style={S.toolbarActions}>
            {/* Environment selector */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setEnvOpen(!envOpen)} style={S.envBtn(!!activeEnv)}>
                <div style={S.envDot(!!activeEnv)} />
                <span>{activeEnv?.name || 'No Environment'}</span>
                <Icon name="chevron-down" size={12} />
              </button>
              {envOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setEnvOpen(false)} />
                  <div style={S.envDropdown}>
                    <div style={{ padding: '6px 0' }}>
                      {environments.length === 0 ? (
                        <div style={{ padding: '8px 12px', color: 'var(--theme-fg-muted)', fontSize: 11 }}>No environments configured</div>
                      ) : (
                        environments.map(env => (
                          <button
                            key={env.id}
                            onClick={() => { setActiveEnvironment(env.isActive ? null! : env.id); setEnvOpen(false); }}
                            style={S.envItem(env.id === activeEnvironmentId)}
                          >
                            <div style={S.envItemDot(env.isActive)} />
                            <span style={{ flex: 1 }}>{env.name}</span>
                            <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10 }}>{env.variables.length} vars</span>
                          </button>
                        ))
                      )}
                    </div>
                    <div style={{ borderTop: '1px solid var(--theme-border)', padding: '4px 0' }}>
                      <button
                        onClick={() => { setShowEnvironmentManager(true); setEnvOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '6px 12px', background: 'transparent', border: 'none', color: 'var(--theme-accent)', cursor: 'pointer', fontSize: 11 }}
                      >
                        <Icon name="settings-gear" size={12} /> Manage Environments
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowVariableViewer(true)} style={S.iconBtn} title="View Variables">
              <Icon name="symbol-variable" size={14} />
            </button>
            <button
              onClick={() => setSidebarView(sidebarView === 'mock' ? 'collections' : 'mock')}
              style={{ ...S.iconBtn, color: sidebarView === 'mock' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
              title="Mock Server"
            >
              <Icon name="server" size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        {sidebarView === 'mock' ? (
          <MockServerPanel />
        ) : showRunner ? (
          <RunnerPanel />
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* Request editor */}
            <div style={{ width: `${splitRatio * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--theme-border)' }}>
              {activeRequest && activeCollectionId ? (
                <RequestEditor request={activeRequest} collectionId={activeCollectionId} isLoading={isLoading} />
              ) : (
                <div style={S.emptyState}>
                  <Icon name="plug" size={48} style={{ color: 'var(--theme-accent)', opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 500 }}>Create or select a request</div>
                  <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
                    Select a request from the sidebar or create a new one to start testing APIs
                  </div>
                  <button
                    onClick={() => handleNewRequest()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 6, background: 'var(--theme-accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                  >
                    <Icon name="plus" size={14} /> New Request
                  </button>
                  <div style={{ marginTop: 24, fontSize: 11, color: 'var(--theme-fg-muted)' }}>
                    <kbd style={{ display: 'inline-block', padding: '1px 5px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>Ctrl</kbd>+<kbd style={{ display: 'inline-block', padding: '1px 5px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>Enter</kbd> Send
                    {' '}
                    <kbd style={{ display: 'inline-block', padding: '1px 5px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>Ctrl</kbd>+<kbd style={{ display: 'inline-block', padding: '1px 5px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>Shift</kbd>+<kbd style={{ display: 'inline-block', padding: '1px 5px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderRadius: 3, fontSize: 10, fontFamily: 'monospace' }}>N</kbd> New
                  </div>
                </div>
              )}
            </div>

            {/* Resize handle */}
            <div
              onMouseDown={handleResize}
              style={S.resizeHandle(isResizing)}
            />

            {/* Response viewer */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <ResponseViewer response={currentResponse} error={error} isLoading={isLoading} />
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showImportDialog && <ImportDialog />}
      {showExportDialog && <ExportDialog />}
      {showEnvironmentManager && <EnvironmentManager />}
      {showCurlImport && <CurlImportDialog />}
    </div>
  );
};
