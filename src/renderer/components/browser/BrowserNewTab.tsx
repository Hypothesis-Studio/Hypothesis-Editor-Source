/**
 * Hypothesis Browser - New Tab Page
 */
import React, { useState, useEffect } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

interface Props {
  onNavigate?: (url: string) => void;
}

// ── SVG icons ─────────────────────────────────────────────────────
const IcoSearch  = () => <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoGlobe   = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IcoCode    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>;
const IcoPlay    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcoBook    = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const IcoBubble  = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoCat     = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>;

const QUICK_LINKS = [
  { title: 'Google',        url: 'https://www.google.com',         Icon: IcoSearch },
  { title: 'GitHub',        url: 'https://github.com',             Icon: IcoCat },
  { title: 'YouTube',       url: 'https://www.youtube.com',        Icon: IcoPlay },
  { title: 'Wikipedia',     url: 'https://www.wikipedia.org',      Icon: IcoBook },
  { title: 'Stack Overflow',url: 'https://stackoverflow.com',      Icon: IcoBubble },
  { title: 'MDN Docs',      url: 'https://developer.mozilla.org',  Icon: IcoCode },
];

const S = {
  root: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--theme-bg)', color: 'var(--theme-fg)',
    padding: 40, gap: 32, overflowY: 'auto' as const,
  },
  searchWrap: { width: '100%', maxWidth: 520, position: 'relative' as const },
  searchInput: {
    width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 22,
    border: '1.5px solid var(--theme-border)', background: 'var(--theme-bg-secondary)',
    color: 'var(--theme-fg)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  searchIcon: {
    position: 'absolute' as const, left: 15, top: '50%', transform: 'translateY(-50%)',
    color: 'var(--theme-fg-muted)', pointerEvents: 'none' as const,
    display: 'flex', alignItems: 'center',
  },
  quickGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 480,
  },
  quickItem: (hov: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '14px 10px', borderRadius: 10, gap: 8, cursor: 'pointer',
    background: hov ? 'var(--theme-bg-tertiary)' : 'var(--theme-bg-secondary)',
    border: `1px solid ${hov ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
    transition: 'background 0.15s, border-color 0.15s',
    color: hov ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
  }),
  quickTitle: { fontSize: 11, fontWeight: 500, color: 'var(--theme-fg-muted)' },
  recentTitle: {
    fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)',
    textTransform: 'uppercase' as const, letterSpacing: 1,
    alignSelf: 'flex-start', width: '100%', maxWidth: 480,
  },
  recentList: { display: 'flex', flexDirection: 'column' as const, gap: 2, width: '100%', maxWidth: 480 },
  recentItem: (hov: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
    borderRadius: 6, cursor: 'pointer',
    background: hov ? 'var(--theme-bg-secondary)' : 'transparent',
    transition: 'background 0.1s',
  }),
  recentFavicon: { width: 14, height: 14, flexShrink: 0 as const },
  recentText: { flex: 1, overflow: 'hidden' },
  recentItemTitle: { fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  recentUrl: { fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
};

const BrowserNewTab: React.FC<Props> = ({ onNavigate }) => {
  const { history, loadHistory, activeTabId, navigate, settings } = useBrowserStore();
  const [query, setQuery] = useState('');
  const [hoveredQuick, setHoveredQuick] = useState<string | null>(null);
  const [hoveredRecent, setHoveredRecent] = useState<string | null>(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    loadHistory();
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const recentVisits = history.slice(0, 5);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const url = /^https?:\/\//.test(query)
      ? query
      : query.includes('.') && !query.includes(' ')
        ? `https://${query}`
        : `${settings?.searchEngine === 'duckduckgo'
            ? 'https://duckduckgo.com/?q='
            : settings?.searchEngine === 'bing'
              ? 'https://www.bing.com/search?q='
              : 'https://www.google.com/search?q='
          }${encodeURIComponent(query)}`;
    if (onNavigate) onNavigate(url);
    else if (activeTabId) navigate(activeTabId, url);
  };

  const handleNavigate = (url: string) => {
    if (onNavigate) onNavigate(url);
    else if (activeTabId) navigate(activeTabId, url);
  };

  const timeStr = time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={S.root}>
      {/* Clock */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 100, color: 'var(--theme-fg)', letterSpacing: 4, lineHeight: 1 }}>{timeStr}</div>
        <div style={{ fontSize: 13, color: 'var(--theme-fg-muted)', marginTop: 4 }}>{dateStr}</div>
      </div>

      {/* Search bar */}
      <form style={S.searchWrap} onSubmit={handleSearch}>
        <span style={S.searchIcon}><IcoSearch /></span>
        <input
          style={S.searchInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search or enter address..."
          autoFocus
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--theme-accent)'; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--theme-border)'; }}
        />
      </form>

      {/* Quick links */}
      <div style={S.quickGrid}>
        {QUICK_LINKS.map(link => (
          <div
            key={link.url}
            style={S.quickItem(hoveredQuick === link.url)}
            onClick={() => handleNavigate(link.url)}
            onMouseEnter={() => setHoveredQuick(link.url)}
            onMouseLeave={() => setHoveredQuick(null)}
          >
            <link.Icon />
            <span style={S.quickTitle}>{link.title}</span>
          </div>
        ))}
      </div>

      {/* Recent visits */}
      {recentVisits.length > 0 && (
        <>
          <div style={S.recentTitle}>Recent</div>
          <div style={S.recentList}>
            {recentVisits.map(h => (
              <div
                key={h.id}
                style={S.recentItem(hoveredRecent === h.id)}
                onClick={() => handleNavigate(h.url)}
                onMouseEnter={() => setHoveredRecent(h.id)}
                onMouseLeave={() => setHoveredRecent(null)}
              >
                {h.favicon
                  ? <img src={h.favicon} style={S.recentFavicon} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <IcoGlobe />
                }
                <div style={S.recentText}>
                  <div style={S.recentItemTitle}>{h.title || h.url}</div>
                  <div style={S.recentUrl}>{h.url}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BrowserNewTab;
