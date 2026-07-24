/**
 * DiffEditor - Monaco-based side-by-side diff viewer for comparing two tabs.
 */
import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { EditorTab } from '../../../shared/types';

interface DiffEditorProps {
  originalTab: EditorTab;
  modifiedTab: EditorTab;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({ originalTab, modifiedTab }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IDiffEditor | null>(null);
  const { exitDiffMode } = useEditorStore();
  const { settings } = useSettingsStore();

  useEffect(() => {
    if (!containerRef.current) return;

    const fontSize = (settings['editor.fontSize'] as number) || 14;
    const fontFamily = (settings['editor.fontFamily'] as string) || "'JetBrains Mono', monospace";
    const tabSize = (settings['editor.tabSize'] as number) || 2;
    const lineHeight = (settings['editor.lineHeight'] as number) || 24;

    // Detect language from file extension
    const getLanguage = (tab: EditorTab): string => {
      if (tab.language) return tab.language;
      const ext = tab.fileName.split('.').pop()?.toLowerCase() || '';
      const langMap: Record<string, string> = {
        js: 'javascript', jsx: 'javascriptreact', mjs: 'javascript', cjs: 'javascript',
        ts: 'typescript', tsx: 'typescriptreact',
        json: 'json', html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
        md: 'markdown', py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
        c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
        sh: 'shell', bash: 'shell', zsh: 'shell', yml: 'yaml', yaml: 'yaml',
        xml: 'xml', sql: 'sql', php: 'php', swift: 'swift', kt: 'kotlin',
      };
      return langMap[ext] || 'plaintext';
    };

    const originalModel = monaco.editor.createModel(originalTab.content, getLanguage(originalTab));
    const modifiedModel = monaco.editor.createModel(modifiedTab.content, getLanguage(modifiedTab));

    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      fontSize,
      fontFamily,
      fontLigatures: true,
      lineHeight,
      tabSize,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      ignoreTrimWhitespace: false,
      renderOverviewRuler: true,
      readOnly: true,
      originalEditable: false,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
    });

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    diffEditorRef.current = diffEditor;

    // Add Escape action to exit diff mode
    diffEditor.getModifiedEditor().addAction({
      id: 'exit-diff-mode',
      label: 'Exit Diff Mode',
      keybindings: [monaco.KeyCode.Escape],
      run: () => exitDiffMode(),
    });

    diffEditor.getOriginalEditor().addAction({
      id: 'exit-diff-mode',
      label: 'Exit Diff Mode',
      keybindings: [monaco.KeyCode.Escape],
      run: () => exitDiffMode(),
    });

    return () => {
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditorRef.current = null;
    };
  }, [originalTab.id, modifiedTab.id]);

  // Sync theme changes
  useEffect(() => {
    const theme = (settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    if (theme === 'hypothesis-light' || theme === 'vs') {
      monaco.editor.setTheme('vs');
    } else if (theme === 'hc-black') {
      monaco.editor.setTheme('hc-black');
    } else {
      monaco.editor.setTheme('vs-dark');
    }
  }, [settings['workbench.colorTheme']]);

  return (
    <div className="flex flex-col h-full">
      {/* Diff header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 32,
          background: 'var(--theme-bg-secondary)',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--theme-fg-muted)' }}>Comparing:</span>
          <span style={{ color: 'var(--theme-fg)', fontWeight: 500 }}>{originalTab.fileName}</span>
          <span style={{ color: 'var(--theme-fg-muted)' }}>↔</span>
          <span style={{ color: 'var(--theme-fg)', fontWeight: 500 }}>{modifiedTab.fileName}</span>
        </div>
        <button
          onClick={exitDiffMode}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', fontSize: 11,
            background: 'transparent', border: '1px solid var(--theme-border)',
            borderRadius: 3, color: 'var(--theme-fg-muted)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          title="Close Diff (Esc)"
        >
          ✕ Close
        </button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
};
