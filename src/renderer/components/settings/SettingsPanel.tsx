/**
 * Settings Panel Component - GUI settings editor with dropdown selects.
 * All settings directly apply to the running editor/terminal.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAppStore } from '../../stores/appStore';
import { useThemeStore } from '../../stores/themeStore';
import { DropdownSelect } from '../common/DropdownSelect';
import { AgentSettingsPanel } from './AgentSettingsPanel';
import { KeyboardShortcutsSettings } from './KeyboardShortcutsSettings';
import { Icon } from '../common/Icon';

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'select';
  options?: string[];
  selectOptions?: { value: string; label: string }[];
  default?: unknown;
  category: string;
}

const SETTINGS_SCHEMA: SettingItem[] = [
  // Editor
  { key: 'editor.fontSize', label: 'Font Size', description: 'Controls the font size in pixels.', type: 'number', default: 14, category: 'Editor' },
  { key: 'editor.fontFamily', label: 'Font Family', description: 'Controls the font family used in the editor.', type: 'select', selectOptions: [
    { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
    { value: "'Fira Code', monospace", label: 'Fira Code' },
    { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
    { value: "'Geist Mono', monospace", label: 'Geist Mono' },
    { value: "'Monaspace Argon', monospace", label: 'Monaspace Argon' },
    { value: 'monospace', label: 'System Default' },
  ], default: "'JetBrains Mono', monospace", category: 'Editor' },
  { key: 'editor.tabSize', label: 'Tab Size', description: 'The number of spaces a tab is equal to.', type: 'number', default: 2, category: 'Editor' },
  { key: 'editor.insertSpaces', label: 'Insert Spaces', description: 'Insert spaces when pressing Tab.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.wordWrap', label: 'Word Wrap', description: 'Controls how lines should wrap.', type: 'enum', options: ['off', 'on', 'wordWrapColumn', 'bounded'], default: 'off', category: 'Editor' },
  { key: 'editor.lineNumbers', label: 'Line Numbers', description: 'Controls the display of line numbers.', type: 'enum', options: ['on', 'off', 'relative', 'interval'], default: 'on', category: 'Editor' },
  { key: 'editor.minimap.enabled', label: 'Minimap', description: 'Controls whether the minimap is shown.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.bracketPairColorization.enabled', label: 'Bracket Pair Colorization', description: 'Controls whether bracket pair colorization is enabled.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.stickyScroll.enabled', label: 'Sticky Scroll', description: 'Shows the nested scopes at the top of the editor.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.folding', label: 'Code Folding', description: 'Controls whether code folding is enabled.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.autoIndent', label: 'Auto Indent', description: 'Controls whether auto indent is enabled.', type: 'enum', options: ['none', 'keep', 'brackets', 'advanced', 'full'], default: 'advanced', category: 'Editor' },
  { key: 'editor.formatOnSave', label: 'Format On Save', description: 'Format a file on save.', type: 'boolean', default: false, category: 'Editor' },
  { key: 'editor.cursorStyle', label: 'Cursor Style', description: 'Controls the cursor style.', type: 'enum', options: ['line', 'block', 'underline'], default: 'line', category: 'Editor' },
  { key: 'editor.cursorBlinking', label: 'Cursor Blinking', description: 'Controls the cursor animation style.', type: 'enum', options: ['blink', 'smooth', 'phase', 'expand', 'solid'], default: 'blink', category: 'Editor' },
  { key: 'editor.renderWhitespace', label: 'Render Whitespace', description: 'Controls how whitespace characters are rendered.', type: 'enum', options: ['none', 'boundary', 'selection', 'trailing', 'all'], default: 'none', category: 'Editor' },
  { key: 'editor.mouseWheelZoom', label: 'Mouse Wheel Zoom', description: 'Zoom the font when using mouse wheel and holding Ctrl.', type: 'boolean', default: false, category: 'Editor' },
  { key: 'editor.smoothScrolling', label: 'Smooth Scrolling', description: 'Controls whether smooth scrolling is enabled.', type: 'boolean', default: false, category: 'Editor' },
  { key: 'editor.padding.top', label: 'Padding Top', description: 'Controls the padding at the top of the editor.', type: 'number', default: 0, category: 'Editor' },
  { key: 'editor.padding.bottom', label: 'Padding Bottom', description: 'Controls the padding at the bottom of the editor.', type: 'number', default: 0, category: 'Editor' },

  // Files
  { key: 'files.autoSave', label: 'Auto Save', description: 'Controls auto save of dirty files.', type: 'enum', options: ['off', 'afterDelay', 'onFocusChange', 'onWindowChange'], default: 'off', category: 'Files' },
  { key: 'files.autoSaveDelay', label: 'Auto Save Delay', description: 'Delay in milliseconds after which a dirty file is saved automatically.', type: 'number', default: 1000, category: 'Files' },
  { key: 'files.encoding', label: 'Encoding', description: 'The default character encoding.', type: 'select', selectOptions: [
    { value: 'utf8', label: 'UTF-8' },
    { value: 'utf16le', label: 'UTF-16 LE' },
    { value: 'utf16be', label: 'UTF-16 BE' },
    { value: 'ascii', label: 'ASCII' },
    { value: 'latin1', label: 'Latin-1 (ISO 8859-1)' },
    { value: 'windows1252', label: 'Windows-1252' },
    { value: 'shiftjis', label: 'Shift JIS' },
    { value: 'eucjp', label: 'EUC-JP' },
    { value: 'gbk', label: 'GBK' },
    { value: 'euckr', label: 'EUC-KR' },
  ], default: 'utf8', category: 'Files' },
  { key: 'files.eol', label: 'End of Line', description: 'The default end of line character.', type: 'select', selectOptions: [
    { value: '\n', label: 'LF (\\n) — Linux/macOS' },
    { value: '\r\n', label: 'CRLF (\\r\\n) — Windows' },
  ], default: '\n', category: 'Files' },
  { key: 'files.trimTrailingWhitespace', label: 'Trim Trailing Whitespace', description: 'When enabled, will trim trailing whitespace when saving a file.', type: 'boolean', default: false, category: 'Files' },
  { key: 'files.insertFinalNewline', label: 'Insert Final Newline', description: 'When enabled, insert a final new line at the end of the file when saving.', type: 'boolean', default: false, category: 'Files' },

  // Workbench
  { key: 'workbench.colorTheme', label: 'Color Theme', description: 'Specifies the color theme used in the workbench. Defaults use the built-in Hypothesis themes.', type: 'select', selectOptions: [
    { value: 'hypothesis-dark', label: 'Hypothesis Dark' },
    { value: 'hypothesis-light', label: 'Hypothesis Light' },
  ], default: 'hypothesis-dark', category: 'Workbench' },
  { key: 'workbench.iconTheme', label: 'Icon Theme', description: 'Specifies the icon theme used in the workbench.', type: 'select', selectOptions: [
    { value: 'material', label: 'Material' },
    { value: 'codi', label: 'Codi' },
    { value: 'none', label: 'None' },
  ], default: 'material', category: 'Workbench' },
  { key: 'workbench.editor.showTabs', label: 'Show Tabs', description: 'Controls whether opened editors should show in tabs.', type: 'boolean', default: true, category: 'Workbench' },
  { key: 'workbench.editor.enablePreview', label: 'Enable Preview', description: 'Use temporary preview tabs when opening files.', type: 'boolean', default: false, category: 'Workbench' },
  { key: 'editor.preview.autoReload', label: 'Auto Reload Preview', description: 'Automatically reload preview when file changes on disk.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.preview.layout', label: 'Preview Layout', description: 'How the preview is displayed relative to the code editor.', type: 'enum', options: ['tab', 'side-by-side'], selectOptions: [
    { value: 'tab', label: 'Bergantian (Tab)' },
    { value: 'side-by-side', label: 'Berdampingan (Side by Side)' },
  ], default: 'tab', category: 'Editor' },
  { key: 'workbench.tree.indent', label: 'Tree Indent', description: 'Controls tree indentation in pixels.', type: 'number', default: 8, category: 'Workbench' },

  // Terminal
  { key: 'terminal.integrated.fontSize', label: 'Terminal Font Size', description: 'Controls the font size in pixels of the terminal.', type: 'number', default: 12, category: 'Terminal' },
  { key: 'terminal.integrated.fontFamily', label: 'Terminal Font Family', description: 'Controls the font family of the terminal.', type: 'select', selectOptions: [
    { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
    { value: "'Fira Code', monospace", label: 'Fira Code' },
    { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
    { value: "'Geist Mono', monospace", label: 'Geist Mono' },
    { value: "'Monaspace Argon', monospace", label: 'Monaspace Argon' },
    { value: 'monospace', label: 'System Default' },
  ], default: "'JetBrains Mono', monospace", category: 'Terminal' },
  { key: 'terminal.integrated.lineHeight', label: 'Terminal Line Height', description: 'Controls the line height of the terminal.', type: 'number', default: 1.4, category: 'Terminal' },
  { key: 'terminal.integrated.scrollback', label: 'Terminal Scrollback', description: 'Controls the maximum number of lines the terminal keeps in its buffer.', type: 'number', default: 1000, category: 'Terminal' },
  { key: 'terminal.integrated.cursorStyle', label: 'Terminal Cursor Style', description: 'Controls the style of the terminal cursor.', type: 'enum', options: ['block', 'underline', 'line'], default: 'block', category: 'Terminal' },
  { key: 'terminal.integrated.cursorBlinking', label: 'Terminal Cursor Blinking', description: 'Controls whether the terminal cursor blinks.', type: 'boolean', default: true, category: 'Terminal' },

  // Git
  { key: 'git.enabled', label: 'Git Enabled', description: 'Whether git is enabled.', type: 'boolean', default: true, category: 'Git' },
  { key: 'git.autofetch', label: 'Git Auto Fetch', description: 'Whether auto fetching is enabled.', type: 'boolean', default: false, category: 'Git' },
  { key: 'git.confirmSync', label: 'Git Confirm Sync', description: 'Confirm before sync.', type: 'boolean', default: true, category: 'Git' },
  { key: 'git.enableSmartCommit', label: 'Git Smart Commit', description: 'Commit all changes when there are no staged changes.', type: 'boolean', default: false, category: 'Git' },
  { key: 'git.defaultBranch', label: 'Default Branch', description: 'The default branch name for new repositories.', type: 'string', default: 'main', category: 'Git' },

  // Window
  { key: 'window.zoomLevel', label: 'Zoom Level', description: 'Adjust the zoom level of the window.', type: 'number', default: 0, category: 'Window' },
  { key: 'window.restoreWindows', label: 'Restore Windows', description: 'Controls how windows are restored.', type: 'enum', options: ['none', 'one', 'all', 'folders'], default: 'all', category: 'Window' },

  // Accessibility
  { key: 'accessibility.supportAccessibilityMode', label: 'Accessibility Mode', description: 'Optimize the editor for screen readers.', type: 'boolean', default: false, category: 'Accessibility' },

  // Editor - Suggestions & Snippets
  { key: 'editor.quickSuggestions.other', label: 'Quick Suggestions (Code)', description: 'Show quick suggestions while typing in code.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.quickSuggestions.comments', label: 'Quick Suggestions (Comments)', description: 'Show quick suggestions while typing in comments.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.quickSuggestions.strings', label: 'Quick Suggestions (Strings)', description: 'Show quick suggestions while typing in strings.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.quickSuggestionsDelay', label: 'Quick Suggestions Delay (ms)', description: 'Delay in ms before quick suggestions appear.', type: 'number', default: 10, category: 'Editor' },
  { key: 'editor.suggest.preview', label: 'Suggestion Preview', description: 'Preview the selected suggestion inline in the editor.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.suggest.insertMode', label: 'Suggestion Insert Mode', description: 'Controls whether suggestions replace or insert text.', type: 'enum', options: ['insert', 'replace'], default: 'replace', category: 'Editor' },
  { key: 'editor.suggest.filterGraceful', label: 'Graceful Suggestion Filter', description: 'Keep showing suggestions even without an exact prefix match.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.suggest.showStatusBar', label: 'Suggestion Status Bar', description: 'Show status bar at the bottom of the suggestion widget.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.suggest.snippetsPreventQuickSuggestions', label: 'Snippets Prevent Quick Suggestions', description: 'Prevent quick suggestions when inside a snippet.', type: 'boolean', default: false, category: 'Editor' },
  { key: 'editor.inlineSuggest.enabled', label: 'Inline Suggestions', description: 'Show inline ghost-text suggestions while typing.', type: 'boolean', default: true, category: 'Editor' },

  // Editor - Hover
  { key: 'editor.hover.sticky', label: 'Sticky Hover', description: 'Keep the hover popup visible when moving the mouse into it.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.hover.above', label: 'Hover Above Line', description: 'Prefer showing hover above the current line.', type: 'boolean', default: true, category: 'Editor' },

  // Editor - Cursor
  { key: 'editor.cursorSmoothCaretAnimation', label: 'Smooth Caret Animation', description: 'Controls whether the cursor should be animated smoothly.', type: 'enum', options: ['off', 'explicit', 'on'], default: 'on', category: 'Editor' },

  // Editor - Find
  { key: 'editor.find.autoFindInSelection', label: 'Auto Find In Selection', description: 'Auto-select find scope when text is selected.', type: 'enum', options: ['never', 'always', 'multiline'], default: 'multiline', category: 'Editor' },
  { key: 'editor.find.loop', label: 'Find Loop', description: 'Controls whether the search wraps around when reaching the end.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.find.cursorMoveOnType', label: 'Cursor Move On Find Type', description: 'Jump to the next match while typing in the find field.', type: 'boolean', default: true, category: 'Editor' },

  // Editor - Unicode & Security
  { key: 'editor.unicodeHighlight.ambiguousCharacters', label: 'Highlight Ambiguous Characters', description: 'Highlight characters that may be confused with ASCII characters.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.unicodeHighlight.invisibleCharacters', label: 'Highlight Invisible Characters', description: 'Highlight invisible/zero-width characters.', type: 'boolean', default: true, category: 'Editor' },
  { key: 'editor.unicodeHighlight.nonBasicASCII', label: 'Highlight Non-ASCII', description: 'Highlight all non-basic ASCII characters.', type: 'boolean', default: false, category: 'Editor' },

  // Editor - Semantic Highlighting
  { key: 'editor.semanticHighlighting.enabled', label: 'Semantic Highlighting', description: 'Use semantic token colors for more accurate syntax highlighting in TypeScript/JavaScript.', type: 'boolean', default: true, category: 'Editor' },

  // AI Agent - Basic toggles only (detailed config is in AgentSettingsPanel)
  { key: 'agent.enabled', label: 'Agent Enabled', description: 'Enable or disable the AI agent system.', type: 'boolean', default: true, category: 'AI Agent' },
  { key: 'agent.streaming', label: 'Streaming Responses', description: 'Stream agent responses in real-time.', type: 'boolean', default: true, category: 'AI Agent' },
  { key: 'agent.memoryEnabled', label: 'Memory Enabled', description: 'Remember context across sessions.', type: 'boolean', default: true, category: 'AI Agent' },
  { key: 'agent.planningEnabled', label: 'Planning Enabled', description: 'Enable multi-step task planning.', type: 'boolean', default: true, category: 'AI Agent' },
  { key: 'agent.retryOnFailure', label: 'Retry on Failure', description: 'Automatically retry failed API calls.', type: 'boolean', default: true, category: 'AI Agent' },
  { key: 'agent.telemetryEnabled', label: 'Telemetry', description: 'Send anonymous usage telemetry.', type: 'boolean', default: false, category: 'AI Agent' },
];

// ── Map settings to appStore actions ──────────────────────────────
function applySettingToApp(key: string, value: unknown) {
  const store = useAppStore.getState();
  switch (key) {
    case 'editor.fontSize': break; // Monaco reads from settings
    case 'editor.fontFamily': break;
    case 'editor.wordWrap': store.toggleWordWrap(); break; // handled via store
    case 'editor.lineNumbers': store.toggleLineNumbers(); break;
    case 'editor.minimap.enabled': store.toggleMinimap(); break;
    case 'editor.stickyScroll.enabled': store.setStickyScroll(value as boolean); break;
    case 'window.zoomLevel': {
      const level = (value as number) || 0;
      (document as any).body.style.zoom = `${100 + level * 10}%`;
      break;
    }
    case 'accessibility.supportAccessibilityMode': {
      // Toggle Monaco accessibility mode via DOM attribute
      document.body.setAttribute('data-accessibility-mode', value ? 'true' : 'false');
      break;
    }
    case 'workbench.colorTheme': {
      // Apply theme via CSS variables
      const root = document.documentElement;
      if (value === 'hypothesis-light' || value === 'vs') {
        root.style.setProperty('--editor-bg', 'var(--theme-bg-secondary)');
        root.style.setProperty('--editor-fg', 'var(--theme-fg)');
      } else {
        root.style.setProperty('--editor-bg', 'var(--theme-bg)');
        root.style.setProperty('--editor-fg', 'var(--theme-fg)');
      }
      break;
    }
  }
}

interface SettingsPanelProps {
  initialCategory?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ initialCategory }) => {
  const { settings, loadSettings, setSetting, resetSetting, resetAllSettings, exportSettings, importSettings } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory || null);
  const [isJsonMode, setIsJsonMode] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const EXTRA_CATEGORIES = ['Keyboard Shortcuts'];
  const categories = useMemo(() => {
    const cats = new Set(SETTINGS_SCHEMA.map((s) => s.category));
    return [...Array.from(cats), ...EXTRA_CATEGORIES];
  }, []);

  const filteredSettings = useMemo(() => {
    let filtered = SETTINGS_SCHEMA;
    // Dynamically inject extension themes into the Color Theme dropdown
    const colorTheme = filtered.find(s => s.key === 'workbench.colorTheme');
    if (colorTheme && colorTheme.type === 'select') {
      const opts = [
        { value: 'hypothesis-dark', label: 'Hypothesis Dark' },
        { value: 'hypothesis-light', label: 'Hypothesis Light' },
      ];
      for (const [id, ext] of Object.entries(useThemeStore.getState().extensionThemes)) {
        if (!opts.some(o => o.value === id)) opts.push({ value: id, label: ext.name });
      }
      colorTheme.selectOptions = opts;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.key.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query),
      );
    }
    if (selectedCategory) {
      filtered = filtered.filter((s) => s.category === selectedCategory);
    }
    return filtered;
  }, [searchQuery, selectedCategory]);

  const groupedSettings = useMemo(() => {
    const groups = new Map<string, SettingItem[]>();
    for (const setting of filteredSettings) {
      if (!groups.has(setting.category)) groups.set(setting.category, []);
      groups.get(setting.category)!.push(setting);
    }
    return groups;
  }, [filteredSettings]);

  const handleSettingChange = async (key: string, value: unknown) => {
    await setSetting(key, value);
    applySettingToApp(key, value);
  };

  const handleExport = () => {
    const data = exportSettings();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hypothesis-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        await importSettings(text);
      }
    };
    input.click();
  };

  const renderSettingInput = (setting: SettingItem) => {
    const value = settings[setting.key] ?? setting.default;

    switch (setting.type) {
      case 'boolean':
        return (
          <button
            onClick={() => handleSettingChange(setting.key, !value)}
            style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: value ? 'var(--theme-accent)' : 'var(--theme-bg-tertiary)', position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 14, height: 14, borderRadius: '50%', background: '#ffffff',
              position: 'absolute', top: 3,
              left: value ? 19 : 3, transition: 'left 0.2s',
            }} />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value as number}
            onChange={(e) => handleSettingChange(setting.key, parseFloat(e.target.value))}
            style={{
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)', borderRadius: 4,
              padding: '3px 6px', fontSize: 11, color: 'var(--theme-fg)', width: 60,
              textAlign: 'right', outline: 'none',
            }}
          />
        );

      case 'enum':
        return (
          <DropdownSelect
            value={(value as string) || ''}
            options={(setting.options || []).map(opt => ({ value: opt, label: opt }))}
            onChange={(v) => handleSettingChange(setting.key, v)}
          />
        );

      case 'select':
        return (
          <DropdownSelect
            value={(value as string) || ''}
            options={setting.selectOptions || []}
            onChange={(v) => handleSettingChange(setting.key, v)}
            showFontPreview={setting.key.includes('fontFamily')}
          />
        );

      case 'string':
        return (
          <input
            type="text"
            value={value as string}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            style={{
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)', borderRadius: 4,
              padding: '3px 6px', fontSize: 11, color: 'var(--theme-fg)', width: 200,
              outline: 'none',
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--theme-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--theme-border)' }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-fg)', margin: 0 }}>Settings</h2>
        <div style={{ flex: 1 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search settings..."
          style={{
            background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border-light)', borderRadius: 4,
            padding: '3px 8px', fontSize: 11, color: 'var(--theme-fg)', width: 200, outline: 'none',
          }}
        />
        <button onClick={() => setIsJsonMode(!isJsonMode)} style={btnStyle}>
          {isJsonMode ? 'GUI' : 'JSON'}
        </button>
        <button onClick={handleExport} style={btnStyle}>Export</button>
        <button onClick={handleImport} style={btnStyle}>Import</button>
        <button onClick={resetAllSettings} style={btnStyle}>Reset All</button>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Category sidebar */}
        <div style={{ width: 160, borderRight: '1px solid var(--theme-border)', overflowY: 'auto' }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 11,
              background: !selectedCategory ? 'var(--theme-bg-active)' : 'transparent',
              color: !selectedCategory ? 'var(--theme-fg)' : 'var(--theme-fg-muted)', border: 'none', cursor: 'pointer',
            }}
          >
            All Settings
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 11,
                background: selectedCategory === cat ? 'var(--theme-bg-active)' : 'transparent',
                color: selectedCategory === cat ? 'var(--theme-fg)' : 'var(--theme-fg-muted)', border: 'none', cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Settings list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {selectedCategory === 'Keyboard Shortcuts' ? (
            <KeyboardShortcutsSettings />
          ) : selectedCategory === 'AI Agent' ? (
            <AgentSettingsPanel />
          ) : isJsonMode ? (
            <textarea
              value={JSON.stringify(settings, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  Object.entries(parsed).forEach(([key, val]) => handleSettingChange(key, val));
                } catch {}
              }}
              style={{
                width: '100%', height: '100%', background: 'var(--theme-bg-secondary)', color: 'var(--theme-fg)',
                padding: 16, fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                resize: 'none', outline: 'none', border: 'none', borderRadius: 4,
              }}
            />
          ) : (
            Array.from(groupedSettings.entries()).map(([category, catSettings]) => (
              <div key={category} style={{ marginBottom: 24 }}>
                <h3 style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--theme-fg)', textTransform: 'uppercase',
                  letterSpacing: 1, marginBottom: 12, paddingLeft: 4,
                }}>
                  {category}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {catSettings.map((setting) => (
                    <div
                      key={setting.key}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 4,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                        <div style={{ fontSize: 12, color: 'var(--theme-fg)' }}>{setting.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--theme-fg-muted)', marginTop: 2 }}>{setting.description}</div>
                        <div style={{ fontSize: 9, color: 'var(--theme-fg-dim)', marginTop: 2, fontFamily: 'monospace' }}>{setting.key}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {renderSettingInput(setting)}
                        <button
                          onClick={() => { resetSetting(setting.key); applySettingToApp(setting.key, setting.default); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', padding: 4 }}
                          title="Reset to default"
                        >
                          <Icon name="refresh" size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border-light)',
  borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
};
