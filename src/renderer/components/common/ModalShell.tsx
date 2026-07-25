/**
 * ModalShell — shared wrapper for all modals/dialogs in the app.
 * Provides consistent overlay, container, title bar, and close button.
 */
import React from 'react';
import { Icon } from './Icon';

interface ModalShellProps {
  title: string;
  icon?: string;
  width?: number | string;
  maxHeight?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  title, icon, width = 560, maxHeight = '80vh', onClose, children, footer,
}) => {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width, maxHeight,
          display: 'flex', flexDirection: 'column',
          background: 'var(--theme-bg-secondary)',
          border: '1px solid var(--theme-border-light, var(--theme-border))',
          borderRadius: 8, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Title bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--theme-border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon && <Icon name={icon} size={16} style={{ color: 'var(--theme-accent)' }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)' }}>{title}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, border: 'none', borderRadius: 4,
              background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-active))'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            padding: '12px 16px', borderTop: '1px solid var(--theme-border)', flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Shared style helpers ─────────────────────────────────────────────
export const modalStyles = {
  label: { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--theme-fg-muted)', marginBottom: 4 } as React.CSSProperties,
  input: { width: '100%', padding: '6px 8px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 12, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
  textarea: { width: '100%', padding: '8px 10px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' } as React.CSSProperties,
  btnPrimary: { padding: '7px 20px', border: 'none', borderRadius: 5, background: 'var(--theme-accent)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 } as React.CSSProperties,
  btnSecondary: { padding: '7px 16px', border: '1px solid var(--theme-border)', borderRadius: 5, background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 12 } as React.CSSProperties,
  btnGhost: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--theme-border)', borderRadius: 4, background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer', fontSize: 11 } as React.CSSProperties,
  btnIconOnly: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, border: 'none', borderRadius: 3, background: 'transparent', color: 'var(--theme-fg-muted)', cursor: 'pointer' } as React.CSSProperties,
  select: { width: '100%', padding: '6px 8px', background: 'var(--theme-bg-input, var(--theme-bg))', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', fontSize: 12, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
};
