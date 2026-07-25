/**
 * Hypothesis Browser - Find in Page Bar
 */
import React, { useEffect, useRef } from 'react';
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
    width: 200, height: 26, padding: '0 8px', borderRadius: 5,
    border: '1px solid var(--theme-border)', background: 'var(--theme-bg)',
    color: 'var(--theme-fg)', fontSize: 12, outline: 'none',
  },
  count: { fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' as const, minWidth: 48 },
  btn: {
    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 4, border: '1px solid var(--theme-border)', background: 'transparent',
    color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 13,
  },
};

const BrowserFindBar: React.FC<Props> = ({ webviewRefs }) => {
  const { activeTabId, findQuery, setFindQuery, setFindBarVisible, findResults } = useBrowserStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const getWv = () => {
    const wv = activeTabId ? webviewRefs.current.get(activeTabId) : null;
    return wv ?? null;
  };

  const safeStop = () => {
    const wv = getWv();
    if (wv && typeof wv.stopFindInPage === 'function') wv.stopFindInPage('clearSelection');
  };

  const find = (query: string, forward = true) => {
    const wv = getWv();
    if (!wv || !query || typeof wv.findInPage !== 'function') return;
    wv.findInPage(query, { findNext: false, forward });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setFindQuery(q);
    if (q) find(q); else safeStop();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { find(findQuery, !e.shiftKey); }
    if (e.key === 'Escape') { setFindBarVisible(false); safeStop(); }
  };

  const close = () => {
    setFindBarVisible(false);
    safeStop();
  };

  return (
    <div style={S.bar}>
      <input
        ref={inputRef} style={S.input} value={findQuery}
        onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder="Find in page..."
      />
      <span style={S.count}>
        {findResults ? `${findResults.activeMatchOrdinal} / ${findResults.matches}` : ''}
      </span>
      <button style={S.btn} onClick={() => find(findQuery, false)} title="Previous (Shift+Enter)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg></button>
      <button style={S.btn} onClick={() => find(findQuery, true)} title="Next (Enter)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>
      <button style={S.btn} onClick={close} title="Close (Escape)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  );
};

export default BrowserFindBar;
