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
    position: 'absolute' as const, bottom: 0, right: 0,
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
    borderRadius: '8px 0 0 0', boxShadow: '0 -2px 12px rgba(0,0,0,0.15)',
    zIndex: 100,
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

  const getWv = () => activeTabId ? webviewRefs.current.get(activeTabId) : null;

  const find = (query: string, forward = true) => {
    const wv = getWv();
    if (!wv || !query) return;
    wv.findInPage(query, { findNext: false, forward });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setFindQuery(q);
    if (q) find(q); else getWv()?.stopFindInPage('clearSelection');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { find(findQuery, !e.shiftKey); }
    if (e.key === 'Escape') { setFindBarVisible(false); getWv()?.stopFindInPage('clearSelection'); }
  };

  const close = () => {
    setFindBarVisible(false);
    getWv()?.stopFindInPage('clearSelection');
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
      <button style={S.btn} onClick={() => find(findQuery, false)} title="Previous (Shift+Enter)">↑</button>
      <button style={S.btn} onClick={() => find(findQuery, true)} title="Next (Enter)">↓</button>
      <button style={S.btn} onClick={close} title="Close (Escape)">×</button>
    </div>
  );
};

export default BrowserFindBar;
