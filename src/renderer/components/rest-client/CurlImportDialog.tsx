/**
 * REST Client - cURL Import Dialog
 */
import React, { useState } from 'react';
import { Icon } from '../common/Icon';
import { ModalShell, modalStyles as S } from '../common/ModalShell';
import { useRestClientStore } from '../../stores/restClientStore';

export const CurlImportDialog: React.FC = () => {
  const { importCurl, setShowCurlImport } = useRestClientStore();
  const [curl, setCurl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!curl.trim()) return;
    setLoading(true); setError(null);
    try { await importCurl(curl); setShowCurlImport(false); }
    catch (err: any) { setError(err.message || 'Failed to parse cURL'); }
    finally { setLoading(false); }
  };

  const handlePaste = async () => {
    try { const t = await navigator.clipboard.readText(); if (t.trim().startsWith('curl ')) setCurl(t); } catch {}
  };

  return (
    <ModalShell
      title="Import from cURL"
      icon="terminal"
      width={560}
      onClose={() => setShowCurlImport(false)}
      footer={<>
        <button onClick={() => setShowCurlImport(false)} style={S.btnSecondary}>Cancel</button>
        <button onClick={handleImport} disabled={loading || !curl.trim()} style={{ ...S.btnPrimary, opacity: loading || !curl.trim() ? 0.5 : 1 }}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--theme-fg-muted)' }}>
          Paste a cURL command to import as a request.
        </div>
        <button onClick={handlePaste} style={{ ...S.btnGhost, color: 'var(--theme-accent)' }}>
          <Icon name="copy" size={12} /> Paste from clipboard
        </button>
        <textarea
          value={curl}
          onChange={e => setCurl(e.target.value)}
          placeholder={`curl -X POST https://api.example.com/data \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "test"}'`}
          style={{ ...S.textarea, minHeight: 160 }}
          rows={8}
        />
        {error && <div style={{ color: 'var(--theme-error, #f87171)', fontSize: 12 }}>{error}</div>}
      </div>
    </ModalShell>
  );
};
