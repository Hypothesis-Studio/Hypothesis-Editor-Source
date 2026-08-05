/**
 * AboutDialog - Professional about page for Hypothesis Editor.
 */
import React, { useEffect, useState } from 'react';
import { WindowControls } from '../common/WindowControls';
import { useThemeStore } from '../../stores/themeStore';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

const iconLight = new URL('../../assets/icons/icon-light.png', import.meta.url).href;
const iconDark = new URL('../../assets/icons/icon-dark.png', import.meta.url).href;

interface AboutDialogProps {
  onClose: () => void;
}

const FEATURES = [
  { label: 'Code Editor', desc: 'Intelligent editing with IntelliSense, snippets, and syntax highlighting for 80+ languages' },
  { label: 'AI Agent', desc: 'Autonomous coding assistant that reads, writes, and reasons about your codebase' },
  { label: 'REST Client', desc: 'Full-featured API testing client with collections, environments, and scripting' },
  { label: 'Database Explorer', desc: 'Visual query builder and schema browser for SQLite, PostgreSQL, and MySQL' },
  { label: 'Web Browser', desc: 'Embedded multi-tab browser with bookmarks, history, and downloads' },
  { label: 'Chat Collaboration', desc: 'Real-time team chat with markdown, file attachments, and AI assistant' },
  { label: 'Project Insights', desc: 'Code health dashboard with complexity analysis, security audit, and git metrics' },
  { label: 'Extensions', desc: 'Extensible plugin system to add new features and integrations' },
  { label: 'Integrated Terminal', desc: 'Multi-session terminal with run support for 9 languages' },
  { label: 'Live Server', desc: 'Local static server with live reload and HTTPS support' },
  { label: 'Tunnels', desc: 'Expose local ports to the internet with public URL sharing' },
  { label: 'Git Integration', desc: 'Source control with staging, commits, branching, and inline diff' },
];

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const isLight = currentTheme.includes('light') || currentTheme === 'vs';
  const iconSrc = isLight ? iconDark : iconLight;
  const [hovered, setHovered] = useState<string | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--theme-bg)', color: 'var(--theme-fg)',
    }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 36, flexShrink: 0,
        background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)',
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--theme-fg-muted)', fontSize: 12,
            display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 16,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
        >
          <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Editor
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg)' }}>
          About — {APP_NAME}
        </div>
        <WindowControls />
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* Hero */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '56px 24px 44px',
          background: isLight
            ? 'linear-gradient(160deg, #f0f4ff 0%, #ffffff 55%)'
            : 'linear-gradient(160deg, #161b2c 0%, var(--theme-bg) 55%)',
          borderBottom: '1px solid var(--theme-border)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative rings */}
          <div style={{
            position: 'absolute', width: 360, height: 360, borderRadius: '50%',
            border: `1px solid ${isLight ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'}`,
            top: -100, right: -80, pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', width: 220, height: 220, borderRadius: '50%',
            border: `1px solid ${isLight ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'}`,
            bottom: -70, left: -70, pointerEvents: 'none',
          }} />

          {/* App icon */}
          <div style={{
            width: 88, height: 88, borderRadius: 20,
            background: isLight ? '#ffffff' : 'var(--theme-bg-secondary)',
            border: '1px solid var(--theme-border)',
            boxShadow: isLight
              ? '0 4px 24px rgba(99,102,241,0.14), 0 1px 6px rgba(0,0,0,0.06)'
              : '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
          }}>
            <img src={iconSrc} alt={APP_NAME} style={{ width: 60, height: 60 }} />
          </div>

          <h1 style={{
            fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 8,
            color: 'var(--theme-fg)', letterSpacing: -0.4,
          }}>{APP_NAME}</h1>

          <p style={{
            fontSize: 13, color: 'var(--theme-fg-muted)', margin: 0, marginBottom: 20,
            maxWidth: 400, textAlign: 'center', lineHeight: 1.65,
          }}>{APP_DESCRIPTION}</p>

          {/* Version + build info */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 14px', borderRadius: 20,
              background: isLight ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.13)',
              border: `1px solid ${isLight ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.28)'}`,
              fontSize: 12, fontWeight: 600,
              color: isLight ? '#4f46e5' : '#818cf8',
            }}>
              Version {APP_VERSION}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 32px 64px' }}>

          {/* Section label */}
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--theme-fg-muted)', marginBottom: 14,
          }}>
            Capabilities
          </div>

          {/* Feature grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10,
            marginBottom: 44,
          }}>
            {FEATURES.map(f => (
              <div
                key={f.label}
                onMouseEnter={() => setHovered(f.label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  padding: '13px 16px', borderRadius: 8,
                  background: hovered === f.label ? 'var(--theme-bg-active)' : 'var(--theme-bg-secondary)',
                  border: `1px solid ${hovered === f.label ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                  transition: 'background 0.12s, border-color 0.12s',
                  cursor: 'default',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 4 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--theme-fg-muted)', lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--theme-border)', marginBottom: 28 }} />

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 16,
          }}>
            <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)', lineHeight: 1.8 }}>
              <div style={{ fontWeight: 500, color: 'var(--theme-fg)' }}>{APP_NAME} Editor</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                © {year} {APP_NAME}. All rights reserved.
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                padding: '7px 28px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: '1px solid var(--theme-border)',
                background: 'var(--theme-bg-secondary)', color: 'var(--theme-fg)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-active)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-secondary)'; }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
