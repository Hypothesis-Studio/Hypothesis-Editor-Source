/**
 * Hypothesis Editor - Shared Type Definitions
 * All types shared between main, preload, and renderer processes.
 */

// ============================================================================
// Editor Types
// ============================================================================

export interface EditorTab {
  id: string;
  filePath: string | null;
  fileName: string;
  language: string;
  content: string;
  isDirty: boolean;
  isPinned: boolean;
  isPreview: boolean;
  viewState: unknown;
  scrollTop: number;
  scrollLeft: number;
  cursorPosition: CursorPosition;
  encoding: string;
  lineEnding: 'LF' | 'CRLF';
  savedContent: string;
  createdAt: number;
  modifiedAt: number;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface EditorSplit {
  id: string;
  direction: 'horizontal' | 'vertical';
  tabs: string[];
  activeTabId: string | null;
  size: number;
  children: (EditorSplit | EditorGroup)[];
}

export interface EditorGroup {
  id: string;
  tabs: string[];
  activeTabId: string | null;
}

// ============================================================================
// File System Types
// ============================================================================

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: Date;
  createdAt: Date;
  isHidden: boolean;
  extension: string;
  children?: FileEntry[];
  isExpanded?: boolean;
  isLoading?: boolean;
  depth: number;
}

export interface Workspace {
  id: string;
  name: string;
  folders: WorkspaceFolder[];
  settings: WorkspaceSettings;
  createdAt: number;
  modifiedAt: number;
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  path: string;
}

export interface WorkspaceSettings {
  [key: string]: unknown;
}

// ============================================================================
// Terminal Types
// ============================================================================

export interface TerminalInstance {
  id: string;
  name: string;
  shell: string;
  cwd: string;
  pid: number;
  isActive: boolean;
  title: string;
  rows: number;
  cols: number;
  createdAt: number;
}

export interface TerminalOptions {
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  rows?: number;
  cols?: number;
  name?: string;
}

// ============================================================================
// Git Types
// ============================================================================

export interface GitStatus {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  conflicted: string[];
}

export interface GitFileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  oldPath?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  parents: string[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: string | null;
  upstream: string | null;
  type: 'local' | 'remote';
}

export interface GitDiff {
  hunks: GitHunk[];
  from: string;
  to: string;
}

export interface GitHunk {
  content: string;
  newStart: number;
  newLines: number;
  oldStart: number;
  oldLines: number;
  changes: GitChange[];
}

export interface GitChange {
  content: string;
  type: 'add' | 'remove' | 'normal';
  newLine?: number;
  oldLine?: number;
}

// ============================================================================
// Theme Types
// ============================================================================

export interface ThemeDefinition {
  id: string;
  name: string;
  type: 'dark' | 'light' | 'high-contrast';
  colors: ThemeColors;
  tokenColors: TokenColor[];
  semanticHighlighting: boolean;
  author?: string;
  description?: string;
  version?: string;
  isBuiltin: boolean;
}

export interface ThemeColors {
  // Editor
  'editor.background': string;
  'editor.foreground': string;
  'editor.lineHighlightBackground': string;
  'editor.selectionBackground': string;
  'editor.inactiveSelectionBackground': string;
  'editor.findMatchBackground': string;
  'editor.findMatchHighlightBackground': string;
  'editor.rangeHighlightBackground': string;
  'editor.wordHighlightBackground': string;
  'editor.wordHighlightStrongBackground': string;
  'editorBracketMatch.background': string;
  'editorBracketMatch.border'?: string;
  'editorIndentGuide.background': string;
  'editorIndentGuide.activeBackground': string;
  'editorLineNumber.foreground': string;
  'editorLineNumber.activeForeground': string;
  'editorCursor.foreground': string;
  'editorWhitespace.foreground'?: string;
  'editorIndentGuide.background1'?: string;
  'editorIndentGuide.background2'?: string;
  'editorIndentGuide.background3'?: string;
  'editorIndentGuide.background4'?: string;
  'editorIndentGuide.background5'?: string;
  'editorIndentGuide.background6'?: string;

  // Sidebar
  'sideBar.background': string;
  'sideBar.foreground': string;
  'sideBar.border': string;
  'sideBarTitle.foreground': string;
  'sideBarSectionHeader.background': string;

