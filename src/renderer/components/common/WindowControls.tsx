/**
 * WindowControls - Minimize / Maximize / Close buttons for frameless Electron window.
 */
import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { Icon } from './Icon';

export const WindowControls: React.FC = () => {
  const { isMaximized } = useAppStore();

  return (
    <div className="flex items-center no-drag">
      <button
        onClick={() => window.api.window.minimize()}
        className="w-11 h-9 flex items-center justify-center"
        style={{ color: 'var(--theme-fg)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
        title="Minimize"
      >
        <Icon name="chrome-minimize" size={16} />
      </button>
      <button
        onClick={() => window.api.window.maximize()}
        className="w-11 h-9 flex items-center justify-center"
        style={{ color: 'var(--theme-fg)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
        title={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          <Icon name="chrome-restore" size={16} />
        ) : (
          <Icon name="chrome-maximize" size={16} />
        )}
      </button>
      <button
        onClick={() => window.api.window.close()}
        className="w-11 h-9 flex items-center justify-center"
        style={{ color: 'var(--theme-fg)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-error)'; e.currentTarget.style.color = '#ffffff'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--theme-fg)'; }}
        title="Close"
      >
        <Icon name="chrome-close" size={16} />
      </button>
    </div>
  );
};
