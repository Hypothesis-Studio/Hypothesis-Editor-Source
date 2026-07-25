/**
 * CommandPalette - Quick command access with fuzzy search.
 * All commands are functional and delegate to the right stores/actions.
 */
import React, { useState, useEffect, useRef } from 'react';
import { APP_NAME } from '../../../shared/utils/appMeta';
import { useAppStore } from '../../stores/appStore';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';

interface CommandItem {
  id: string;
  label: string;
  category?: string;
  keybinding?: string;
  action: () => void;
  hidden?: boolean;
}

interface CommandPaletteProps {
  onClose: () => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onOpenFolder?: () => void;
  onCloseFolder?: () => void;
  onOpenSettings?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  onOpenDocs?: () => void;
  onOpenShortcuts?: () => void;
  onOpenWelcome?: () => void;
  onOpenAbout?: () => void;
  onOpenAgent?: () => void;
  onOpenInsights?: () => void;
  onOpenRestClient?: () => void;
  onOpenDatabase?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  onClose, onNewFile, onOpenFile, onOpenFolder, onCloseFolder, onOpenSettings, onSave, onSaveAs,
  onOpenDocs, onOpenShortcuts, onOpenWelcome, onOpenAbout, onOpenAgent, onOpenInsights, onOpenRestClient, onOpenDatabase,
}) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [extensionCommands, setExtensionCommands] = useState<Array<{ id: string; label: string; category: string; pluginId: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const app = useAppStore;
  const editor = useEditorStore;
  const settings = useSettingsStore.getState().settings;
  const agentEnabled = settings['agent.enabled'] !== false;

  // Load extension commands on mount and refresh on IPC events
  useEffect(() => {
    const fetchCmds = () => {
      window.api.plugin.getExtensionCommands().then(cmds => {
        setExtensionCommands(cmds as Array<{ id: string; label: string; category: string; pluginId: string }>);
      }).catch(() => {});
    };
    fetchCmds();
    // Listen for extension changes from main process
    const unsub1 = (window as any).api?.menu?.onChannel?.('extension:commands-changed', fetchCmds);
    const unsub2 = (window as any).api?.menu?.onChannel?.('extension:command-registered', fetchCmds);
    return () => { unsub1?.(); unsub2?.(); };
  }, []);

  const commands: CommandItem[] = [
    // ── File ────────────────────────────────────────────────────────
    { id: 'file.new', label: 'New File', category: 'File', keybinding: 'Ctrl+N', action: () => { onNewFile?.(); onClose(); } },
    { id: 'file.open', label: 'Open File...', category: 'File', keybinding: 'Ctrl+O', action: () => { onOpenFile?.(); onClose(); } },
    { id: 'folder.open', label: 'Open Folder...', category: 'File', keybinding: 'Ctrl+Shift+O', action: () => { onOpenFolder?.(); onClose(); } },
    { id: 'folder.close', label: 'Close Folder', category: 'File', keybinding: 'Ctrl+K F', action: () => { onCloseFolder?.(); onClose(); } },
    { id: 'workspace.addFolder', label: 'Add Folder to Workspace', category: 'File', action: () => { onOpenFolder?.(); onClose(); } },
    { id: 'file.save', label: 'Save', category: 'File', keybinding: 'Ctrl+S', action: () => { onSave?.(); onClose(); } },
    { id: 'file.saveAs', label: 'Save As...', category: 'File', keybinding: 'Ctrl+Shift+S', action: () => { onSaveAs?.(); onClose(); } },
    { id: 'file.saveAll', label: 'Save All', category: 'File', action: () => { editor.getState().tabs.forEach(t => { if (t.filePath && t.isDirty) { window.api.file.save(t.filePath, t.content); editor.getState().setTabDirty(t.id, false); } }); onClose(); } },
    { id: 'file.close', label: 'Close Editor', category: 'File', keybinding: 'Ctrl+W', action: () => { const t = editor.getState().activeTabId; if (t) editor.getState().closeTab(t); onClose(); } },
    { id: 'file.closeAll', label: 'Close All Editors', category: 'File', action: () => { editor.getState().tabs.forEach(t => editor.getState().closeTab(t.id)); onClose(); } },

    // ── View: Sidebar ──────────────────────────────────────────────
    { id: 'view.explorer', label: 'Show Explorer', category: 'View', keybinding: 'Ctrl+Shift+E', action: () => { app.getState().setActiveSidebarView('explorer'); app.getState().sidebarVisible || app.getState().toggleSidebar(); onClose(); } },
    { id: 'view.search', label: 'Show Search', category: 'View', keybinding: 'Ctrl+Shift+F', action: () => { app.getState().setActiveSidebarView('search'); app.getState().sidebarVisible || app.getState().toggleSidebar(); onClose(); } },
    { id: 'view.git', label: 'Show Source Control', category: 'View', keybinding: 'Ctrl+Shift+G', action: () => { app.getState().setActiveSidebarView('git'); app.getState().sidebarVisible || app.getState().toggleSidebar(); onClose(); } },
    { id: 'view.extensions', label: 'Show Extensions', category: 'View', keybinding: 'Ctrl+Shift+X', action: () => { app.getState().setActiveSidebarView('extensions'); app.getState().sidebarVisible || app.getState().toggleSidebar(); onClose(); } },
    { id: 'view.agent', label: 'Open AI Agent', category: 'View', keybinding: 'Ctrl+Shift+A', action: () => { onOpenAgent?.(); onClose(); }, hidden: !agentEnabled },
    { id: 'view.restclient', label: 'Open REST Client', category: 'View', keybinding: 'Ctrl+Shift+R', action: () => { onOpenRestClient?.(); onClose(); } },
    { id: 'view.database', label: 'Open Database Explorer', category: 'View', keybinding: 'Ctrl+Shift+D', action: () => { onOpenDatabase?.(); onClose(); } },
    { id: 'view.insights', label: 'Open Project Insights', category: 'View', action: () => { onOpenInsights?.(); onClose(); } },

    // ── View: Toggles ──────────────────────────────────────────────
    { id: 'view.toggleSidebar', label: 'Toggle Sidebar', category: 'View', keybinding: 'Ctrl+B', action: () => { app.getState().toggleSidebar(); onClose(); } },
    { id: 'view.toggleTerminal', label: 'Toggle Terminal', category: 'View', keybinding: 'Ctrl+`', action: () => { app.getState().togglePanel(); app.getState().setActivePanel('terminal'); onClose(); } },
    { id: 'view.togglePanel', label: 'Toggle Panel', category: 'View', keybinding: 'Ctrl+J', action: () => { app.getState().togglePanel(); onClose(); } },
    { id: 'view.toggleMinimap', label: 'Toggle Minimap', category: 'View', action: () => { app.getState().toggleMinimap(); onClose(); } },
    { id: 'view.toggleWordWrap', label: 'Toggle Word Wrap', category: 'View', keybinding: 'Alt+Z', action: () => { app.getState().toggleWordWrap(); onClose(); } },
    { id: 'view.toggleLineNumbers', label: 'Toggle Line Numbers', category: 'View', action: () => { app.getState().toggleLineNumbers(); onClose(); } },
    { id: 'view.toggleBreadcrumbs', label: 'Toggle Breadcrumbs', category: 'View', action: () => { app.getState().toggleBreadcrumbs(); onClose(); } },
    { id: 'view.toggleStickyScroll', label: 'Toggle Sticky Scroll', category: 'View', action: () => { app.getState().toggleStickyScroll(); onClose(); } },
    { id: 'view.toggleActivityBar', label: 'Toggle Activity Bar', category: 'View', action: () => { app.getState().toggleActivityBar(); onClose(); } },
    { id: 'view.toggleStatusBar', label: 'Toggle Status Bar', category: 'View', action: () => { app.getState().toggleStatusBar(); onClose(); } },
    { id: 'view.toggleFullscreen', label: 'Toggle Full Screen', category: 'View', keybinding: 'F11', action: () => { window.api.window.maximize(); onClose(); } },
    { id: 'view.toggleZenMode', label: 'Toggle Zen Mode', category: 'View', keybinding: 'Ctrl+K Z', action: () => { app.getState().toggleZenMode(); onClose(); } },

    // ── Edit ───────────────────────────────────────────────────────
    { id: 'editor.undo', label: 'Undo', category: 'Edit', keybinding: 'Ctrl+Z', action: () => { editor.getState().triggerUndo(); onClose(); } },
    { id: 'editor.redo', label: 'Redo', category: 'Edit', keybinding: 'Ctrl+Y', action: () => { editor.getState().triggerRedo(); onClose(); } },
    { id: 'editor.find', label: 'Find', category: 'Edit', keybinding: 'Ctrl+F', action: () => { editor.getState().triggerFind(); onClose(); } },
    { id: 'editor.replace', label: 'Find and Replace', category: 'Edit', keybinding: 'Ctrl+H', action: () => { editor.getState().triggerReplace(); onClose(); } },
    { id: 'editor.comment', label: 'Toggle Line Comment', category: 'Edit', keybinding: 'Ctrl+/', action: () => { editor.getState().triggerComment(); onClose(); } },
    { id: 'editor.diff', label: 'Compare Active Tab With...', category: 'Edit', action: () => { const at = editor.getState().activeTabId; if (at && editor.getState().tabs.length >= 2) { const other = editor.getState().tabs.find(t => t.id !== at); if (other) editor.getState().startDiff(at, other.id); } onClose(); } },
    { id: 'editor.exitDiff', label: 'Exit Diff Mode', category: 'Edit', keybinding: 'Escape', action: () => { editor.getState().exitDiffMode(); onClose(); } },
    { id: 'editor.foldAll', label: 'Fold All', category: 'Edit', keybinding: 'Ctrl+K Ctrl+0', action: () => { editor.getState().triggerFoldAll(); onClose(); } },
    { id: 'editor.unfoldAll', label: 'Unfold All', category: 'Edit', keybinding: 'Ctrl+K Ctrl+J', action: () => { editor.getState().triggerUnfoldAll(); onClose(); } },

    // ── Go ─────────────────────────────────────────────────────────
    { id: 'go.line', label: 'Go to Line...', category: 'Go', keybinding: 'Ctrl+G', action: () => { editor.getState().triggerGoToLine(); onClose(); } },
    { id: 'go.symbol', label: 'Go to Symbol...', category: 'Go', keybinding: 'Ctrl+Shift+O', action: () => { editor.getState().triggerGoToSymbol(); onClose(); } },
    { id: 'go.definition', label: 'Go to Definition', category: 'Go', keybinding: 'F12', action: () => { editor.getState().triggerGoToDefinition(); onClose(); } },
    { id: 'go.peek', label: 'Peek Definition', category: 'Go', keybinding: 'Alt+F12', action: () => { editor.getState().triggerPeekDefinition(); onClose(); } },
    { id: 'go.back', label: 'Navigate Back', category: 'Go', keybinding: 'Alt+Left', action: () => { editor.getState().triggerGoBack(); onClose(); } },
    { id: 'go.forward', label: 'Navigate Forward', category: 'Go', keybinding: 'Alt+Right', action: () => { editor.getState().triggerGoForward(); onClose(); } },

    // ── Terminal ───────────────────────────────────────────────────
    { id: 'terminal.new', label: 'New Terminal', category: 'Terminal', keybinding: 'Ctrl+Shift+`', action: () => { app.getState().togglePanel(); app.getState().setActivePanel('terminal'); onClose(); } },
    { id: 'terminal.output', label: 'Show Output', category: 'Terminal', action: () => { app.getState().togglePanel(); app.getState().setActivePanel('output'); onClose(); } },
    { id: 'terminal.problems', label: 'Show Problems', category: 'Terminal', action: () => { app.getState().togglePanel(); app.getState().setActivePanel('problems'); onClose(); } },
    { id: 'terminal.console', label: 'Show Console', category: 'Terminal', action: () => { app.getState().togglePanel(); app.getState().setActivePanel('console'); onClose(); } },
    // terminal.clear and terminal.kill removed — no reliable renderer-side terminal handle

    // ── Preferences ────────────────────────────────────────────────
    { id: 'settings.open', label: 'Open Settings', category: 'Preferences', keybinding: 'Ctrl+,', action: () => { onOpenSettings?.(); onClose(); } },
    { id: 'theme.change', label: 'Color Theme', category: 'Preferences', action: () => { onOpenSettings?.(); onClose(); } },
    { id: 'iconTheme.change', label: 'File Icon Theme', category: 'Preferences', action: () => { onOpenSettings?.(); onClose(); } },

    { id: 'help.welcome', label: 'Welcome', category: 'Help', action: () => { onOpenWelcome?.(); onClose(); } },
    { id: 'help.docs', label: 'Documentation', category: 'Help', keybinding: 'F1', action: () => { onOpenDocs?.(); onClose(); } },
    { id: 'help.shortcuts', label: 'Keyboard Shortcuts', category: 'Help', keybinding: 'Ctrl+K Ctrl+S', action: () => { onOpenShortcuts?.(); onClose(); } },
    { id: 'help.about', label: `About ${APP_NAME}`, category: 'Help', action: () => { onOpenAbout?.(); onClose(); } },
    // ── Extension Commands ──────────────────────────────────────────
    ...extensionCommands.map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      category: cmd.category || 'Extension',
      action: async () => {
        try {
          const activeEditor = editor.getState().activeEditor;
          const activeTab = editor.getState().tabs.find(t => t.id === editor.getState().activeTabId);
          let args: any = {};
          if (activeTab && activeEditor) {
            // Get selected text for formatSelection-style commands
            let selectedText = '';
            const selection = activeEditor.getSelection();
            if (selection && !selection.isEmpty()) {
              const selModel = activeEditor.getModel();
              if (selModel) selectedText = selModel.getValueInRange(selection);
            }
            args = {
              text: activeTab.content,
              selectedText,
              languageId: activeTab.language,
              filePath: activeTab.filePath,
            };
          }
          const result = await window.api.plugin.executeCommand(cmd.id, args);
          // If the command returned formatted text, apply it to the editor
          if (result && typeof result === 'string' && activeEditor && activeTab) {
            const model = activeEditor.getModel();
            if (model && result !== activeTab.content) {
              activeEditor.executeEdits('extension', [{
                range: model.getFullModelRange(),
                text: result,
              }]);
              editor.getState().updateTab(activeTab.id, { content: result });
              editor.getState().setTabDirty(activeTab.id, true);
            }
          }
        } catch (e) {
          console.error(`Failed to execute extension command ${cmd.id}:`, e);
        }
        onClose();
      },
    })),
  ];

  const filtered = commands.filter(c => {
    if (c.hidden) return false;
    const q = query.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q) || c.id.includes(q);
  });

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[selected]?.action(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filtered, selected, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[600px] rounded-lg shadow-2xl overflow-hidden" style={{ background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light)' }}>
        <div className="p-3" style={{ borderBottom: '1px solid var(--theme-border-light)' }}>
          <input
            ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Type a command..."
            className="w-full px-3 py-2 text-sm rounded outline-none"
            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-bg-tertiary)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--theme-accent)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--theme-bg-tertiary)'; }}
          />
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-center" style={{ color: 'var(--theme-fg-muted)' }}>No commands found</div>
          ) : filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className="flex items-center px-4 py-2 cursor-pointer"
              style={i === selected ? { background: 'var(--theme-bg-active)' } : {}}
              onMouseEnter={(e) => { setSelected(i); if (i !== selected) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
              onMouseLeave={(e) => { if (i !== selected) e.currentTarget.style.background = ''; }}
              onClick={cmd.action}
            >
              <div className="w-5 h-5 mr-3" style={{ color: 'var(--theme-fg-muted)' }}>
                <Icon name="run" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm" style={{ color: 'var(--theme-fg)' }}>{cmd.label}</span>
                {cmd.category && <span className="ml-2 text-xs" style={{ color: 'var(--theme-fg-muted)' }}>{cmd.category}</span>}
              </div>
              {cmd.keybinding && <kbd className="px-1.5 py-0.5 text-xs rounded ml-2" style={{ color: 'var(--theme-fg-muted)', background: 'var(--theme-bg-tertiary)' }}>{cmd.keybinding}</kbd>}
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-xs" style={{ borderTop: '1px solid var(--theme-border-light)', color: 'var(--theme-fg-muted)' }}>
          ↑↓ navigate · Enter execute · Esc close
        </div>
      </div>
    </div>
  );
};
