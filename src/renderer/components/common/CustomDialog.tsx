/**
 * CustomDialog - Themed dialog to replace native alert/confirm.
 */
import React from 'react';
import { APP_NAME, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

interface DialogProps {
  title: string;
  message: string;
  type?: 'info' | 'about' | 'license';
  onClose: () => void;
}

export const CustomDialog: React.FC<DialogProps> = ({ title, message, type = 'info', onClose }) => {
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
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)', borderRadius: 8,
          width: type === 'about' ? 380 : 440, maxHeight: '70vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Title bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--theme-border)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)',
              padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={14} height={14} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '16px 20px', fontSize: 13, color: 'var(--theme-fg)', lineHeight: 1.8,
          overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: type === 'license' ? 'inherit' : 'inherit',
        }}>
          {type === 'about' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>{APP_NAME}</div>
              <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 16 }}>{APP_DESCRIPTION}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--theme-fg-muted)' }}>
                {message.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ) : (
            message
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', padding: '12px 16px',
          borderTop: '1px solid var(--theme-border)',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'var(--theme-accent)', color: '#ffffff', border: 'none', borderRadius: 4,
              padding: '6px 24px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--theme-accent)'; }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