  // Titlebar
  'titleBar.activeBackground': string;
  'titleBar.activeForeground': string;
  'titleBar.inactiveBackground': string;
  'titleBar.inactiveForeground': string;
  'titleBar.border': string;

  // Statusbar
  'statusBar.background': string;
  'statusBar.foreground': string;
  'statusBar.border': string;
  'statusBar.debuggingBackground'?: string;
  'statusBar.debuggingForeground'?: string;
  'statusBar.noFolderBackground': string;

  // Tabs
  'tab.activeBackground': string;
  'tab.activeForeground': string;
  'tab.activeBorder': string;
  'tab.activeBorderTop': string;
  'tab.inactiveBackground': string;
  'tab.inactiveForeground'?: string;
  'tab.border': string;
  'tab.hoverBackground': string;
  'tab.hoverBorder': string;

  // Terminal
  'terminal.background': string;
  'terminal.foreground': string;
  'terminal.ansiBlack': string;
  'terminal.ansiRed': string;
  'terminal.ansiGreen': string;
  'terminal.ansiYellow': string;
  'terminal.ansiBlue': string;
  'terminal.ansiMagenta': string;
  'terminal.ansiCyan': string;
  'terminal.ansiWhite': string;
  'terminal.ansiBrightBlack': string;
  'terminal.ansiBrightRed': string;
  'terminal.ansiBrightGreen': string;
  'terminal.ansiBrightYellow': string;
  'terminal.ansiBrightBlue': string;
  'terminal.ansiBrightMagenta': string;
  'terminal.ansiBrightCyan': string;
  'terminal.ansiBrightWhite': string;

  // Activity Bar
  'activityBar.background': string;
  'activityBar.foreground': string;
  'activityBar.inactiveForeground': string;
  'activityBar.border': string;
  'activityBarBadge.background': string;
  'activityBarBadge.foreground': string;

  // Minimap
  'minimap.background': string;
  'minimap.selectionHighlight': string;
  'minimap.findMatchHighlight': string;

  // Scrollbar
  'scrollbar.shadow': string;
  'scrollbarSlider.background': string;
  'scrollbarSlider.hoverBackground': string;
  'scrollbarSlider.activeBackground': string;

  // Input
  'input.background': string;
  'input.foreground': string;
  'input.border': string;
  'input.placeholderForeground'?: string;
  'inputOption.activeBorder'?: string;

  // Dropdown
  'dropdown.background': string;
  'dropdown.foreground': string;
  'dropdown.border': string;

  // List
  'list.activeSelectionBackground'?: string;
  'list.activeSelectionForeground': string;
  'list.hoverBackground': string;
  'list.hoverForeground': string;
  'list.focusBackground': string;
  'list.focusForeground': string;
  'list.highlightForeground': string;
  'list.inactiveSelectionBackground': string;
  'list.inactiveSelectionForeground': string;

  // Badge
  'badge.background': string;
  'badge.foreground': string;

  // Button
  'button.background': string;
  'button.foreground': string;
  'button.hoverBackground': string;

  // Peek
  'peekView.border': string;
  'peekViewEditor.background': string;
  'peekViewResult.background': string;
  'peekViewTitle.background': string;
  'peekViewTitleLabel.foreground': string;

  // Notification
  'notificationCenter.border': string;
  'notifications.background': string;
  'notifications.foreground': string;

  // Git
  'gitDecoration.addedResourceForeground': string;
  'gitDecoration.modifiedResourceForeground': string;
  'gitDecoration.deletedResourceForeground': string;
  'gitDecoration.untrackedResourceForeground': string;
  'gitDecoration.ignoredResourceForeground': string;
  'gitDecoration.conflictingResourceForeground': string;

  // General
  focusBorder: string;
  foreground: string;
  'widget.shadow': string;
  'selection.background': string;
  descriptionForeground: string;
  errorForeground: string;
  'textLink.foreground': string;
  'textBlockQuote.background': string;
  'textCodeBlock.background': string;
  'textPreformat.foreground': string;
  'textSeparator.foreground': string;

  [key: string]: string | undefined;
}

