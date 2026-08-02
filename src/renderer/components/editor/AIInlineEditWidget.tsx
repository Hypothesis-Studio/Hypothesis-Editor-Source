/**
 * AIInlineEditWidget - Multi-cursor AI inline edit widget.
 *
 * Usage:
 *   - Trigger via context menu "AI Edit (Multi-Cursor)" or Ctrl+K Ctrl+K
 *   - Collects ALL current selections from the editor
 *   - Sends each selection to AI with a shared prompt
 *   - Shows per-selection diff preview inline
 *   - Apply / reject individually or all at once
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as monaco from 'monaco-editor';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SelectionEdit {
  id: string;
  index: number;
  range: monaco.IRange;
  originalText: string;
  proposedText: string | null;
  status: 'pending' | 'loading' | 'done' | 'error';
  error?: string;
}

interface AIInlineEditWidgetProps {
  editor: monaco.editor.IStandaloneCodeEditor;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rangeToKey(r: monaco.IRange): string {
  return `${r.startLineNumber}:${r.startColumn}-${r.endLineNumber}:${r.endColumn}`;
}

function buildDiff(original: string, proposed: string): Array<{ type: 'removed' | 'added' | 'context'; text: string }> {
  const oldLines = original.split('\n');
  const newLines = proposed.split('\n');
  const result: Array<{ type: 'removed' | 'added' | 'context'; text: string }> = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      result.push({ type: 'context', text: o ?? '' });
    } else {
      if (o !== undefined) result.push({ type: 'removed', text: o });
      if (n !== undefined) result.push({ type: 'added', text: n });
    }
  }
  return result;
}

function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ── AI call ────────────────────────────────────────────────────────────────────

async function callAI(prompt: string, selectionTexts: string[], language: string): Promise<string[]> {
  const api = (window as any).api;

  const configsResult = await api.agent.config.list();
  const configs: any[] = configsResult?.data ?? configsResult ?? [];
  if (!configs.length) throw new Error('No AI agent configured — add a provider in Settings → AI Agent');

  const { useSettingsStore } = await import('../../stores/settingsStore');
  const preferredId = useSettingsStore.getState().settings['git.commitMessageAgentId'] as string | undefined;
  const agentConfig = (preferredId ? configs.find((c: any) => c.id === preferredId) : null) ?? configs[0];

  const sessionResult = await api.agent.session.create(agentConfig.id, 'inline-edit');
  const sessionId = sessionResult?.data?.id ?? sessionResult?.id;
  if (!sessionId) throw new Error('Failed to create AI session');

  try {
    const systemMsg = [
      `You are a code editing assistant. The user will give you ${selectionTexts.length} code selection(s) and an edit instruction.`,
      `For each selection, output ONLY the edited code — no explanations, no markdown fences, no extra text.`,
      `Separate each selection's output with the exact delimiter: <<<SELECTION_BREAK>>>`,
      `Language: ${language}`,
      `Preserve indentation of the original selection.`,
      `Output exactly ${selectionTexts.length} section(s), in order.`,
    ].join('\n');

    const userMsg = [
      `Instruction: ${prompt}`,
      '',
      ...selectionTexts.map((text, i) => `Selection ${i + 1}:\n${text}`),
    ].join('\n\n');

    const fullPrompt = `${systemMsg}\n\n${userMsg}`;

    const result = await api.agent.chat.send(sessionId, fullPrompt, agentConfig.id);
    const content: string = result?.data?.content ?? result?.content ?? '';

    if (!content.trim()) throw new Error('AI returned empty response');

    const parts = content.split('<<<SELECTION_BREAK>>>').map((s: string) => s.trim());
    while (parts.length < selectionTexts.length) parts.push(selectionTexts[parts.length]);
    return parts.slice(0, selectionTexts.length);
  } finally {
    api.agent.session.delete(sessionId).catch(() => {});
  }
}

// ── Robot Icon (matches AI Agent activity bar icon) ────────────────────────────

const RobotIcon: React.FC<{ size?: number; color?: string }> = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color} style={{ flexShrink: 0 }}>
    <path d="M12 9H4C3.173 9 2.5 9.673 2.5 10.5V11C2.5 11.123 2.562 14 8 14C13.438 14 13.5 11.123 13.5 11V10.5C13.5 9.673 12.827 9 12 9ZM12.5 10.991C12.497 11.073 12.372 13 8 13C3.628 13 3.503 11.073 3.5 11V10.5C3.5 10.224 3.724 10 4 10H12C12.276 10 12.5 10.224 12.5 10.5V10.991ZM5.5 8H10.5C11.327 8 12 7.327 12 6.5V3.5C12 2.673 11.327 2 10.5 2H8.5V1.5C8.5 1.224 8.276 1 8 1C7.724 1 7.5 1.224 7.5 1.5V2H5.5C4.673 2 4 2.673 4 3.5V6.5C4 7.327 4.673 8 5.5 8ZM5 3.5C5 3.224 5.224 3 5.5 3H10.5C10.776 3 11 3.224 11 3.5V6.5C11 6.776 10.776 7 10.5 7H5.5C5.224 7 5 6.776 5 6.5V3.5ZM5.75 5C5.75 4.586 6.086 4.25 6.5 4.25C6.914 4.25 7.25 4.586 7.25 5C7.25 5.414 6.914 5.75 6.5 5.75C6.086 5.75 5.75 5.414 5.75 5ZM8.75 5C8.75 4.586 9.086 4.25 9.5 4.25C9.914 4.25 10.25 4.586 10.25 5C10.25 5.414 9.914 5.75 9.5 5.75C9.086 5.75 8.75 5.414 8.75 5Z"/>
  </svg>
);

const SpinnerIcon: React.FC = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
    style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
    <path d="M8 2a6 6 0 1 0 6 6" />
  </svg>
);

// ── Component ──────────────────────────────────────────────────────────────────

export const AIInlineEditWidget: React.FC<AIInlineEditWidgetProps> = ({ editor, onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [edits, setEdits] = useState<SelectionEdit[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'input' | 'review'>('input');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Collect all current selections on mount
  useEffect(() => {
    const selections = editor.getSelections() ?? [];
    const model = editor.getModel();
    if (!model || selections.length === 0) { onClose(); return; }

    const nonEmpty = selections.filter(s => !s.isEmpty());
    if (nonEmpty.length === 0) { onClose(); return; }

    const initialEdits: SelectionEdit[] = nonEmpty.map((sel, i) => ({
      id: `sel-${i}-${rangeToKey(sel)}`,
      index: i,
      range: sel,
      originalText: model.getValueInRange(sel),
      proposedText: null,
      status: 'pending',
    }));

    setEdits(initialEdits);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Read shortcut from store for placeholder hint
  const [shortcutHint, setShortcutHint] = useState('Ctrl+K Ctrl+K');
  useEffect(() => {
    import('../../stores/keyboardShortcutStore').then(({ useKeyboardShortcutStore }) => {
      const shortcuts = useKeyboardShortcutStore.getState().shortcuts;
      const sc = shortcuts.find(s => s.id === 'ai-inline-edit');
      if (sc) setShortcutHint(sc.currentKeys);
    });
  }, []);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || edits.length === 0 || isRunning) return;

    setIsRunning(true);
    setError(null);
    setEdits(prev => prev.map(e => ({ ...e, status: 'loading' })));

    try {
      const model = editor.getModel();
      const language = model?.getLanguageId() ?? 'plaintext';
      const selectionTexts = edits.map(e => e.originalText);

      const results = await callAI(prompt.trim(), selectionTexts, language);

      setEdits(prev => prev.map((e, i) => ({
        ...e,
        proposedText: results[i] ?? e.originalText,
        status: 'done',
      })));
      setPhase('review');
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setError(msg);
      setEdits(prev => prev.map(e => ({ ...e, status: 'error', error: msg })));
    } finally {
      setIsRunning(false);
    }
  }, [prompt, edits, isRunning, editor]);

  const applyEdit = useCallback((id: string) => {
    const edit = edits.find(e => e.id === id);
    if (!edit || edit.proposedText === null) return;
    editor.executeEdits('ai-inline-edit', [{ range: edit.range, text: edit.proposedText }]);
    setEdits(prev => prev.filter(e => e.id !== id));
    if (edits.length === 1) onClose();
  }, [edits, editor, onClose]);

  const rejectEdit = useCallback((id: string) => {
    setEdits(prev => prev.filter(e => e.id !== id));
    if (edits.length === 1) onClose();
  }, [edits, onClose]);

  const applyAll = useCallback(() => {
    const doneEdits = edits.filter(e => e.status === 'done' && e.proposedText !== null);
    if (doneEdits.length === 0) return;
    const sorted = [...doneEdits].sort((a, b) => {
      if (b.range.startLineNumber !== a.range.startLineNumber)
        return b.range.startLineNumber - a.range.startLineNumber;
      return b.range.startColumn - a.range.startColumn;
    });
    editor.executeEdits('ai-inline-edit-all', sorted.map(e => ({ range: e.range, text: e.proposedText! })));
    onClose();
  }, [edits, editor, onClose]);

  const rejectAll = useCallback(() => { onClose(); }, [onClose]);

  // Position widget near the first selection
  const [widgetStyle, setWidgetStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (edits.length === 0) return;
    const firstRange = edits[0].range;
    const coords = editor.getScrolledVisiblePosition({ lineNumber: firstRange.startLineNumber, column: firstRange.startColumn });
    const domNode = editor.getDomNode();
    if (!coords || !domNode) return;
    const rect = domNode.getBoundingClientRect();
    const top = rect.top + coords.top + 24;
    const left = Math.min(rect.left + coords.left, window.innerWidth - 520);
    setWidgetStyle({ position: 'fixed', top: Math.max(8, top), left: Math.max(8, left) });
  }, [edits.length > 0 ? edits[0].range.startLineNumber : 0]);

  const doneCount = edits.filter(e => e.status === 'done').length;
  const allDone = doneCount === edits.length && edits.length > 0;

  return (
    <div
      style={{
        ...widgetStyle,
        width: 480,
        background: 'var(--theme-bg-secondary)',
        border: '1px solid var(--theme-accent)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 99999,
        fontFamily: 'var(--theme-font-family, sans-serif)',
        fontSize: 12,
        overflow: 'hidden',
      }}
      onKeyDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'var(--theme-bg-tertiary)',
        borderBottom: '1px solid var(--theme-border)',
      }}>
        <RobotIcon size={14} color="var(--theme-accent)" />
        <span style={{ fontWeight: 600, color: 'var(--theme-fg)', fontSize: 11 }}>AI Edit</span>
        <span style={{
          marginLeft: 4, fontSize: 10, padding: '1px 6px', borderRadius: 10,
          background: 'var(--theme-accent)', color: '#fff', fontWeight: 600,
        }}>
          {edits.length} selection{edits.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', opacity: 0.6 }}>{shortcutHint}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: 2, marginLeft: 4 }}
          title="Close (Escape)"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
          </svg>
        </button>
      </div>

      {/* Input phase */}
      {phase === 'input' && (
        <div style={{ padding: 12 }}>
          {/* Selection previews */}
          <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {edits.map((e, i) => (
              <div key={e.id} style={{
                fontSize: 10, color: 'var(--theme-fg-muted)',
                background: 'var(--theme-bg-tertiary)', borderRadius: 4, padding: '3px 8px',
                fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <span style={{ color: 'var(--theme-accent)', marginRight: 6 }}>#{i + 1}</span>
                L{e.range.startLineNumber}
                {e.range.startLineNumber !== e.range.endLineNumber ? `-${e.range.endLineNumber}` : ''}
                {' · '}
                {truncate(e.originalText.replace(/\n/g, ' '), 60)}
              </div>
            ))}
          </div>

          <textarea
            ref={inputRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); }
              if (e.key === 'Escape') onClose();
            }}
            placeholder={`Describe what to change across all ${edits.length} selection(s)... (Enter to run, Shift+Enter for newline)`}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)',
              border: '1px solid var(--theme-border)', borderRadius: 4,
              padding: '6px 8px', fontSize: 12, resize: 'none', height: 60,
              outline: 'none', fontFamily: 'inherit',
            }}
          />

          {error && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--theme-error, #f87171)', padding: '4px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 4 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
            <button
              onClick={handleRun}
              disabled={!prompt.trim() || isRunning}
              style={{ ...primaryBtnStyle, opacity: (!prompt.trim() || isRunning) ? 0.5 : 1 }}
            >
              {isRunning
                ? <><SpinnerIcon /> Generating...</>
                : <><RobotIcon size={11} /> Run AI Edit</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Review phase */}
      {phase === 'review' && (
        <div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {edits.map((e, i) => (
              <div key={e.id} style={{ borderBottom: '1px solid var(--theme-border)', padding: '8px 12px' }}>
                {/* Selection header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, color: '#fff', background: 'var(--theme-accent)',
                    borderRadius: 10, padding: '1px 6px', fontWeight: 600,
                  }}>#{i + 1}</span>
                  <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
                    Line {e.range.startLineNumber}{e.range.startLineNumber !== e.range.endLineNumber ? `-${e.range.endLineNumber}` : ''}
                  </span>
                  <div style={{ flex: 1 }} />
                  {e.status === 'done' && (
                    <>
                      <button
                        onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                        style={{ ...secondaryBtnStyle, fontSize: 10, padding: '1px 6px' }}
                      >
                        {expandedId === e.id ? 'Hide diff' : 'Show diff'}
                      </button>
                      <button onClick={() => applyEdit(e.id)} style={{ ...primaryBtnStyle, fontSize: 10, padding: '2px 8px' }}>
                        Apply
                      </button>
                      <button onClick={() => rejectEdit(e.id)} style={{ ...dangerBtnStyle, fontSize: 10, padding: '2px 8px' }}>
                        Reject
                      </button>
                    </>
                  )}
                  {e.status === 'loading' && <SpinnerIcon />}
                  {e.status === 'error' && (
                    <span style={{ fontSize: 10, color: 'var(--theme-error, #f87171)' }}>Error</span>
                  )}
                </div>

                {/* Diff preview */}
                {expandedId === e.id && e.proposedText !== null && (
                  <div style={{
                    fontFamily: 'monospace', fontSize: 11, borderRadius: 4,
                    overflow: 'auto', maxHeight: 180,
                    border: '1px solid var(--theme-border)',
                  }}>
                    {buildDiff(e.originalText, e.proposedText).map((line, li) => (
                      <div key={li} style={{
                        padding: '1px 8px', whiteSpace: 'pre',
                        background: line.type === 'removed' ? 'rgba(239,68,68,0.15)'
                          : line.type === 'added' ? 'rgba(34,197,94,0.15)'
                          : 'transparent',
                        color: line.type === 'removed' ? '#f87171'
                          : line.type === 'added' ? '#4ade80'
                          : 'var(--theme-fg-muted)',
                      }}>
                        {line.type === 'removed' ? '- ' : line.type === 'added' ? '+ ' : '  '}
                        {line.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Compact proposed text when not expanded */}
                {expandedId !== e.id && e.proposedText !== null && (
                  <div style={{
                    fontSize: 10, fontFamily: 'monospace', color: 'var(--theme-fg-muted)',
                    background: 'var(--theme-bg-tertiary)', borderRadius: 4, padding: '3px 8px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <span style={{ color: '#4ade80', marginRight: 4 }}>-&gt;</span>
                    {truncate(e.proposedText.replace(/\n/g, ' '), 80)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div style={{
            display: 'flex', gap: 6, padding: '8px 12px',
            borderTop: '1px solid var(--theme-border)',
            background: 'var(--theme-bg-tertiary)',
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)' }}>
              {doneCount} of {edits.length} ready
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={rejectAll} style={secondaryBtnStyle}>Reject All</button>
              <button onClick={applyAll} disabled={!allDone} style={{ ...primaryBtnStyle, opacity: allDone ? 1 : 0.5 }}>
                <RobotIcon size={11} /> Apply All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared button styles ───────────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
  background: 'var(--theme-accent)', color: '#fff', fontSize: 11, fontWeight: 500,
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
  background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
  color: 'var(--theme-fg-muted)', fontSize: 11,
};

const dangerBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
  background: 'rgba(239,68,68,0.15)', color: '#f87171', fontSize: 11,
};
