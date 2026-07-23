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
    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 3, height: 14, background: 'var(--theme-accent)', borderRadius: 2 }} />
      {title}
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>
  </div>
);

const Row: React.FC<{ keys: string; desc: string }> = ({ keys, desc }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '6px 12px', borderRadius: 4, fontSize: 12,
  }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
  >
    <span style={{ color: 'var(--theme-fg)' }}>{desc}</span>
    <div style={{ display: 'flex', gap: 4 }}>
      {keys.split(' ').map((k, i) => (
        <kbd key={i} style={{
          background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-fg-dim)', borderRadius: 3,
          padding: '2px 8px', fontSize: 11, color: 'var(--theme-fg)', fontFamily: "'JetBrains Mono', monospace",
          minWidth: 20, textAlign: 'center',
        }}>{k}</kbd>
      ))}
    </div>
  </div>
);

export const KeyboardShortcutsPage: React.FC<PageProps> = ({ onClose }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)' }}>
        {/* Left: Back */}
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Editor
          </button>
        </div>
        {/* Center: Title */}
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg)' }}>Keyboard Shortcuts — {APP_NAME}</div>
        {/* Right: Window Controls */}
        <WindowControls />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 40px', maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 4 }}>Keyboard Shortcuts</h1>
        <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 28 }}>Complete reference for all keyboard shortcuts in {APP_NAME} Editor.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
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
              <Row keys="Alt+Up" desc="Move Line Up" />
              <Row keys="Alt+Down" desc="Move Line Down" />
              <Row keys="Ctrl+/" desc="Toggle Comment" />
              <Row keys="Tab" desc="Indent" />
              <Row keys="Shift+Tab" desc="Outdent" />
            </Section>

            <Section title="Terminal">
              <Row keys="Ctrl+`" desc="Toggle Terminal" />
              <Row keys="Ctrl+Shift+`" desc="New Terminal" />
              <Row keys="Ctrl+F5" desc="Run File" />
              <Row keys="Shift+F5" desc="Stop" />
              <Row keys="Ctrl+Shift+B" desc="Run Build Task" />
            </Section>
          </div>

          <div>
            <Section title="Search & Navigation">
              <Row keys="Ctrl+F" desc="Find" />
              <Row keys="Ctrl+H" desc="Replace" />
              <Row keys="Ctrl+Shift+F" desc="Find in Files" />
              <Row keys="Ctrl+P" desc="Go to File" />
              <Row keys="Ctrl+G" desc="Go to Line" />
              <Row keys="Ctrl+Shift+O" desc="Go to Symbol" />
              <Row keys="F12" desc="Go to Definition" />
              <Row keys="Alt+F12" desc="Peek Definition" />
              <Row keys="Alt+Left" desc="Navigate Back" />
              <Row keys="Alt+Right" desc="Navigate Forward" />
            </Section>

            <Section title="Views">
              <Row keys="Ctrl+Shift+E" desc="Explorer" />
              <Row keys="Ctrl+Shift+F" desc="Search" />
              <Row keys="Ctrl+Shift+G" desc="Source Control" />
              <Row keys="Ctrl+Shift+A" desc="AI Agent" />
              <Row keys="Ctrl+Shift+X" desc="Extensions" />
              <Row keys="Ctrl+Shift+Z" desc="Zen Mode" />
              <Row keys="Alt+Z" desc="Toggle Word Wrap" />
            </Section>

            <Section title="Multi-Cursor">
              <Row keys="Alt+Click" desc="Add Cursor" />
              <Row keys="Ctrl+Alt+Up" desc="Cursor Above" />
              <Row keys="Ctrl+Alt+Down" desc="Cursor Below" />
              <Row keys="Ctrl+U" desc="Undo Last Cursor" />
            </Section>

            <Section title="Code Folding">
              <Row keys="Ctrl+Shift+[" desc="Fold" />
              <Row keys="Ctrl+Shift+]" desc="Unfold" />
              <Row keys="Ctrl+K Ctrl+0" desc="Fold All" />
              <Row keys="Ctrl+K Ctrl+J" desc="Unfold All" />
            </Section>

            <Section title="AI Agent">
              <Row keys="Ctrl+Shift+A" desc="Open AI Agent" />
              <Row keys="/clear" desc="Clear chat" />
              <Row keys="/reset" desc="Full reset (chat + memory)" />
              <Row keys="/context" desc="Reset context" />
              <Row keys="/new" desc="New session" />
              <Row keys="/help" desc="Show all commands" />
              <Row keys="/model" desc="Show current model" />
              <Row keys="/tools" desc="List available tools" />
              <Row keys="/status" desc="System health" />
              <Row keys="/export" desc="Export chat as JSON" />
              <Row keys="/settings" desc="Open agent settings" />
            </Section>
          </div>
        </div>

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
};
