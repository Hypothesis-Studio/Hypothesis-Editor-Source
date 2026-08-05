/**
 * SnippetManagerPanel.tsx
 * Professional snippet manager - clean design matching app theme.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { useSnippetStore } from '../../stores/snippetStore';
import { showConfirm } from '../../stores/dialogStore';
import { Icon } from '../common/Icon';
import { GlobalDialog } from '../common/GlobalDialog';
import type { Snippet } from '../../../shared/types';

interface Props { onClose: () => void; }

const LANGUAGES = [
  '', 'typescript', 'typescriptreact', 'javascript', 'javascriptreact',
  'python', 'go', 'rust', 'java', 'c', 'cpp', 'csharp', 'php', 'ruby',
  'html', 'css', 'scss', 'json', 'yaml', 'markdown', 'sql', 'shell', 'plaintext',
];
const LANG_LABELS: Record<string, string> = {
  '': 'All Languages', typescript: 'TypeScript', typescriptreact: 'TSX',
  javascript: 'JavaScript', javascriptreact: 'JSX', python: 'Python',
  go: 'Go', rust: 'Rust', java: 'Java', c: 'C', cpp: 'C++', csharp: 'C#',
  php: 'PHP', ruby: 'Ruby', html: 'HTML', css: 'CSS', scss: 'SCSS',
  json: 'JSON', yaml: 'YAML', markdown: 'Markdown', sql: 'SQL',
  shell: 'Shell', plaintext: 'Plain Text',
};

// ── Detect app color scheme ──────────────────────────────────────
function getMonacoTheme(): string {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg').trim();
  if (!bg) return 'vs-dark';
  // Parse lightness: if hex, check brightness
  const hex = bg.replace('#', '');
  if (hex.length === 3 || hex.length === 6) {
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? 'vs' : 'vs-dark';
  }
  return 'vs-dark';
}

// ── Monaco body editor ────────────────────────────────────────────
const BodyEditor: React.FC<{ value: string; onChange: (v: string) => void; language?: string }> = ({ value, onChange, language }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const monacoTheme = getMonacoTheme();
    const ed = monaco.editor.create(containerRef.current, {
      value,
      language: language || 'plaintext',
      theme: monacoTheme,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      padding: { top: 10, bottom: 10 },
      contextmenu: false,
      scrollbar: { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 5 },
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      suggest: { showSnippets: false },
      tabSize: 2,
    });
    editorRef.current = ed;
    ed.onDidChangeModelContent(() => onChange(ed.getValue()));
    ed.onDidFocusEditorText(() => setFocused(true));
    ed.onDidBlurEditorText(() => setFocused(false));
    return () => { ed.dispose(); editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync value when changed externally (e.g. snippet selection changed)
  useEffect(() => {
    const ed = editorRef.current;
    if (ed && ed.getValue() !== value) ed.setValue(value);
  }, [value]);

  // Update language model when language prop changes
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (model) monaco.editor.setModelLanguage(model, language || 'plaintext');
  }, [language]);

  return (
    <div style={{
      borderRadius: 6,
      overflow: 'hidden',
      border: `1px solid ${focused ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
      boxShadow: focused ? '0 0 0 2px color-mix(in srgb, var(--theme-accent) 25%, transparent)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      <div ref={containerRef} style={{ height: 240 }} />
    </div>
  );
};

const emptyForm = (): Omit<Snippet, 'id' | 'isBuiltin'> => ({ name: '', prefix: '', body: '', description: '', scope: '', language: '' });

// ── Main panel ────────────────────────────────────────────────────
export const SnippetManagerPanel: React.FC<Props> = ({ onClose }) => {
  const { snippets, loaded, loadSnippets, addSnippet, updateSnippet, deleteSnippet, importVSCodeSnippets, exportVSCodeSnippets } = useSnippetStore();
  const [filterLang, setFilterLang] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Snippet, 'id' | 'isBuiltin'>>(emptyForm());
  const [isNew, setIsNew] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importScope, setImportScope] = useState('');
  const [importResult, setImportResult] = useState<{ added: number; errors: string[] } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => { loadSnippets(); }, [loadSnippets]);

  useEffect(() => {
    if (!selectedId) return;
    const s = snippets.find(x => x.id === selectedId);
    if (!s) return;
    setForm({ name: s.name, prefix: s.prefix, body: Array.isArray(s.body) ? s.body.join('\n') : s.body, description: s.description, scope: s.scope, language: s.language || '' });
    setFormDirty(false); setIsNew(false);
  }, [selectedId, snippets]);

  const filteredSnippets = snippets.filter(s => {
    if (filterLang && s.scope !== filterLang && s.language !== filterLang) return false;
    if (search) { const q = search.toLowerCase(); return s.name.toLowerCase().includes(q) || s.prefix.toLowerCase().includes(q) || s.description.toLowerCase().includes(q); }
    return true;
  });

  const handleNew = () => { setSelectedId(null); setForm(emptyForm()); setIsNew(true); setFormDirty(false); };

  const handleSelect = async (id: string) => {
    if (formDirty && (selectedId !== id || isNew)) {
      const ok = await showConfirm('Discard unsaved changes?', 'Unsaved Changes');
      if (!ok) return;
    }
    setSelectedId(id); setIsNew(false);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.prefix.trim()) { showToast('Name and prefix are required', 'error'); return; }
    if (isNew) {
      addSnippet(form); showToast('Snippet created'); setIsNew(false);
      const added = useSnippetStore.getState().snippets.slice(-1)[0];
      if (added) setSelectedId(added.id);
    } else if (selectedId) { updateSnippet(selectedId, form); showToast('Snippet saved'); }
    setFormDirty(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const s = snippets.find(x => x.id === selectedId);
    if (!s) return;
    const ok = await showConfirm(`Delete snippet "${s.name}"?`, 'Delete Snippet');
    if (!ok) return;
    deleteSnippet(selectedId); setSelectedId(null); setForm(emptyForm()); setIsNew(false);
    showToast('Snippet deleted');
  };

  const handleExport = () => {
    const json = exportVSCodeSnippets(filterLang || undefined);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filterLang ? `${filterLang}.code-snippets` : 'snippets.code-snippets';
    a.click(); URL.revokeObjectURL(url); showToast('Exported');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setImportText(ev.target?.result as string || ''); setImportResult(null); };
    reader.readAsText(file); e.target.value = '';
  };

  const handleImportApply = () => {
    if (!importText.trim()) return;
    const result = importVSCodeSnippets(importText, importScope);
    setImportResult(result);
    if (result.added > 0) showToast(`Imported ${result.added} snippet(s)`);
    else showToast('No snippets imported', 'error');
  };

  const patchForm = (patch: Partial<typeof form>) => { setForm(prev => ({ ...prev, ...patch })); setFormDirty(true); };
  const bodyStr = Array.isArray(form.body) ? form.body.join('\n') : form.body;
  const hasSelection = !!(selectedId || isNew);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', flexDirection: 'column', background: 'var(--theme-bg)' }}>

      {/* Top bar */}
      <div style={{ height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)', position: 'relative' }}>
        <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12, padding: '4px 0' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--theme-fg)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--theme-fg-muted)')}>
          <Icon name="arrow-left" size={14} /> Back to Editor
        </button>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="symbol-snippet" size={15} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)' }}>Snippets</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ActionButton icon="cloud-download" label="Import" onClick={() => { setShowImport(v => !v); setImportResult(null); }} active={showImport} />
          <ActionButton icon="export" label="Export" onClick={handleExport} />
          <div style={{ width: 1, height: 16, background: 'var(--theme-border)', margin: '0 2px' }} />
          <ActionButton icon="add" label="New Snippet" onClick={handleNew} primary />
        </div>
      </div>

      {/* Import drawer */}
      {showImport && (
        <div style={{ flexShrink: 0, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg-muted)' }}>Import .code-snippets</span>
            <select value={importScope} onChange={e => setImportScope(e.target.value)} style={selectSt()}>
              {LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l] ?? l}</option>)}
            </select>
            <label style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer', background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)' }}>
              Choose file… <input type="file" accept=".code-snippets,.json" style={{ display: 'none' }} onChange={handleImportFile} />
            </label>
            <button onClick={handleImportApply} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', fontSize: 12, fontWeight: 600, background: 'var(--theme-accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
              <Icon name="check" size={12} /> Apply
            </button>
          </div>
          <textarea value={importText} onChange={e => { setImportText(e.target.value); setImportResult(null); }} placeholder="…or paste .code-snippets JSON here" spellCheck={false}
            style={{ width: '100%', height: 72, padding: '6px 10px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', resize: 'none', outline: 'none', boxSizing: 'border-box' as const }} />
          {importResult && (
            <div style={{ fontSize: 12, color: importResult.added > 0 ? '#4ec9b0' : '#f48771' }}>
              {importResult.added > 0 && <span>✓ {importResult.added} snippet(s) imported. </span>}
              {importResult.errors.length > 0 && <span>{importResult.errors.slice(0, 3).join(' · ')}</span>}
            </div>
          )}
        </div>
      )}

      {/* Main body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Sidebar */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--theme-bg-secondary)', borderRight: '1px solid var(--theme-border)' }}>
          <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--theme-border)' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-fg-muted)', pointerEvents: 'none' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search snippets…"
                style={{ width: '100%', padding: '5px 8px 5px 28px', fontSize: 12, background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <select value={filterLang} onChange={e => setFilterLang(e.target.value)} style={{ ...selectSt(), width: '100%' }}>
              {LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l] ?? l}</option>)}
            </select>
          </div>
          <div style={{ padding: '5px 12px', fontSize: 11, color: 'var(--theme-fg-muted)', borderBottom: '1px solid var(--theme-border)' }}>
            {filteredSnippets.length} snippet{filteredSnippets.length !== 1 ? 's' : ''}
            {filterLang && <span style={{ marginLeft: 6, opacity: 0.7 }}>in {LANG_LABELS[filterLang]}</span>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!loaded && <Placeholder icon="loading" text="Loading…" />}
            {loaded && filteredSnippets.length === 0 && (
              <Placeholder icon="symbol-snippet" text={snippets.length === 0 ? 'No snippets yet' : 'No results'} sub={snippets.length === 0 ? 'Click New Snippet to get started' : 'Try a different search'} />
            )}
            {filteredSnippets.map(s => <SnippetRow key={s.id} snippet={s} selected={selectedId === s.id} onClick={() => handleSelect(s.id)} />)}
          </div>
        </div>

        {/* Editor pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--theme-bg)' }}>
          {!hasSelection ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, color: 'var(--theme-fg-muted)' }}>
              <Icon name="symbol-snippet" size={48} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 6 }}>No snippet selected</div>
                <div style={{ fontSize: 12 }}>Select one from the list, or click <strong>New Snippet</strong></div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--theme-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--theme-fg-muted)' }}>
                  {isNew ? 'New Snippet' : 'Edit Snippet'}
                </div>
                {!isNew && <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--theme-fg)', marginTop: 4 }}>{form.name || 'Untitled'}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', marginBottom: 20 }}>
                <Field label="Name" required>
                  <input value={form.name} onChange={e => patchForm({ name: e.target.value })} placeholder="My Snippet" style={inputSt()} />
                </Field>
                <Field label="Prefix" required hint="trigger word in editor">
                  <input value={form.prefix} onChange={e => patchForm({ prefix: e.target.value })} placeholder="mysnip" style={{ ...inputSt(), fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
                </Field>
                <Field label="Description">
                  <input value={form.description} onChange={e => patchForm({ description: e.target.value })} placeholder="Optional description" style={inputSt()} />
                </Field>
                <Field label="Language">
                  <select value={form.scope} onChange={e => patchForm({ scope: e.target.value, language: e.target.value })} style={{ ...selectSt(), width: '100%', padding: '6px 8px' }}>
                    {LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l] ?? l}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Body" hint="tab stops: ${1:value} · final cursor: $0">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px', background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', borderBottom: 'none', borderRadius: '6px 6px 0 0' }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--theme-fg-muted)' }}>
                      {LANG_LABELS[form.scope] || 'Plain Text'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', opacity: 0.6 }}>
                      {bodyStr.split('\n').length} lines
                    </span>
                  </div>
                  <div style={{ borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                    <BodyEditor value={bodyStr} onChange={v => patchForm({ body: v })} language={form.scope || undefined} />
                  </div>
                </div>
              </Field>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--theme-border)' }}>
                <button onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', fontSize: 12, fontWeight: 600, background: 'var(--theme-accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>
                  <Icon name={isNew ? 'add' : 'save'} size={13} />
                  {isNew ? 'Create Snippet' : 'Save Changes'}
                </button>
                {!isNew && selectedId && (
                  <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, background: 'transparent', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg-muted)', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e53e3e'; e.currentTarget.style.borderColor = '#e53e3e'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--theme-border)'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}>
                    <Icon name="trash" size={13} /> Delete
                  </button>
                )}
                {formDirty && <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)', marginLeft: 4 }}>● Unsaved changes</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500, color: '#fff', background: toast.type === 'error' ? '#e53e3e' : 'var(--theme-accent)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)', zIndex: 9999, pointerEvents: 'none' as const }}>
          <Icon name={toast.type === 'error' ? 'error-small' : 'check'} size={13} /> {toast.msg}
        </div>
      )}

      {/* Global dialog — needed here because SnippetManagerPanel renders as an early-return, outside the main App tree that normally hosts GlobalDialog */}
      <GlobalDialog />
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────

