/**
 * ConnectionDialog - Create/edit database connection
 * Uses ModalShell for consistent styling with the rest of the app.
 */
import React, { useState, useEffect } from 'react';
import { ModalShell, modalStyles } from '../common/ModalShell';
import type { DatabaseConnection, DatabaseConnectionConfig, DatabaseDriver } from '../../../shared/types/database';
import { useDBStore } from '../../stores/dbStore';

interface ConnectionDialogProps {
  connection?: DatabaseConnection;
  onClose: () => void;
}

const DRIVERS: { value: DatabaseDriver; label: string; desc: string }[] = [
  { value: 'sqlite',     label: 'SQLite',     desc: 'Local file-based database' },
  { value: 'postgresql', label: 'PostgreSQL', desc: 'postgres / supabase / neon' },
  { value: 'mysql',      label: 'MySQL',      desc: 'MySQL 5.7+' },
  { value: 'mariadb',    label: 'MariaDB',    desc: 'MariaDB 10+' },
];

const DEFAULT_PORTS: Record<DatabaseDriver, number> = {
  sqlite: 0, postgresql: 5432, mysql: 3306, mariadb: 3306,
};

const S = {
  field: { marginBottom: 14 } as React.CSSProperties,
  row: { display: 'flex', gap: 10 } as React.CSSProperties,
  driverGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16,
  } as React.CSSProperties,
  driverBtn: (active: boolean): React.CSSProperties => ({
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
    border: `1px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
    background: active ? 'rgba(var(--theme-accent-rgb, 0,122,204),0.1)' : 'var(--theme-bg)',
    transition: 'all 0.12s',
  }),
  driverBtnName: (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: 600,
    color: active ? 'var(--theme-accent)' : 'var(--theme-fg)',
    display: 'block', marginBottom: 2,
  }),
  driverBtnDesc: {
    fontSize: 10, color: 'var(--theme-fg-muted)', display: 'block',
  } as React.CSSProperties,
  sslRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
  } as React.CSSProperties,
  sslLabel: {
    fontSize: 12, color: 'var(--theme-fg)', cursor: 'pointer',
  } as React.CSSProperties,
  testResult: (ok: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '6px 10px', borderRadius: 5,
    background: ok ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
    color: ok ? '#3fb950' : '#f85149',
    border: `1px solid ${ok ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`,
    marginBottom: 4,
  }),
  browseBtn: {
    ...modalStyles.btnSecondary,
    padding: '6px 12px', whiteSpace: 'nowrap' as const, flexShrink: 0,
  } as React.CSSProperties,
  sectionDivider: {
    borderTop: '1px solid var(--theme-border)', margin: '4px 0 14px',
  } as React.CSSProperties,
};

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({ connection, onClose }) => {
  const { createConnection, updateConnection, testConnection } = useDBStore();

  const [name,     setName]     = useState(connection?.name     || '');
  const [driver,   setDriver]   = useState<DatabaseDriver>(connection?.driver || 'sqlite');
  const [filePath, setFilePath] = useState(connection?.filePath || '');
  const [host,     setHost]     = useState(connection?.host     || 'localhost');
  const [port,     setPort]     = useState(connection?.port     || DEFAULT_PORTS[driver]);
  const [database, setDatabase] = useState(connection?.database || '');
  const [username, setUsername] = useState(connection?.username || '');
  const [password, setPassword] = useState(connection?.password || '');
  const [ssl,      setSsl]      = useState(connection?.ssl      || false);

  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; latency?: number } | null>(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (!connection) setPort(DEFAULT_PORTS[driver]);
    setTestResult(null);
  }, [driver]);

  const buildConfig = (): DatabaseConnectionConfig => ({
    name, driver, filePath, host, port, database, username, password, ssl,
  });

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    const result = await testConnection(buildConfig());
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (connection) {
      await updateConnection(connection.id, buildConfig());
    } else {
      await createConnection(buildConfig());
    }
    setSaving(false);
    onClose();
  };

  const handleBrowse = async () => {
    const api = (window as any).api;
    const result = await api.file.dialogOpen({
      title: 'Open SQLite File',
      filters: [
        { name: 'SQLite', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) setFilePath(result.filePaths[0]);
  };

  const footer = (
    <>
      <button style={modalStyles.btnSecondary} onClick={onClose}>Cancel</button>
      <button
        style={{ ...modalStyles.btnSecondary, opacity: testing ? 0.6 : 1 }}
        onClick={handleTest}
        disabled={testing}
      >
        {testing ? 'Testing…' : 'Test Connection'}
      </button>
      <button
        style={{ ...modalStyles.btnPrimary, opacity: saving || !name.trim() ? 0.6 : 1 }}
        onClick={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? 'Saving…' : connection ? 'Save Changes' : 'Create'}
      </button>
    </>
  );

  return (
    <ModalShell
      title={connection ? 'Edit Connection' : 'New Database Connection'}
      icon="database"
      width={500}
      onClose={onClose}
      footer={footer}
    >
      {/* Connection name */}
      <div style={S.field}>
        <label style={modalStyles.label}>CONNECTION NAME</label>
        <input
          style={modalStyles.input}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. My Local DB"
          autoFocus
        />
      </div>

      {/* Driver selector */}
      <div style={{ marginBottom: 4 }}>
        <label style={modalStyles.label}>DRIVER</label>
      </div>
      <div style={S.driverGrid}>
        {DRIVERS.map(d => (
          <button
            key={d.value}
            style={S.driverBtn(driver === d.value)}
            onClick={() => setDriver(d.value)}
          >
            <span style={S.driverBtnName(driver === d.value)}>{d.label}</span>
            <span style={S.driverBtnDesc}>{d.desc}</span>
          </button>
        ))}
      </div>

      <div style={S.sectionDivider} />

      {/* SQLite: file path */}
      {driver === 'sqlite' ? (
        <div style={S.field}>
          <label style={modalStyles.label}>FILE PATH</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ ...modalStyles.input, flex: 1 }}
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              placeholder="/path/to/database.sqlite"
            />
            <button style={S.browseBtn} onClick={handleBrowse}>Browse…</button>
          </div>
        </div>
      ) : (
        <>
          {/* Host + Port */}
          <div style={{ ...S.row, ...S.field }}>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>HOST</label>
              <input
                style={modalStyles.input}
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={modalStyles.label}>PORT</label>
              <input
                style={modalStyles.input}
                type="number"
                value={port}
                onChange={e => setPort(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Database name */}
          <div style={S.field}>
            <label style={modalStyles.label}>DATABASE</label>
            <input
              style={modalStyles.input}
              value={database}
              onChange={e => setDatabase(e.target.value)}
              placeholder="my_database"
            />
          </div>

          {/* Username + Password */}
          <div style={{ ...S.row, ...S.field }}>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>USERNAME</label>
              <input
                style={modalStyles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="root"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={modalStyles.label}>PASSWORD</label>
              <input
                style={modalStyles.input}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* SSL toggle */}
          <div style={S.sslRow}>
            <input
              type="checkbox"
              id="db-ssl"
              checked={ssl}
              onChange={e => setSsl(e.target.checked)}
            />
            <label htmlFor="db-ssl" style={S.sslLabel}>Use SSL / TLS</label>
          </div>
        </>
      )}

      {/* Test result */}
      {testResult && (
        <div style={S.testResult(testResult.success)}>
          {testResult.success
            ? `✓ Connection successful${testResult.latency ? ` · ${testResult.latency} ms` : ''}`
            : `✗ ${testResult.error}`
          }
        </div>
      )}
    </ModalShell>
  );
};
