/**
 * Settings Service - Manages application settings.
 */
import type { AppStore } from './AppStore';
import type { AppSettings } from '../../shared/types';
import { logger } from '../utils/logger';

const DEFAULT_SETTINGS: Partial<AppSettings> = {
  'editor.fontSize': 14,
  'editor.fontFamily': "'JetBrains Mono', monospace",
  'editor.fontWeight': '400',
  'editor.fontLigatures': true,
  'editor.lineHeight': 1.6,
  'editor.letterSpacing': 0,
  'editor.tabSize': 2,
  'editor.insertSpaces': true,
  'editor.wordWrap': 'off',
  'editor.wordWrapColumn': 80,
  'editor.minimap.enabled': true,
  'editor.minimap.side': 'right',
  'editor.minimap.renderCharacters': true,
  'editor.minimap.maxColumn': 80,
  'editor.lineNumbers': 'on',
  'editor.renderWhitespace': 'none',
  'editor.cursorStyle': 'line',
  'editor.cursorBlinking': 'blink',
  'editor.cursorSmoothCaretAnimation': 'on',
  'editor.bracketPairColorization.enabled': true,
  'editor.guides.bracketPairs': true,
  'editor.guides.indentation': true,
  'editor.guides.highlightActiveIndentation': true,
  'editor.stickyScroll.enabled': true,
  'editor.folding': true,
  'editor.foldingStrategy': 'auto',
  'editor.showFoldingControls': 'mouseover',
  'editor.autoIndent': 'advanced',
  'editor.formatOnSave': false,
  'editor.formatOnPaste': false,
  'editor.formatOnType': false,
  'editor.suggestOnTriggerCharacters': true,
  'editor.acceptSuggestionOnCommitCharacter': true,
  'editor.acceptSuggestionOnEnter': 'on',
  'editor.tabCompletion': 'on',
  'editor.snippetSuggestions': 'inline',
  'editor.quickSuggestions.other': true,
  'editor.quickSuggestions.comments': true,
  'editor.quickSuggestions.strings': true,
  'editor.quickSuggestionsDelay': 10,
  'editor.suggest.preview': true,
  'editor.suggest.insertMode': 'replace',
  'editor.suggest.filterGraceful': true,
  'editor.suggest.showStatusBar': true,
  'editor.suggest.snippetsPreventQuickSuggestions': false,
  'editor.inlineSuggest.enabled': true,
  'editor.codeLens': true,
  'editor.lightbulb.enabled': true,
  'editor.hover.enabled': true,
  'editor.hover.delay': 300,
  'editor.hover.sticky': true,
  'editor.hover.above': true,
  'editor.links': true,
  'editor.colorDecorators': true,
  'editor.contextmenu': true,
  'editor.mouseWheelZoom': false,
  'editor.multiCursorModifier': 'ctrlCmd',
  'editor.occurrencesHighlight': 'singleFile',
  'editor.selectionHighlight': true,
  'editor.overviewRulerBorder': true,
  'editor.hideCursorInOverviewRuler': false,
  'editor.scrollBeyondLastLine': true,
  'editor.smoothScrolling': false,
  'editor.padding.top': 0,
  'editor.padding.bottom': 0,
  'editor.find.autoFindInSelection': 'multiline',
  'editor.find.seedSearchStringFromSelection': 'selection',
  'editor.find.loop': true,
  'editor.find.cursorMoveOnType': true,
  'editor.unicodeHighlight.ambiguousCharacters': true,
  'editor.unicodeHighlight.invisibleCharacters': true,
  'editor.unicodeHighlight.nonBasicASCII': false,
  'editor.accessibilitySupport': 'auto',
  'editor.semanticHighlighting.enabled': true,
  'files.autoSave': 'off',
  'files.autoSaveDelay': 1000,
  'files.encoding': 'utf8',
  'files.eol': '\n',
  'files.trimTrailingWhitespace': false,
  'files.insertFinalNewline': false,
  'files.trimFinalNewlines': false,
  'files.exclude': {},
  'files.watcherExclude': {},
  'files.associations': {},
  'workbench.colorTheme': 'hypothesis-dark',
  'workbench.iconTheme': 'material',
  'workbench.sideBar.location': 'left',
  'workbench.panel.defaultLocation': 'bottom',
  'workbench.editor.showTabs': true,
  'workbench.editor.tabCloseButton': 'right',
  'workbench.editor.tabSizing': 'fit',
  'workbench.editor.enablePreview': false,
  'workbench.editor.enablePreviewFromQuickOpen': false,
  'workbench.editor.closeOnFileDelete': true,
  'workbench.startupEditor': 'welcomePage',
  'workbench.tree.indent': 8,
  'workbench.list.openMode': 'singleClick',
  'terminal.integrated.fontSize': 12,
  'terminal.integrated.fontFamily': "'JetBrains Mono', monospace",
  'terminal.integrated.lineHeight': 1.4,
  'terminal.integrated.scrollback': 1000,
  'terminal.integrated.cursorStyle': 'block',
  'terminal.integrated.cursorBlinking': true,
  'terminal.integrated.copyOnSelection': false,

  'search.exclude': {},
  'search.useIgnoreFiles': true,
  'search.followSymlinks': true,
  'git.enabled': true,
  'git.autofetch': false,
  'git.confirmSync': true,
  'git.enableSmartCommit': false,
  'window.zoomLevel': 0,
  'window.title': '${dirty}${activeEditorShort} — ${rootName}',
  'window.restoreWindows': 'all',
  'window.newWindowDimensions': 'inherit',
  'telemetry.telemetryLevel': 'off',
  'extensions.autoUpdate': true,
  'extensions.showRecommendationsOnlyOnDemand': false,
  'update.channel': 'stable',
  'accessibility.supportAccessibilityMode': false,

  // Agent defaults
  'agent.enabled': true,
  'agent.defaultTemperature': 0.7,
  'agent.defaultMaxTokens': 4096,
  'agent.streaming': true,
  'agent.maxTurns': 20,
  'agent.maxToolCalls': 10,
  'agent.toolCallTimeout': 30000,
  'agent.memoryEnabled': true,
  'agent.memoryMaxTokens': 4000,
  'agent.planningEnabled': true,
  'agent.planningMaxSteps': 10,
  'agent.retryOnFailure': true,
  'agent.maxRetries': 3,
  'agent.retryDelayMs': 1000,
  'agent.requestTimeout': 60000,
  'agent.logLevel': 'info',
  'agent.telemetryEnabled': false,
};

