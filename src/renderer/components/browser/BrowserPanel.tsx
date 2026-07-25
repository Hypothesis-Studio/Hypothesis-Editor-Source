/**
 * Hypothesis Browser - Main Panel
 * Navigation is driven imperatively via webview.loadURL() in the renderer.
 * The store holds display state only; it never triggers loadURL.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useBrowserStore } from '../../stores/browserStore';
import BrowserToolbar from './BrowserToolbar';
import BrowserTabBar from './BrowserTabBar';
import BrowserSidebar from './BrowserSidebar';
import BrowserFindBar from './BrowserFindBar';
import BrowserNewTab from './BrowserNewTab';

const S = {
  root: {
    display: 'flex', flexDirection: 'column' as const, height: '100%', width: '100%',
    background: 'var(--theme-bg)', overflow: 'hidden',
  },
  body: {
    display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' as const,
  },
  webviewWrap: {
    flex: 1, position: 'relative' as const, overflow: 'hidden',
    display: 'flex', flexDirection: 'column' as const,
  },
  webview: {
    flex: 1, width: '100%', border: 'none', display: 'block',
  } as React.CSSProperties,
  loadBar: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2,
    background: 'var(--theme-accent)', zIndex: 10, transition: 'opacity 0.3s',
  },
  crashScreen: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    color: 'var(--theme-fg-muted)', gap: 12,
  },
  crashBtn: {
    padding: '8px 20px', borderRadius: 6, background: 'var(--theme-accent)',
    color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13,
  },
};

const IconCrash = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <circle cx="12" cy="16" r="0.5" fill="currentColor"/>
  </svg>
);

const DEFAULT_URL = 'about:blank';

const BrowserPanel: React.FC = () => {
  const {
    tabs, activeTabId, createTab, init,
    updateTab, addHistory, findBarVisible, findQuery,
    setAddressBarValue,
  } = useBrowserStore();

  // webviewRefs: tabId → WebviewTag element (shared with Toolbar/FindBar)
  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map());
  // initialSrcs: stores the URL used as webview src on first mount — never changes after
  const initialSrcs = useRef<Map<string, string>>(new Map());
  // Set of tabIds whose listeners are already attached
  const attachedIds = useRef<Set<string>>(new Set());

  const [crashed, setCrashed] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => { init(); }, []);

  // ── Expose webviewRefs to store so Toolbar can reach it ────────
  useEffect(() => {
    (window as any).__browserWebviewRefs = webviewRefs;
  }, []);

  // ── Helper: navigate a tab imperatively ───────────────────────
  const loadUrl = useCallback((tabId: string, url: string) => {
    const wv = webviewRefs.current.get(tabId);
    if (wv) {
      try { (wv as any).loadURL(url); } catch (e) { console.warn('[Browser] loadURL failed', e); }
    } else {
      // Webview not mounted yet — store as initial src
      initialSrcs.current.set(tabId, url);
    }
  }, []);

  // Expose loadUrl globally so Toolbar / store can call it
  useEffect(() => {
    (window as any).__browserLoadUrl = loadUrl;
  }, [loadUrl]);

  // ── Attach event listeners once per webview ───────────────────
  const attachListeners = useCallback((tabId: string, wv: Electron.WebviewTag) => {
    if (attachedIds.current.has(tabId)) return;
    attachedIds.current.add(tabId);

    wv.addEventListener('did-start-loading', () => {
      updateTab(tabId, { isLoading: true });
      setShowProgress(true);
      setLoadProgress(20);
    });

    wv.addEventListener('did-stop-loading', () => {
      updateTab(tabId, { isLoading: false });
      setLoadProgress(100);
      setTimeout(() => { setShowProgress(false); setLoadProgress(0); }, 400);
    });

    // load-commit fires for every sub-resource — only handle main frame
    wv.addEventListener('load-commit', (e: any) => {
      if (!e.isMainFrame) return;
      const url: string = e.url;
      // Update store state only — do NOT call loadURL here
      updateTab(tabId, {
        url,
        canGoBack: wv.canGoBack(),
        canGoForward: wv.canGoForward(),
      });
      // Sync address bar for active tab
      if (tabId === useBrowserStore.getState().activeTabId) {
        setAddressBarValue(url);
      }
    });

    wv.addEventListener('did-navigate', (e: any) => {
      updateTab(tabId, {
        url: e.url,
        canGoBack: wv.canGoBack(),
        canGoForward: wv.canGoForward(),
      });
    });

    wv.addEventListener('did-navigate-in-page', (e: any) => {
      if (!e.isMainFrame) return;
      updateTab(tabId, { url: e.url, canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
      if (tabId === useBrowserStore.getState().activeTabId) {
        setAddressBarValue(e.url);
      }
    });

    wv.addEventListener('page-title-updated', (e: any) => {
      updateTab(tabId, { title: e.title });
    });

    wv.addEventListener('page-favicon-updated', (e: any) => {
      const favicon = e.favicons?.[0] ?? null;
      updateTab(tabId, { favicon });
    });

    wv.addEventListener('did-finish-load', () => {
      setLoadProgress(100);
      const tab = useBrowserStore.getState().tabs.find(t => t.id === tabId);
      if (tab && tab.url && !tab.url.startsWith('about:')) {
        addHistory(tab.url, tab.title || tab.url, tab.favicon ?? null);
      }
    });

    wv.addEventListener('did-fail-load', (e: any) => {
      if (e.errorCode === -3) return; // navigation aborted — not an error
      updateTab(tabId, { isLoading: false, title: 'Failed to load' });
    });

    wv.addEventListener('crashed', () => {
      setCrashed(tabId);
      updateTab(tabId, { isLoading: false });
    });
    wv.addEventListener('destroyed', () => setCrashed(tabId));

    wv.addEventListener('new-window', (e: any) => {
      useBrowserStore.getState().createTab(e.url);
    });

    wv.addEventListener('found-in-page', (e: any) => {
      useBrowserStore.setState({ findResults: e.result });
    });
  }, [updateTab, addHistory, setAddressBarValue]);

  // ── Find in page ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeTabId) return;
    const wv = webviewRefs.current.get(activeTabId);
    if (!wv) return;
    if (findBarVisible && findQuery) {
      if (typeof wv.findInPage === 'function') {
        wv.findInPage(findQuery, { findNext: false, forward: true });
      }
    } else {
      if (typeof wv.stopFindInPage === 'function') {
        wv.stopFindInPage('clearSelection');
      }
    }
  }, [findBarVisible, findQuery, activeTabId]);

  // ── Reload crashed tab ────────────────────────────────────────
  const handleReload = (tabId: string) => {
    setCrashed(null);
    const wv = webviewRefs.current.get(tabId);
    if (wv) { wv.reload(); } else {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) loadUrl(tabId, tab.url);
    }
  };

  // ── Empty state ───────────────────────────────────────────────
  if (tabs.length === 0) {
    return (
      <div style={S.root}>
        <div style={{ ...S.body, alignItems: 'center', justifyContent: 'center' }}>
          <BrowserNewTab onNavigate={(url) => createTab(url)} />
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <BrowserTabBar />
      <BrowserToolbar webviewRefs={webviewRefs} />
      <div style={S.body}>
        <div style={S.webviewWrap}>
          {showProgress && (
            <div style={{ ...S.loadBar, width: `${loadProgress}%`, opacity: loadProgress === 100 ? 0 : 1 }} />
          )}
          {tabs.map(tab => (
            <div
              key={tab.id}
              style={{
                flex: 1, display: tab.id === activeTabId ? 'flex' : 'none',
                flexDirection: 'column', overflow: 'hidden', position: 'relative',
              }}
            >
              {tab.url === '' || tab.url === 'about:newtab' ? (
                <BrowserNewTab onNavigate={(url) => loadUrl(tab.id, url)} />
              ) : crashed === tab.id ? (
                <div style={S.crashScreen}>
                  <IconCrash />
                  <span style={{ fontSize: 15 }}>This tab crashed</span>
                  <button style={S.crashBtn} onClick={() => handleReload(tab.id)}>Reload</button>
                </div>
              ) : (
                <webview
                  key={`wv-${tab.id}`}
                  ref={(el) => {
                    if (!el) return;
                    const wv = el as unknown as Electron.WebviewTag;
                    webviewRefs.current.set(tab.id, wv);
                    attachListeners(tab.id, wv);
                  }}
                  src={(() => {
                    // Freeze src on first render — never update it again
                    // All subsequent navigation is done via wv.loadURL() imperatively
                    if (!initialSrcs.current.has(tab.id)) {
                      const url = tab.url && !tab.url.startsWith('about:newtab') ? tab.url : DEFAULT_URL;
                      initialSrcs.current.set(tab.id, url);
                    }
                    return initialSrcs.current.get(tab.id)!;
                  })()}
                  style={S.webview}
                  allowpopups="true"
                  webpreferences="contextIsolation=yes, javascript=yes"
                />
              )}
            </div>
          ))}
          {findBarVisible && <BrowserFindBar webviewRefs={webviewRefs} />}
        </div>
        <BrowserSidebar webviewRefs={webviewRefs} />
      </div>
    </div>
  );
};

export default BrowserPanel;
