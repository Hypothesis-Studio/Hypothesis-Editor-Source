/**
 * Hypothesis Browser - Find in Page Bar
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

interface Props {
  webviewRefs: React.MutableRefObject<Map<string, Electron.WebviewTag>>;
}

const S = {
  bar: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
    background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)',
    borderTop: '1px solid var(--theme-border)',
  },
  input: {
    width: 220, height: 26, padding: '0 8px', borderRadius: 5,
    border: '1px solid var(--theme-border)', background: 'var(--theme-bg)',
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none',
  },
  count: { fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' as const, minWidth: 52 },
  btn: {
    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, border: '1px solid var(--theme-border)', background: 'transparent',
    color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 13,
  },
};

const BrowserFindBar: React.FC<Props> = ({ webviewRefs }) => {
  const { activeTabId, findQuery, setFindQuery, setFindBarVisible, findResults } = useBrowserStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastQueryRef = useRef<string>('');

  useEffect(() => { inputRef.current?.focus(); }, []);

  const getWv = useCallback(() => {
    return activeTabId ? webviewRefs.current.get(activeTabId) ?? null : null;
  }, [activeTabId, webviewRefs]);

  const stopFind = useCallback(() => {
    const wv = getWv();
    if (wv && typeof wv.stopFindInPage === 'function') {
      try { wv.stopFindInPage('clearSelection'); } catch {}
    }
  }, [getWv]);

  const find = useCallback((query: string, forward = true, isNew = false) => {
    const wv = getWv();
    if (!wv || !query.trim()) return;
    if (typeof wv.findInPage !== 'function') return;
    try {
      if (isNew) {
        // New search: stop previous first, then start fresh
        try { wv.stopFindInPage('keepSelection'); } catch {}
        wv.findInPage(query, { forward: true, findNext: false });
      } else {
        // Navigate existing results
        wv.findInPage(query, { forward, findNext: true });
      }
    } catch (e) {
      console.warn('[FindBar] findInPage error', e);
    }
  }, [getWv]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setFindQuery(q);
    if (q.trim()) {
      find(q, true, true); // always "new search" on text change
    } else {
      stopFind();
      useBrowserStore.setState({ findResults: null });
    }
    lastQueryRef.current = q;
  }, [find, stopFind, setFindQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      find(findQuery, !e.shiftKey, false);
    }
    if (e.key === 'Escape') {
      close();
    }
  }, [find, findQuery]);

  const close = useCallback(() => {
    stopFind();
    setFindQuery('');
    setFindBarVisible(false);
    useBrowserStore.setState({ findResults: null });
    lastQueryRef.current = '';
  }, [stopFind, setFindQuery, setFindBarVisible]);

  return (
    <div style={S.bar}>
      <input
        ref={inputRef}
        style={S.input}
        value={findQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
      />
      <span style={S.count}>
        {findResults && findResults.matches > 0
          ? `${findResults.activeMatchOrdinal} / ${findResults.matches}`
          : findResults && findResults.matches === 0
            ? 'No results'
            : ''}
      </span>
      <button style={S.btn} onClick={() => find(findQuery, false, false)} title="Previous">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <button style={S.btn} onClick={() => find(findQuery, true, false)} title="Next">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button style={S.btn} onClick={close} title="Close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
};

export default BrowserFindBar;
