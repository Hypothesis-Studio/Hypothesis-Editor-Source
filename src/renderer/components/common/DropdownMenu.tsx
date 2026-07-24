/**
 * Dropdown Menu Component — Theme-consistent dropdown menus.
 */
import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface MenuItem {
  label: string;
  keybinding?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  icon?: string;
  checked?: boolean;
}

interface DropdownMenuProps {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ items, x, y, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Detect light theme for hover colors
  const rootStyle = getComputedStyle(document.documentElement);
  const bgColor = rootStyle.getPropertyValue('--theme-bg').trim();
  const isLight = bgColor && !bgColor.startsWith('#1') && !bgColor.startsWith('#0') && bgColor !== '#1e1e1e' && bgColor !== '#252526';
  const hoverBg = isLight ? '#d9d9d9' : 'var(--theme-bg-active)';
  const hoverFg = isLight ? '#000000' : 'var(--theme-accent-fg)';

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        ref.current.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
      if (rect.bottom > window.innerHeight) {
        ref.current.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[200px] rounded-md shadow-2xl py-1 animate-scale-in"
      style={{
        left: x, top: y,
        background: 'var(--theme-bg-tertiary)',
        border: '1px solid var(--theme-border-light)',
      }}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="h-px my-1 mx-2" style={{ background: 'var(--theme-border-light)' }} />;
        }
        return (
          <button
            key={i}
            className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-left"
            style={{
              color: item.disabled ? 'var(--theme-fg-dim)' : 'var(--theme-fg)',
              cursor: item.disabled ? 'default' : 'pointer',
              background: 'transparent',
              border: 'none',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) {
                e.currentTarget.style.background = hoverBg;
                e.currentTarget.style.color = hoverFg;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = item.disabled ? 'var(--theme-fg-dim)' : 'var(--theme-fg)';
            }}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            <span className="flex items-center gap-2">
              {/* Checkmark indicator for checked items */}
              <span className="w-4 flex-shrink-0" style={{ color: 'var(--theme-fg)' }}>
                {item.checked !== undefined && item.checked && (
                  <Icon name="check" size={14} />
                )}
              </span>
              <span>{item.label}</span>
            </span>
            <span className="flex items-center gap-2">
              {item.keybinding && (
                <kbd className="text-[10px]" style={{ color: 'var(--theme-fg-muted)' }}>{item.keybinding}</kbd>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};
