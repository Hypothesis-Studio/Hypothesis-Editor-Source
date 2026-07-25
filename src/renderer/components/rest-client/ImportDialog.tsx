/**
 * REST Client - Import Dialog
 */
import React, { useState, useRef } from 'react';
import type { ImportFormat } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { ModalShell, modalStyles as S } from '../common/ModalShell';
import { useRestClientStore } from '../../stores/restClientStore';

const FORMATS: Array<{ value: ImportFormat; label: string; desc: string }> = [
  { value: 'postman_v2.1', label: 'Postman v2.1', desc: 'Postman collections' },
  { value: 'postman_v2', label: 'Postman v2.0', desc: 'Legacy Postman' },
  { value: 'openapi_3', label: 'OpenAPI 3.x', desc: 'OpenAPI spec' },
  { value: 'swagger_2', label: 'Swagger 2.0', desc: 'Legacy Swagger' },
  { value: 'insomnia', label: 'Insomnia', desc: 'Insomnia export' },
  { value: 'har', label: 'HAR', desc: 'HTTP Archive' },
  { value: 'rest_client', label: 'REST Client', desc: 'Native format' },
];

export const ImportDialog: React.FC = () => {
  const { importCollections, setShowImportDialog } = useRestClientStore();
  const [format, setFormat] = useState<ImportFormat>('postman_v2.1');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setContent(reader.result as string);
      try {
        const p = JSON.parse(reader.result as string);
        if (p.info?.schema?.includes('postman')) setFormat(p.info.schema.includes('v2.1') ? 'postman_v2.1' : 'postman_v2');
        else if (p.openapi) setFormat('openapi_3');
        else if (p.swagger) setFormat('swagger_2');
        else if (p.log?.version) setFormat('har');
        else if (p.__export_format || p.resources) setFormat('insomnia');
      } catch {}
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!content.trim()) { setError('Provide content to import'); return; }
    setLoading(true); setError(null); setSuccess(null);
    try {
      await importCollections(content, format);
      setSuccess('Import successful!');
      setTimeout(() => setShowImportDialog(false), 1000);
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title="Import Collection"
      icon="upload"
      width={600}
      onClose={() => setShowImportDialog(false)}
      footer={<>
        <button onClick={() => setShowImportDialog(false)} style={S.btnSecondary}>Cancel</button>
        <button onClick={handleImport} disabled={loading || !content.trim()} style={{ ...S.btnPrimary, opacity: loading || !content.trim() ? 0.5 : 1 }}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={S.label}>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value as ImportFormat)} style={S.select}>
            {FORMATS.map(f => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
          </select>
        </div>
        <div>
          <label style={S.label}>File</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => fileRef.current?.click()} style={S.btnGhost}>
              <Icon name="upload" size={12} /> Choose File
            </button>
            <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>or paste below</span>
          </div>
          <input ref={fileRef} type="file" accept=".json,.har,.yaml,.yml" onChange={handleFile} style={{ display: 'none' }} />
        </div>
        <div>
          <label style={S.label}>Content</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Paste JSON here..."
            style={{ ...S.textarea, minHeight: 200 }}
          />
        </div>
        {error && <div style={{ color: 'var(--theme-error, #f87171)', fontSize: 12 }}>{error}</div>}
        {success && <div style={{ color: 'var(--theme-success, #4ade80)', fontSize: 12 }}>{success}</div>}
      </div>
    </ModalShell>
  );
};
