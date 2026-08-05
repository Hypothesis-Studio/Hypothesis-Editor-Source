/**
 * Monaco Editor Component - Core editor with full feature support.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as monaco from 'monaco-editor';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeStore } from '../../stores/themeStore';
import { format as prettierFormat } from 'prettier';
import * as prettierBabel from 'prettier/plugins/babel';
import * as prettierEstree from 'prettier/plugins/estree';
import * as prettierTypescript from 'prettier/plugins/typescript';
import * as prettierHtml from 'prettier/plugins/html';
import * as prettierCss from 'prettier/plugins/postcss';
import * as prettierMarkdown from 'prettier/plugins/markdown';
import { useEditorStore } from '../../stores/editorStore';
import type { EditorTab } from '../../../shared/types';
import { AIInlineEditWidget } from './AIInlineEditWidget';
import * as ReactDOM from 'react-dom/client';
import { useSnippetStore } from '../../stores/snippetStore';

interface MonacoEditorProps {
  tab: EditorTab;
  isActive: boolean;
}

// Configure Monaco Editor workers
// Uses pre-bundled worker files from public/workers/ for Electron compatibility.
// The import.meta.url + /monaco-editor/esm/... approach only works in Vite dev server,
// not in Electron production (file:// protocol). Static worker files resolve correctly.
const setupMonacoWorkers = () => {
  (self as unknown as Record<string, unknown>).MonacoEnvironment = {
    getWorkerUrl: function (_moduleId: string, label: string): string {
      // Use relative paths so workers resolve correctly under both
      // Vite dev server (http://) and Electron production (file://).
      // Absolute paths like /workers/... fail under file:// protocol.
      switch (label) {
        case 'json':
          return './workers/json.worker.js';
        case 'css':
        case 'scss':
        case 'less':
          return './workers/css.worker.js';
        case 'html':
        case 'handlebars':
        case 'razor':
          return './workers/html.worker.js';
        case 'typescript':
        case 'javascript':
          return './workers/ts.worker.js';
        default:
          return './workers/editor.worker.js';
      }
    },
  };
};

setupMonacoWorkers();

export const MonacoEditor: React.FC<MonacoEditorProps> = ({ tab, isActive }) => {
  // Skip Monaco for agent virtual tab - must be before hooks
  if (tab.id === 'agent-tab') return null;

  return <MonacoEditorInner tab={tab} isActive={isActive} />;
};

const MonacoEditorInner: React.FC<MonacoEditorProps> = ({ tab, isActive }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoThemeRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monacoThemesAppliedRef = useRef<Set<string>>(new Set());
  const { updateTab, setCursorPosition, setTabDirty } = useEditorStore();
  const { wordWrap, minimapVisible, lineNumbers, stickyScroll, breadcrumbsVisible } = useAppStore();
  const { settings } = useSettingsStore();
  const [isReady, setIsReady] = useState(false);
  const aiWidgetRootRef = useRef<ReactDOM.Root | null>(null);
  const aiWidgetContainerRef = useRef<HTMLDivElement | null>(null);

  const openAIInlineEdit = useCallback((ed: monaco.editor.IStandaloneCodeEditor) => {
    // Close any existing widget
    if (aiWidgetRootRef.current) {
      aiWidgetRootRef.current.unmount();
      aiWidgetRootRef.current = null;
    }
    if (aiWidgetContainerRef.current) {
      aiWidgetContainerRef.current.remove();
      aiWidgetContainerRef.current = null;
    }

    const selections = ed.getSelections() ?? [];
    const hasSelection = selections.some(s => !s.isEmpty());
    if (!hasSelection) return;

    const container = document.createElement('div');
    document.body.appendChild(container);
    aiWidgetContainerRef.current = container;

    const root = ReactDOM.createRoot(container);
    aiWidgetRootRef.current = root;

    const close = () => {
      root.unmount();
      container.remove();
      aiWidgetRootRef.current = null;
      aiWidgetContainerRef.current = null;
      ed.focus();
    };

    root.render(
      React.createElement(AIInlineEditWidget, { editor: ed, onClose: close })
    );
  }, []);

  // Create editor
  useEffect(() => {
    if (!editorRef.current) return;

    const fontSize = (settings['editor.fontSize'] as number) || 14;
    const fontFamily = (settings['editor.fontFamily'] as string) || "'JetBrains Mono', monospace";
    const tabSize = (settings['editor.tabSize'] as number) || 2;
    const lineHeight = (settings['editor.lineHeight'] as number) || 24;
    const cursorStyle = (settings['editor.cursorStyle'] as string) || 'line';
    const cursorBlinking = (settings['editor.cursorBlinking'] as string) || 'blink';
    const cursorSmoothCaretAnimation = (settings['editor.cursorSmoothCaretAnimation'] as string) || 'on';
    const renderWhitespace = (settings['editor.renderWhitespace'] as string) || 'none';
    const autoIndent = (settings['editor.autoIndent'] as string) || 'advanced';
    const mouseWheelZoom = (settings['editor.mouseWheelZoom'] as boolean) || false;
    const smoothScrolling = (settings['editor.smoothScrolling'] as boolean) || false;
    const paddingTop = (settings['editor.padding.top'] as number) || 0;
    const paddingBottom = (settings['editor.padding.bottom'] as number) || 0;

    // Suggestions & snippets
    const quickSuggestionsDelay = (settings['editor.quickSuggestionsDelay'] as number) ?? 10;
    const suggestPreview = (settings['editor.suggest.preview'] as boolean) !== false;
    const suggestInsertMode = (settings['editor.suggest.insertMode'] as string) || 'replace';
    const suggestFilterGraceful = (settings['editor.suggest.filterGraceful'] as boolean) !== false;
    const suggestShowStatusBar = (settings['editor.suggest.showStatusBar'] as boolean) !== false;
    const suggestSnippetsPreventQuick = (settings['editor.suggest.snippetsPreventQuickSuggestions'] as boolean) || false;
    const inlineSuggestEnabled = (settings['editor.inlineSuggest.enabled'] as boolean) !== false;

    // Hover
    const hoverEnabled = (settings['editor.hover.enabled'] as boolean) !== false;
    const hoverDelay = (settings['editor.hover.delay'] as number) ?? 300;
    const hoverSticky = (settings['editor.hover.sticky'] as boolean) !== false;
    const hoverAbove = (settings['editor.hover.above'] as boolean) !== false;

    // Find
    const findAutoFindInSelection = (settings['editor.find.autoFindInSelection'] as string) || 'multiline';
    const findLoop = (settings['editor.find.loop'] as boolean) !== false;
    const findCursorMoveOnType = (settings['editor.find.cursorMoveOnType'] as boolean) !== false;

    // Unicode highlight
    const unicodeAmbiguous = (settings['editor.unicodeHighlight.ambiguousCharacters'] as boolean) !== false;
    const unicodeInvisible = (settings['editor.unicodeHighlight.invisibleCharacters'] as boolean) !== false;
    const unicodeNonBasicASCII = (settings['editor.unicodeHighlight.nonBasicASCII'] as boolean) || false;

    // Semantic highlighting
    const semanticHighlighting = (settings['editor.semanticHighlighting.enabled'] as boolean) !== false;

    // Accessibility
    const accessibilitySupport = (settings['accessibility.supportAccessibilityMode'] as boolean) ? 'on' : 'auto';

    // Determine base Monaco theme from current settings
    const colorThemeForCreate = (settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    const extThemeForCreate = useThemeStore.getState().extensionThemes[colorThemeForCreate];
    let baseMonacoForCreate: string;
    if (colorThemeForCreate === 'hc-black') {
      baseMonacoForCreate = 'hc-black';
    } else if (extThemeForCreate) {
      baseMonacoForCreate = extThemeForCreate.type === 'light' ? 'vs' : 'vs-dark';
    } else {
      baseMonacoForCreate = (colorThemeForCreate === 'hypothesis-light' || colorThemeForCreate === 'vs') ? 'vs' : 'vs-dark';
    }

    const editor = monaco.editor.create(editorRef.current, {
      value: tab.content,
      language: tab.language,
      theme: baseMonacoForCreate as any,
      automaticLayout: true,
      unusualLineTerminators: 'off',
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
      cursorSmoothCaretAnimation: cursorSmoothCaretAnimation as any,
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
        maxLineCount: 5,
        defaultModel: 'foldingProviderModel',
        scrollWithEditor: true,
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
      tabCompletion: 'on',
      snippetSuggestions: 'inline',
      quickSuggestions: {
        other: (settings['editor.quickSuggestions.other'] as boolean) !== false,
        comments: (settings['editor.quickSuggestions.comments'] as boolean) !== false,
        strings: (settings['editor.quickSuggestions.strings'] as boolean) !== false,
      },
      quickSuggestionsDelay,
      inlineSuggest: {
        enabled: inlineSuggestEnabled,
        mode: 'prefix',
      },
      codeLens: true,
      lightbulb: {
        // @ts-ignore - LightbulbIconOption may not exist in all Monaco versions
        enabled: (monaco.editor as any).LightbulbIconOption?.On ?? true,
      },
      hover: {
        enabled: hoverEnabled,
        delay: hoverDelay,
        sticky: hoverSticky,
        above: hoverAbove,
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
        useShadows: true,
      },
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: findAutoFindInSelection as any,
        seedSearchStringFromSelection: 'selection',
        loop: findLoop,
        cursorMoveOnType: findCursorMoveOnType,
      },
      wordBasedSuggestions: 'allDocuments',
      accessibilitySupport: accessibilitySupport as any,
      unicodeHighlight: {
        ambiguousCharacters: unicodeAmbiguous,
        invisibleCharacters: unicodeInvisible,
        nonBasicASCII: unicodeNonBasicASCII,
      },
      'semanticHighlighting.enabled': semanticHighlighting,
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
        preview: suggestPreview,
        insertMode: suggestInsertMode as any,
        filterGraceful: suggestFilterGraceful,
        showStatusBar: suggestShowStatusBar,
        snippetsPreventQuickSuggestions: suggestSnippetsPreventQuick,
      },
    });

    monacoRef.current = editor;
    setIsReady(true);

    // Re-apply the current extension theme after editor creation.
    // monaco.editor.create() resets the global theme, so we must re-apply.
    const currentThemeId = (settings['workbench.colorTheme'] as string) || 'hypothesis-dark';
    const currentExtTheme = useThemeStore.getState().extensionThemes[currentThemeId];
    if (currentExtTheme) {
      const baseMonacoTheme = currentExtTheme.type === 'light' ? 'vs' : 'vs-dark';
      // defineTheme is idempotent — safe to call again
      const rules: any[] = [];
      if (currentExtTheme.tokenColors) {
        for (const tc of currentExtTheme.tokenColors) {
          const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
          for (const scope of scopes) {
            rules.push({ token: scope, foreground: tc.settings?.foreground?.replace('#', ''), fontStyle: tc.settings?.fontStyle || '' });
          }
        }
      }
      const colors: Record<string, string> = {};
      for (const [key, value] of Object.entries(currentExtTheme.rawColors || currentExtTheme.colors || {})) {
        if (typeof value === 'string') colors[key] = value;
      }
      monaco.editor.defineTheme(currentThemeId, { base: baseMonacoTheme as any, inherit: true, rules, colors });
      // Apply with delay to ensure Monaco processes it
      requestAnimationFrame(() => monaco.editor.setTheme(currentThemeId));
      setTimeout(() => monaco.editor.setTheme(currentThemeId), 200);
      setTimeout(() => monaco.editor.setTheme(currentThemeId), 500);
    } else if (baseMonacoForCreate !== 'vs-dark') {
      // Ensure built-in light/default themes apply to newly created editors too
      requestAnimationFrame(() => monaco.editor.setTheme(baseMonacoForCreate));
      setTimeout(() => monaco.editor.setTheme(baseMonacoForCreate), 200);
    }

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

    // AI Inline Edit — Ctrl+K Ctrl+K
    editor.addAction({
      id: 'hypothesis.action.aiInlineEdit',
      label: 'AI Edit Selection',
      keybindings: [
        monaco.KeyMod.chord(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
        ),
      ],
      run: () => openAIInlineEdit(editor),
    });

    editor.addAction({
      id: 'duplicate-line-real',
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

    // --- Formatting helpers (shared by actions + providers) ---

    const builtinFormat = (text: string, langId: string, tabSz: number, useSpaces: boolean): string => {
      const lines = text.split('\n');
      const indentChar = useSpaces ? ' '.repeat(tabSz) : '\t';
      const formatted = lines.map((line) => {
        // Trim trailing whitespace
        let trimmed = line.replace(/\s+$/, '');
        // Normalize leading whitespace to consistent indentation
        if (trimmed.length > 0) {
          const match = trimmed.match(/^(\s*)/);
          if (match) {
            const rawIndent = match[1];
            if (useSpaces && rawIndent.includes('\t')) {
              // Convert tabs to spaces
              let col = 0;
              for (const ch of rawIndent) {
                col += ch === '\t' ? tabSz - (col % tabSz) : 1;
              }
              const indentLevel = Math.floor(col / tabSz);
              trimmed = indentChar.repeat(indentLevel) + trimmed.slice(rawIndent.length);
            } else if (!useSpaces && rawIndent.includes(' ')) {
              // Convert spaces to tabs
              let col = 0;
              for (const ch of rawIndent) {
                col += ch === ' ' ? 1 : (ch === '\t' ? tabSz : 1);
              }
              const indentLevel = Math.floor(col / tabSz);
              trimmed = indentChar.repeat(indentLevel) + trimmed.slice(rawIndent.length);
            }
          }
        }
        return trimmed;
      });
      let result = formatted.join('\n');
      // Ensure final newline
      if (!result.endsWith('\n')) {
        result += '\n';
      }
      return result;
    };

    const langToPlugin: Record<string, string> = {
      javascript: 'babel', typescript: 'typescript', json: 'json',
      html: 'html', css: 'css', scss: 'css', less: 'css',
      markdown: 'markdown', yaml: 'babel', graphql: 'babel',
    };

    const tryPrettierFormat = async (text: string, langId: string): Promise<string | null> => {
      try {
        // Resolve parser
        let parser = langToPlugin[langId];
        if (!parser && tab.filePath) {
          const ext = tab.filePath.split('.').pop()?.toLowerCase();
          const extMap: Record<string, string> = {
            js: 'babel', jsx: 'babel', mjs: 'babel', cjs: 'babel',
            ts: 'typescript', tsx: 'typescript',
            json: 'json', html: 'html', css: 'css', scss: 'css', less: 'css',
            md: 'markdown', yml: 'babel', yaml: 'babel',
          };
          if (ext) parser = extMap[ext];
        }
        if (!parser) parser = 'babel';

        // Build plugins array based on parser
        const plugins: any[] = [];
        if (parser === 'babel') {
          plugins.push(prettierBabel, prettierEstree);
        } else if (parser === 'typescript') {
          plugins.push(prettierTypescript, prettierEstree);
        } else if (parser === 'html') {
          plugins.push(prettierHtml);
        } else if (parser === 'css') {
          plugins.push(prettierCss);
        } else if (parser === 'markdown') {
          plugins.push(prettierMarkdown);
        }

        const result = await prettierFormat(text, {
          parser,
          plugins,
          filepath: tab.filePath || undefined,
          singleQuote: true,
          trailingComma: 'all',
          tabWidth: fmtTabSize,
          semi: true,
          printWidth: 100,
        });

        if (result && typeof result === 'string' && result !== text) {
          return result;
        }
      } catch (err) {
        console.warn('[Format] Prettier error:', (err as any)?.message);
      }
      return null;
    };

    const fmtTabSize = (settings['editor.tabSize'] as number) || 2;
    const fmtInsertSpaces = (settings['editor.insertSpaces'] as boolean) !== false;

    // Core format functions (used by actions, providers, and store triggers)
    const doFormatDocument = async (ed: monaco.editor.IStandaloneCodeEditor) => {
      const model = ed.getModel();
      if (!model) return;
      const currentText = model.getValue();
      const langId = model.getLanguageId();
      const formatted = await tryPrettierFormat(currentText, langId)
        ?? builtinFormat(currentText, langId, fmtTabSize, fmtInsertSpaces);
      if (formatted !== currentText) {
        ed.executeEdits('builtin-format', [{ range: model.getFullModelRange(), text: formatted }]);
      }
    };

    const doFormatSelection = async (ed: monaco.editor.IStandaloneCodeEditor) => {
      const model = ed.getModel();
      if (!model) return;
      const selection = ed.getSelection();
      if (!selection || selection.isEmpty()) return;
      const selectedText = model.getValueInRange(selection);
      const langId = model.getLanguageId();
      const formatted = await tryPrettierFormat(selectedText, langId)
        ?? builtinFormat(selectedText, langId, fmtTabSize, fmtInsertSpaces);
      if (formatted !== selectedText) {
        ed.executeEdits('builtin-format-selection', [{ range: selection, text: formatted }]);
      }
    };

    // Disable Monaco's built-in context menu — we provide our own
    editor.updateOptions({ contextmenu: false });

    // Expose format functions on the editor instance for external triggers
    (editor as any).__hypothesis_formatDocument = doFormatDocument;
    (editor as any).__hypothesis_formatSelection = doFormatSelection;

    // Register keyboard shortcut action
    const formatAction = editor.addAction({
      id: 'hypothesis.action.formatDocument',
      label: 'Format Document',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: doFormatDocument,
    });

    // Hover provider - disabled for clean UI
    const provideHover = () => null;

    const hoverLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'];
    const hoverProviders = hoverLanguages.map(lang =>
      monaco.languages.registerHoverProvider(lang, { provideHover })
    );
    const fallbackHover = monaco.languages.registerHoverProvider('*', { provideHover });

    // Custom right-click context menu
    const contextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      // Remove any existing custom menu
      document.querySelectorAll('.hypothesis-context-menu').forEach(el => el.remove());

      const hasSelection = !editor.getSelection()?.isEmpty();
      const items: Array<{ label: string; shortcut?: string; action: () => void; className?: string } | 'separator'> = [
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => { editor.trigger('menu', 'editor.action.clipboardCutAction', undefined); } },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => { editor.trigger('menu', 'editor.action.clipboardCopyAction', undefined); } },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => { editor.trigger('menu', 'editor.action.clipboardPasteAction', undefined); } },
        'separator',
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => { editor.trigger('menu', 'editor.action.selectAll', undefined); } },
        'separator',
        { label: 'Format Document', shortcut: 'Shift+Alt+F', action: () => doFormatDocument(editor) },
        ...(hasSelection ? [{ label: 'Format Selection', action: () => doFormatSelection(editor) }] as const : []),
        'separator',
        { label: 'Go to Definition', shortcut: 'F12', action: () => { editor.trigger('menu', 'editor.action.revealDefinition', undefined); } },
        { label: 'Peek Definition', shortcut: 'Alt+F12', action: () => { editor.trigger('menu', 'editor.action.peekDefinition', undefined); } },
      ...(hasSelection ? [
          'separator',
          { label: 'Ask AI Agent', action: () => {
            const sel = editor.getSelection();
            const selectedText = sel && !sel.isEmpty() ? editor.getModel()?.getValueInRange(sel) || '' : '';
            window.dispatchEvent(new CustomEvent('hypothesis:open-agent-tab', { detail: { code: selectedText, mode: 'ask' } }));
          }},
          { label: 'AI Edit (Multi-Cursor)', shortcut: 'Ctrl+K Ctrl+K', action: () => openAIInlineEdit(editor) },
      ] as const : []),
        'separator',
        { label: 'Command Palette', shortcut: 'Ctrl+Shift+P', action: () => { useAppStore.getState().toggleCommandPalette(); } },
      ];

      const menu = document.createElement('div');
      menu.className = 'hypothesis-context-menu';
      menu.style.cssText = `position:fixed;z-index:99999;left:${Math.min(e.clientX, window.innerWidth - 220)}px;top:${Math.min(e.clientY, window.innerHeight - items.length * 30)}px;`
        + `background:var(--theme-editor-background,#1e1e1e);border:1px solid var(--theme-border,#3c3c3c);`
        + `border-radius:4px;padding:4px 0;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.4);font-size:13px;`
        + `font-family:var(--theme-font-family,sans-serif);color:var(--theme-foreground,#ccc);`;

      items.forEach(item => {
        if (item === 'separator') {
          const sep = document.createElement('div');
          sep.style.cssText = 'height:1px;background:var(--theme-border,#3c3c3c);margin:4px 0;';
          menu.appendChild(sep);
        } else {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;justify-content:space-between;padding:4px 12px;cursor:pointer;white-space:nowrap;';
          row.onmouseenter = () => { row.style.background = 'var(--theme-accent,#094771)'; };
          row.onmouseleave = () => { row.style.background = 'transparent'; };
          row.textContent = item.label;
          if ('shortcut' in item && item.shortcut) {
            const shortcutEl = document.createElement('span');
            shortcutEl.textContent = item.shortcut;
            shortcutEl.style.cssText = 'opacity:0.5;margin-left:24px;font-size:12px;';
            row.appendChild(shortcutEl);
          }
          row.onclick = () => { menu.remove(); item.action(); };
          menu.appendChild(row);
        }
      });

      document.body.appendChild(menu);

      const closeMenu = (ev: MouseEvent) => {
        if (!menu.contains(ev.target as Node)) {
          menu.remove();
          document.removeEventListener('mousedown', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
    };

    const editorDom = editor.getDomNode();
    if (editorDom) editorDom.addEventListener('contextmenu', contextMenuHandler);

    // ── Register user snippet completion provider ──────────────
    const snippetProvider = monaco.languages.registerCompletionItemProvider('*', {
      triggerCharacters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split(''),
      provideCompletionItems(model, position) {
        const langId = model.getLanguageId();
        const allSnippets = useSnippetStore.getState().snippets;
        const applicable = allSnippets.filter(s =>
          !s.scope || s.scope === langId || s.language === langId
        );
        if (applicable.length === 0) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber, word.startColumn,
          position.lineNumber, word.endColumn,
        );

        const suggestions: monaco.languages.CompletionItem[] = applicable.map(s => {
          const bodyLines: string[] = Array.isArray(s.body)
            ? s.body
            : s.body.split('\n');
          return {
            label: s.prefix,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: s.name,
            documentation: s.description || undefined,
            insertText: bodyLines.join('\n'),
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `0_${s.prefix}`,
          };
        });
        return { suggestions };
      },
    });

    // Focus editor if active
    if (isActive) {
      editor.focus();
    }

    return () => {
      formatAction.dispose();
      snippetProvider.dispose();
      hoverProviders.forEach(p => p.dispose());
      fallbackHover.dispose();
      contentChangeDisposable.dispose();
      cursorChangeDisposable.dispose();
      scrollChangeDisposable.dispose();
      if (editorDom) editorDom.removeEventListener('contextmenu', contextMenuHandler);
      document.querySelectorAll('.hypothesis-context-menu').forEach(el => el.remove());
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
      stickyScroll: {
        enabled: stickyScroll,
        maxLineCount: 5,
        defaultModel: 'foldingProviderModel',
        scrollWithEditor: true,
      },
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
      cursorSmoothCaretAnimation: (settings['editor.cursorSmoothCaretAnimation'] as any) || 'on',
      renderWhitespace: (settings['editor.renderWhitespace'] as any) || 'none',
      autoIndent: (settings['editor.autoIndent'] as any) || 'advanced',
      mouseWheelZoom: (settings['editor.mouseWheelZoom'] as boolean) || false,
      smoothScrolling: (settings['editor.smoothScrolling'] as boolean) || false,
      folding: (settings['editor.folding'] as boolean) !== false,
      bracketPairColorization: { enabled: (settings['editor.bracketPairColorization.enabled'] as boolean) !== false },
      stickyScroll: {
        enabled: (settings['editor.stickyScroll.enabled'] as boolean) !== false,
        maxLineCount: 5,
        defaultModel: 'foldingProviderModel',
        scrollWithEditor: true,
      },
      padding: {
        top: (settings['editor.padding.top'] as number) || 0,
        bottom: (settings['editor.padding.bottom'] as number) || 0,
      },
      quickSuggestions: {
        other: (settings['editor.quickSuggestions.other'] as boolean) !== false,
        comments: (settings['editor.quickSuggestions.comments'] as boolean) !== false,
        strings: (settings['editor.quickSuggestions.strings'] as boolean) !== false,
      },
      quickSuggestionsDelay: (settings['editor.quickSuggestionsDelay'] as number) ?? 10,
      inlineSuggest: {
        enabled: (settings['editor.inlineSuggest.enabled'] as boolean) !== false,
        mode: 'prefix',
      },
      suggest: {
        showSnippets: true,
        preview: (settings['editor.suggest.preview'] as boolean) !== false,
        insertMode: ((settings['editor.suggest.insertMode'] as string) || 'replace') as any,
        filterGraceful: (settings['editor.suggest.filterGraceful'] as boolean) !== false,
        showStatusBar: (settings['editor.suggest.showStatusBar'] as boolean) !== false,
        snippetsPreventQuickSuggestions: (settings['editor.suggest.snippetsPreventQuickSuggestions'] as boolean) || false,
      },
      hover: {
        enabled: (settings['editor.hover.enabled'] as boolean) !== false,
        delay: (settings['editor.hover.delay'] as number) ?? 300,
        sticky: (settings['editor.hover.sticky'] as boolean) !== false,
        above: (settings['editor.hover.above'] as boolean) !== false,
      },
      find: {
        addExtraSpaceOnTop: false,
        autoFindInSelection: ((settings['editor.find.autoFindInSelection'] as string) || 'multiline') as any,
        seedSearchStringFromSelection: 'selection',
        loop: (settings['editor.find.loop'] as boolean) !== false,
        cursorMoveOnType: (settings['editor.find.cursorMoveOnType'] as boolean) !== false,
      },
      unicodeHighlight: {
        ambiguousCharacters: (settings['editor.unicodeHighlight.ambiguousCharacters'] as boolean) !== false,
        invisibleCharacters: (settings['editor.unicodeHighlight.invisibleCharacters'] as boolean) !== false,
        nonBasicASCII: (settings['editor.unicodeHighlight.nonBasicASCII'] as boolean) || false,
      },
      accessibilitySupport: ((settings['accessibility.supportAccessibilityMode'] as boolean) ? 'on' : 'auto') as any,
      'semanticHighlighting.enabled': (settings['editor.semanticHighlighting.enabled'] as boolean) !== false,
    });
    // NOTE: Theme is handled by the creation effect above + the ext:monaco:defineTheme listener.
    // Do NOT set theme here — it would override extension themes on every settings change.
  }, [
    settings['editor.fontSize'], settings['editor.fontFamily'], settings['editor.tabSize'], settings['editor.insertSpaces'],
    settings['editor.lineHeight'], settings['editor.cursorStyle'], settings['editor.cursorBlinking'],
    settings['editor.cursorSmoothCaretAnimation'],
    settings['editor.renderWhitespace'], settings['editor.autoIndent'],
    settings['editor.mouseWheelZoom'], settings['editor.smoothScrolling'],
    settings['editor.folding'], settings['editor.bracketPairColorization.enabled'],
    settings['editor.stickyScroll.enabled'],
    settings['editor.padding.top'], settings['editor.padding.bottom'],
    settings['editor.quickSuggestions.other'], settings['editor.quickSuggestions.comments'], settings['editor.quickSuggestions.strings'],
    settings['editor.quickSuggestionsDelay'],
    settings['editor.suggest.preview'], settings['editor.suggest.insertMode'],
    settings['editor.suggest.filterGraceful'], settings['editor.suggest.showStatusBar'],
    settings['editor.suggest.snippetsPreventQuickSuggestions'],
    settings['editor.inlineSuggest.enabled'],
    settings['editor.hover.enabled'], settings['editor.hover.delay'],
    settings['editor.hover.sticky'], settings['editor.hover.above'],
    settings['editor.find.autoFindInSelection'], settings['editor.find.loop'], settings['editor.find.cursorMoveOnType'],
    settings['editor.unicodeHighlight.ambiguousCharacters'],
    settings['editor.unicodeHighlight.invisibleCharacters'],
    settings['editor.unicodeHighlight.nonBasicASCII'],
    settings['editor.semanticHighlighting.enabled'],
    settings['accessibility.supportAccessibilityMode'],
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

  // ── Listen for extension Monaco theme registration ─────────────
  useEffect(() => {
    const api = (window as any).api;
    if (!api?.menu?.onChannel) return;
    const unsubs: Array<() => void> = [];

    // When extension defines a Monaco theme, register it AND apply if it's the current theme
    unsubs.push(api.menu.onChannel('ext:monaco:defineTheme', (data: any) => {
      if (data?.themeId && data?.baseTheme) {
        try {
          monaco.editor.defineTheme(data.themeId, {
            base: data.baseTheme,
            inherit: true,
            rules: data.rules || [],
            colors: data.colors || {},
          });
          // Apply immediately if this is the current workbench theme
          const currentTheme = useSettingsStore.getState().settings['workbench.colorTheme'] || 'hypothesis-dark';
          if (currentTheme === data.themeId) {
            requestAnimationFrame(() => monaco.editor.setTheme(data.themeId));
            setTimeout(() => monaco.editor.setTheme(data.themeId), 200);
            setTimeout(() => monaco.editor.setTheme(data.themeId), 500);
          }
        } catch (e) {
          console.warn('Failed to define Monaco theme:', e);
        }
      }
    }));

    // When extension themes are unregistered, revert to default
    unsubs.push(api.menu.onChannel('ext:monaco:unregister', (themeIds: string[]) => {
      if (Array.isArray(themeIds)) {
        const currentTheme = useSettingsStore.getState().settings['workbench.colorTheme'] || 'hypothesis-dark';
        if (themeIds.includes(currentTheme)) {
          useSettingsStore.getState().setSetting('workbench.colorTheme', 'hypothesis-dark');
          monaco.editor.setTheme('vs-dark');
        }
      }
    }));

    unsubs.push(api.menu.onChannel('ext:monaco:setTheme', (themeId: string) => {
      if (themeId) {
        try { monaco.editor.setTheme(themeId); } catch {}
      }
    }));

    // NOTE: ext:theme:revert is never sent from main process — removed dead code.
    // Theme revert logic lives in unregisterExtensionTheme() in themeStore.

    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div
      ref={editorRef}
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
};