const SnippetRow: React.FC<{ snippet: Snippet; selected: boolean; onClick: () => void }> = ({ snippet, selected, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '8px 12px', background: selected ? 'var(--theme-list-active-bg, var(--theme-accent))' : hov ? 'var(--theme-bg-tertiary)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 3, borderLeft: selected ? '2px solid var(--theme-fg)' : '2px solid transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: '1px 5px', borderRadius: 3, background: selected ? 'rgba(255,255,255,0.18)' : 'var(--theme-bg)', color: selected ? '#fff' : 'var(--theme-accent-fg, #4ec9b0)', flexShrink: 0 }}>
          {snippet.prefix}
        </span>
        <span style={{ fontSize: 12, fontWeight: 500, color: selected ? '#fff' : 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {snippet.name}
        </span>
      </div>
      {snippet.description && (
        <span style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.65)' : 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 1 }}>
          {snippet.description}
        </span>
      )}
    </button>
  );
};

const Placeholder: React.FC<{ icon: string; text: string; sub?: string }> = ({ icon, text, sub }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, color: 'var(--theme-fg-muted)' }}>
    <Icon name={icon} size={32} />
    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--theme-fg)' }}>{text}</div>
    {sub && <div style={{ fontSize: 11 }}>{sub}</div>}
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({ label, required, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--theme-fg-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
      {label}
      {required && <span style={{ color: 'var(--theme-error, #f48771)' }}>*</span>}
      {hint && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.65, fontSize: 11 }}>— {hint}</span>}
    </label>
    {children}
  </div>
);

const ActionButton: React.FC<{ icon: string; label: string; onClick: () => void; active?: boolean; primary?: boolean }> = ({ icon, label, onClick, active, primary }) => {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={label} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: 12, fontWeight: primary ? 600 : 400, borderRadius: 4, cursor: 'pointer', border: primary ? 'none' : '1px solid var(--theme-border)', background: primary ? 'var(--theme-accent)' : (active || hov) ? 'var(--theme-bg-tertiary)' : 'transparent', color: primary ? '#fff' : (active || hov) ? 'var(--theme-fg)' : 'var(--theme-fg-muted)', transition: 'all 0.1s' }}>
      <Icon name={icon} size={13} /> {label}
    </button>
  );
};

function inputSt(): React.CSSProperties {
  return { width: '100%', padding: '6px 9px', fontSize: 13, background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
}

function selectSt(): React.CSSProperties {
  return { padding: '4px 8px', fontSize: 12, background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 4, color: 'var(--theme-fg)', cursor: 'pointer', outline: 'none' };
}
