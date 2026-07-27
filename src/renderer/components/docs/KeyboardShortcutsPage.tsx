/**
 * KeyboardShortcutsPage - Complete keyboard shortcuts reference.
 */
import React from 'react';
import { APP_NAME } from '../../../shared/utils/appMeta';
import { WindowControls } from '../common/WindowControls';

interface PageProps {
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
      <span style={{ width: 3, height: 14, background: 'var(--theme-accent)', borderRadius: 2, flexShrink: 0 }} />
      {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>
  </div>
);

const Row: React.FC<{ keys: string | string[]; desc: string; muted?: boolean }> = ({ keys, desc, muted }) => {
  const keyList = Array.isArray(keys) ? keys : keys.split(' ');
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '1fr 160px', alignItems: 'center', padding: '4px 10px', borderRadius: 4, gap: 12 }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-secondary))'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 12, color: muted ? 'var(--theme-fg-muted)' : 'var(--theme-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
      <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
        {keyList.map((k, i) => (
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

const Divider: React.FC = () => (
  <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 10px' }} />
);

export const KeyboardShortcutsPage: React.FC<PageProps> = ({ onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Editor
          </button>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--theme-fg)' }}>Keyboard Shortcuts — {APP_NAME}</div>
        <WindowControls />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '28px 40px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>Keyboard Shortcuts</h1>
        <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 32 }}>Complete reference for all keyboard shortcuts in {APP_NAME}.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          {/* Left column */}
          <div>
            <Section title="General">
              <Row keys="Ctrl+Shift+P" desc="Command Palette" />
              <Row keys="Ctrl+N" desc="New File" />
              <Row keys="Ctrl+O" desc="Open File" />
              <Row keys="Ctrl+S" desc="Save" />
              <Row keys="Ctrl+Shift+S" desc="Save As" />
              <Row keys="Ctrl+W" desc="Close Tab" />
              <Row keys="Ctrl+B" desc="Toggle Sidebar" />
              <Row keys="Ctrl+J" desc="Toggle Panel" />
              <Row keys="F11" desc="Full Screen" />
              <Row keys="Ctrl+," desc="Settings" />
            </Section>

            <Section title="Editing">
              <Row keys="Ctrl+Z" desc="Undo" />
              <Row keys="Ctrl+Y" desc="Redo" />
              <Row keys="Ctrl+X" desc="Cut" />
              <Row keys="Ctrl+C" desc="Copy" />
              <Row keys="Ctrl+V" desc="Paste" />
              <Row keys="Ctrl+A" desc="Select All" />
              <Row keys="Ctrl+D" desc="Select Next Match" />
              <Row keys="Ctrl+Shift+K" desc="Delete Line" />
              <Row keys="Alt+↑" desc="Move Line Up" />
              <Row keys="Alt+↓" desc="Move Line Down" />
              <Row keys="Ctrl+/" desc="Toggle Comment" />
              <Row keys="Tab" desc="Indent" />
              <Row keys="Shift+Tab" desc="Outdent" />
            </Section>

            <Section title="Multi-Cursor">
              <Row keys="Alt+Click" desc="Add Cursor" />
              <Row keys="Ctrl+Alt+↑" desc="Add Cursor Above" />
              <Row keys="Ctrl+Alt+↓" desc="Add Cursor Below" />
              <Row keys="Ctrl+Shift+L" desc="Select All Occurrences" />
              <Row keys="Ctrl+U" desc="Undo Last Cursor" />
            </Section>

            <Section title="Code Folding">
              <Row keys="Ctrl+Shift+[" desc="Fold Block" />
              <Row keys="Ctrl+Shift+]" desc="Unfold Block" />
              <Row keys={['Ctrl+K', 'Ctrl+0']} desc="Fold All" />
              <Row keys={['Ctrl+K', 'Ctrl+J']} desc="Unfold All" />
            </Section>

            <Section title="Terminal">
              <Row keys="Ctrl+`" desc="Toggle Terminal" />
              <Row keys="Ctrl+Shift+`" desc="New Terminal" />
              <Row keys="Ctrl+F5" desc="Run Current File" />
              <Row keys="Shift+F5" desc="Stop Running Process" />
            </Section>
          </div>

          {/* Right column */}
          <div>
            <Section title="Views">
              <Row keys="Ctrl+Shift+E" desc="Explorer" />
              <Row keys="Ctrl+Shift+F" desc="Search (Find in Files)" />
              <Row keys="Ctrl+Shift+G" desc="Source Control (Git)" />
              <Row keys="Ctrl+Shift+A" desc="AI Agent" />
              <Row keys="Ctrl+Shift+R" desc="REST Client" />
              <Row keys="Ctrl+Shift+B" desc="Web Browser" />
              <Row keys="Ctrl+Shift+X" desc="Extensions" />
              <Row keys="Ctrl+Shift+Z" desc="Zen Mode" />
            </Section>

            <Section title="Search & Navigation">
              <Row keys="Ctrl+F" desc="Find in File" />
              <Row keys="Ctrl+H" desc="Find & Replace" />
              <Row keys="Ctrl+P" desc="Go to File (Quick Open)" />
              <Row keys="Ctrl+G" desc="Go to Line" />
              <Row keys="Ctrl+Shift+O" desc="Go to Symbol" />
              <Row keys="F12" desc="Go to Definition" />
              <Row keys="Alt+F12" desc="Peek Definition" />
              <Row keys="Alt+←" desc="Navigate Back" />
              <Row keys="Alt+→" desc="Navigate Forward" />
              <Row keys="Alt+Z" desc="Toggle Word Wrap" />
            </Section>

            <Section title="REST Client">
              <Row keys="Ctrl+Shift+R" desc="Open REST Client" />
              <Row keys="Ctrl+Enter" desc="Send Request" />
              <Row keys="Escape" desc="Cancel Request" />
            </Section>

            <Section title="AI Agent">
              <Row keys="Ctrl+Shift+A" desc="Open AI Agent" />
              <Divider />
              <Row keys="/clear" desc="Clear chat messages" muted />
              <Row keys="/reset" desc="Full reset — chat + memory" muted />
              <Row keys="/context" desc="Reset context only" muted />
              <Row keys="/new" desc="New session" muted />
              <Row keys="/help" desc="Show all commands" muted />
              <Row keys="/model" desc="Show current model" muted />
              <Row keys="/tools" desc="List available tools" muted />
              <Row keys="/status" desc="System health" muted />
              <Row keys="/export" desc="Export chat as JSON" muted />
              <Row keys="/settings" desc="Open agent settings" muted />
            </Section>

            <Section title="Web Browser">
              <Row keys="Ctrl+Shift+B" desc="Open Web Browser" />
              <Row keys="Ctrl+T" desc="New Tab" />
              <Row keys="Ctrl+W" desc="Close Tab" />
              <Row keys="Ctrl+L" desc="Focus Address Bar" />
              <Row keys="Ctrl+R" desc="Reload Page" />
              <Row keys="Alt+←" desc="Go Back" />
              <Row keys="Alt+→" desc="Go Forward" />
              <Row keys="Ctrl+F" desc="Find in Page" />
            </Section>
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
};
