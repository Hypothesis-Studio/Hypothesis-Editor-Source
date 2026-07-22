/**
 * WindowControls - Minimize / Maximize / Close buttons for frameless Electron window.
 */
import React from 'react';
import { useAppStore } from '../../stores/appStore';

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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeWidth={2} d="M20 12H4" />
        </svg>
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="8" y="8" width="12" height="12" rx="1" strokeWidth={2} />
            <path d="M4 16V6a1 1 0 011-1h10" strokeWidth={2} />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="4" y="4" width="16" height="16" rx="1" strokeWidth={2} />
          </svg>
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
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
