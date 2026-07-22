/**
 * Common UI Components - Shared reusable UI components.
 */
import React, { forwardRef } from 'react';

// ============================================================================
// Icon Component
// ============================================================================

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const iconPaths: Record<string, string> = {
  'file': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  'folder': 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  'search': 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  'terminal': 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'git': 'M13 10V3L4 14h7v7l9-11h-7z',
  'settings': 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  'close': 'M6 18L18 6M6 6l12 12',
  'plus': 'M12 4v16m8-8H4',
  'minus': 'M20 12H4',
  'chevron-right': 'M9 5l7 7-7 7',
  'chevron-down': 'M19 9l-7 7-7-7',
  'refresh': 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  'copy': 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3',
  'trash': 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  'edit': 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  'save': 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  'warning': 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  'error': 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  'info': 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  'check': 'M5 13l4 4L19 7',
  'x': 'M6 18L18 6M6 6l12 12',
  'maximize': 'M4 4h16v16H4z',
  'minimize': 'M20 12H4',
  'restore': 'M8 8h8v8H8z M4 4h4v1H5v3H4V4z M16 4h4v4h-1V5h-3V4z M20 16v4h-4v-1h3v-3h1z M8 20H4v-4h1v3h3v1z',
};

export const Icon: React.FC<IconProps> = ({ name, size = 16, className = '' }) => {
  const path = iconPaths[name];
  if (!path) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
};

// ============================================================================
// Button Component
// ============================================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, loading, children, className = '', ...props }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'text-white',
      secondary: 'text-white',
      ghost: 'text-white',
      danger: 'text-white',
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs gap-1',
      md: 'px-3 py-1.5 text-sm gap-1.5',
      lg: 'px-4 py-2 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon ? (
          icon
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// ============================================================================
// Input Component
// ============================================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, className = '', ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--theme-fg-muted)' }}>
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={`w-full rounded px-3 py-1.5 text-sm outline-none ${icon ? 'pl-8' : ''} ${className}`}
          style={{
            background: 'var(--theme-bg-tertiary)',
            color: 'var(--theme-fg)',
            border: error ? '1px solid var(--theme-error)' : '1px solid var(--theme-bg-tertiary)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = error ? 'var(--theme-error)' : 'var(--theme-bg-tertiary)'; }}
          {...props}
        />
        {error && <p className="mt-1 text-xs" style={{ color: 'var(--theme-error)' }}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// Tooltip Component
// ============================================================================

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top', delay = 300 }) => {
  const [show, setShow] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setShow(false);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {children}
      {show && (
        <div className={`absolute z-50 px-2 py-1 text-xs rounded shadow-lg whitespace-nowrap ${positionClasses[position]}`} style={{ color: 'var(--theme-fg)', background: 'var(--theme-bg)', border: '1px solid var(--theme-border-light)' }}>
          {content}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Badge Component
// ============================================================================

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  const variantStyles = {
    default: { background: 'var(--theme-bg-tertiary)', color: 'white' },
    success: { background: 'var(--theme-success)', color: 'white' },
    warning: { background: 'var(--theme-warning)', color: 'black' },
    error: { background: 'var(--theme-error)', color: 'white' },
  };

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-full ${className}" style={variantStyles[variant]}>
      {children}
    </span>
  );
};

// ============================================================================
// Spinner Component
// ============================================================================

interface SpinnerProps {
  size?: number;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 20, className = '' }) => {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ============================================================================
// Divider Component
// ============================================================================

interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({ orientation = 'horizontal', className = '' }) => {
  return (
    <div
      className={`${orientation === 'horizontal' ? 'h-px w-full' : 'w-px h-full'} ${className}`}
      style={{ background: 'var(--theme-border)' }}
    />
  );
};

// ============================================================================
// EmptyState Component
// ============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && <div className="mb-4" style={{ color: 'var(--theme-fg-muted)' }}>{icon}</div>}
      <h3 className="text-sm font-medium mb-1" style={{ color: 'var(--theme-fg)' }}>{title}</h3>
      {description && <p className="text-xs mb-4" style={{ color: 'var(--theme-fg-muted)' }}>{description}</p>}
      {action}
    </div>
  );
};
