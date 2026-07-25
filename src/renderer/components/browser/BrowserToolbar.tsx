/**
 * Hypothesis Browser - Toolbar (address bar, nav buttons, actions)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

interface Props {
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
}

// ── Inline SVG icons ──────────────────────────────────────────────
const Ico = ({ d, size = 14, vb = '0 0 24 24' }: { d: string; size?: number; vb?: string }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const IcoBack       = () => <Ico size={14} d="M15 18l-6-6 6-6" />;
const IcoForward    = () => <Ico size={14} d="M9 18l6-6-6-6" />;
const IcoReload     = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IcoStop       = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoHome       = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcoLock       = () => <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcoUnlock     = () => <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>;
const IcoClose      = () => <Ico size={10} d="M18 6L6 18M6 6l12 12" />;
const IcoStar       = ({ filled }: { filled: boolean }) => <svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcoSearch     = () => <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoSettings   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IcoPlus       = () => <Ico size={14} d="M12 5v14M5 12h14" />;
const IcoHistory    = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5.49"/></svg>;
const IcoBookmarks  = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IcoDownload   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcoGlobe      = () => <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IcoMinus      = () => <Ico size={14} d="M5 12h14" />;
const IcoFind       = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoDevTools   = () => <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;

const S = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 40,
    background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)',
    flexShrink: 0,
  },
  navBtn: (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'var(--theme-fg-disabled)' : 'var(--theme-fg-muted)',
    flexShrink: 0, transition: 'background 0.12s, color 0.12s',
  }),
  addrWrap: {
    flex: 1, display: 'flex', alignItems: 'center', position: 'relative' as const,
  },
  addrInput: {
    flex: 1, height: 28, borderRadius: 6, border: '1px solid var(--theme-border)',
    background: 'var(--theme-bg)', color: 'var(--theme-fg)',
    fontSize: 12, padding: '0 32px 0 32px', outline: 'none',
    transition: 'border-color 0.15s',
  },
  lockIcon: {
    position: 'absolute' as const, left: 9, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--theme-fg-muted)', pointerEvents: 'none' as const, zIndex: 1,
    display: 'flex', alignItems: 'center',
  },
  clearBtn: {
    position: 'absolute' as const, right: 6, top: '50%', transform: 'translateY(-50%)',
    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, border: 'none', background: 'transparent',
    color: 'var(--theme-fg-muted)', cursor: 'pointer', zIndex: 1, padding: 0,
  },
  suggestion: {
    position: 'absolute' as const, top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999,
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
    borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: 320,
    overflowY: 'auto' as const,
  },
  suggItem: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer',
    background: active ? 'var(--theme-bg-tertiary)' : 'transparent',
    borderBottom: '1px solid var(--theme-border-light)',
  }),
  suggIcon: { display: 'flex', alignItems: 'center', color: 'var(--theme-fg-muted)', width: 16, justifyContent: 'center', flexShrink: 0 },
  suggTitle: { fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  suggUrl: { fontSize: 11, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  actionBtn: {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--theme-fg-muted)', flexShrink: 0, transition: 'background 0.12s, color 0.12s',
  },
  zoomLabel: {
    fontSize: 11, color: 'var(--theme-fg-muted)', cursor: 'pointer', whiteSpace: 'nowrap' as const,
    padding: '0 2px',
  },
};

const BrowserToolbar: React.FC<Props> = ({ webviewRefs }) => {
  const {
    tabs, activeTabId, navigate, createTab,
    addressBarValue, setAddressBarValue, setAddressBarFocused,
    searchSuggestions, getSearchSuggestions, clearSuggestions,
    sidebarView, setSidebarView, setFindBarVisible, findBarVisible,
    isBookmarked, addBookmark, deleteBookmark, updateTab,
  } = useBrowserStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [suggActive, setSuggActive] = useState(-1);
  const [showSugg, setShowSugg] = useState(false);
  const [isBookmarkedState, setIsBookmarkedState] = useState<any>(null);
  const activeTab = tabs.find(t => t.id === activeTabId);

  useEffect(() => {
    if (activeTab) setIsBookmarkedState(isBookmarked(activeTab.url));
  }, [activeTab?.url, tabs]);

  const getWv = () => activeTabId ? webviewRefs.current.get(activeTabId) : null;

  const goBack    = () => getWv()?.goBack();
  const goForward = () => getWv()?.goForward();
  const reload    = () => { const wv = getWv(); if (wv) { activeTab?.isLoading ? wv.stop() : wv.reload(); } };
  const goHome    = () => { if (activeTabId) navigate(activeTabId, ''); };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressBarValue(val);
    if (val.trim()) { getSearchSuggestions(val); setShowSugg(true); setSuggActive(-1); }
    else { clearSuggestions(); setShowSugg(false); }
  }, []);

  const handleSubmit = useCallback((url?: string) => {
    const raw = url ?? addressBarValue;
    if (!activeTabId || !raw.trim()) return;
    // Resolve URL — if it looks like a URL navigate directly, else search
    const target = /^https?:\/\/|^file:\/\//.test(raw)
      ? raw
      : raw.includes('.') && !raw.includes(' ')
        ? `https://${raw}`
        : `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
    // Navigate imperatively via webview
    const wv = webviewRefs.current.get(activeTabId);
    if (wv && typeof (wv as any).loadURL === 'function') {
      try { (wv as any).loadURL(target); } catch {}
    }
    navigate(activeTabId, target);
    inputRef.current?.blur();
    setShowSugg(false); clearSuggestions();
  }, [activeTabId, addressBarValue, navigate, webviewRefs]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (suggActive >= 0 && searchSuggestions[suggActive]) handleSubmit(searchSuggestions[suggActive].url);
      else handleSubmit();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setSuggActive(p => Math.min(p + 1, searchSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setSuggActive(p => Math.max(p - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSugg(false); clearSuggestions(); inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    setAddressBarFocused(true);
    inputRef.current?.select();
    setShowSugg(true);
    if (activeTab) getSearchSuggestions(activeTab.url);
  };

  const handleBlur = () => {
    setTimeout(() => { setShowSugg(false); clearSuggestions(); }, 150);
    setAddressBarFocused(false);
    if (activeTab) setAddressBarValue(activeTab.url);
  };

  const toggleBookmark = async () => {
    if (!activeTab) return;
    if (isBookmarkedState) {
      await deleteBookmark(isBookmarkedState.id);
      setIsBookmarkedState(null);
    } else {
      await addBookmark(activeTab.url, activeTab.title, activeTab.favicon);
      setIsBookmarkedState(isBookmarked(activeTab.url));
    }
  };

  const zoomIn    = () => { const wv = getWv(); if (!wv || !activeTabId || !activeTab) return; const z = Math.min((activeTab.zoomLevel ?? 0) + 1, 9); wv.setZoomLevel(z); updateTab(activeTabId, { zoomLevel: z }); };
  const zoomOut   = () => { const wv = getWv(); if (!wv || !activeTabId || !activeTab) return; const z = Math.max((activeTab.zoomLevel ?? 0) - 1, -5); wv.setZoomLevel(z); updateTab(activeTabId, { zoomLevel: z }); };
  const zoomReset = () => { const wv = getWv(); if (!wv || !activeTabId) return; wv.setZoomLevel(0); updateTab(activeTabId, { zoomLevel: 0 }); };
  const openDevTools = () => getWv()?.openDevTools();
  const isSecure = activeTab?.url?.startsWith('https://');

  const btnHover = (e: React.MouseEvent, enter: boolean) => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = enter ? 'var(--theme-bg-tertiary)' : 'transparent';
    el.style.color = enter ? 'var(--theme-fg)' : 'var(--theme-fg-muted)';
  };

  const sidebarBtnStyle = (view: string): React.CSSProperties => ({
    ...S.actionBtn,
    color: sidebarView === view ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
  });

  return (
    <div style={S.bar}>
      {/* Back */}
      <button style={S.navBtn(!activeTab?.canGoBack)} disabled={!activeTab?.canGoBack} onClick={goBack} title="Back">
        <IcoBack />
      </button>
      {/* Forward */}
      <button style={S.navBtn(!activeTab?.canGoForward)} disabled={!activeTab?.canGoForward} onClick={goForward} title="Forward">
        <IcoForward />
      </button>
      {/* Reload/Stop */}
      <button style={S.navBtn(false)} onClick={reload} title={activeTab?.isLoading ? 'Stop' : 'Reload'}
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>
        {activeTab?.isLoading ? <IcoStop /> : <IcoReload />}
      </button>
      {/* Home */}
      <button style={S.navBtn(false)} onClick={goHome} title="Home"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>
        <IcoHome />
      </button>

      {/* Address bar */}
      <div style={S.addrWrap}>
        <span style={S.lockIcon}>{isSecure ? <IcoLock /> : <IcoUnlock />}</span>
        <input
          ref={inputRef}
          style={{ ...S.addrInput, borderColor: showSugg ? 'var(--theme-accent)' : 'var(--theme-border)' }}
          value={addressBarValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search or enter address..."
          spellCheck={false}
        />
        {addressBarValue && showSugg && (
          <button style={S.clearBtn} onMouseDown={e => { e.preventDefault(); setAddressBarValue(''); clearSuggestions(); }}>
            <IcoClose />
          </button>
        )}
        {showSugg && searchSuggestions.length > 0 && (
          <div style={S.suggestion}>
            {searchSuggestions.map((s, i) => (
              <div key={i} style={S.suggItem(i === suggActive)}
                onMouseDown={e => { e.preventDefault(); handleSubmit(s.url); }}
                onMouseEnter={() => setSuggActive(i)}>
                <span style={S.suggIcon}>
                  {s.type === 'history' ? <IcoHistory /> : s.type === 'bookmark' ? <IcoBookmarks /> : s.type === 'url' ? <IcoGlobe /> : <IcoSearch />}
                </span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={S.suggTitle}>{s.title}</div>
                  {s.url !== s.title && <div style={S.suggUrl}>{s.url}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookmark */}
      <button
        style={{ ...S.actionBtn, color: isBookmarkedState ? '#f6c90e' : 'var(--theme-fg-muted)' }}
        onClick={toggleBookmark} title={isBookmarkedState ? 'Remove bookmark' : 'Bookmark this page'}
        onMouseEnter={e => btnHover(e, true)}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = isBookmarkedState ? '#f6c90e' : 'var(--theme-fg-muted)'; }}
      ><IcoStar filled={!!isBookmarkedState} /></button>

      {/* Zoom out */}
      <button style={S.actionBtn} onClick={zoomOut} title="Zoom out" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}><IcoMinus /></button>
      {activeTab && (activeTab.zoomLevel ?? 0) !== 0 && (
        <span style={S.zoomLabel} onClick={zoomReset} title="Reset zoom">{Math.round(100 + (activeTab.zoomLevel ?? 0) * 10)}%</span>
      )}
      {/* Zoom in */}
      <button style={S.actionBtn} onClick={zoomIn} title="Zoom in" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}><IcoPlus /></button>

      {/* Find */}
      <button style={{ ...S.actionBtn, color: findBarVisible ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
        onClick={() => setFindBarVisible(!findBarVisible)} title="Find in page (Ctrl+F)"
        onMouseEnter={e => btnHover(e, true)}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = findBarVisible ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}
      ><IcoFind /></button>

      {/* DevTools */}
      <button style={S.actionBtn} onClick={openDevTools} title="Developer Tools"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}><IcoDevTools /></button>

      {/* New Tab */}
      <button style={S.actionBtn} onClick={() => createTab()} title="New Tab"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}><IcoPlus /></button>

      {/* Sidebar: History */}
      <button style={sidebarBtnStyle('history')} onClick={() => setSidebarView(sidebarView === 'history' ? null : 'history')} title="History"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'history' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>
        <IcoHistory />
      </button>
      {/* Sidebar: Bookmarks */}
      <button style={sidebarBtnStyle('bookmarks')} onClick={() => setSidebarView(sidebarView === 'bookmarks' ? null : 'bookmarks')} title="Bookmarks"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'bookmarks' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>
        <IcoBookmarks />
      </button>
      {/* Sidebar: Downloads */}
      <button style={sidebarBtnStyle('downloads')} onClick={() => setSidebarView(sidebarView === 'downloads' ? null : 'downloads')} title="Downloads"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'downloads' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>
        <IcoDownload />
      </button>
    </div>
  );
};

export default BrowserToolbar;
