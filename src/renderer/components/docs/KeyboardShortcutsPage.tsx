/**
 * KeyboardShortcutsPage - Dynamic keyboard shortcuts reference.
 * Reads current key bindings from keyboardShortcutStore (respects customizations).
 */
import React from 'react';
import { APP_NAME } from '../../../shared/utils/appMeta';
import { WindowControls } from '../common/WindowControls';
import { useKeyboardShortcutStore, type ShortcutDef } from '../../stores/keyboardShortcutStore';

interface PageProps {
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h3 style={{
      fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 8,
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      <span style={{ width: 3, height: 14, background: 'var(--theme-accent)', borderRadius: 2, flexShrink: 0 }} />
      {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>
  </div>
);

const Row: React.FC<{ shortcut: ShortcutDef; muted?: boolean }> = ({ shortcut, muted }) => {
  const keyParts = shortcut.currentKeys.split('+').filter(Boolean);
  const isModified = shortcut.currentKeys !== shortcut.defaultKeys;

  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: '1fr 200px',
        alignItems: 'center', padding: '4px 10px', borderRadius: 4, gap: 12,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-secondary))'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        <span style={{
          fontSize: 12,
          color: muted ? 'var(--theme-fg-muted)' : 'var(--theme-fg)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {shortcut.label}
        </span>
        {isModified && (
          <span style={{
            fontSize: 9, color: 'var(--theme-accent)',
            background: 'var(--theme-accent)22',
            borderRadius: 3, padding: '1px 5px', flexShrink: 0,
          }}>
            custom
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', flexWrap: 'nowrap', alignItems: 'center' }}>
        {keyParts.map((k, i) => (
          <kbd key={i} style={{
            background: 'var(--theme-bg-tertiary, var(--theme-bg-secondary))',
            border: '1px solid var(--theme-border)',
            borderBottom: '2px solid var(--theme-border)',
            borderRadius: 4, padding: '2px 7px', fontSize: 10,
            color: 'var(--theme-fg)', fontFamily: "'JetBrains Mono', monospace",
            minWidth: 22, textAlign: 'center', lineHeight: 1.5, whiteSpace: 'nowrap',
          }}>{k}</kbd>
        ))}
      </div>
    </div>
  );
};

const SlashRow: React.FC<{ cmd: string; desc: string }> = ({ cmd, desc }) => (
  <div
    style={{
      display: 'grid', gridTemplateColumns: '1fr 200px',
      alignItems: 'center', padding: '4px 10px', borderRadius: 4, gap: 12,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-secondary))'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ fontSize: 12, color: 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <kbd style={{
        background: 'var(--theme-bg-tertiary)',
        border: '1px solid var(--theme-border)',
        borderBottom: '2px solid var(--theme-border)',
        borderRadius: 4, padding: '2px 10px', fontSize: 10,
        color: 'var(--theme-fg-muted)', fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'nowrap',
      }}>{cmd}</kbd>
    </div>
  </div>
);

const Divider: React.FC = () => (
  <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 10px' }} />
);

const CATEGORY_ORDER = ['General', 'Sidebar', 'Editing', 'Search & Navigation'];

// Shortcut ids to show in each column section
const LEFT_SECTIONS: { category: string; ids: string[] }[] = [
  {
    category: 'General',
    ids: ['command-palette', 'new-file', 'open-file', 'save', 'save-as', 'close-tab', 'toggle-sidebar', 'toggle-panel', 'fullscreen', 'settings'],
  },
  {
    category: 'Editing',
    ids: ['undo', 'redo', 'cut', 'copy', 'paste', 'select-all', 'toggle-comment', 'toggle-word-wrap', 'format-document', 'run-file', 'stop-process'],
  },
  {
    category: 'Multi-Cursor & Folding',
    ids: [], // static entries below
  },
];

const RIGHT_SECTIONS: { category: string; ids: string[] }[] = [
  {
    category: 'Sidebar / Views',
    ids: ['view-explorer', 'view-search', 'view-git', 'view-agent', 'view-rest-client', 'view-browser', 'view-extensions', 'zen-mode'],
  },
  {
    category: 'Search & Navigation',
    ids: ['find', 'replace', 'quick-open', 'go-to-line', 'go-to-symbol', 'go-to-definition', 'peek-definition', 'navigate-back', 'navigate-forward'],
  },
];

