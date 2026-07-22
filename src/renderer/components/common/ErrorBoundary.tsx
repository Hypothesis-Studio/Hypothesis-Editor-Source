/**
 * ErrorBoundary - Catches React render errors and shows a recovery UI instead of blank screen.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-8" style={{ background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm mb-6 text-center max-w-md" style={{ color: 'var(--theme-fg-muted)' }}>
            The editor encountered an unexpected error. You can try reloading or resetting the workspace.
          </p>

          <div className="rounded-lg p-4 mb-6 max-w-lg w-full overflow-auto max-h-[200px]" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)' }}>
            <p className="text-xs font-mono" style={{ color: 'var(--theme-error)' }}>
              {this.state.error?.message || 'Unknown error'}
            </p>
            {this.state.error?.stack && (
              <pre className="mt-2 text-[10px] whitespace-pre-wrap break-all" style={{ color: 'var(--theme-fg-muted)' }}>
                {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
              </pre>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={this.handleReload} className="btn btn-primary">
              Reload Editor
            </button>
            <button onClick={this.handleReset} className="btn btn-secondary">
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
