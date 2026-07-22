/**
 * DocumentationPage - In-app documentation with improved design.
 */
import React from 'react';
import { WindowControls } from '../common/WindowControls';
import { useThemeStore } from '../../stores/themeStore';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

const iconLight = new URL('../../assets/icons/icon-light.png', import.meta.url).href;
const iconDark = new URL('../../assets/icons/icon-dark.png', import.meta.url).href;

interface PageProps {
  onClose: () => void;
}

export const DocumentationPage: React.FC<PageProps> = ({ onClose }) => {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const isLight = currentTheme.includes('light') || currentTheme === 'vs';
  const iconSrc = isLight ? iconDark : iconLight;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      {/* Header */}
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
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg)' }}>Documentation — {APP_NAME}</div>
        {/* Right: Window Controls */}
        <WindowControls />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><img src={iconSrc} alt="Hypothesis" style={{ width: 100, height: 100 }} /></div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 6 }}>{APP_NAME} Editor</h1>
          <p style={{ fontSize: 13, color: 'var(--theme-fg-muted)' }}>{APP_DESCRIPTION} — v{APP_VERSION}</p>
        </div>

        {/* Getting Started */}
        <Section title="Getting Started">
          <Card>
            <SubSection title="Opening Files">
              <List items={[
                ['Ctrl+O', 'Open one or more files from your filesystem'],
                ['Ctrl+N', 'Create a new untitled file'],
                ['Ctrl+K F', 'Close the current folder/workspace'],
                ['Drag & Drop', 'Drag files directly into the editor window'],
              ]} />
            </SubSection>
          </Card>
          <Card>
            <SubSection title="Saving Files">
              <List items={[
                ['Ctrl+S', 'Save the current file'],
                ['Ctrl+Shift+S', 'Save with a new name or location'],
                ['File → Save All', 'Save all open modified files at once'],
              ]} />
            </SubSection>
          </Card>
        </Section>

        {/* Editor */}
        <Section title="Editor Features">
          <Card>
            <FeatureGrid features={[
              ['Syntax Highlighting', '80+ languages with rich color themes'],
              ['IntelliSense', 'Auto-completion, parameter hints, quick info'],
              ['Bracket Colorization', 'Matching brackets are color-coded for clarity'],
              ['Minimap', 'Code overview sidebar (toggle via View menu)'],
              ['Breadcrumbs', 'File path & symbol navigation above editor'],
              ['Word Wrap', 'Soft-wrap long lines (Alt+Z to toggle)'],
              ['Line Numbers', 'Absolute, relative, or interval display'],
              ['Sticky Scroll', 'Current scope stays visible at the top'],
              ['Multi-Cursor', 'Ctrl+Click to add cursors, Ctrl+D for next match'],
              ['Code Folding', 'Collapse/expand code blocks with gutter icons'],
              ['Find & Replace', 'Regex, case sensitivity, whole word options'],
            ]} />
          </Card>
        </Section>

        {/* Sidebar */}
        <Section title="Sidebar & Panels">
          <Card>
            <SubSection title="Activity Bar (Left Icon Bar)">
              <p style={{ marginBottom: 8 }}>The Activity Bar provides quick access to:</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Explorer', 'Browse and manage files'],
                  ['Search', 'Search across files with regex'],
                  ['Source Control', 'Git integration'],
                  ['Extensions', 'Manage extensions'],
                  ['Terminal', 'Integrated terminal'],
                  ['Problems', 'Diagnostics and errors'],
                  ['Output', 'Build/task output'],
                ].map(([icon, desc], i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: 'var(--theme-fg-muted)', minWidth: 140 }}>{icon}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </Card>
          <Card>
            <SubSection title="Bottom Panel Tabs">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  ['Terminal', 'Integrated terminal with multi-tab support'],
                  ['Output', 'Build and task output logs'],
                  ['Problems', 'Linter errors, warnings, diagnostics'],
                  ['Console', 'Debug console for expression evaluation'],
                ].map(([name, desc], i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
                    <span style={{ color: 'var(--theme-accent)', fontWeight: 600, minWidth: 80 }}>{name}</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </Card>
        </Section>

        {/* Terminal */}
        <Section title="Integrated Terminal" icon="⬡">
          <Card>
            <List items={[
              ['Multiple Terminals', 'Create and switch between terminal instances'],
              ['Auto-detect Shell', 'Uses system default (PowerShell, bash, zsh)'],
              ['Run File (Ctrl+F5)', 'Runs current file based on its language extension'],
              ['Supported', 'JS, TS, Python, Ruby, Go, Rust, Java, Shell, PHP'],
              ['Clear', 'Clear terminal screen (trash icon in panel)'],
              ['Kill All', 'Terminate all terminal sessions (stop icon)'],
            ]} />
          </Card>
        </Section>

        {/* Git */}
        <Section title="Git Integration">
          <Card>
            <List items={[
              ['Source Control Panel', 'View changed, staged, and untracked files'],
              ['Diff Viewer', 'Side-by-side comparison of changes'],
              ['Stage & Commit', 'Stage individual files or all changes'],
              ['Branch Management', 'Switch and create branches'],
              ['Status Bar', 'Shows current branch and change count'],
            ]} />
          </Card>
        </Section>

        {/* Settings */}
        <Section title="Settings">
          <Card>
            <p style={{ marginBottom: 8, fontSize: 12 }}>Access via <kbd style={kbdStyle}>Ctrl+,</kbd> or the gear icon in the Activity Bar.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Editor', 'Font, tab size, word wrap, minimap'],
                ['Themes', 'Dark, light, high-contrast'],
                ['Keybindings', 'Customize keyboard shortcuts'],
                ['Files', 'Auto-save, encoding, line endings'],
                ['Terminal', 'Shell path, font, scrollback'],
              ].map(([name, desc], i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: 'var(--theme-accent)', fontWeight: 600, minWidth: 80 }}>{name}</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* Tips */}
        <Section title="Tips & Tricks">
          <Card>
            <List items={[
              ['Command Palette', 'Ctrl+Shift+P — Access any command by name'],
              ['Zen Mode', 'Ctrl+Shift+Z — Distraction-free editing'],
              ['Split Editor', 'View multiple files side by side'],
              ['Pin Tabs', 'Right-click a tab to pin it open'],
              ['Quick Switch', 'Ctrl+P to fuzzy-search and open files'],
              ['Breadcrumbs', 'Click symbols in breadcrumb bar to navigate'],
            ]} />
          </Card>
        </Section>

        <div style={{ height: 60 }} />
      </div>
    </div>
  );
};

// ── Styled Components ──────────────────────────────────────────────

const kbdStyle: React.CSSProperties = {
  background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-fg-dim)', borderRadius: 3,
  padding: '1px 6px', fontSize: 11, color: 'var(--theme-fg)', fontFamily: "'JetBrains Mono', monospace",
};

const Section: React.FC<{ title: string; icon?: string; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div style={{ marginBottom: 32 }}>
    <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon && <span>{icon}</span>}
      {title}
    </h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)', borderRadius: 8,
    padding: '16px 20px', fontSize: 13, lineHeight: 1.8,
  }}>
    {children}
  </div>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 12 }}>
    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', marginBottom: 8 }}>{title}</h4>
    {children}
  </div>
);

const List: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {items.map(([label, desc], i) => (
      <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '3px 0' }}>
        <span style={{ color: 'var(--theme-accent)', fontWeight: 500, minWidth: 140 }}>{label}</span>
        <span style={{ color: 'var(--theme-fg)' }}>{desc}</span>
      </div>
    ))}
  </div>
);

const FeatureGrid: React.FC<{ features: [string, string][] }> = ({ features }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
    {features.map(([name, desc], i) => (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)' }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{desc}</span>
      </div>
    ))}
  </div>
);