export interface TokenColor {
  name?: string;
  scope: string | string[];
  settings: {
    foreground?: string;
    fontStyle?: string;
    background?: string;
  };
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  engines: {
    hypothesis: string;
  };
  activationEvents: string[];
  contributes?: PluginContributes;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  icon?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
}

export interface PluginContributes {
  commands?: PluginCommand[];
  menus?: PluginMenu[];
  keybindings?: PluginKeybinding[];
  languages?: PluginLanguage[];
  themes?: PluginTheme[];
  snippets?: PluginSnippet[];
  configuration?: PluginConfiguration[];
  views?: PluginView[];
  iconThemes?: PluginIconTheme[];
}

export interface PluginCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
  when?: string;
}

export interface PluginMenu {
  id: string;
  items: PluginMenuItem[];
}

export interface PluginMenuItem {
  command: string;
  title?: string;
  group?: string;
  when?: string;
  order?: number;
}

export interface PluginKeybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
}

export interface PluginLanguage {
  id: string;
  extensions: string[];
  aliases: string[];
  configuration?: string;
}

export interface PluginTheme {
  id: string;
  label: string;
  path: string;
  uiTheme: 'vs' | 'vs-dark' | 'hc-black';
}

export interface PluginSnippet {
  language: string;
  path: string;
}

export interface PluginConfiguration {
  title: string;
  properties: Record<string, unknown>;
}

export interface PluginView {
  id: string;
  name: string;
  when?: string;
}

export interface PluginIconTheme {
  id: string;
  label: string;
  path: string;
}

export interface PluginContext {
  subscriptions: PluginDisposable[];
  workspace: PluginWorkspace;
  commands: PluginCommandRegistry;
  window: PluginWindowRegistry;
  languages: PluginLanguageRegistry;
  editor: PluginEditorAPI;
  terminal: PluginTerminalAPI;
  statusbar: PluginStatusBarAPI;
  panels: PluginPanelAPI;
  menus: PluginMenuAPI;
  events: PluginEventAPI;
  formatters: PluginFormatterAPI;
  linters: PluginLinterAPI;
  settings: PluginSettingsAPI;
  theme: PluginThemeAPI;
  fs: PluginFileSystemAPI;
  git: PluginGitAPI;
  storage: PluginStorageAPI;
  clipboard: PluginClipboardAPI;
  http: PluginHTTPAPI;
  process: PluginProcessAPI;
  ui: PluginUIAPI;
  notifications: PluginNotificationAPI;
}

// ── Comprehensive Extension API Types ───────────────────────────

export interface PluginSettingsAPI {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): Promise<boolean>;
  getAll(): Record<string, unknown>;
  getSection(section: string): Record<string, unknown>;
  onDidChange(listener: (settings: Record<string, unknown>) => void): PluginDisposable;
}

export interface PluginThemeAPI {
  getCurrent(): ThemeDefinition | undefined;
  list(): ThemeDefinition[];
  set(themeId: string): Promise<boolean>;
  register(theme: ThemeDefinition): PluginDisposable;
  onDidChange(listener: (themeId: string) => void): PluginDisposable;
}

export interface PluginFileSystemAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  exists(filePath: string): Promise<boolean>;
  readDir(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymbolicLink: boolean }>>;
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<boolean>;
  delete(targetPath: string, options?: { recursive?: boolean }): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<boolean>;
  stat(filePath: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean; createdAt: string; modifiedAt: string }>;
  watch(filePath: string, listener: (event: { type: string; path: string }) => void): PluginDisposable;
  getWorkspacePath(): string | undefined;
  resolvePath(...segments: string[]): string;
}

export interface PluginGitAPI {
  status(repoPath: string): Promise<GitStatus>;
  log(repoPath: string, maxCount?: number): Promise<GitCommit[]>;
  diff(repoPath: string, file?: string): Promise<GitDiff>;
  branch(repoPath: string): Promise<GitBranch[]>;
  commit(repoPath: string, message: string, files?: string[]): Promise<string>;
  push(repoPath: string, remote?: string): Promise<boolean>;
  pull(repoPath: string, remote?: string): Promise<boolean>;
  fetch(repoPath: string, remote?: string): Promise<boolean>;
  add(repoPath: string, files: string[]): Promise<boolean>;
  reset(repoPath: string, files?: string[]): Promise<boolean>;
  stash(repoPath: string): Promise<boolean>;
  checkout(repoPath: string, branch: string): Promise<boolean>;
  merge(repoPath: string, branch: string): Promise<boolean>;
  init(repoPath: string): Promise<boolean>;
}

