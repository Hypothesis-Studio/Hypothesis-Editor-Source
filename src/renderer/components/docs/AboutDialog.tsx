/**
 * AboutDialog - About Hypothesis overlay with app info.
 */
import React from 'react';
import { WindowControls } from '../common/WindowControls';
import { useThemeStore } from '../../stores/themeStore';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

const iconLight = new URL('../../assets/icons/icon-light.png', import.meta.url).href;
const iconDark = new URL('../../assets/icons/icon-dark.png', import.meta.url).href;

interface AboutDialogProps {
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const isLight = currentTheme.includes('light') || currentTheme === 'vs';
  const iconSrc = isLight ? iconDark : iconLight;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Editor
          </button>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg)' }}>About — {APP_NAME}</div>
        <WindowControls />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <img src={iconSrc} alt={APP_NAME} style={{ width: 128, height: 128 }} />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, color: 'var(--theme-fg)' }}>{APP_NAME}</h1>
          <p style={{ fontSize: 14, color: 'var(--theme-fg-muted)', marginBottom: 4 }}>{APP_DESCRIPTION}</p>
          <p style={{ fontSize: 13, color: 'var(--theme-fg-dim)' }}>Version {APP_VERSION}</p>
        </div>
        <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg-muted)', lineHeight: 1.8 }}>
          <p style={{ marginTop: 8 }}>© {new Date().getFullYear()} {APP_NAME}</p>
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 24, padding: '8px 32px', borderRadius: 6, border: '1px solid var(--theme-border)',
            background: 'var(--theme-bg-secondary)', color: 'var(--theme-fg)', cursor: 'pointer', fontSize: 13,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-active)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-secondary)'; }}
        >
          OK
        </button>
      </div>
    </div>
  );
};
