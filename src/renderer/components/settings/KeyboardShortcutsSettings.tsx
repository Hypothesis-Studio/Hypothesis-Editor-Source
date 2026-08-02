/**
 * KeyboardShortcutsSettings.tsx
 * Settings panel for customizing keyboard shortcuts.
 * Records new key combos, detects conflicts, persists via keyboardShortcutStore.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useKeyboardShortcutStore, type ShortcutDef } from '../../stores/keyboardShortcutStore';
import { Icon } from '../common/Icon';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey)              parts.push('Shift');
  if (e.altKey)               parts.push('Alt');

  const ignore = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS']);
  if (!ignore.has(e.key)) {
    // Normalize arrow keys
    const keyMap: Record<string, string> = {
      ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down',
    };
    parts.push(keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key));
  }
  return parts.join('+');
}

function keysToDisplay(keys: string): string[] {
  return keys.split('+').filter(Boolean);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const KbdTag: React.FC<{ k: string }> = ({ k }) => (
  <kbd style={{
    background: 'var(--theme-bg-tertiary)',
    border: '1px solid var(--theme-border)',
    borderBottom: '2px solid var(--theme-border)',
    borderRadius: 4,
    padding: '2px 7px',
    fontSize: 10,
    color: 'var(--theme-fg)',
    fontFamily: "'JetBrains Mono', monospace",
    minWidth: 22,
    textAlign: 'center',
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }}>{k}</kbd>
);

// ── Main component ────────────────────────────────────────────────────────────

export const KeyboardShortcutsSettings: React.FC = () => {
  const { shortcuts, setShortcut, resetShortcut, resetAll } = useKeyboardShortcutStore();
  const [search, setSearch]           = useState('');
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [recording, setRecording]     = useState('');
  const [conflict, setConflict]       = useState<ShortcutDef | null>(null);
  const recordRef = useRef<HTMLDivElement>(null);

  // Detect conflict when recording changes
  useEffect(() => {
    if (!recording || !editingId) { setConflict(null); return; }
    const found = shortcuts.find(s => s.id !== editingId && s.currentKeys === recording);
    setConflict(found ?? null);
  }, [recording, editingId, shortcuts]);

  // Focus the recorder div so keydown fires
  useEffect(() => {
    if (editingId) setTimeout(() => recordRef.current?.focus(), 50);
  }, [editingId]);

  const handleRecordKey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      setEditingId(null);
      setRecording('');
      setConflict(null);
      return;
    }
    const combo = formatEvent(e);
    // Only accept combos that have at least one modifier + a non-modifier key
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey || e.shiftKey;
    const ignore = new Set(['Control', 'Shift', 'Alt', 'Meta', 'OS']);
    if (!ignore.has(e.key) && (hasModifier || ['F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12'].includes(e.key))) {
      setRecording(combo);
    }
  }, []);

  const commitRecording = useCallback(() => {
    if (editingId && recording) {
      setShortcut(editingId, recording);
    }
    setEditingId(null);
    setRecording('');
    setConflict(null);
  }, [editingId, recording, setShortcut]);

  const cancelRecording = useCallback(() => {
    setEditingId(null);
    setRecording('');
    setConflict(null);
  }, []);

  // Group by category
  const categories = useMemo(() => {
    const order = ['General', 'Sidebar', 'Editing', 'Search & Navigation'];
    return order;
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return shortcuts;
    const q = search.toLowerCase();
    return shortcuts.filter(s =>
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.currentKeys.toLowerCase().includes(q),
    );
  }, [shortcuts, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [filtered, categories]);

  const hasCustomizations = shortcuts.some(s => s.currentKeys !== s.defaultKeys);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search shortcuts..."
          style={{
            flex: 1,
            background: 'var(--theme-bg-tertiary)',
            border: '1px solid var(--theme-border-light)',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 11,
            color: 'var(--theme-fg)',
            outline: 'none',
          }}
        />
        {hasCustomizations && (
          <button
            onClick={resetAll}
            style={{
              background: 'var(--theme-bg-tertiary)',
              color: 'var(--theme-fg-muted)',
              border: '1px solid var(--theme-border-light)',
              borderRadius: 4,
              padding: '4px 12px',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Reset All
          </button>
        )}
      </div>

      {/* Shortcut list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {categories.map(cat => {
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: 24 }}>
              <h3 style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--theme-fg-muted)',
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                marginBottom: 6,
                paddingLeft: 4,
              }}>{cat}</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {items.map(s => {
                  const isEditing   = editingId === s.id;
                  const isModified  = s.currentKeys !== s.defaultKeys;

                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        alignItems: 'center',
                        padding: '6px 10px',
                        borderRadius: 4,
                        gap: 12,
                        background: isEditing ? 'var(--theme-bg-active)' : 'transparent',
                        border: isEditing ? '1px solid var(--theme-accent)' : '1px solid transparent',
                      }}
                      onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
                      onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* Left: label + description */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, color: 'var(--theme-fg)' }}>{s.label}</span>
                          {isModified && (
                            <span style={{
                              fontSize: 9,
                              color: 'var(--theme-accent)',
                              background: 'var(--theme-accent)22',
                              borderRadius: 3,
                              padding: '1px 5px',
                            }}>modified</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--theme-fg-dim)', marginTop: 1 }}>{s.description}</div>
                        {isEditing && conflict && (
                          <div style={{
                            marginTop: 4,
                            fontSize: 10,
                            color: '#e6a817',
                            background: '#e6a81722',
                            borderRadius: 3,
                            padding: '2px 6px',
                            display: 'inline-block',
                          }}>
                            ⚠ Conflict with: {conflict.label}
                          </div>
                        )}
                      </div>

                      {/* Right: keys + actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isEditing ? (
                          <>
                            {/* Recording area */}
                            <div
                              ref={recordRef}
                              tabIndex={0}
                              onKeyDown={handleRecordKey as unknown as React.KeyboardEventHandler}
                              style={{
                                minWidth: 140,
                                padding: '3px 10px',
                                background: 'var(--theme-bg)',
                                border: '1px solid var(--theme-accent)',
                                borderRadius: 4,
                                fontSize: 11,
                                color: recording ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
                                cursor: 'text',
                                outline: 'none',
                                textAlign: 'center',
                                fontFamily: "'JetBrains Mono', monospace",
                              }}
                            >
                              {recording || 'Press shortcut...'}
                            </div>
                            <button
                              onClick={commitRecording}
                              disabled={!recording}
                              style={{
                                background: recording ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)',
                                color: recording ? '#fff' : 'var(--theme-fg-muted)',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 10px',
                                fontSize: 11,
                                cursor: recording ? 'pointer' : 'not-allowed',
                              }}
                            >
                              OK
                            </button>
                            <button
                              onClick={cancelRecording}
                              style={{
                                background: 'var(--theme-bg-tertiary)',
                                color: 'var(--theme-fg-muted)',
                                border: '1px solid var(--theme-border-light)',
                                borderRadius: 4,
                                padding: '3px 10px',
                                fontSize: 11,
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Display current keys */}
                            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                              {keysToDisplay(s.currentKeys).map((k, i) => (
                                <KbdTag key={i} k={k} />
                              ))}
                            </div>
                            {/* Edit button */}
                            <button
                              onClick={() => { setEditingId(s.id); setRecording(''); }}
                              title="Change shortcut"
                              style={{
                                background: 'none',
                                border: '1px solid var(--theme-border-light)',
                                borderRadius: 4,
                                padding: '2px 7px',
                                cursor: 'pointer',
                                color: 'var(--theme-fg-muted)',
                                fontSize: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.borderColor = 'var(--theme-fg-muted)'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.borderColor = 'var(--theme-border-light)'; }}
                            >
                              <Icon name="edit" size={11} /> Edit
                            </button>
                            {/* Reset button — only if modified */}
                            {isModified && (
                              <button
                                onClick={() => resetShortcut(s.id)}
                                title={`Reset to default: ${s.defaultKeys}`}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 3,
                                  cursor: 'pointer',
                                  color: 'var(--theme-fg-muted)',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                              >
                                <Icon name="refresh" size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--theme-fg-muted)', fontSize: 12 }}>
            No shortcuts found for "{search}"
          </div>
        )}
      </div>
    </div>
  );
};