export interface PluginStorageAPI {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  getAll(): Record<string, unknown>;
  clear(): Promise<boolean>;
}

export interface PluginClipboardAPI {
  read(): Promise<string>;
  write(text: string): Promise<boolean>;
}

export interface PluginHTTPAPI {
  fetch(url: string, options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  }): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }>;
}

export interface PluginProcessAPI {
  exec(command: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  getEnv(key: string): string | undefined;
  getPlatform(): string;
  getArch(): string;
  getVersion(): string;
  getAppPath(): string;
  getExtensionPath(pluginId: string): string | null;
  getTempPath(): string;
  getHomePath(): string;
}

export interface PluginUIAPI {
  showMessage(type: 'info' | 'warning' | 'error', message: string, items?: string[]): Promise<string | undefined>;
  showDialog(options: {
    type?: 'info' | 'warning' | 'error' | 'question';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
    defaultId?: number;
    cancelId?: number;
  }): Promise<{ response: number; checkboxChecked: boolean }>;
  showOpenDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: string[];
  }): Promise<{ canceled: boolean; filePaths: string[] }>;
  showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<{ canceled: boolean; filePath: string }>;
  createStatusBarItem(id: string, text: string, alignment: 'left' | 'right', priority?: number): PluginDisposable;
  updateStatusBarItem(id: string, text: string): void;
  createPanel(id: string, title: string, content: string): PluginDisposable;
  updatePanel(id: string, content: string): void;
  showPanel(id: string): void;
  hidePanel(id: string): void;
  createSidebarView(id: string, title: string, content: string): PluginDisposable;
  showSidebarView(id: string): void;
}

export interface PluginNotificationAPI {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

export interface PluginDisposable {
  dispose(): void;
}

export interface PluginWorkspace {
  rootPath: string | undefined;
  workspaceFolders: WorkspaceFolder[] | undefined;
  getConfiguration(section: string): unknown;
  onDidChangeConfiguration: (listener: () => void) => PluginDisposable;
  onDidOpenTextDocument: (listener: (doc: any) => void) => PluginDisposable;
  onDidSaveTextDocument: (listener: (doc: any) => void) => PluginDisposable;
  onDidCloseTextDocument: (listener: (doc: any) => void) => PluginDisposable;
  openTextDocument: (uri: string) => Promise<any>;
  applyEdit: (edit: any) => Promise<boolean>;
}

export interface PluginCommandRegistry {
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): PluginDisposable;
  executeCommand<T>(id: string, ...args: unknown[]): Promise<T>;
}

export interface PluginWindowRegistry {
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showInputBox(options: InputBoxOptions): Promise<string | undefined>;
  showQuickPick(items: string[], options?: QuickPickOptions): Promise<string | undefined>;
}

export interface PluginLanguageRegistry {
  registerCompletionItemProvider(
    selector: string,
    provider: CompletionItemProvider,
  ): PluginDisposable;
  registerHoverProvider(selector: string, provider: HoverProvider): PluginDisposable;
  registerDefinitionProvider(
    selector: string,
    provider: DefinitionProvider,
  ): PluginDisposable;
  registerDocumentFormattingEditProvider(selector: string, provider: any): PluginDisposable;
  registerDocumentSymbolProvider(selector: string, provider: any): PluginDisposable;
  registerCodeActionProvider(selector: string, provider: any): PluginDisposable;
  registerCodeLensProvider(selector: string, provider: any): PluginDisposable;
  registerReferenceProvider(selector: string, provider: any): PluginDisposable;
  registerRenameProvider(selector: string, provider: any): PluginDisposable;
  registerSignatureHelpProvider(selector: string, provider: any): PluginDisposable;
  registerFoldingRangeProvider(selector: string, provider: any): PluginDisposable;
}

