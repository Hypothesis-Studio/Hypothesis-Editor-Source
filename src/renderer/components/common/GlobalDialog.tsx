/**
 * GlobalDialog - Renders the global themed dialog from dialogStore.
 */
import React from 'react';
import { useDialogStore } from '../../stores/dialogStore';
import { APP_NAME } from '../../../shared/utils/appMeta';
import { Icon } from './Icon';

export const GlobalDialog: React.FC = () => {
  const { isOpen, title, message, type, buttons, resolveDialog, cancelDialog } = useDialogStore();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      }}
      onClick={cancelDialog}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)', borderRadius: 8,
          width: type === 'about' ? 380 : 420, maxHeight: '70vh',
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
            onClick={cancelDialog}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)',
              padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '16px 20px', fontSize: 13, color: 'var(--theme-fg)', lineHeight: 1.8,
          overflow: 'auto', whiteSpace: 'pre-wrap',
        }}>
          {type === 'about' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>{APP_NAME}</div>
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

        {/* Footer buttons */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px',
          borderTop: '1px solid var(--theme-border)',
        }}>
          {buttons.map((btn, i) => {
            const styles: Record<string, React.CSSProperties> = {
              primary: { background: 'var(--theme-accent)', color: '#ffffff', border: 'none' },
              secondary: { background: 'transparent', color: 'var(--theme-fg-muted)', border: '1px solid var(--theme-border)' },
              danger: { background: '#e53e3e', color: '#ffffff', border: 'none' },
            };
            const style = styles[btn.variant || 'primary'];
            return (
              <button
                key={i}
                onClick={() => resolveDialog(i)}
                style={{
                  ...style,
                  borderRadius: 4, padding: '6px 20px', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
