/**
 * Hypothesis Browser - Sidebar (History / Bookmarks / Downloads)
 */
import React, { useEffect, useState } from 'react';
import { useBrowserStore } from '../../stores/browserStore';
import type { BrowserDownload, BrowserHistoryEntry, BrowserBookmark, BrowserBookmarkFolder } from '../../../shared/types/browser';

interface Props {
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
}

const S = {
  sidebar: (open: boolean): React.CSSProperties => ({
    width: open ? 280 : 0, flexShrink: 0, overflow: 'hidden',
    borderLeft: open ? '1px solid var(--theme-border)' : 'none',
    background: 'var(--theme-bg-secondary)', display: 'flex',
    flexDirection: 'column', transition: 'width 0.18s ease',
  }),
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px 8px', borderBottom: '1px solid var(--theme-border)',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', textTransform: 'uppercase' as const, letterSpacing: 1 },
  closeBtn: {
    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--theme-fg-muted)', fontSize: 14,
  },
  searchBox: {
    margin: '8px 10px', padding: '5px 10px', borderRadius: 6,
    border: '1px solid var(--theme-border)', background: 'var(--theme-bg)',
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none', width: 'calc(100% - 20px)',
  },
  list: { flex: 1, overflowY: 'auto' as const, padding: '4px 0' },
  item: (hover: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
    cursor: 'pointer', background: hover ? 'var(--theme-bg-tertiary)' : 'transparent',
    transition: 'background 0.1s',
  }),
  favicon: { width: 14, height: 14, flexShrink: 0, objectFit: 'contain' as const },
  faviconPlaceholder: { width: 14, height: 14, borderRadius: 2, background: 'var(--theme-bg-tertiary)', flexShrink: 0 },
  itemTitle: { fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 },
  itemUrl: { fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  itemAction: {
    width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--theme-fg-muted)', fontSize: 12, flexShrink: 0, opacity: 0,
  },
  groupLabel: {
    fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)', padding: '8px 12px 3px',
    textTransform: 'uppercase' as const, letterSpacing: 1,
  },
  clearBtn: {
    margin: '6px 10px', padding: '5px 0', borderRadius: 6, border: '1px solid var(--theme-border)',
    background: 'transparent', color: 'var(--theme-error, #e53e3e)', fontSize: 11,
    cursor: 'pointer', textAlign: 'center' as const, width: 'calc(100% - 20px)',
  },
  dlItem: {
    padding: '8px 12px', borderBottom: '1px solid var(--theme-border-light)',
  },
  dlName: { fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, marginBottom: 4 },
  dlProgress: {
    height: 3, borderRadius: 2, background: 'var(--theme-border)',
    marginBottom: 4, overflow: 'hidden',
  },
  dlProgressInner: (pct: number, state: string): React.CSSProperties => ({
    height: '100%', borderRadius: 2, width: `${pct}%`,
    background: state === 'completed' ? 'var(--theme-success, #48bb78)' : state === 'cancelled' || state === 'interrupted' ? '#e53e3e' : 'var(--theme-accent)',
    transition: 'width 0.3s',
  }),
  dlMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--theme-fg-muted)' },
  dlActions: { display: 'flex', gap: 6, marginTop: 4 },
  dlBtn: {
    padding: '2px 8px', borderRadius: 4, border: '1px solid var(--theme-border)',
    background: 'transparent', color: 'var(--theme-fg-muted)', fontSize: 10, cursor: 'pointer',
  },
  folderRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
    cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12,
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    color: 'var(--theme-fg-muted)', gap: 8, padding: 20,
  },
};

function formatBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)}MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function formatSpeed(bps: number): string {
  if (bps < 1024) return `${bps}B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)}KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)}MB/s`;
}

