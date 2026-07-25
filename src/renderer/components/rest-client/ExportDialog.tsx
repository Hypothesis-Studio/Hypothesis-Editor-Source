/**
 * REST Client - Export Dialog
 */
import React, { useState } from 'react';
import type { ExportFormat } from '../../../shared/types/rest-client';
import { Icon } from '../common/Icon';
import { ModalShell, modalStyles as S } from '../common/ModalShell';
import { useRestClientStore } from '../../stores/restClientStore';

const FMTS: Array<{ value: ExportFormat; label: string; desc: string }> = [
  { value: 'rest_client', label: 'REST Client', desc: 'Native format' },
  { value: 'postman_v2.1', label: 'Postman v2.1', desc: 'Postman compatible' },
  { value: 'openapi_3', label: 'OpenAPI 3.x', desc: 'API spec' },
  { value: 'curl', label: 'cURL', desc: 'Terminal commands' },
  { value: 'har', label: 'HAR', desc: 'HTTP Archive' },
];

export const ExportDialog: React.FC = () => {
  const { collections, exportCollections, setShowExportDialog } = useRestClientStore();
  const [format, setFormat] = useState<ExportFormat>('rest_client');
  const [selIds, setSelIds] = useState<Set<string>>(new Set(collections.map(c => c.id)));
  const [exported, setExported] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggle = (id: string) => setSelIds(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });
  const handleExport = async () => { const r = await exportCollections(format); setExported(r); };
  const handleCopy = async () => {
    if (exported) { await navigator.clipboard.writeText(exported); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  };
  const handleDownload = () => {
    if (!exported) return;
    const ext = format === 'curl' ? 'sh' : format === 'har' ? 'har' : 'json';
    const blob = new Blob([exported], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rest-client-export.${ext}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalShell
      title="Export Collections"
      icon="download"
      width={600}
      onClose={() => setShowExportDialog(false)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={S.label}>Collections</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflow: 'auto' }}>
            {collections.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={selIds.has(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
                <span style={{ color: 'var(--theme-fg-muted)', fontSize: 10 }}>({c.requests.length})</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label style={S.label}>Format</label>
          <select value={format} onChange={e => setFormat(e.target.value as ExportFormat)} style={S.select}>
            {FMTS.map(f => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
          </select>
        </div>
        <button onClick={handleExport} style={S.btnPrimary}>Export</button>
        {exported && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button onClick={handleCopy} style={S.btnGhost}>
                <Icon name={copied ? 'check' : 'copy'} size={12} />{copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={handleDownload} style={S.btnGhost}>
                <Icon name="download" size={12} /> Download
              </button>
            </div>
            <textarea readOnly value={exported} style={{ ...S.textarea, minHeight: 200 }} />
          </div>
        )}
      </div>
    </ModalShell>
  );
};