export class SettingsService {
  private appStore: AppStore;
  private cachedSettings: Partial<AppSettings>;

  constructor(appStore: AppStore) {
    this.appStore = appStore;
    this.cachedSettings = {};
  }

  async initialize(): Promise<void> {
    const stored = this.appStore.get('settings');
    this.cachedSettings = { ...DEFAULT_SETTINGS, ...stored };
    this.appStore.set('settings', this.cachedSettings);
    logger.info('Settings service initialized');
  }

  get<T>(key: string): T {
    return (this.cachedSettings[key] ?? DEFAULT_SETTINGS[key]) as T;
  }

  set(key: string, value: unknown): void {
    this.cachedSettings[key] = value;
    this.appStore.set('settings', this.cachedSettings);
  }

  getAll(): Partial<AppSettings> {
    return { ...this.cachedSettings };
  }

  reset(key: string): void {
    const defaultVal = DEFAULT_SETTINGS[key];
    if (defaultVal !== undefined) {
      this.cachedSettings[key] = defaultVal;
    } else {
      delete this.cachedSettings[key];
    }
    this.appStore.set('settings', this.cachedSettings);
  }

  resetAll(): void {
    this.cachedSettings = { ...DEFAULT_SETTINGS };
    this.appStore.set('settings', this.cachedSettings);
  }

  export(): string {
    return JSON.stringify(this.cachedSettings, null, 2);
  }

  import(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      this.cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      this.appStore.set('settings', this.cachedSettings);
      return true;
    } catch {
      return false;
    }
  }
}