export interface InputBoxOptions {
  prompt?: string;
  placeHolder?: string;
  value?: string;
  password?: boolean;
  validateInput?: (value: string) => string | null;
}

export interface QuickPickOptions {
  placeHolder?: string;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}

export interface CompletionItemProvider {
  provideCompletionItems(
    document: unknown,
    position: unknown,
  ): unknown[] | Promise<unknown[]>;
  resolveCompletionItem?(item: unknown): unknown;
}

export interface HoverProvider {
  provideHover(document: unknown, position: unknown): unknown | Promise<unknown>;
}

export interface DefinitionProvider {
  provideDefinition(
    document: unknown,
    position: unknown,
  ): unknown | Promise<unknown>;
}

// ============================================================================
// Extension API Types (rich plugin context)
// ============================================================================

export interface PluginEditorAPI {
  getActiveDocument(): { uri: string; content: string; language: string } | null;
  getOpenDocuments(): Array<{ uri: string; content: string; language: string }>;
  getSelection(): { start: CursorPosition; end: CursorPosition } | null;
  insertText(uri: string, position: CursorPosition, text: string): Promise<void>;
  replaceText(uri: string, range: { start: CursorPosition; end: CursorPosition }, text: string): Promise<void>;
  openFile(filePath: string): Promise<{ filePath: string; content: string }>;
  saveFile(filePath: string, content: string): Promise<boolean>;
  getDocumentContent(filePath: string): Promise<string>;
  openDocument(uri: string): Promise<void>;
  closeDocument(uri: string): Promise<void>;
  onOpenFile(listener: (data: { filePath: string; content: string }) => void): PluginDisposable;
  onFileSaved(listener: (data: { filePath: string }) => void): PluginDisposable;
  onDidChangeActiveEditor(listener: (editor: { uri: string } | null) => void): PluginDisposable;
}

export interface PluginTerminalAPI {
  create(options?: { shell?: string; cwd?: string; name?: string }): Promise<string>;
  write(terminalId: string, data: string): void;
  close(terminalId: string): Promise<void>;
  onDidWriteData(listener: (data: { terminalId: string; data: string }) => void): PluginDisposable;
  onDidCloseTerminal(listener: (terminalId: string) => void): PluginDisposable;
}

export interface PluginStatusBarAPI {
  createItem(id: string, text: string, alignment: 'left' | 'right', priority?: number): PluginDisposable;
  updateItem(id: string, text: string): void;
  showItem(id: string): void;
  hideItem(id: string): void;
}

export interface PluginPanelAPI {
  createPanel(id: string, title: string, content: string): PluginDisposable;
  showPanel(id: string): void;
  hidePanel(id: string): void;
  updatePanel(id: string, content: string): void;
}

export interface PluginMenuAPI {
  registerMenu(menuId: string, items: Array<{ label: string; command: string; group?: string; when?: string; order?: number; icon?: string }>): PluginDisposable;
  registerContextMenu(menuId: string, items: Array<{ label: string; command: string; group?: string; when?: string; order?: number; icon?: string }>): PluginDisposable;
}

export interface PluginEventAPI {
  onDidSaveTextDocument(listener: (doc: { uri: string; content: string }) => void): PluginDisposable;
  onDidOpenTextDocument(listener: (doc: { uri: string; content: string; language: string }) => void): PluginDisposable;
  onDidCloseTextDocument(listener: (doc: { uri: string }) => void): PluginDisposable;
  onDidChangeActiveEditor(listener: (editor: { uri: string } | null) => void): PluginDisposable;
}

export interface PluginFormatterAPI {
  registerFormatter(selector: string, formatter: {
    format(document: { uri: string; content: string; language: string }, options: { tabSize: number; insertSpaces: boolean }): string | Promise<string>;
  }): PluginDisposable;
}

export interface PluginLinterAPI {
  registerLinter(selector: string, linter: {
    lint(document: { uri: string; content: string; language: string }): Diagnostic[] | Promise<Diagnostic[]>;
  }): PluginDisposable;
}

