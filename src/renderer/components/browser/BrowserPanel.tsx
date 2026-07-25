/**
 * Hypothesis Browser - Main Panel
 * Houses the webview, toolbar, tabs, sidebar, and find bar.
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
    flex: 1, position: 'relative' as const, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const,
  },
  webview: {
    flex: 1, width: '100%', border: 'none', display: 'block',
  } as React.CSSProperties,
  loadBar: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, height: 2,
    background: 'var(--theme-accent)', zIndex: 10,
    transition: 'opacity 0.3s',
  },
  crashScreen: {
    flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    color: 'var(--theme-fg-muted)', gap: 12,
  },
  crashBtn: {
    padding: '8px 20px', borderRadius: 6, background: 'var(--theme-accent)',
    color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13,
  },
};

const BrowserPanel: React.FC = () => {
  const { tabs, activeTabId, createTab, init, navigate, updateTab, addHistory, findBarVisible, findQuery } = useBrowserStore();
  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map());
  const [crashed, setCrashed] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => { init(); }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Attach webview event listeners when tab becomes active
  const attachWebviewListeners = useCallback((tabId: string, wv: Electron.WebviewTag) => {
    if ((wv as any)._listenersAttached) return;
    (wv as any)._listenersAttached = true;

    wv.addEventListener('did-start-loading', () => {
      updateTab(tabId, { isLoading: true });
      setShowProgress(true); setLoadProgress(10);
    });

    wv.addEventListener('did-stop-loading', () => {
      updateTab(tabId, { isLoading: false });
      setLoadProgress(100);
      setTimeout(() => { setShowProgress(false); setLoadProgress(0); }, 400);
    });

    wv.addEventListener('load-commit', (e: any) => {
      if (e.isMainFrame) {
        updateTab(tabId, {
          url: e.url,
          canGoBack: wv.canGoBack(),
          canGoForward: wv.canGoForward(),
        });
        if (tabId === activeTabId) {
          useBrowserStore.getState().setAddressBarValue(e.url);
        }
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
      const tab = useBrowserStore.getState().tabs.find(t => t.id === tabId);
      if (tab && tab.url && tab.url !== 'about:blank') {
        addHistory(tab.url, tab.title || tab.url, tab.favicon);
      }
      setLoadProgress(100);
    });

    wv.addEventListener('did-fail-load', (e: any) => {
      if (e.errorCode === -3) return; // aborted (navigation)
      updateTab(tabId, { isLoading: false, title: 'Failed to load' });
    });

    wv.addEventListener('crashed', () => { setCrashed(tabId); updateTab(tabId, { isLoading: false }); });
    wv.addEventListener('destroyed', () => { setCrashed(tabId); });

    wv.addEventListener('new-window', (e: any) => {
      useBrowserStore.getState().createTab(e.url);
    });

    wv.addEventListener('context-menu', (e: any) => {
      e.preventDefault();
    });

    wv.addEventListener('found-in-page', (e: any) => {
      useBrowserStore.setState({ findResults: e.result });
    });

    wv.addEventListener('did-navigate', () => {
      updateTab(tabId, {
        canGoBack: wv.canGoBack(),
        canGoForward: wv.canGoForward(),
      });
    });

    wv.addEventListener('did-navigate-in-page', (e: any) => {
      if (e.isMainFrame) {
        updateTab(tabId, { url: e.url, canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
        if (tabId === activeTabId) useBrowserStore.getState().setAddressBarValue(e.url);
      }
    });
  }, [activeTabId, updateTab, addHistory]);

  // Find in page
  useEffect(() => {
    if (!activeTabId) return;
    const wv = webviewRefs.current.get(activeTabId);
    if (!wv) return;
    if (findBarVisible && findQuery) {
      wv.findInPage(findQuery, { findNext: false, forward: true });
    } else {
      wv.stopFindInPage('clearSelection');
    }
  }, [findBarVisible, findQuery, activeTabId]);

  const handleReload = (tabId: string) => {
    const wv = webviewRefs.current.get(tabId);
    setCrashed(null);
    if (wv) { wv.reload(); } else {
      const tab = tabs.find(t => t.id === tabId);
      if (tab) navigate(tabId, tab.url);
    }
  };

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
            <div key={tab.id} style={{ flex: 1, display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
              {crashed === tab.id ? (
                <div style={S.crashScreen}>
                  <span style={{ fontSize: 32 }}>💥</span>
                  <span style={{ fontSize: 15 }}>This tab crashed</span>
                  <button style={S.crashBtn} onClick={() => handleReload(tab.id)}>Reload</button>
                </div>
              ) : (
                <webview
                  ref={(el) => {
                    if (el) {
                      webviewRefs.current.set(tab.id, el as unknown as Electron.WebviewTag);
                      attachWebviewListeners(tab.id, el as unknown as Electron.WebviewTag);
                    }
                  }}
                  src={tab.url}
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
