/**
 * TunnelForm - Inline form for opening a new tunnel port.
 * Compact single-row design similar to VSCode's "Forward a Port" row.
 */
import React, { useRef, useCallback } from 'react';
import { useTunnelStore } from '../../stores/tunnelStore';

export const TunnelForm: React.FC = () => {
  const {
    portInput, labelInput, subdomainInput, autoReconnect, isLoading, tunnels,
    setPortInput, setLabelInput, setSubdomainInput, setAutoReconnect,
    tunnelProvider, setTunnelProvider,
    openTunnel,
  } = useTunnelStore();

  const activeTunnelCount = tunnels.filter((t) => t.status !== 'closed').length;

  const portRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(portInput.trim(), 10);
    if (!portInput.trim() || isNaN(port) || port < 1 || port > 65535) {
      portRef.current?.focus();
      return;
    }
    await openTunnel({
      localPort: port,
      label: labelInput.trim() || undefined,
      subdomain: tunnelProvider === 'localtunnel' ? (subdomainInput.trim() || undefined) : undefined,
      autoReconnect,
      provider: tunnelProvider,
    });
    portRef.current?.focus();
  }, [portInput, labelInput, subdomainInput, autoReconnect, openTunnel]);

  const handlePortKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only allow digits
    if (
      e.key.length === 1 &&
      !/[0-9]/.test(e.key) &&
      !e.ctrlKey && !e.metaKey
    ) {
      e.preventDefault();
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        padding: '5px 8px',
        borderBottom: '1px solid var(--theme-border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Left: inputs + submit */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Port */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' }}>Port</label>
        <input
          ref={portRef}
          type="text"
          inputMode="numeric"
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          onKeyDown={handlePortKeyDown}
          placeholder="3000"
          maxLength={5}
          disabled={isLoading}
          style={inputStyle(80)}
        />
      </div>

      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' }}>Label</label>
        <input
          type="text"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="My App"
          maxLength={40}
          disabled={isLoading}
          style={inputStyle(110)}
        />
      </div>

      {/* Provider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' }}>Provider</label>
        <select
          value={tunnelProvider}
          onChange={(e) => setTunnelProvider(e.target.value as 'localtunnel' | 'cloudflare')}
          disabled={isLoading}
          style={{ ...inputStyle(120), height: 22, padding: '0 4px' }}
        >
          <option value="cloudflare">Cloudflare</option>
          <option value="localtunnel">LocalTunnel</option>
        </select>
      </div>

      {/* Subdomain (localtunnel only) */}
      {tunnelProvider === 'localtunnel' && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={{ fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap' }}>Subdomain</label>
        <input
          type="text"
          value={subdomainInput}
          onChange={(e) => setSubdomainInput(e.target.value.replace(/[^a-z0-9-]/g, ''))}
          placeholder="my-app (optional)"
          maxLength={40}
          disabled={isLoading}
          style={inputStyle(140)}
        />
      </div>
      )}

      {/* Auto-reconnect toggle */}
      <label style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 11, color: 'var(--theme-fg-muted)', cursor: 'pointer', userSelect: 'none',
      }}>
        <input
          type="checkbox"
          checked={autoReconnect}
          onChange={(e) => setAutoReconnect(e.target.checked)}
          disabled={isLoading}
          style={{ accentColor: 'var(--theme-accent)', cursor: 'pointer' }}
        />
        Auto-reconnect
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !portInput.trim()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 10px',
          fontSize: 11,
          fontWeight: 500,
          background: portInput.trim() && !isLoading ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
          color: portInput.trim() && !isLoading ? '#fff' : 'var(--theme-fg-muted)',
          border: 'none',
          borderRadius: 4,
          cursor: portInput.trim() && !isLoading ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
      >
        {isLoading ? (
          <SpinnerIcon />
        ) : (
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1={12} y1={5} x2={12} y2={19} />
            <line x1={5} y1={12} x2={19} y2={12} />
          </svg>
        )}
        Forward Port
      </button>
      </div>

      {/* Right: count + icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <span style={{
          fontSize: 11,
          fontWeight: activeTunnelCount > 0 ? 600 : 400,
          color: activeTunnelCount > 0 ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
          minWidth: 8,
          textAlign: 'right',
        }}>
          {activeTunnelCount}
        </span>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
          stroke={activeTunnelCount > 0 ? 'var(--theme-accent)' : 'currentColor'}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={{ color: activeTunnelCount > 0 ? 'var(--theme-accent)' : 'var(--theme-fg-muted)', flexShrink: 0 }}
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>
    </form>
  );
};

const inputStyle = (width: number): React.CSSProperties => ({
  width,
  height: 22,
  padding: '0 6px',
  fontSize: 11,
  background: 'var(--theme-input-bg, var(--theme-bg-secondary))',
  color: 'var(--theme-fg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 3,
  outline: 'none',
});

const SpinnerIcon: React.FC = () => (
  <svg
    width={11} height={11} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
    style={{ animation: 'spin 0.8s linear infinite' }}
  >
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);
