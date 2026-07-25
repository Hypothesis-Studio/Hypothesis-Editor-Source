/**
 * Hypothesis Browser - Main Panel
 * Uses ResizeObserver to measure exact available height for webview area.
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useBrowserStore } from '../../stores/browserStore';
import BrowserToolbar from './BrowserToolbar';
import BrowserTabBar from './BrowserTabBar';
import BrowserSidebar from './BrowserSidebar';
import BrowserFindBar from './BrowserFindBar';
import BrowserNewTab from './BrowserNewTab';

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
    setAddressBarValue, setFindBarVisible,
  } = useBrowserStore();

  const webviewRefs = useRef<Map<string, Electron.WebviewTag>>(new Map());
  const initialSrcs = useRef<Map<string, string>>(new Map());
  const attachedIds = useRef<Set<string>>(new Set());
  const domReadyIds = useRef<Set<string>>(new Set());

  const [crashed, setCrashed] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  // Measure available height for webview body area
  const rootRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState<number>(500);

  const measure = useCallback(() => {
    const rootH = rootRef.current?.getBoundingClientRect().height ?? 0;
    const tbH = tabBarRef.current?.getBoundingClientRect().height ?? 0;
    const tlH = toolbarRef.current?.getBoundingClientRect().height ?? 0;
    const h = rootH - tbH - tlH;
    if (h > 0) setBodyHeight(h);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => { init(); }, []);
  useEffect(() => { (window as any).__browserWebviewRefs = webviewRefs; }, []);

  const loadUrl = useCallback((tabId: string, url: string) => {
    const wv = webviewRefs.current.get(tabId);
    if (wv) {
      try { (wv as any).loadURL(url); } catch (e) { console.warn('[Browser] loadURL failed', e); }
    } else {
      initialSrcs.current.set(tabId, url);
    }
  }, []);

  useEffect(() => { (window as any).__browserLoadUrl = loadUrl; }, [loadUrl]);

  const attachListeners = useCallback((tabId: string, wv: Electron.WebviewTag) => {
    if (attachedIds.current.has(tabId)) return;
    attachedIds.current.add(tabId);

    wv.addEventListener('dom-ready', () => { domReadyIds.current.add(tabId); });
    const isReady = () => domReadyIds.current.has(tabId);

    wv.addEventListener('did-start-loading', () => {
      updateTab(tabId, { isLoading: true });
      setShowProgress(true); setLoadProgress(20);
    });
    wv.addEventListener('did-stop-loading', () => {
      updateTab(tabId, { isLoading: false });
      setLoadProgress(100);
      setTimeout(() => { setShowProgress(false); setLoadProgress(0); }, 400);
    });
    wv.addEventListener('load-commit', (e: any) => {
      if (!e.isMainFrame) return;
      updateTab(tabId, {
        url: e.url,
        canGoBack: isReady() ? wv.canGoBack() : false,
        canGoForward: isReady() ? wv.canGoForward() : false,
      });
      if (tabId === useBrowserStore.getState().activeTabId) setAddressBarValue(e.url);
    });
    wv.addEventListener('did-navigate', (e: any) => {
      if (!isReady()) return;
      updateTab(tabId, { url: e.url, canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
    });
    wv.addEventListener('did-navigate-in-page', (e: any) => {
      if (!e.isMainFrame || !isReady()) return;
      updateTab(tabId, { url: e.url, canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() });
      if (tabId === useBrowserStore.getState().activeTabId) setAddressBarValue(e.url);
    });
    wv.addEventListener('page-title-updated', (e: any) => { updateTab(tabId, { title: e.title }); });
    wv.addEventListener('page-favicon-updated', (e: any) => {
      updateTab(tabId, { favicon: e.favicons?.[0] ?? null });
    });
    wv.addEventListener('did-finish-load', () => {
      setLoadProgress(100);
      const tab = useBrowserStore.getState().tabs.find(t => t.id === tabId);
      if (tab?.url && !tab.url.startsWith('about:')) {
        addHistory(tab.url, tab.title || tab.url, tab.favicon ?? null);
      }
    });
    wv.addEventListener('did-fail-load', (e: any) => {
      if (e.errorCode === -3) return;
      updateTab(tabId, { isLoading: false, title: 'Failed to load' });
    });
    wv.addEventListener('crashed', () => { setCrashed(tabId); updateTab(tabId, { isLoading: false }); });
    wv.addEventListener('destroyed', () => setCrashed(tabId));
    wv.addEventListener('new-window', (e: any) => { useBrowserStore.getState().createTab(e.url); });
    wv.addEventListener('found-in-page', (e: any) => { useBrowserStore.setState({ findResults: e.result }); });
  }, [updateTab, addHistory, setAddressBarValue]);

  // Find in page
  useEffect(() => {
    if (!activeTabId) return;
    const wv = webviewRefs.current.get(activeTabId);
    if (!wv || !domReadyIds.current.has(activeTabId)) return;
    if (findBarVisible && findQuery) {
      if (typeof wv.findInPage === 'function') wv.findInPage(findQuery, { findNext: false, forward: true });
    } else {
      if (typeof wv.stopFindInPage === 'function') try { wv.stopFindInPage('clearSelection'); } catch {}
    }
  }, [findBarVisible, findQuery, activeTabId]);

  // Close find bar with Escape at panel level
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && findBarVisible) setFindBarVisible(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [findBarVisible, setFindBarVisible]);

  const handleReload = (tabId: string) => {
    setCrashed(null);
    const wv = webviewRefs.current.get(tabId);
    if (wv) { wv.reload(); }
    else { const tab = tabs.find(t => t.id === tabId); if (tab) loadUrl(tabId, tab.url); }
  };

  if (tabs.length === 0) {
    return (
      <div ref={rootRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-bg)' }}>
        <BrowserNewTab onNavigate={(url) => createTab(url)} />
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--theme-bg)', overflow: 'hidden' }}>

      {/* Tab bar */}
      <div ref={tabBarRef} style={{ flexShrink: 0 }}>
        <BrowserTabBar />
      </div>

      {/* Toolbar */}
      <div ref={toolbarRef} style={{ flexShrink: 0 }}>
        <BrowserToolbar webviewRefs={webviewRefs} />
      </div>

      {/* Find bar — outside webview container so it doesn't affect layout */}
      {findBarVisible && (
        <div style={{ flexShrink: 0 }}>
          <BrowserFindBar webviewRefs={webviewRefs} />
        </div>
      )}

      {/* Body — explicit pixel height from ResizeObserver */}
      <div style={{ display: 'flex', width: '100%', height: bodyHeight, overflow: 'hidden', flexShrink: 0 }}>

        {/* Webview container */}
        <div style={{ flex: '1 1 0', minWidth: 0, position: 'relative', overflow: 'hidden', height: '100%' }}>
          {showProgress && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 10,
              background: 'var(--theme-accent)',
              width: `${loadProgress}%`, opacity: loadProgress === 100 ? 0 : 1, transition: 'opacity 0.3s',
            }} />
          )}

          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            const isNewTab = !tab.url || tab.url === 'about:newtab';
            const isCrashed = crashed === tab.id;
            return (
              <div
                key={tab.id}
                style={{
                  position: 'absolute', inset: 0,
                  visibility: isActive ? 'visible' : 'hidden',
                  pointerEvents: isActive ? 'auto' : 'none',
                }}
              >
                {isNewTab ? (
                  <BrowserNewTab onNavigate={(url) => loadUrl(tab.id, url)} />
                ) : isCrashed ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--theme-fg-muted)', gap: 12 }}>
                    <IconCrash />
                    <span style={{ fontSize: 15 }}>This tab crashed</span>
                    <button
                      style={{ padding: '8px 20px', borderRadius: 6, background: 'var(--theme-accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
                      onClick={() => handleReload(tab.id)}
                    >Reload</button>
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
                      if (!initialSrcs.current.has(tab.id)) {
                        initialSrcs.current.set(tab.id, tab.url || DEFAULT_URL);
                      }
                      return initialSrcs.current.get(tab.id)!;
                    })()}
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                    allowpopups="true"
                    webpreferences="contextIsolation=yes, javascript=yes"
                  />
                )}
              </div>
            );
          })}
        </div>

        <BrowserSidebar webviewRefs={webviewRefs} />
      </div>
    </div>
  );
};

export default BrowserPanel;
