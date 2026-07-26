/**
 * LiveServerForm - Inline form for starting a new live server.
 */
import React, { useRef, useCallback } from 'react';
import { useLiveServerStore } from '../../stores/liveServerStore';

const SpinnerIcon: React.FC = () => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

export const LiveServerForm: React.FC = () => {
  const {
    rootPathInput, portInput, labelInput, protocol, liveReload,
    openBrowser, spaMode, isLoading, servers,
    setRootPathInput, setPortInput, setLabelInput, setProtocol,
    setLiveReload, setOpenBrowser, setSpaMode,
    startServer, pickFolder,
  } = useLiveServerStore();

  const activeCount = servers.filter((s) => s.status === 'running').length;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPathInput.trim() || isLoading) return;
    await startServer({
      rootPath: rootPathInput.trim(),
      port: portInput.trim() ? parseInt(portInput.trim(), 10) : undefined,
      label: labelInput.trim() || undefined,
      protocol,
      liveReload,
      openBrowser,
      spaMode,
      cors: true,
    });
  }, [rootPathInput, portInput, labelInput, protocol, liveReload, openBrowser, spaMode, isLoading, startServer]);

  const canSubmit = !!rootPathInput.trim() && !isLoading;

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
      {/* Left: inputs + controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

        {/* Root path */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <input
            type="text"
            value={rootPathInput}
            onChange={(e) => setRootPathInput(e.target.value)}
            placeholder="Folder path..."
            disabled={isLoading}
            style={inputStyle(160)}
          />
          <button
            type="button"
            onClick={pickFolder}
            disabled={isLoading}
            title="Browse folder"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, padding: 0,
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
              borderRadius: 3, cursor: isLoading ? 'not-allowed' : 'pointer',
              color: 'var(--theme-fg-muted)',
            }}
            onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>

        {/* Port */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={labelStyle}>Port</label>
          <input
            type="text"
            inputMode="numeric"
            value={portInput}
            onChange={(e) => setPortInput(e.target.value.replace(/\D/g, ''))}
            placeholder="auto"
            maxLength={5}
            disabled={isLoading}
            style={inputStyle(60)}
          />
        </div>

        {/* Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={labelStyle}>Label</label>
          <input
            type="text"
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="My App"
            maxLength={40}
            disabled={isLoading}
            style={inputStyle(100)}
          />
        </div>

        {/* Protocol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <label style={labelStyle}>Protocol</label>
          <select
            value={protocol}
            onChange={(e) => setProtocol(e.target.value as 'http' | 'https')}
            disabled={isLoading}
            style={selectStyle}
          >
            <option value="http">HTTP</option>
            <option value="https">HTTPS</option>
          </select>
        </div>

        {/* Toggles */}
        <ToggleChip label="Live Reload" active={liveReload} onToggle={() => setLiveReload(!liveReload)} disabled={isLoading} />
        <ToggleChip label="SPA" active={spaMode} onToggle={() => setSpaMode(!spaMode)} disabled={isLoading} title="Serve index.html for all 404s" />
        <ToggleChip label="Open" active={openBrowser} onToggle={() => setOpenBrowser(!openBrowser)} disabled={isLoading} title="Auto-open in browser on start" />

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', fontSize: 11, fontWeight: 500,
            background: canSubmit ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
            color: canSubmit ? '#fff' : 'var(--theme-fg-muted)',
            border: 'none', borderRadius: 4,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s', flexShrink: 0,
          }}
        >
          {isLoading ? <SpinnerIcon /> : (
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
            </svg>
          )}
          Start Server
        </button>
      </div>

      {/* Right: active count + icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <span style={{
          fontSize: 11,
          fontWeight: activeCount > 0 ? 600 : 400,
          color: activeCount > 0 ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
          minWidth: 8, textAlign: 'right',
        }}>
          {activeCount}
        </span>
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
          stroke={activeCount > 0 ? 'var(--theme-accent)' : 'currentColor'}
          strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={{ color: activeCount > 0 ? 'var(--theme-accent)' : 'var(--theme-fg-muted)', flexShrink: 0 }}
        >
          <circle cx={12} cy={12} r={10} />
          <line x1={2} y1={12} x2={22} y2={12} />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
    </form>
  );
};

// ── Toggle chip ───────────────────────────────────────────────────────────────

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  title?: string;
}> = ({ label, active, onToggle, disabled, title }) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    title={title}
    style={{
      padding: '2px 7px', fontSize: 10, fontWeight: active ? 600 : 400,
      background: active ? 'var(--theme-accent)20' : 'var(--theme-bg-tertiary)',
      color: active ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
      border: `1px solid ${active ? 'var(--theme-accent)40' : 'var(--theme-border)'}`,
      borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all 0.15s', flexShrink: 0,
    }}
  >
    {label}
  </button>
);

// ── Styles ────────────────────────────────────────────────────────────────────

const inputStyle = (width: number): React.CSSProperties => ({
  width,
  height: 22, padding: '0 6px', fontSize: 11,
  background: 'var(--theme-input-bg, var(--theme-bg-secondary))',
  color: 'var(--theme-fg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 3, outline: 'none',
  fontFamily: 'inherit',
});

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--theme-fg-muted)', whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  height: 22, padding: '0 4px', fontSize: 11,
  background: 'var(--theme-input-bg, var(--theme-bg-secondary))',
  color: 'var(--theme-fg)',
  border: '1px solid var(--theme-border)',
  borderRadius: 3, outline: 'none', cursor: 'pointer',
  fontFamily: 'inherit',
};
