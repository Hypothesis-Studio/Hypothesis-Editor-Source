/**
 * REST Client - Sidebar (Collections, History, Templates)
 */
import React, { useState, useMemo } from 'react';
import type { RestClientCollection, RestClientRequest, RestClientHistoryEntry } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { useRestClientStore } from '../../stores/restClientStore';
import { showConfirm } from '../../stores/dialogStore';

const mc = (m: string) => ({ GET: '#4ade80', POST: '#facc15', PUT: '#60a5fa', PATCH: '#a78bfa', DELETE: '#f87171' }[m.toUpperCase()] || 'var(--theme-fg-muted)');
type View = 'collections' | 'history' | 'templates';

interface Props {
  collections: RestClientCollection[]; activeCollectionId: string | null; activeRequestId: string | null;
  onSelectCollection: (id: string | null) => void; onSelectRequest: (id: string | null) => void;
  onNewRequest: (templateId?: string) => void; onOpenImport: () => void; onOpenExport: () => void;
  onOpenCurlImport: () => void; onOpenEnvironmentManager: () => void; onToggleRunner: () => void;
}

export const RestClientSidebar: React.FC<Props> = (props) => {
  const { collections, activeCollectionId, activeRequestId, onSelectCollection, onSelectRequest, onNewRequest, onOpenImport, onOpenExport, onOpenCurlImport, onToggleRunner } = props;
  const [view, setView] = useState<View>('collections');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [ctx, setCtx] = useState<{ x: number; y: number; type: string; id: string; cid?: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const history = useRestClientStore(s => s.history);
  const clearHistory = useRestClientStore(s => s.clearHistory);
  const templates = useRestClientStore(s => s.templates);

  const filtered = useMemo(() => {
    if (!search.trim()) return collections;
    const q = search.toLowerCase();
    return collections.filter(c => c.name.toLowerCase().includes(q) || c.requests.some(r => r.name.toLowerCase().includes(q) || r.url.toLowerCase().includes(q)));
  }, [collections, search]);

  const toggle = (id: string) => setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleCtx = (e: React.MouseEvent, type: string, id: string, cid?: string) => { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, type, id, cid }); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 8px 4px', borderBottom: '1px solid var(--theme-border)' }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {(['collections', 'history', 'templates'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: 'none', borderRadius: 4, background: view === v ? 'var(--theme-bg-active)' : 'transparent', color: view === v ? 'var(--theme-fg)' : 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 11, fontWeight: view === v ? 500 : 400 }}>
              <Icon name={v === 'collections' ? 'folder-library' : v === 'history' ? 'history' : 'library'} size={13} />
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={view === 'history' ? 'Search history...' : 'Search...'} style={{ width: '100%', padding: '5px 8px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 11, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid var(--theme-border)' }}>
        <button onClick={() => onNewRequest()} style={ab} title="New Request"><Icon name="plus" size={14} /></button>
        <button onClick={() => { const n = prompt('Collection name:'); if (n) useRestClientStore.getState().createCollection(n); }} style={ab} title="New Collection"><Icon name="folder-create" size={14} /></button>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenCurlImport} style={ab} title="Import cURL"><Icon name="terminal" size={14} /></button>
        <button onClick={onOpenImport} style={ab} title="Import"><Icon name="upload" size={14} /></button>
        <button onClick={onOpenExport} style={ab} title="Export"><Icon name="download" size={14} /></button>
        <button onClick={onToggleRunner} style={ab} title="Runner"><Icon name="play" size={14} /></button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }} onClick={() => setCtx(null)}>
        {view === 'collections' && (filtered.length === 0 ? <div style={{ padding: '16px 12px', color: 'var(--theme-fg-muted)', textAlign: 'center', fontSize: 11 }}>{search ? 'No matches' : 'No collections'}</div> : filtered.map(col => (
          <div key={col.id}>
            <div onClick={() => { toggle(col.id); onSelectCollection(col.id); }} onContextMenu={e => handleCtx(e, 'collection', col.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', cursor: 'pointer', background: col.id === activeCollectionId ? 'var(--theme-bg-active)' : 'transparent', borderRadius: 4, margin: '0 4px', fontSize: 12, fontWeight: 500 }} onMouseEnter={e => { if (col.id !== activeCollectionId) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }} onMouseLeave={e => { if (col.id !== activeCollectionId) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name={expanded.has(col.id) ? 'chevron-down' : 'chevron-right'} size={12} style={{ color: 'var(--theme-fg-muted)', flexShrink: 0 }} />
              <Icon name="folder-library" size={14} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
              {renaming?.id === col.id ? (
                <input
                  autoFocus
                  value={renaming.name}
                  onChange={e => setRenaming({ id: col.id, name: e.target.value })}
                  onBlur={() => { if (renaming.name.trim()) useRestClientStore.getState().updateCollection(col.id, { name: renaming.name.trim() }); setRenaming(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { if (renaming.name.trim()) useRestClientStore.getState().updateCollection(col.id, { name: renaming.name.trim() }); setRenaming(null); } if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }}
                  onClick={e => e.stopPropagation()}
                  style={{ flex: 1, background: 'var(--theme-bg)', border: '1px solid var(--theme-accent)', borderRadius: 3, color: 'var(--theme-fg)', fontSize: 12, outline: 'none', padding: '1px 4px' }}
                />
              ) : (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
              )}
              <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10 }}>{col.requests.length}</span>
            </div>
            {expanded.has(col.id) && col.requests.map(req => (
              <div key={req.id} onClick={() => { onSelectCollection(col.id); onSelectRequest(req.id); }} onContextMenu={e => handleCtx(e, 'request', req.id, col.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 20px', cursor: 'pointer', background: req.id === activeRequestId ? 'var(--theme-bg-active)' : 'transparent', borderRadius: 4, fontSize: 12 }} onMouseEnter={e => { if (req.id !== activeRequestId) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }} onMouseLeave={e => { if (req.id !== activeRequestId) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: mc(req.method), minWidth: 32, fontFamily: 'monospace' }}>{req.method}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.name}</span>
              </div>
            ))}
          </div>
        )))}
        {view === 'history' && (
          <>
            {history.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', borderBottom: '1px solid var(--theme-border)' }}>
                <button onClick={() => clearHistory()} style={{ ...ab, color: '#f87171', fontSize: 11, width: 'auto', padding: '3px 8px', gap: 4, display: 'flex', alignItems: 'center' }} title="Clear history">
                  <Icon name="trash" size={12} />
                  <span>Clear</span>
                </button>
              </div>
            )}
            {history.length === 0
              ? <div style={{ padding: '16px 12px', color: 'var(--theme-fg-muted)', textAlign: 'center', fontSize: 11 }}>No history</div>
              : history.slice(0, 100).map(entry => (
                <div key={entry.id} onClick={() => { if (entry.requestId && entry.collectionId) { onSelectCollection(entry.collectionId); onSelectRequest(entry.requestId); } }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid var(--theme-border)' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: mc(entry.method), minWidth: 32, fontFamily: 'monospace' }}>{entry.method}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.url.split('?')[0]}</div>
                    <div style={{ display: 'flex', gap: 8, color: 'var(--theme-fg-muted)', fontSize: 10 }}>
                      <span style={{ color: entry.response.statusCode >= 400 ? '#f87171' : '#4ade80' }}>{entry.response.statusCode}</span>
                      <span>{entry.duration}ms</span>
                    </div>
                  </div>
                </div>
              ))
            }
          </>
        )}
        {view === 'templates' && (
          <div style={{ padding: '4px 8px' }}>
            {Object.entries(templates.reduce((acc, t) => { (acc[t.category] = acc[t.category] || []).push(t); return acc; }, {} as Record<string, typeof templates>)).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 4px', marginBottom: 2 }}>{cat}</div>
                {items.map(t => (
                  <button key={t.id} onClick={() => onNewRequest(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--theme-fg)', cursor: 'pointer', fontSize: 12, borderRadius: 4, textAlign: 'left' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: mc(t.method), minWidth: 36 }}>{t.method}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      {ctx && <ContextMenu x={ctx.x} y={ctx.y} type={ctx.type} id={ctx.id} cid={ctx.cid} onClose={() => setCtx(null)} onRename={(id, name) => { setRenaming({ id, name }); setCtx(null); }} />}
    </div>
  );
};

const ContextMenu: React.FC<{ x: number; y: number; type: string; id: string; cid?: string; onClose: () => void; onRename: (id: string, name: string) => void }> = ({ x, y, type, id, cid, onClose, onRename }) => {
  const items: Array<{ label: string; icon: string; action: () => void; danger?: boolean }> = [];
  if (type === 'collection') {
    items.push({ label: 'New Request', icon: 'add', action: async () => {
      const r = await useRestClientStore.getState().createRequest(id, { name: 'New Request', method: 'GET', url: '' });
      if (r) useRestClientStore.getState().setActiveRequest(r.id);
      onClose();
    } });
    items.push({ label: 'Rename', icon: 'edit', action: () => {
      const col = useRestClientStore.getState().collections.find(c => c.id === id);
      if (col) onRename(id, col.name);
      onClose();
    } });
    items.push({ label: 'Delete', icon: 'trash', danger: true, action: async () => {
      onClose();
      const col = useRestClientStore.getState().collections.find(c => c.id === id);
      const ok = await showConfirm(
        `Delete collection "${col?.name || ''}"? This will remove all requests inside.`,
        'Delete Collection'
      );
      if (ok) useRestClientStore.getState().deleteCollection(id);
    } });
  } else if (type === 'request' && cid) {
    items.push({ label: 'Duplicate', icon: 'copy', action: async () => {
      await useRestClientStore.getState().duplicateRequest(cid, id);
      onClose();
    } });
    items.push({ label: 'Generate cURL', icon: 'terminal', action: async () => {
      try {
        const curl = await (window as any).api.restClient.generateCurl(id, cid);
        await navigator.clipboard.writeText(curl);
      } catch (e) { console.error('generateCurl failed', e); }
      onClose();
    } });
    items.push({ label: 'Delete', icon: 'trash', danger: true, action: async () => {
      onClose();
      const col = useRestClientStore.getState().collections.find(c => c.id === cid);
      const req = col?.requests.find(r => r.id === id);
      const ok = await showConfirm(`Delete request "${req?.name || ''}"?`, 'Delete Request');
      if (ok) useRestClientStore.getState().deleteRequest(cid, id);
    } });
  }

  // Clamp so menu stays on screen
  const menuW = 180, menuH = items.length * 32 + 16;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - menuH - 8);

  return (<>
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose(); }} />
    <div style={{
      position: 'fixed', left, top, zIndex: 9999,
      background: 'var(--theme-bg-secondary)',
      border: '1px solid var(--theme-border-light, var(--theme-border))',
      borderRadius: 6, padding: '4px 0', minWidth: menuW,
      boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    }}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && item.danger && <div style={{ height: 1, background: 'var(--theme-border)', margin: '3px 6px' }} />}
          <button
            onClick={item.action}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 12px',
              background: 'transparent', border: 'none',
              color: item.danger ? 'var(--theme-error, #f87171)' : 'var(--theme-fg)',
              cursor: 'pointer', fontSize: 12, textAlign: 'left',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = item.danger ? 'rgba(248,113,113,0.1)' : 'var(--theme-bg-hover, var(--theme-bg-active))'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name={item.icon} size={13} style={{ flexShrink: 0, opacity: 0.85 }} />
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  </>);
};

const ab: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, border: 'none', borderRadius: 4, background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer' };
