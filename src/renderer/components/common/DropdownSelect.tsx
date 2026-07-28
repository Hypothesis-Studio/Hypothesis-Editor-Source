/**
 * DropdownSelect — Shared themed dropdown select component.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';

interface DropdownOption {
  value: string;
  label: string;
  description?: string;
}

interface DropdownSelectProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  showFontPreview?: boolean;
  placeholder?: string;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
}

export const DropdownSelect: React.FC<DropdownSelectProps> = ({
  value, options, onChange, showFontPreview, placeholder, minWidth = 120, maxWidth = 200, className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  // Detect light theme for hover colors
  const rootStyle = getComputedStyle(document.documentElement);
  const bgColor = rootStyle.getPropertyValue('--theme-bg').trim();
  const isLight = bgColor && !bgColor.startsWith('#1') && !bgColor.startsWith('#0') && bgColor !== '#1e1e1e' && bgColor !== '#252526';
  const hoverBg = isLight ? '#d9d9d9' : '#3a3a4a';
  const hoverFg = isLight ? '#1a1a1a' : '#ffffff';
  const selectedBg = isLight ? '#c8d8f0' : '#2a3a5c';
  const selectedFg = isLight ? '#1a1a1a' : '#ffffff';

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div ref={ref} style={{ position: 'relative' }} className={className}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)', borderRadius: 4,
          padding: '3px 8px', fontSize: 11, color: 'var(--theme-fg)', cursor: 'pointer',
          minWidth, maxWidth, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected?.label || value || placeholder || 'Select...'}
        </span>
        <Icon name="chevron-down" size={10} style={{ flexShrink: 0 }} />
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)', borderRadius: 4,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)', marginTop: 2,
          maxHeight: 260, overflowY: 'auto', minWidth: '100%',
        }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                width: '100%', padding: '6px 10px', fontSize: 11,
                background: opt.value === value ? selectedBg : 'transparent',
                color: opt.value === value ? selectedFg : 'var(--theme-fg)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = hoverBg;
                  e.currentTarget.style.color = hoverFg;
                }
              }}
              onMouseLeave={(e) => {
                if (opt.value !== value) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--theme-fg)';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                {opt.description && (
                  <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', flexShrink: 0 }}>{opt.description}</span>
                )}
                {opt.value === value && (
                  <span style={{ fontSize: 10, color: 'var(--theme-accent)' }}>selected</span>
                )}
              </div>
              {showFontPreview && (
                <span style={{ fontFamily: opt.value, fontSize: 12, color: 'var(--theme-fg-muted)', lineHeight: 1.5 }}>
                  ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 {'{}'}[]()@#$
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