export const KeyboardShortcutsPage: React.FC<PageProps> = ({ onClose }) => {
  const shortcuts = useKeyboardShortcutStore(s => s.shortcuts);
  const byId = React.useMemo(() => {
    const m = new Map<string, ShortcutDef>();
    shortcuts.forEach(s => m.set(s.id, s));
    return m;
  }, [shortcuts]);

  const renderIds = (ids: string[]) =>
    ids
      .map(id => byId.get(id))
      .filter((s): s is ShortcutDef => Boolean(s))
      .map(s => <Row key={s.id} shortcut={s} />);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 36,
        background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--theme-fg-muted)', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Editor
          </button>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--theme-fg)' }}>
          Keyboard Shortcuts — {APP_NAME}
        </div>
        <WindowControls />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>
          Keyboard Shortcuts
        </h1>
        <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 8 }}>
          Complete reference for all keyboard shortcuts in {APP_NAME}.
        </p>
        <p style={{
          fontSize: 11, color: 'var(--theme-accent)', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width={12} height={12} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          Shortcuts can be customized in <strong>Settings → Keyboard Shortcuts</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          {/* Left column */}
          <div>
            <Section title="General">
              {renderIds(LEFT_SECTIONS[0].ids)}
            </Section>

            <Section title="Editing">
              {renderIds(LEFT_SECTIONS[1].ids)}
            </Section>

            <Section title="Multi-Cursor">
              <Row shortcut={{ id: 'alt-click', label: 'Add Cursor', category: 'Editing', description: '', defaultKeys: 'Alt+Click', currentKeys: 'Alt+Click' }} />
              <Row shortcut={{ id: 'cursor-above', label: 'Add Cursor Above', category: 'Editing', description: '', defaultKeys: 'Ctrl+Alt+Up', currentKeys: 'Ctrl+Alt+Up' }} />
              <Row shortcut={{ id: 'cursor-below', label: 'Add Cursor Below', category: 'Editing', description: '', defaultKeys: 'Ctrl+Alt+Down', currentKeys: 'Ctrl+Alt+Down' }} />
              <Row shortcut={{ id: 'select-all-occ', label: 'Select All Occurrences', category: 'Editing', description: '', defaultKeys: 'Ctrl+Shift+L', currentKeys: 'Ctrl+Shift+L' }} />
              <Row shortcut={{ id: 'undo-cursor', label: 'Undo Last Cursor', category: 'Editing', description: '', defaultKeys: 'Ctrl+U', currentKeys: 'Ctrl+U' }} />
            </Section>

            <Section title="Code Folding">
              <Row shortcut={{ id: 'fold', label: 'Fold Block', category: 'Editing', description: '', defaultKeys: 'Ctrl+Shift+[', currentKeys: 'Ctrl+Shift+[' }} />
              <Row shortcut={{ id: 'unfold', label: 'Unfold Block', category: 'Editing', description: '', defaultKeys: 'Ctrl+Shift+]', currentKeys: 'Ctrl+Shift+]' }} />
              <Row shortcut={{ id: 'fold-all', label: 'Fold All', category: 'Editing', description: '', defaultKeys: 'Ctrl+K+0', currentKeys: 'Ctrl+K+0' }} />
              <Row shortcut={{ id: 'unfold-all', label: 'Unfold All', category: 'Editing', description: '', defaultKeys: 'Ctrl+K+J', currentKeys: 'Ctrl+K+J' }} />
            </Section>

            <Section title="Terminal">
              {renderIds(['toggle-terminal', 'new-terminal', 'run-file', 'stop-process'])}
            </Section>
          </div>

          {/* Right column */}
          <div>
            <Section title="Sidebar / Views">
              {renderIds(RIGHT_SECTIONS[0].ids)}
            </Section>

            <Section title="Search & Navigation">
              {renderIds(RIGHT_SECTIONS[1].ids)}
            </Section>

            <Section title="REST Client">
              {renderIds(['view-rest-client'])}
              <Row shortcut={{ id: 'rest-send', label: 'Send Request', category: 'Sidebar', description: '', defaultKeys: 'Ctrl+Enter', currentKeys: 'Ctrl+Enter', scope: 'browser' }} />
              <Row shortcut={{ id: 'rest-cancel', label: 'Cancel Request', category: 'Sidebar', description: '', defaultKeys: 'Escape', currentKeys: 'Escape', scope: 'browser' }} />
            </Section>

            <Section title="AI Agent">
              {renderIds(['view-agent'])}
              <Divider />
              <SlashRow cmd="/clear"    desc="Clear chat messages" />
              <SlashRow cmd="/reset"    desc="Full reset — chat + memory" />
              <SlashRow cmd="/context"  desc="Reset context only" />
              <SlashRow cmd="/new"      desc="New session" />
              <SlashRow cmd="/help"     desc="Show all commands" />
              <SlashRow cmd="/model"    desc="Show current model" />
              <SlashRow cmd="/tools"    desc="List available tools" />
              <SlashRow cmd="/status"   desc="System health" />
              <SlashRow cmd="/export"   desc="Export chat as JSON" />
              <SlashRow cmd="/settings" desc="Open agent settings" />
            </Section>

            <Section title="Web Browser">
              {renderIds(['view-browser'])}
              <Row shortcut={{ id: 'browser-new-tab',  label: 'New Tab',           category: 'Sidebar', description: '', defaultKeys: 'Ctrl+T',   currentKeys: 'Ctrl+T',   scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-close-tab',label: 'Close Tab',          category: 'Sidebar', description: '', defaultKeys: 'Ctrl+W',   currentKeys: 'Ctrl+W',   scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-address',  label: 'Focus Address Bar',  category: 'Sidebar', description: '', defaultKeys: 'Ctrl+L',   currentKeys: 'Ctrl+L',   scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-reload',   label: 'Reload Page',        category: 'Sidebar', description: '', defaultKeys: 'Ctrl+R',   currentKeys: 'Ctrl+R',   scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-back',     label: 'Go Back',            category: 'Sidebar', description: '', defaultKeys: 'Alt+Left', currentKeys: 'Alt+Left', scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-forward',  label: 'Go Forward',         category: 'Sidebar', description: '', defaultKeys: 'Alt+Right',currentKeys: 'Alt+Right',scope: 'browser' }} />
              <Row shortcut={{ id: 'browser-find',     label: 'Find in Page',       category: 'Sidebar', description: '', defaultKeys: 'Ctrl+F',   currentKeys: 'Ctrl+F',   scope: 'browser' }} />
            </Section>
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
};
