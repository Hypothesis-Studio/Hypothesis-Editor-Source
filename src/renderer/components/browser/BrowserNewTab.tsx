/**
 * Hypothesis Browser - New Tab Page
 */
import React, { useState, useEffect } from 'react';
import { useBrowserStore } from '../../stores/browserStore';

interface Props {
  onNavigate?: (url: string) => void;
}

const QUICK_LINKS = [
  { title: 'Google', url: 'https://www.google.com', emoji: '🔍' },
  { title: 'GitHub', url: 'https://github.com', emoji: '🐙' },
  { title: 'YouTube', url: 'https://www.youtube.com', emoji: '▶️' },
  { title: 'Wikipedia', url: 'https://www.wikipedia.org', emoji: '📖' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com', emoji: '💬' },
  { title: 'MDN Docs', url: 'https://developer.mozilla.org', emoji: '📚' },
];

const S = {
  root: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--theme-bg)', color: 'var(--theme-fg)',
    padding: 40, gap: 32,
  },
  title: { fontSize: 28, fontWeight: 300, color: 'var(--theme-fg)', letterSpacing: 2 },
  searchWrap: { width: '100%', maxWidth: 520, position: 'relative' as const },
  searchInput: {
    width: '100%', height: 44, padding: '0 16px 0 44px', borderRadius: 22,
    border: '1.5px solid var(--theme-border)', background: 'var(--theme-bg-secondary)',
    color: 'var(--theme-fg)', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  searchIcon: {
    position: 'absolute' as const, left: 16, top: '50%', transform: 'translateY(-50%)',
    fontSize: 16, color: 'var(--theme-fg-muted)', pointerEvents: 'none' as const,
  },
  quickGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%', maxWidth: 480,
  },
  quickItem: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center',
    padding: '14px 10px', borderRadius: 10, gap: 6, cursor: 'pointer',
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)',
    transition: 'background 0.15s, border-color 0.15s',
  },
  quickEmoji: { fontSize: 22 },
  quickTitle: { fontSize: 11, color: 'var(--theme-fg-muted)', fontWeight: 500 },
  recentTitle: { fontSize: 11, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase' as const, letterSpacing: 1, alignSelf: 'flex-start', width: '100%', maxWidth: 480 },
  recentList: { display: 'flex', flexDirection: 'column' as const, gap: 2, width: '100%', maxWidth: 480 },
  recentItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
    borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s',
  },
  recentFavicon: { width: 14, height: 14, flexShrink: 0 },
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
    const url = query.includes('.') && !query.includes(' ')
      ? (query.startsWith('http') ? query : `https://${query}`)
      : `${(settings?.searchEngine === 'duckduckgo' ? 'https://duckduckgo.com/?q=' : settings?.searchEngine === 'bing' ? 'https://www.bing.com/search?q=' : 'https://www.google.com/search?q=')}${encodeURIComponent(query)}`;
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
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 100, color: 'var(--theme-fg)', letterSpacing: 4, lineHeight: 1 }}>{timeStr}</div>
        <div style={{ fontSize: 13, color: 'var(--theme-fg-muted)', marginTop: 4 }}>{dateStr}</div>
      </div>

      <form style={S.searchWrap} onSubmit={handleSearch}>
        <span style={S.searchIcon}>🔍</span>
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

      <div style={S.quickGrid}>
        {QUICK_LINKS.map(link => (
          <div
            key={link.url}
            style={{
              ...S.quickItem,
              background: hoveredQuick === link.url ? 'var(--theme-bg-tertiary)' : S.quickItem.background,
              borderColor: hoveredQuick === link.url ? 'var(--theme-accent)' : 'var(--theme-border)',
            }}
            onClick={() => handleNavigate(link.url)}
            onMouseEnter={() => setHoveredQuick(link.url)}
            onMouseLeave={() => setHoveredQuick(null)}
          >
            <span style={S.quickEmoji}>{link.emoji}</span>
            <span style={S.quickTitle}>{link.title}</span>
          </div>
        ))}
      </div>

      {recentVisits.length > 0 && (
        <>
          <div style={S.recentTitle}>Recent</div>
          <div style={S.recentList}>
            {recentVisits.map(h => (
              <div
                key={h.id}
                style={{ ...S.recentItem, background: hoveredRecent === h.id ? 'var(--theme-bg-secondary)' : 'transparent' }}
                onClick={() => handleNavigate(h.url)}
                onMouseEnter={() => setHoveredRecent(h.id)}
                onMouseLeave={() => setHoveredRecent(null)}
              >
                {h.favicon
                  ? <img src={h.favicon} style={S.recentFavicon} alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <span style={{ ...S.recentFavicon, fontSize: 12 }}>🌐</span>
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
