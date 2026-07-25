/**
 * Hypothesis Browser - Toolbar (address bar, nav buttons, actions)
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

interface Props {
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
}

const S = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', height: 40,
    background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)',
    flexShrink: 0,
  },
  navBtn: (disabled: boolean): React.CSSProperties => ({
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'var(--theme-fg-disabled)' : 'var(--theme-fg-muted)', fontSize: 15,
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
    color: 'var(--theme-fg-muted)', fontSize: 11, pointerEvents: 'none' as const, zIndex: 1,
  },
  clearBtn: {
    position: 'absolute' as const, right: 6, top: '50%', transform: 'translateY(-50%)',
    width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, border: 'none', background: 'transparent',
    color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 12, zIndex: 1,
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
  suggIcon: { fontSize: 12, color: 'var(--theme-fg-muted)', width: 16, textAlign: 'center' as const, flexShrink: 0 },
  suggTitle: { fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  suggUrl: { fontSize: 11, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  actionBtn: {
    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--theme-fg-muted)', fontSize: 14, flexShrink: 0, transition: 'background 0.12s, color 0.12s',
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
    if (activeTab) {
      setIsBookmarkedState(isBookmarked(activeTab.url));
    }
  }, [activeTab?.url, tabs]);

  const getWv = () => activeTabId ? webviewRefs.current.get(activeTabId) : null;

  const goBack = () => getWv()?.goBack();
  const goForward = () => getWv()?.goForward();
  const reload = () => {
    const wv = getWv();
    if (wv) { activeTab?.isLoading ? wv.stop() : wv.reload(); }
  };
  const goHome = () => { if (activeTabId) navigate(activeTabId, ''); };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressBarValue(val);
    if (val.trim()) { getSearchSuggestions(val); setShowSugg(true); setSuggActive(-1); }
    else { clearSuggestions(); setShowSugg(false); }
  }, []);

  const handleSubmit = useCallback((url?: string) => {
    const target = url ?? addressBarValue;
    if (activeTabId && target.trim()) {
      navigate(activeTabId, target);
      inputRef.current?.blur();
      setShowSugg(false); clearSuggestions();
    }
  }, [activeTabId, addressBarValue, navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (suggActive >= 0 && searchSuggestions[suggActive]) {
        handleSubmit(searchSuggestions[suggActive].url);
      } else { handleSubmit(); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault(); setSuggActive(p => Math.min(p + 1, searchSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setSuggActive(p => Math.max(p - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSugg(false); clearSuggestions(); inputRef.current?.blur();
      if (activeTab) setAddressBarValue(activeTab.url);
    }
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

  const zoomIn = () => {
    if (!activeTabId || !activeTab) return;
    const wv = getWv(); if (!wv) return;
    const z = Math.min((activeTab.zoomLevel ?? 0) + 1, 9);
    wv.setZoomLevel(z); updateTab(activeTabId, { zoomLevel: z });
  };
  const zoomOut = () => {
    if (!activeTabId || !activeTab) return;
    const wv = getWv(); if (!wv) return;
    const z = Math.max((activeTab.zoomLevel ?? 0) - 1, -5);
    wv.setZoomLevel(z); updateTab(activeTabId, { zoomLevel: z });
  };
  const zoomReset = () => {
    if (!activeTabId) return;
    const wv = getWv(); if (!wv) return;
    wv.setZoomLevel(0); updateTab(activeTabId, { zoomLevel: 0 });
  };

  const openDevTools = () => { getWv()?.openDevTools(); };
  const isSecure = activeTab?.url?.startsWith('https://');

  const btnHover = (e: React.MouseEvent, enter: boolean) => {
    const el = e.currentTarget as HTMLElement;
    el.style.background = enter ? 'var(--theme-bg-tertiary)' : 'transparent';
    el.style.color = enter ? 'var(--theme-fg)' : 'var(--theme-fg-muted)';
  };

  return (
    <div style={S.bar}>
      {/* Back */}
      <button
        style={S.navBtn(!activeTab?.canGoBack)}
        disabled={!activeTab?.canGoBack}
        onClick={goBack} title="Back (Alt+Left)"
        onMouseEnter={e => !activeTab?.canGoBack || btnHover(e, true)}
        onMouseLeave={e => btnHover(e, false)}
      >←</button>

      {/* Forward */}
      <button
        style={S.navBtn(!activeTab?.canGoForward)}
        disabled={!activeTab?.canGoForward}
        onClick={goForward} title="Forward (Alt+Right)"
        onMouseEnter={e => !activeTab?.canGoForward || btnHover(e, true)}
        onMouseLeave={e => btnHover(e, false)}
      >→</button>

      {/* Reload / Stop */}
      <button
        style={S.navBtn(false)} onClick={reload}
        title={activeTab?.isLoading ? 'Stop' : 'Reload (Ctrl+R)'}
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}
      >{activeTab?.isLoading ? '✕' : '↻'}</button>

      {/* Home */}
      <button
        style={S.navBtn(false)} onClick={goHome} title="Home"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}
      >⌂</button>

      {/* Address bar */}
      <div style={S.addrWrap}>
        <span style={S.lockIcon}>{isSecure ? '🔒' : '🔓'}</span>
        <input
          ref={inputRef}
          style={{ ...S.addrInput, borderColor: showSugg ? 'var(--theme-accent)' : 'var(--theme-border)' }}
          value={addressBarValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { setAddressBarFocused(true); inputRef.current?.select(); setShowSugg(true); }}
          onBlur={() => {
            setTimeout(() => { setShowSugg(false); clearSuggestions(); }, 150);
            setAddressBarFocused(false);
            if (activeTab) setAddressBarValue(activeTab.url);
          }}
          placeholder="Search or enter address..."
          spellCheck={false}
        />
        {addressBarValue && showSugg && (
          <button style={S.clearBtn} onMouseDown={e => { e.preventDefault(); setAddressBarValue(''); clearSuggestions(); }}>×</button>
        )}
        {showSugg && searchSuggestions.length > 0 && (
          <div style={S.suggestion}>
            {searchSuggestions.map((s, i) => (
              <div
                key={i}
                style={S.suggItem(i === suggActive)}
                onMouseDown={e => { e.preventDefault(); handleSubmit(s.url); }}
                onMouseEnter={() => setSuggActive(i)}
              >
                <span style={S.suggIcon}>
                  {s.type === 'history' ? '🕐' : s.type === 'bookmark' ? '⭐' : s.type === 'url' ? '🌐' : '🔍'}
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

      {/* Bookmark toggle */}
      <button
        style={{ ...S.actionBtn, color: isBookmarkedState ? '#f6c90e' : 'var(--theme-fg-muted)' }}
        onClick={toggleBookmark} title={isBookmarkedState ? 'Remove bookmark' : 'Bookmark this page'}
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = isBookmarkedState ? '#f6c90e' : 'var(--theme-fg-muted)'; }}
      >⭐</button>

      {/* Zoom */}
      <button style={S.actionBtn} onClick={zoomOut} title="Zoom out" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>−</button>
      {activeTab && (activeTab.zoomLevel ?? 0) !== 0 && (
        <span
          style={{ fontSize: 11, color: 'var(--theme-fg-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          onClick={zoomReset} title="Reset zoom"
        >{Math.round(100 + (activeTab.zoomLevel ?? 0) * 10)}%</span>
      )}
      <button style={S.actionBtn} onClick={zoomIn} title="Zoom in" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>+</button>

      {/* Find */}
      <button
        style={{ ...S.actionBtn, color: findBarVisible ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
        onClick={() => setFindBarVisible(!findBarVisible)} title="Find in page (Ctrl+F)"
        onMouseEnter={e => btnHover(e, true)}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = findBarVisible ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}
      >🔍</button>

      {/* DevTools */}
      <button style={S.actionBtn} onClick={openDevTools} title="Developer Tools (Ctrl+Shift+I)" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>⚙</button>

      {/* New Tab */}
      <button style={S.actionBtn} onClick={() => createTab()} title="New Tab (Ctrl+T)" onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => btnHover(e, false)}>⊕</button>

      {/* Sidebar toggles */}
      <button style={{ ...S.actionBtn, color: sidebarView === 'history' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
        onClick={() => setSidebarView('history')} title="History"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'history' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>🕐</button>
      <button style={{ ...S.actionBtn, color: sidebarView === 'bookmarks' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
        onClick={() => setSidebarView('bookmarks')} title="Bookmarks"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'bookmarks' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>📚</button>
      <button style={{ ...S.actionBtn, color: sidebarView === 'downloads' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)' }}
        onClick={() => setSidebarView('downloads')} title="Downloads"
        onMouseEnter={e => btnHover(e, true)} onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = sidebarView === 'downloads' ? 'var(--theme-accent)' : 'var(--theme-fg-muted)'; }}>⬇</button>
    </div>
  );
};

export default BrowserToolbar;
