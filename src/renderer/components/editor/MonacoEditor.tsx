/**
 * Monaco Editor Component - Core editor with full feature support.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores/editorStore';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { EditorTab } from '../../../shared/types';

interface MonacoEditorProps {
  tab: EditorTab;
  isActive: boolean;
}

// Configure Monaco Editor workers
const setupMonacoWorkers = () => {
  (self as unknown as Record<string, unknown>).MonacoEnvironment = {
    getWorker: function (_workerId: string, label: string) {
      const getWorkerModule = (moduleUrl: string, label: string) => {
        return new Worker(new URL(moduleUrl, import.meta.url), {
          name: label,
          type: 'module',
        });
      };

      switch (label) {
        case 'json':
          return getWorkerModule('/monaco-editor/esm/vs/language/json/json.worker?worker', label);
        case 'css':
        case 'scss':
        case 'less':
          return getWorkerModule('/monaco-editor/esm/vs/language/css/css.worker?worker', label);
        case 'html':
        case 'handlebars':
        case 'razor':
          return getWorkerModule('/monaco-editor/esm/vs/language/html/html.worker?worker', label);
        case 'typescript':
        case 'javascript':
          return getWorkerModule(
            '/monaco-editor/esm/vs/language/typescript/ts.worker?worker',
            label,
          );
        default:
          return getWorkerModule('/monaco-editor/esm/vs/editor/editor.worker?worker', label);
      }
    },
  };
};

setupMonacoWorkers();

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ tab, isActive }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { updateTab, setCursorPosition, setTabDirty } = useEditorStore();
  const { wordWrap, minimapVisible, lineNumbers, stickyScroll, breadcrumbsVisible } = useAppStore();
  const { settings } = useSettingsStore();
  const [isReady, setIsReady] = useState(false);

  // Create editor
  useEffect(() => {
    if (!editorRef.current) return;

    const fontSize = (settings['editor.fontSize'] as number) || 14;
    const fontFamily = (settings['editor.fontFamily'] as string) || "'JetBrains Mono', monospace";
    const tabSize = (settings['editor.tabSize'] as number) || 2;
    const lineHeight = (settings['editor.lineHeight'] as number) || 24;
    const cursorStyle = (settings['editor.cursorStyle'] as string) || 'line';
    const cursorBlinking = (settings['editor.cursorBlinking'] as string) || 'blink';
    const renderWhitespace = (settings['editor.renderWhitespace'] as string) || 'none';
    const autoIndent = (settings['editor.autoIndent'] as string) || 'advanced';
    const mouseWheelZoom = (settings['editor.mouseWheelZoom'] as boolean) || false;
    const smoothScrolling = (settings['editor.smoothScrolling'] as boolean) || false;
    const paddingTop = (settings['editor.padding.top'] as number) || 0;
    const paddingBottom = (settings['editor.padding.bottom'] as number) || 0;

    const editor = monaco.editor.create(editorRef.current, {
      value: tab.content,
      language: tab.language,
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize,
      fontFamily,
      fontLigatures: true,
      lineHeight,
      letterSpacing: 0,
      tabSize,
      insertSpaces: (settings['editor.insertSpaces'] as boolean) !== false,
      wordWrap,
      minimap: {
        enabled: minimapVisible,
        side: 'right',
        renderCharacters: true,
        maxColumn: 80,
      },
      lineNumbers,
      renderWhitespace: renderWhitespace as any,
      cursorStyle: cursorStyle as any,
      cursorBlinking: cursorBlinking as any,
      cursorSmoothCaretAnimation: 'off',
      bracketPairColorization: {
        enabled: (settings['editor.bracketPairColorization.enabled'] as boolean) !== false,
      },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      stickyScroll: {
        enabled: (settings['editor.stickyScroll.enabled'] as boolean) !== false,
      },
      folding: (settings['editor.folding'] as boolean) !== false,
      foldingStrategy: 'auto',
      showFoldingControls: 'mouseover',
      autoIndent: autoIndent as any,
      formatOnPaste: (settings['editor.formatOnPaste'] as boolean) || false,
      formatOnType: (settings['editor.formatOnType'] as boolean) || false,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'off',
      snippetSuggestions: 'inline',
      codeLens: true,
      lightbulb: {
        // @ts-ignore - LightbulbIconOption may not exist in all Monaco versions
        enabled: (monaco.editor as any).LightbulbIconOption?.On ?? true,
      },
      hover: {
        enabled: true,
        delay: 300,
      },
      links: true,
      colorDecorators: true,
      contextmenu: true,
      mouseWheelZoom,
      multiCursorModifier: 'ctrlCmd',
      occurrencesHighlight: 'singleFile',
      selectionHighlight: true,
      overviewRulerBorder: true,
      hideCursorInOverviewRuler: false,
      scrollBeyondLastLine: true,
      smoothScrolling,
      padding: {
        top: paddingTop,
        bottom: paddingBottom,
      },
      renderLineHighlight: 'all',
      renderLineHighlightOnlyWhenFocus: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
        verticalSliderSize: 10,
        horizontalSliderSize: 10,
      },
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: 'never',
        seedSearchStringFromSelection: 'always',
      },
      wordBasedSuggestions: 'allDocuments',
      parameterHints: {
        enabled: true,
      },
      suggest: {
        showMethods: true,
        showFunctions: true,
        showConstructors: true,
        showFields: true,
        showVariables: true,
        showClasses: true,
        showStructs: true,
        showInterfaces: true,
        showModules: true,
        showProperties: true,
        showEvents: true,
        showOperators: true,
        showUnits: true,
        showValues: true,
        showConstants: true,
        showEnums: true,
        showEnumMembers: true,
        showKeywords: true,
        showWords: true,
        showColors: true,
        showFiles: true,
        showReferences: true,
        showFolders: true,
        showTypeParameters: true,
        showSnippets: true,
      },
    });

    monacoRef.current = editor;
    setIsReady(true);

    // Register this editor as the active one for menu actions
    if (isActive) {
      useEditorStore.getState().setActiveEditor(editor);
    }

    // Restore view state
    if (tab.viewState) {
      editor.restoreViewState(tab.viewState as monaco.editor.ICodeEditorViewState);
    }

    // Restore cursor position
    editor.setPosition({
      lineNumber: tab.cursorPosition.line,
      column: tab.cursorPosition.column,
    });

    // Restore scroll position
    editor.setScrollPosition({
      scrollTop: tab.scrollTop,
      scrollLeft: tab.scrollLeft,
    });

    // Listen for content changes
    const contentChangeDisposable = editor.onDidChangeModelContent(() => {
      const newContent = editor.getValue();
      updateTab(tab.id, {
        content: newContent,
        isDirty: newContent !== tab.savedContent,
        modifiedAt: Date.now(),
      });
    });

    // Listen for cursor position changes
    const cursorChangeDisposable = editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        line: e.position.lineNumber,
        column: e.position.column,
      });
      updateTab(tab.id, {
        cursorPosition: {
          line: e.position.lineNumber,
          column: e.position.column,
        },
      });
    });

    // Listen for scroll position changes
    const scrollChangeDisposable = editor.onDidScrollChange((e) => {
      updateTab(tab.id, {
        scrollTop: e.scrollTop,
        scrollLeft: e.scrollLeft,
      });
    });

    editor.addAction({
      id: 'toggle-word-wrap',
      label: 'Toggle Word Wrap',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => {
        const currentWrap = editor.getOption(monaco.editor.EditorOption.wordWrap);
        editor.updateOptions({
          wordWrap: currentWrap === 'off' ? 'on' : 'off',
        });
      },
    });

    editor.addAction({
      id: 'toggle-minimap',
      label: 'Toggle Minimap',
      run: () => {
        const currentMinimap = editor.getOption(monaco.editor.EditorOption.minimap);
        editor.updateOptions({
          minimap: { enabled: !currentMinimap.enabled },
        });
      },
    });

    editor.addAction({
      id: 'duplicate-line',
      label: 'Duplicate Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK],
      run: (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const lineContent = model.getLineContent(selection.startLineNumber);
            const position = ed.getPosition();
            if (position) {
              const range = new monaco.Range(
                selection.startLineNumber,
                model.getLineMaxColumn(selection.startLineNumber),
                selection.startLineNumber,
                model.getLineMaxColumn(selection.startLineNumber),
              );
              ed.executeEdits('duplicate-line', [
                { range, text: '\n' + lineContent },
              ]);
            }
          }
        }
      },
    });

    editor.addAction({
      id: 'delete-line',
      label: 'Delete Line',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: (ed) => {
        const selection = ed.getSelection();
        if (selection) {
          const model = ed.getModel();
          if (model) {
            const range = new monaco.Range(
              selection.startLineNumber,
              1,
              selection.startLineNumber + 1,
              1,
            );
            ed.executeEdits('delete-line', [{ range, text: '' }]);
          }
        }
      },
    });

    editor.addAction({
      id: 'move-line-up',
      label: 'Move Line Up',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.UpArrow],
      run: (ed) => {
        const position = ed.getPosition();
        if (position && position.lineNumber > 1) {
          const model = ed.getModel();
          if (model) {
            const currentLine = model.getLineContent(position.lineNumber);
            const aboveLine = model.getLineContent(position.lineNumber - 1);
            const range = new monaco.Range(position.lineNumber - 1, 1, position.lineNumber, model.getLineMaxColumn(position.lineNumber));
            ed.executeEdits('move-line-up', [
              { range, text: currentLine + '\n' + aboveLine },
            ]);
            ed.setPosition({ lineNumber: position.lineNumber - 1, column: position.column });
          }
        }
      },
    });

    editor.addAction({
      id: 'move-line-down',
      label: 'Move Line Down',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.DownArrow],
      run: (ed) => {
        const position = ed.getPosition();
        const model = ed.getModel();
        if (position && model && position.lineNumber < model.getLineCount()) {
          const currentLine = model.getLineContent(position.lineNumber);
          const belowLine = model.getLineContent(position.lineNumber + 1);
          const range = new monaco.Range(position.lineNumber, 1, position.lineNumber + 1, model.getLineMaxColumn(position.lineNumber + 1));
          ed.executeEdits('move-line-down', [
            { range, text: belowLine + '\n' + currentLine },
          ]);
          ed.setPosition({ lineNumber: position.lineNumber + 1, column: position.column });
        }
      },
    });

    // Focus editor if active
    if (isActive) {
      editor.focus();
    }

    return () => {
      contentChangeDisposable.dispose();
      cursorChangeDisposable.dispose();
      scrollChangeDisposable.dispose();
      editor.dispose();
      monacoRef.current = null;
    };
  }, [tab.filePath]);

  // ── Sync view settings from appStore → Monaco ───────────────────
  useEffect(() => {
    const editor = monacoRef.current;
    if (!editor) return;
    editor.updateOptions({
      wordWrap,
      minimap: { enabled: minimapVisible },
      lineNumbers,
      stickyScroll: { enabled: stickyScroll },
    });
  }, [wordWrap, minimapVisible, lineNumbers, stickyScroll]);

  // ── Sync settings from settingsStore → Monaco ───────────────────
  useEffect(() => {
    const editor = monacoRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize: (settings['editor.fontSize'] as number) || 14,
      fontFamily: (settings['editor.fontFamily'] as string) || "'JetBrains Mono', monospace",
      tabSize: (settings['editor.tabSize'] as number) || 2,
      insertSpaces: (settings['editor.insertSpaces'] as boolean) !== false,
      lineHeight: (settings['editor.lineHeight'] as number) || 24,
      cursorStyle: (settings['editor.cursorStyle'] as any) || 'line',
      cursorBlinking: (settings['editor.cursorBlinking'] as any) || 'blink',
      renderWhitespace: (settings['editor.renderWhitespace'] as any) || 'none',
      autoIndent: (settings['editor.autoIndent'] as any) || 'advanced',
      mouseWheelZoom: (settings['editor.mouseWheelZoom'] as boolean) || false,
      smoothScrolling: (settings['editor.smoothScrolling'] as boolean) || false,
      folding: (settings['editor.folding'] as boolean) !== false,
      bracketPairColorization: { enabled: (settings['editor.bracketPairColorization.enabled'] as boolean) !== false },
      stickyScroll: { enabled: (settings['editor.stickyScroll.enabled'] as boolean) !== false },
      padding: {
        top: (settings['editor.padding.top'] as number) || 0,
        bottom: (settings['editor.padding.bottom'] as number) || 0,
      },
    });
    // Apply theme
    const theme = (settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    if (theme === 'hypothesis-light' || theme === 'vs') {
      monaco.editor.setTheme('vs');
    } else if (theme === 'hc-black') {
      monaco.editor.setTheme('hc-black');
    } else {
      monaco.editor.setTheme('vs-dark');
    }
  }, [
    settings['editor.fontSize'], settings['editor.fontFamily'], settings['editor.tabSize'], settings['editor.insertSpaces'],
    settings['editor.lineHeight'], settings['editor.cursorStyle'], settings['editor.cursorBlinking'],
    settings['editor.renderWhitespace'], settings['editor.autoIndent'],
    settings['editor.mouseWheelZoom'], settings['editor.smoothScrolling'],
    settings['editor.folding'], settings['editor.bracketPairColorization.enabled'],
    settings['editor.stickyScroll.enabled'],
    settings['editor.padding.top'], settings['editor.padding.bottom'],
    settings['workbench.colorTheme'],
  ]);

  // Focus and register as active editor when tab becomes active
  useEffect(() => {
    if (isActive && monacoRef.current) {
      monacoRef.current.focus();
      useEditorStore.getState().setActiveEditor(monacoRef.current);
    }
  }, [isActive]);

  // Update content when tab changes externally
  useEffect(() => {
    if (monacoRef.current && isReady) {
      const currentValue = monacoRef.current.getValue();
      if (currentValue !== tab.content) {
        monacoRef.current.setValue(tab.content);
      }
    }
  }, [tab.content]);

  return (
    <div
      ref={editorRef}
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
};