export interface Diagnostic {
  range: { start: CursorPosition; end: CursorPosition };
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  code?: string | number;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface AppSettings {
  // Editor
  'editor.fontSize': number;
  'editor.fontFamily': string;
  'editor.fontWeight': string;
  'editor.fontLigatures': boolean;
  'editor.lineHeight': number;
  'editor.letterSpacing': number;
  'editor.tabSize': number;
  'editor.insertSpaces': boolean;
  'editor.wordWrap': 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  'editor.wordWrapColumn': number;
  'editor.minimap.enabled': boolean;
  'editor.minimap.side': 'left' | 'right';
  'editor.minimap.renderCharacters': boolean;
  'editor.minimap.maxColumn': number;
  'editor.lineNumbers': 'on' | 'off' | 'relative' | 'interval';
  'editor.renderWhitespace': 'none' | 'boundary' | 'selection' | 'trailing' | 'all';
  'editor.cursorStyle': 'line' | 'block' | 'underline';
  'editor.cursorBlinking': 'blink' | 'smooth' | 'phase' | 'expand' | 'solid';
  'editor.cursorSmoothCaretAnimation': 'on' | 'off' | 'explicit';
  'editor.bracketPairColorization.enabled': boolean;
  'editor.guides.bracketPairs': boolean | 'active';
  'editor.guides.indentation': boolean;
  'editor.guides.highlightActiveIndentation': boolean;
  'editor.stickyScroll.enabled': boolean;
  'editor.folding': boolean;
  'editor.foldingStrategy': 'auto' | 'indentation';
  'editor.showFoldingControls': 'always' | 'mouseover';
  'editor.autoIndent': 'none' | 'keep' | 'brackets' | 'advanced' | 'full';
  'editor.formatOnSave': boolean;
  'editor.formatOnPaste': boolean;
  'editor.formatOnType': boolean;
  'editor.suggestOnTriggerCharacters': boolean;
  'editor.acceptSuggestionOnCommitCharacter': boolean;
  'editor.acceptSuggestionOnEnter': 'on' | 'smart' | 'off';
  'editor.tabCompletion': 'on' | 'off' | 'onlySnippets';
  'editor.snippetSuggestions': 'top' | 'bottom' | 'inline' | 'none';
  'editor.codeLens': boolean;
  'editor.lightbulb.enabled': boolean;
  'editor.hover.enabled': boolean;
  'editor.hover.delay': number;
  'editor.links': boolean;
  'editor.colorDecorators': boolean;
  'editor.contextmenu': boolean;
  'editor.mouseWheelZoom': boolean;
  'editor.multiCursorModifier': 'ctrlCmd' | 'alt';
  'editor.occurrencesHighlight': 'singleFile' | 'off';
  'editor.selectionHighlight': boolean;
  'editor.overviewRulerBorder': boolean;
  'editor.hideCursorInOverviewRuler': boolean;
  'editor.scrollBeyondLastLine': boolean;
  'editor.smoothScrolling': boolean;
  'editor.padding.top': number;
  'editor.padding.bottom': number;

  // Files
  'files.autoSave': 'off' | 'afterDelay' | 'onFocusChange' | 'onWindowChange';
  'files.autoSaveDelay': number;
  'files.encoding': string;
  'files.eol': '\n' | '\r\n';
  'files.trimTrailingWhitespace': boolean;
  'files.insertFinalNewline': boolean;
  'files.trimFinalNewlines': boolean;
  'files.exclude': Record<string, boolean>;
  'files.watcherExclude': Record<string, boolean>;
  'files.associations': Record<string, string>;

  // Workbench
  'workbench.colorTheme': string;
  'workbench.iconTheme': string;
  'workbench.sideBar.location': 'left' | 'right';
  'workbench.panel.defaultLocation': 'bottom' | 'right';
  'workbench.editor.showTabs': boolean;
  'workbench.editor.tabCloseButton': 'left' | 'right' | 'off';
  'workbench.editor.tabSizing': 'fit' | 'shrink' | 'fixed';
  'workbench.editor.enablePreview': boolean;
  'workbench.editor.enablePreviewFromQuickOpen': boolean;
  'workbench.editor.closeOnFileDelete': boolean;
  'workbench.startupEditor': 'none' | 'welcomePage' | 'readme' | 'newUntitledFile';
  'workbench.tree.indent': number;
  'workbench.list.openMode': 'singleClick' | 'doubleClick';

  // Terminal
  'terminal.integrated.defaultProfile.windows': string;
  'terminal.integrated.defaultProfile.linux': string;
  'terminal.integrated.defaultProfile.osx': string;
  'terminal.integrated.fontSize': number;
  'terminal.integrated.fontFamily': string;
  'terminal.integrated.lineHeight': number;
  'terminal.integrated.scrollback': number;
  'terminal.integrated.cursorStyle': 'block' | 'underline' | 'line';
  'terminal.integrated.cursorBlinking': boolean;
  'terminal.integrated.copyOnSelection': boolean;

  // Search
  'search.exclude': Record<string, boolean>;
  'search.useIgnoreFiles': boolean;
  'search.followSymlinks': boolean;

  // Git
  'git.enabled': boolean;
  'git.autofetch': boolean;
  'git.confirmSync': boolean;
  'git.enableSmartCommit': boolean;

  // Window
  'window.zoomLevel': number;
  'window.title': string;
  'window.restoreWindows': 'none' | 'one' | 'all' | 'folders';
  'window.newWindowDimensions': 'default' | 'inherit' | 'offset' | 'maximized';

  // Telemetry
  'telemetry.telemetryLevel': 'all' | 'error' | 'crash' | 'off';

  // Extensions
  'extensions.autoUpdate': boolean;
  'extensions.showRecommendationsOnlyOnDemand': boolean;

  // Update
  'update.channel': 'stable' | 'preview';

  // Accessibility
  'accessibility.supportAccessibilityMode': boolean;

  [key: string]: unknown;
}

// ============================================================================
// Command Types
// ============================================================================

export interface Command {
  id: string;
  label: string;
  category?: string;
  keybinding?: string;
  when?: string;
  icon?: string;
  handler: (...args: unknown[]) => unknown;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  length: number;
  text: string;
  match: string;
  preview: {
    before: string;
    match: string;
    after: string;
  };
}

export interface SearchOptions {
  query: string;
  replace?: string;
  include?: string;
  exclude?: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
  useIgnoreFiles: boolean;
  followSymlinks: boolean;
  maxResults: number;
}

// ============================================================================
// Snippet Types
// ============================================================================

export interface Snippet {
  id: string;
  name: string;
  prefix: string;
  body: string | string[];
  description: string;
  scope: string;
  language?: string;
  isBuiltin: boolean;
}

// ============================================================================
// Keyboard Shortcut Types
// ============================================================================

export interface Keybinding {
  command: string;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
  args?: unknown;
  source: 'default' | 'user' | 'extension';
}

// ============================================================================
// IPC Types
// ============================================================================

export interface IPCChannel {
  name: string;
  direction: 'main-to-renderer' | 'renderer-to-main' | 'bidirectional';
}

export const IPC_CHANNELS = {
  // App
  APP_READY: 'app:ready',
  APP_QUIT: 'app:quit',
  APP_RELAUNCH: 'app:relaunch',
  APP_VERSION: 'app:version',
  APP_FOCUS: 'app:focus',

  // Window
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_RESTORE: 'window:restore',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',
  WINDOW_SET_TITLE: 'window:set-title',
  WINDOW_NEW: 'window:new',
  WINDOW_GET_ALL: 'window:get-all',

  // File
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_SAVE_ALL: 'file:save-all',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_EXISTS: 'file:exists',
  FILE_CREATE: 'file:create',
  FILE_DELETE: 'file:delete',
  FILE_RENAME: 'file:rename',
  FILE_COPY: 'file:copy',
  FILE_MOVE: 'file:move',
  FILE_STAT: 'file:stat',
  FILE_WATCH: 'file:watch',
  FILE_UNWATCH: 'file:unwatch',
  FILE_DIALOG_OPEN: 'file:dialog-open',
  FILE_DIALOG_SAVE: 'file:dialog-save',

  // Directory
  DIR_READ: 'dir:read',
  DIR_CREATE: 'dir:create',
  DIR_DELETE: 'dir:delete',
  DIR_TREE: 'dir:tree',

  // Editor
  EDITOR_OPEN: 'editor:open',
  EDITOR_CLOSE: 'editor:close',
  EDITOR_SAVE: 'editor:save',
  EDITOR_FORMAT: 'editor:format',
  EDITOR_UNDO: 'editor:undo',
  EDITO_REDO: 'editor:redo',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_WRITE: 'terminal:write',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_CLOSE: 'terminal:close',
  TERMINAL_KILL: 'terminal:kill',
  TERMINAL_LIST: 'terminal:list',
  TERMINAL_DATA: 'terminal:data',
  TERMINAL_EXIT: 'terminal:exit',
  TERMINAL_TITLE: 'terminal:title',

  // Git
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_FETCH: 'git:fetch',
  GIT_CLONE: 'git:clone',
  GIT_BRANCH: 'git:branch',
  GIT_CHECKOUT: 'git:checkout',
  GIT_MERGE: 'git:merge',
  GIT_DIFF: 'git:diff',
  GIT_LOG: 'git:log',
  GIT_STASH: 'git:stash',
  GIT_ADD: 'git:add',
  GIT_RESET: 'git:reset',
  GIT_INIT: 'git:init',

  // Search
  SEARCH: 'search:find',
  SEARCH_REPLACE: 'search:replace',
  SEARCH_REPLACE_ALL: 'search:replace-all',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_EXPORT: 'settings:export',
  SETTINGS_IMPORT: 'settings:import',
  SETTINGS_CHANGED: 'settings:changed',

  // Theme
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  THEME_LIST: 'theme:list',
  THEME_CHANGED: 'theme:changed',

  // Keybinding
  KEYBINDING_GET_ALL: 'keybinding:get-all',
  KEYBINDING_SET: 'keybinding:set',
  KEYBINDING_RESET: 'keybinding:reset',
  KEYBINDING_CONFLICTS: 'keybinding:conflicts',

  // Workspace
  WORKSPACE_OPEN: 'workspace:open',
  WORKSPACE_SAVE: 'workspace:save',
  WORKSPACE_GET: 'workspace:get',
  WORKSPACE_RECENT: 'workspace:recent',
  WORKSPACE_ADD_FOLDER: 'workspace:add-folder',
  WORKSPACE_REMOVE_FOLDER: 'workspace:remove-folder',

  // Plugin
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',
  PLUGIN_ACTIVATE: 'plugin:activate',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_PROGRESS: 'update:progress',

  // Log
  LOG_INFO: 'log:info',
  LOG_WARN: 'log:warn',
  LOG_ERROR: 'log:error',
  LOG_DEBUG: 'log:debug',

  // Menu
  MENU_POPUP_CONTEXT: 'menu:popup-context',
  MENU_SET_MENU: 'menu:set-menu',

  // Dialog
  DIALOG_MESSAGE: 'dialog:message',
  DIALOG_CONFIRM: 'dialog:confirm',
  DIALOG_INPUT: 'dialog:input',

  // Clipboard
  CLIPBOARD_READ: 'clipboard:read',
  CLIPBOARD_WRITE: 'clipboard:write',
  CLIPBOARD_HISTORY: 'clipboard:history',

  // Crash
  CRASH_REPORT: 'crash:report',
  CRASH_RECOVERY: 'crash:recovery',
} as const;

export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ============================================================================
// Event Types
// ============================================================================

export interface AppEvent {
  type: string;
  payload?: unknown;
  timestamp: number;
  source: string;
}

export type EventListener<T = unknown> = (event: AppEvent & { payload: T }) => void;

// ============================================================================
// Store Types
// ============================================================================

export interface StoreSchema {
  settings: Partial<AppSettings>;
  keybindings: Keybinding[];
  recentWorkspaces: string[];
  recentFiles: string[];
  windowState: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
    isFullScreen: boolean;
  };
  sidebarState: {
    activeView: string;
    width: number;
    isVisible: boolean;
  };
  panelState: {
    activePanel: string;
    height: number;
    isVisible: boolean;
  };
  theme: string;
  iconTheme: string;
  language: string;
  snippets: Snippet[];
  pluginStates: Record<string, { enabled: boolean; config: unknown }>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = T extends (
  ...args: unknown[]
) => Promise<infer R>
  ? R
  : never;

export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