function groupHistoryByDate(entries: BrowserHistoryEntry[]): [string, BrowserHistoryEntry[]][] {
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups = new Map<string, BrowserHistoryEntry[]>();
  for (const e of entries) {
    const d = new Date(e.visitedAt);
    let label: string;
    if (e.visitedAt >= today.getTime()) label = 'Today';
    else if (e.visitedAt >= yesterday.getTime()) label = 'Yesterday';
    else if (now - e.visitedAt < 7 * 86400000) label = d.toLocaleDateString('en', { weekday: 'long' });
    else label = d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  return Array.from(groups.entries());
}

const HistoryView: React.FC<{ onNavigate: (url: string) => void }> = ({ onNavigate }) => {
  const { history, loadHistory, deleteHistory, clearHistory, navigate, activeTabId } = useBrowserStore();
  const [search, setSearch] = useState('');
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

  const filtered = search
    ? history.filter(h => h.url.toLowerCase().includes(search.toLowerCase()) || h.title.toLowerCase().includes(search.toLowerCase()))
    : history;
  const groups = groupHistoryByDate(filtered);

  return (
    <>
      <input style={S.searchBox} placeholder="Search history..." value={search} onChange={e => setSearch(e.target.value)} />
      <div style={S.list}>
        {groups.length === 0 && <div style={S.empty}><span style={{ fontSize: 28 }}>🕐</span><span style={{ fontSize: 12 }}>No history</span></div>}
        {groups.map(([label, items]) => (
          <div key={label}>
            <div style={S.groupLabel}>{label}</div>
            {items.map(h => (
              <div
                key={h.id}
                style={S.item(hover === h.id)}
                onMouseEnter={() => setHover(h.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onNavigate(h.url)}
              >
                {h.favicon
                  ? <img src={h.favicon} style={S.favicon} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <div style={S.faviconPlaceholder} />}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={S.itemTitle}>{h.title || h.url}</div>
                  <div style={S.itemUrl}>{h.url}</div>
                </div>
                <button
                  style={{ ...S.itemAction, opacity: hover === h.id ? 1 : 0 }}
                  onClick={e => { e.stopPropagation(); deleteHistory(h.id); }}
                  title="Remove"
                >×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      {history.length > 0 && (
        <button style={S.clearBtn} onClick={clearHistory}>Clear All History</button>
      )}
    </>
  );
};

const BookmarksView: React.FC<{ onNavigate: (url: string) => void }> = ({ onNavigate }) => {
  const { bookmarks, bookmarkFolders, loadBookmarks, deleteBookmark, createFolder } = useBrowserStore();
  const [search, setSearch] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => { loadBookmarks(); }, []);

  const filtered = search
    ? bookmarks.filter(b => b.url.toLowerCase().includes(search.toLowerCase()) || b.title.toLowerCase().includes(search.toLowerCase()))
    : bookmarks;

  const rootBookmarks = filtered.filter(b => !b.folderId);
  const toggleFolder = (id: string) => setExpandedFolders(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const handleNewFolder = async () => {
    if (newFolderName.trim()) { await createFolder(newFolderName.trim()); setNewFolderName(''); setNewFolderMode(false); }
  };

  const renderBookmark = (b: BrowserBookmark) => (
    <div key={b.id} style={S.item(hover === b.id)} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} onClick={() => onNavigate(b.url)}>
      {b.favicon ? <img src={b.favicon} style={S.favicon} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div style={S.faviconPlaceholder} />}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={S.itemTitle}>{b.title || b.url}</div>
        <div style={S.itemUrl}>{b.url}</div>
      </div>
      <button style={{ ...S.itemAction, opacity: hover === b.id ? 1 : 0 }} onClick={e => { e.stopPropagation(); deleteBookmark(b.id); }} title="Remove">×</button>
    </div>
  );

  return (
    <>
      <input style={S.searchBox} placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} />
      <div style={S.list}>
        {/* Folders */}
        {!search && bookmarkFolders.map(folder => (
          <div key={folder.id}>
            <div style={S.folderRow} onClick={() => toggleFolder(folder.id)}>
              <span>{expandedFolders.has(folder.id) ? '📂' : '📁'}</span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
              <span style={{ fontSize: 10 }}>{expandedFolders.has(folder.id) ? '▾' : '▸'}</span>
            </div>
            {expandedFolders.has(folder.id) && (
              <div style={{ paddingLeft: 12 }}>
                {bookmarks.filter(b => b.folderId === folder.id).map(renderBookmark)}
              </div>
            )}
          </div>
        ))}
        {/* Root bookmarks */}
        {rootBookmarks.length === 0 && bookmarkFolders.length === 0 && (
          <div style={S.empty}><span style={{ fontSize: 28 }}>⭐</span><span style={{ fontSize: 12 }}>No bookmarks yet</span></div>
        )}
        {rootBookmarks.map(renderBookmark)}
      </div>
      {/* New folder */}
      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--theme-border)' }}>
        {newFolderMode ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              style={{ ...S.searchBox, margin: 0, flex: 1 }} autoFocus
              placeholder="Folder name" value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleNewFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
            />
            <button style={{ ...S.dlBtn, color: 'var(--theme-accent)' }} onClick={handleNewFolder}>OK</button>
          </div>
        ) : (
          <button style={{ ...S.clearBtn, color: 'var(--theme-accent)', border: '1px solid var(--theme-accent)' }} onClick={() => setNewFolderMode(true)}>+ New Folder</button>
        )}
      </div>
    </>
  );
};

const DownloadsView: React.FC = () => {
  const { downloads, loadDownloads, pauseDownload, resumeDownload, cancelDownload, clearDownloads, showDownloadInFolder } = useBrowserStore();

  useEffect(() => { loadDownloads(); }, []);

  const active = downloads.filter(d => d.state === 'progressing');
  const done = downloads.filter(d => d.state !== 'progressing');

  const renderDl = (dl: BrowserDownload) => {
    const pct = dl.totalBytes > 0 ? Math.round((dl.receivedBytes / dl.totalBytes) * 100) : 0;
    return (
      <div key={dl.id} style={S.dlItem}>
        <div style={S.dlName} title={dl.filename}>{dl.filename}</div>
        <div style={S.dlProgress}>
          <div style={S.dlProgressInner(pct, dl.state)} />
        </div>
        <div style={S.dlMeta}>
          <span>{dl.state === 'completed' ? formatBytes(dl.totalBytes) : `${formatBytes(dl.receivedBytes)} / ${dl.totalBytes > 0 ? formatBytes(dl.totalBytes) : '?'}`}</span>
          <span>{dl.state === 'progressing' && !dl.paused ? formatSpeed(dl.speed) : dl.state}</span>
        </div>
        <div style={S.dlActions}>
          {dl.state === 'progressing' && !dl.paused && <button style={S.dlBtn} onClick={() => pauseDownload(dl.id)}>Pause</button>}
          {dl.state === 'progressing' && dl.paused && <button style={S.dlBtn} onClick={() => resumeDownload(dl.id)}>Resume</button>}
          {dl.state === 'progressing' && <button style={{ ...S.dlBtn, color: '#e53e3e' }} onClick={() => cancelDownload(dl.id)}>Cancel</button>}
          {dl.state === 'completed' && <button style={S.dlBtn} onClick={() => showDownloadInFolder(dl.id)}>Show in folder</button>}
          {(dl.state === 'completed' || dl.state === 'cancelled' || dl.state === 'interrupted') && (
            <button style={{ ...S.dlBtn, color: 'var(--theme-accent)' }} onClick={() => (window as any).api?.browser?.nav?.loadUrl('_new', dl.url)}>Re-download</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={S.list}>
      {downloads.length === 0 && <div style={S.empty}><span style={{ fontSize: 28 }}>⬇</span><span style={{ fontSize: 12 }}>No downloads</span></div>}
      {active.length > 0 && <><div style={S.groupLabel}>Active</div>{active.map(renderDl)}</>}
      {done.length > 0 && <><div style={S.groupLabel}>Completed</div>{done.map(renderDl)}</>}
      {done.length > 0 && <button style={S.clearBtn} onClick={clearDownloads}>Clear Completed</button>}
    </div>
  );
};

const BrowserSidebar: React.FC<Props> = ({ webviewRefs }) => {
  const { sidebarView, setSidebarView, activeTabId, navigate } = useBrowserStore();
  const open = sidebarView !== null;

  const handleNavigate = (url: string) => {
    if (activeTabId) navigate(activeTabId, url);
  };

  const titles: Record<string, string> = { history: 'History', bookmarks: 'Bookmarks', downloads: 'Downloads' };

  return (
    <div style={S.sidebar(open)}>
      {open && (
        <>
          <div style={S.header}>
            <span style={S.headerTitle}>{sidebarView ? titles[sidebarView] : ''}</span>
            <button style={S.closeBtn} onClick={() => setSidebarView(null)} title="Close">×</button>
          </div>
          {sidebarView === 'history' && <HistoryView onNavigate={handleNavigate} />}
          {sidebarView === 'bookmarks' && <BookmarksView onNavigate={handleNavigate} />}
          {sidebarView === 'downloads' && <DownloadsView />}
        </>
      )}
    </div>
  );
};

export default BrowserSidebar;
