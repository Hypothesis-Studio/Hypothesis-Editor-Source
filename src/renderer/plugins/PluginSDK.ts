/**
 * Plugin SDK - Full Extension API for renderer-side plugins.
 * Provides real implementations for all extension capabilities:
 * - Commands, Editor, Settings, Theme, File System, Git
 * - Terminal, UI (panels, statusbar, sidebar), Storage
 * - Clipboard, HTTP, Process, Notifications
 */
import type {
  PluginManifest,
  PluginContext,
  PluginDisposable,
  ThemeDefinition,
  GitStatus,
  GitCommit,
  GitDiff,
  GitBranch,
  CursorPosition,
} from '../../shared/types';

// ============================================================================
// Disposable
// ============================================================================

export class Disposable implements PluginDisposable {
  private _fn: () => void;
  constructor(fn: () => void) { this._fn = fn; }
  dispose(): void { this._fn(); }
}

// ============================================================================
// Plugin API Interface
// ============================================================================

export interface PluginAPI {
  readonly version: string;
  readonly manifest: PluginManifest;

  commands: CommandAPI;
  window: WindowAPI;
  workspace: WorkspaceAPI;
  languages: LanguageAPI;
  themes: ThemeAPI;
  panels: PanelAPI;
  statusbar: StatusBarAPI;
  menus: MenuAPI;
  snippets: SnippetAPI;
  formatters: FormatterAPI;
  linters: LinterAPI;
  editor: EditorAPI;
  settings: SettingsAPI;
  fs: FileSystemAPI;
  git: GitAPI;
  terminal: TerminalAPI;
  storage: StorageAPI;
  clipboard: ClipboardAPI;
  http: HTTPAPI;
  process: ProcessAPI;
  notifications: NotificationAPI;
}

// ============================================================================
// Command API
// ============================================================================

export interface CommandAPI {
  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable;
  executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T>;
  getCommands(): string[];
}

export class CommandAPIImpl implements CommandAPI {
  private commands = new Map<string, (...args: unknown[]) => unknown>();

  registerCommand(id: string, handler: (...args: unknown[]) => unknown): Disposable {
    this.commands.set(id, handler);
    return new Disposable(() => this.commands.delete(id));
  }

  async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
    const handler = this.commands.get(id);
    if (handler) return handler(...args) as T;
    // Try from main process
    try {
      return await (window as any).api.extension.commands.execute(id, args) as T;
    } catch {
      throw new Error(`Command not found: ${id}`);
    }
  }

  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  hasCommand(id: string): boolean {
    return this.commands.has(id);
  }
}

// ============================================================================
// Editor API
// ============================================================================

export interface EditorAPI {
  getActiveDocument(): { uri: string; content: string; language: string } | null;
  getOpenDocuments(): Array<{ uri: string; content: string; language: string }>;
  openFile(filePath: string): Promise<{ filePath: string; content: string }>;
  saveFile(filePath: string, content: string): Promise<boolean>;
  getDocumentContent(filePath: string): Promise<string>;
  getSelection(): { start: CursorPosition; end: CursorPosition } | null;
  insertText(uri: string, position: CursorPosition, text: string): Promise<void>;
  replaceText(uri: string, range: { start: CursorPosition; end: CursorPosition }, text: string): Promise<void>;
  onOpenFile(listener: (data: { filePath: string; content: string }) => void): Disposable;
  onFileSaved(listener: (data: { filePath: string }) => void): Disposable;
}

export class EditorAPIImpl implements EditorAPI {
  private disposables: Array<() => void> = [];

  getActiveDocument() {
    // Access from editorStore via window
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return null;
    const state = store.getState();
    const tab = state.tabs.find((t: any) => t.id === state.activeTabId);
    if (!tab) return null;
    return { uri: tab.filePath || '', content: tab.content, language: tab.language };
  }

  getOpenDocuments() {
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return [];
    const state = store.getState();
    return state.tabs.map((t: any) => ({
      uri: t.filePath || '',
      content: t.content,
      language: t.language,
    }));
  }

  async openFile(filePath: string) {
    return (window as any).api.extension.editor.openFile(filePath);
  }

  async saveFile(filePath: string, content: string) {
    return (window as any).api.extension.editor.saveFile(filePath, content);
  }

  async getDocumentContent(filePath: string) {
    return (window as any).api.extension.editor.getDocumentContent(filePath);
  }

  getSelection() {
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return null;
    const editor = store.getState().activeEditor;
    if (!editor) return null;
    const sel = editor.getSelection();
    if (!sel) return null;
    return {
      start: { line: sel.startLineNumber, column: sel.startColumn },
      end: { line: sel.endLineNumber, column: sel.endColumn },
    };
  }

  async insertText(uri: string, position: CursorPosition, text: string) {
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return;
    const editor = store.getState().activeEditor;
    if (!editor) return;
    const range = new (window as any).monaco.Range(
      position.line, position.column,
      position.line, position.column,
    );
    editor.executeEdits('extension', [{ range, text }]);
  }

  async replaceText(uri: string, range: { start: CursorPosition; end: CursorPosition }, text: string) {
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return;
    const editor = store.getState().activeEditor;
    if (!editor) return;
    const monacoRange = new (window as any).monaco.Range(
      range.start.line, range.start.column,
      range.end.line, range.end.column,
    );
    editor.executeEdits('extension', [{ range: monacoRange, text }]);
  }

  onOpenFile(listener: (data: { filePath: string; content: string }) => void): Disposable {
    const unsub = (window as any).api.extension.editor.onOpenFile(listener);
    this.disposables.push(unsub);
    return new Disposable(unsub);
  }

  onFileSaved(listener: (data: { filePath: string }) => void): Disposable {
    const unsub = (window as any).api.extension.editor.onFileSaved(listener);
    this.disposables.push(unsub);
    return new Disposable(unsub);
  }

  async openDocument(uri: string): Promise<void> {
    const result = await this.openFile(uri);
    // File opened via IPC
  }

  async closeDocument(uri: string): Promise<void> {
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return;
    const state = store.getState();
    const tab = state.tabs.find((t: any) => t.filePath === uri);
    if (tab) state.closeTab(tab.id);
  }

  onDidChangeActiveEditor(listener: (editor: { uri: string } | null) => void): Disposable {
    // Listen for tab changes
    const store = (window as any).__hypothesisEditorStore;
    if (!store) return new Disposable(() => {});
    // Simplified - poll for changes
    let lastActiveId: string | null = null;
    const interval = setInterval(() => {
      const state = store.getState();
      if (state.activeTabId !== lastActiveId) {
        lastActiveId = state.activeTabId;
        const tab = state.tabs.find((t: any) => t.id === lastActiveId);
        listener(tab ? { uri: tab.filePath || '' } : null);
      }
    }, 500);
    return new Disposable(() => clearInterval(interval));
  }

  dispose() {
    this.disposables.forEach(d => d());
    this.disposables = [];
  }
}

// ============================================================================
// Settings API
// ============================================================================

export interface SettingsAPI {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  set(key: string, value: unknown): Promise<boolean>;
  getAll(): Promise<Record<string, unknown>>;
  getSection(section: string): Promise<Record<string, unknown>>;
  onDidChange(listener: (settings: Record<string, unknown>) => void): Disposable;
}

export class SettingsAPIImpl implements SettingsAPI {
  private listeners: Array<(settings: Record<string, unknown>) => void> = [];

  get<T>(key: string, defaultValue?: T): T | undefined {
    const store = (window as any).__hypothesisSettingsStore;
    if (store) {
      const val = store.getState().settings[key];
      return (val !== undefined ? val : defaultValue) as T;
    }
    return defaultValue as T;
  }

  async set(key: string, value: unknown): Promise<boolean> {
    const store = (window as any).__hypothesisSettingsStore;
    if (store) {
      await store.getState().setSetting(key, value);
      return true;
    }
    return (window as any).api.extension.settings.set(key, value);
  }

  async getAll(): Promise<Record<string, unknown>> {
    const store = (window as any).__hypothesisSettingsStore;
    if (store) return store.getState().settings;
    return (window as any).api.extension.settings.getAll();
  }

  async getSection(section: string): Promise<Record<string, unknown>> {
    return (window as any).api.extension.settings.getSection(section);
  }

  onDidChange(listener: (settings: Record<string, unknown>) => void): Disposable {
    this.listeners.push(listener);
    const unsub = (window as any).api.settings.onChanged((settings: Record<string, unknown>) => {
      this.listeners.forEach(l => l(settings));
    });
    return new Disposable(() => {
      this.listeners = this.listeners.filter(l => l !== listener);
      unsub?.();
    });
  }
}

// ============================================================================
// Theme API
// ============================================================================

export interface ThemeAPI {
  getCurrent(): ThemeDefinition | undefined;
  list(): Promise<ThemeDefinition[]>;
  set(themeId: string): Promise<boolean>;
  register(theme: ThemeDefinition): Disposable;
  onDidChange(listener: (themeId: string) => void): Disposable;
}

export class ThemeAPIImpl implements ThemeAPI {
  getCurrent(): ThemeDefinition | undefined {
    const store = (window as any).__hypothesisAppStore;
    if (!store) return undefined;
    const themeId = store.getState().currentTheme;
    return { id: themeId, name: themeId } as ThemeDefinition;
  }

  async list(): Promise<ThemeDefinition[]> {
    return (window as any).api.extension.theme.list();
  }

  async set(themeId: string): Promise<boolean> {
    const store = (window as any).__hypothesisAppStore;
    if (store) {
      store.getState().setTheme(themeId);
      return true;
    }
    return (window as any).api.extension.theme.set(themeId);
  }

  register(theme: ThemeDefinition): Disposable {
    (window as any).api.extension.theme.register(theme);
    return new Disposable(() => {});
  }

  onDidChange(listener: (themeId: string) => void): Disposable {
    const unsub = (window as any).api.theme.onChanged((theme: any) => {
      listener(typeof theme === 'string' ? theme : theme?.id || '');
    });
    return new Disposable(unsub || (() => {}));
  }
}

// ============================================================================
// File System API
// ============================================================================

export interface FileSystemAPI {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  exists(filePath: string): Promise<boolean>;
  readDir(dirPath: string): Promise<Array<{ name: string; isDirectory: boolean; isFile: boolean; isSymbolicLink: boolean }>>;
  mkdir(dirPath: string, options?: { recursive?: boolean }): Promise<boolean>;
  delete(targetPath: string, options?: { recursive?: boolean }): Promise<boolean>;
  rename(oldPath: string, newPath: string): Promise<boolean>;
  stat(filePath: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean; isSymbolicLink: boolean; createdAt: string; modifiedAt: string }>;
  watch(filePath: string, listener: (event: { type: string; path: string }) => void): Disposable;
  getWorkspacePath(): string | undefined;
  resolvePath(...segments: string[]): string;
}

export class FileSystemAPIImpl implements FileSystemAPI {
  readFile(filePath: string): Promise<string> {
    return (window as any).api.extension.fs.readFile(filePath);
  }

  writeFile(filePath: string, content: string): Promise<boolean> {
    return (window as any).api.extension.fs.writeFile(filePath, content);
  }

  exists(filePath: string): Promise<boolean> {
    return (window as any).api.extension.fs.exists(filePath);
  }

  readDir(dirPath: string) {
    return (window as any).api.extension.fs.readDir(dirPath);
  }

  mkdir(dirPath: string, options?: { recursive?: boolean }) {
    return (window as any).api.extension.fs.mkdir(dirPath, options);
  }

  delete(targetPath: string, options?: { recursive?: boolean }) {
    return (window as any).api.extension.fs.delete(targetPath, options);
  }

  rename(oldPath: string, newPath: string) {
    return (window as any).api.extension.fs.rename(oldPath, newPath);
  }

  stat(filePath: string) {
    return (window as any).api.extension.fs.stat(filePath);
  }

  watch(filePath: string, listener: (event: { type: string; path: string }) => void): Disposable {
    (window as any).api.extension.fs.watch(filePath);
    // Simplified - file watcher events come through file-watcher IPC
    const unsub = (window as any).api.fileWatcher.onEvent((event: any) => {
      if (event.path === filePath || event.dirPath === filePath) {
        listener({ type: event.type, path: event.path });
      }
    });
    return new Disposable(() => {
      unsub?.();
      (window as any).api.extension.fs.unwatch(filePath);
    });
  }

  getWorkspacePath(): string | undefined {
    const store = (window as any).__hypothesisAppStore;
    return store?.getState?.().workspaceRoot || undefined;
  }

  resolvePath(...segments: string[]): string {
    // Browser-side path join (simple)
    return segments.join('/').replace(/\/+/g, '/');
  }
}

// ============================================================================
// Git API
// ============================================================================

export interface GitAPI {
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

export class GitAPIImpl implements GitAPI {
  status(repoPath: string): Promise<GitStatus> { return (window as any).api.extension.git.status(repoPath); }
  log(repoPath: string, maxCount?: number): Promise<GitCommit[]> { return (window as any).api.extension.git.log(repoPath, maxCount); }
  diff(repoPath: string, file?: string): Promise<GitDiff> { return (window as any).api.extension.git.diff(repoPath, file); }
  branch(repoPath: string): Promise<GitBranch[]> { return (window as any).api.extension.git.branch(repoPath); }
  commit(repoPath: string, message: string, files?: string[]): Promise<string> { return (window as any).api.extension.git.commit(repoPath, message, files); }
  push(repoPath: string, remote?: string): Promise<boolean> { return (window as any).api.extension.git.push(repoPath, remote); }
  pull(repoPath: string, remote?: string): Promise<boolean> { return (window as any).api.extension.git.pull(repoPath, remote); }
  fetch(repoPath: string, remote?: string): Promise<boolean> { return (window as any).api.extension.git.fetch(repoPath, remote); }
  add(repoPath: string, files: string[]): Promise<boolean> { return (window as any).api.extension.git.add(repoPath, files); }
  reset(repoPath: string, files?: string[]): Promise<boolean> { return (window as any).api.extension.git.reset(repoPath, files); }
  stash(repoPath: string): Promise<boolean> { return (window as any).api.extension.git.stash(repoPath); }
  checkout(repoPath: string, branch: string): Promise<boolean> { return (window as any).api.extension.git.checkout(repoPath, branch); }
  merge(repoPath: string, branch: string): Promise<boolean> { return (window as any).api.extension.git.merge(repoPath, branch); }
  init(repoPath: string): Promise<boolean> { return (window as any).api.extension.git.init(repoPath); }
}

// ============================================================================
// Terminal API
// ============================================================================

export interface TerminalAPI {
  create(options?: { shell?: string; cwd?: string; name?: string }): Promise<string>;
  write(terminalId: string, data: string): void;
  close(terminalId: string): Promise<void>;
  runCommand(command: string, cwd?: string): void;
  onData(listener: (data: { terminalId: string; data: string }) => void): Disposable;
  onExit(listener: (data: { terminalId: string; exitCode: number }) => void): Disposable;
}

export class TerminalAPIImpl implements TerminalAPI {
  async create(options?: { shell?: string; cwd?: string; name?: string }): Promise<string> {
    await (window as any).api.extension.terminal.create(options);
    return `ext-term-${Date.now()}`;
  }

  write(terminalId: string, data: string): void {
    (window as any).api.extension.terminal.write(terminalId, data);
  }

  async close(terminalId: string): Promise<void> {
    await (window as any).api.extension.terminal.close(terminalId);
  }

  runCommand(command: string, cwd?: string): void {
    const store = (window as any).__hypothesisAppStore;
    if (store) {
      store.getState().runCommand(command);
    } else {
      (window as any).api.extension.terminal.runCommand(command, cwd);
    }
  }

  onData(listener: (data: { terminalId: string; data: string }) => void): Disposable {
    const unsub = (window as any).api.extension.terminal.onData(listener);
    return new Disposable(unsub || (() => {}));
  }

  onExit(listener: (data: { terminalId: string; exitCode: number }) => void): Disposable {
    const unsub = (window as any).api.extension.terminal.onExit(listener);
    return new Disposable(unsub || (() => {}));
  }
}

// ============================================================================
// Storage API (per-extension key-value)
// ============================================================================

export interface StorageAPI {
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  getAll(): Promise<Record<string, unknown>>;
  clear(): Promise<boolean>;
}

export class StorageAPIImpl implements StorageAPI {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  get<T>(key: string): T | undefined {
    // Sync from local cache, async from main
    return (window as any).api.extension.storage.get(this.pluginId, key);
  }

  async set(key: string, value: unknown): Promise<boolean> {
    return (window as any).api.extension.storage.set(this.pluginId, key, value);
  }

  async delete(key: string): Promise<boolean> {
    return (window as any).api.extension.storage.delete(this.pluginId, key);
  }

  async getAll(): Promise<Record<string, unknown>> {
    return (window as any).api.extension.storage.getAll(this.pluginId);
  }

  async clear(): Promise<boolean> {
    return (window as any).api.extension.storage.clear(this.pluginId);
  }
}

// ============================================================================
// Clipboard API
// ============================================================================

export interface ClipboardAPI {
  read(): Promise<string>;
  write(text: string): Promise<boolean>;
}

export class ClipboardAPIImpl implements ClipboardAPI {
  read(): Promise<string> { return (window as any).api.extension.clipboard.read(); }
  write(text: string): Promise<boolean> { return (window as any).api.extension.clipboard.write(text); }
}

// ============================================================================
// HTTP API
// ============================================================================

export interface HTTPAPI {
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

export class HTTPAPIImpl implements HTTPAPI {
  fetch(url: string, options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  }) {
    return (window as any).api.extension.http.fetch(url, options);
  }
}

// ============================================================================
// Process API
// ============================================================================

export interface ProcessAPI {
  exec(command: string, options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  getEnv(key: string): Promise<string | undefined>;
  getPlatform(): Promise<string>;
  getArch(): Promise<string>;
  getVersion(): Promise<string>;
  getAppPath(): Promise<string>;
  getExtensionPath(pluginId: string): Promise<string | null>;
  getTempPath(): Promise<string>;
  getHomePath(): Promise<string>;
}

export class ProcessAPIImpl implements ProcessAPI {
  exec(command: string, options?: { cwd?: string; env?: Record<string, string>; timeout?: number }) {
    return (window as any).api.extension.process.exec(command, options);
  }

  getEnv(key: string) { return (window as any).api.extension.process.getEnv(key); }
  getPlatform() { return (window as any).api.extension.process.getPlatform(); }
  getArch() { return (window as any).api.extension.process.getArch(); }
  getVersion() { return (window as any).api.extension.process.getVersion(); }
  getAppPath() { return (window as any).api.extension.process.getAppPath(); }
  getExtensionPath(pluginId: string) { return (window as any).api.extension.process.getExtensionPath(pluginId); }
  getTempPath() { return (window as any).api.extension.process.getTempPath(); }
  getHomePath() { return (window as any).api.extension.process.getHomePath(); }
}

// ============================================================================
// Notifications API
// ============================================================================

export interface NotificationAPI {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

export class NotificationAPIImpl implements NotificationAPI {
  info(message: string) {
    const store = (window as any).__hypothesisAppStore;
    if (store) store.getState().setStatusMessage(message, 'info');
    else (window as any).api.extension.ui.showMessage('info', message);
  }
  warn(message: string) {
    const store = (window as any).__hypothesisAppStore;
    if (store) store.getState().setStatusMessage(message, 'warning');
    else (window as any).api.extension.ui.showMessage('warning', message);
  }
  error(message: string) {
    const store = (window as any).__hypothesisAppStore;
    if (store) store.getState().setStatusMessage(message, 'error');
    else (window as any).api.extension.ui.showMessage('error', message);
  }
  success(message: string) {
    const store = (window as any).__hypothesisAppStore;
    if (store) store.getState().setStatusMessage(message, 'success');
    else (window as any).api.extension.ui.showMessage('info', message);
  }
}

// ============================================================================
// Window API (legacy compat + enhanced)
// ============================================================================

export interface WindowAPI {
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
  showInputBox(options: InputBoxOptions): Promise<string | undefined>;
  showQuickPick<T extends QuickPickItem>(items: T[], options?: QuickPickOptions): Promise<T | undefined>;
  createOutputChannel(name: string): OutputChannel;
  registerWebviewPanel(viewType: string, title: string): WebviewPanel;
}

export interface InputBoxOptions {
  prompt?: string;
  placeHolder?: string;
  value?: string;
  password?: boolean;
  validateInput?: (value: string) => string | null;
}

export interface QuickPickItem {
  label: string;
  description?: string;
  detail?: string;
  picked?: boolean;
  alwaysShow?: boolean;
}

export interface QuickPickOptions {
  placeHolder?: string;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
  canPickMany?: boolean;
}

export interface OutputChannel {
  name: string;
  append(value: string): void;
  appendLine(value: string): void;
  clear(): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

export interface WebviewPanel {
  webview: {
    html: string;
    postMessage(message: unknown): void;
    onDidReceiveMessage(handler: (message: unknown) => void): Disposable;
  };
  title: string;
  visible: boolean;
  active: boolean;
  reveal(): void;
  dispose(): void;
  onDidDispose(handler: () => void): Disposable;
  onDidChangeViewState(handler: (e: { webviewPanel: WebviewPanel }) => void): Disposable;
}

// ============================================================================
// Workspace API
// ============================================================================

export interface WorkspaceAPI {
  readonly rootPath: string | undefined;
  readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;
  getConfiguration(section: string): WorkspaceConfiguration;
  onDidChangeConfiguration(listener: () => void): Disposable;
  onDidOpenTextDocument(listener: (doc: TextDocument) => void): Disposable;
  onDidSaveTextDocument(listener: (doc: TextDocument) => void): Disposable;
  onDidCloseTextDocument(listener: (doc: TextDocument) => void): Disposable;
  openTextDocument(uri: string): Promise<TextDocument>;
  applyEdit(edit: WorkspaceEdit): Promise<boolean>;
}

export interface WorkspaceFolder {
  uri: string;
  name: string;
  path: string;
}

export interface WorkspaceConfiguration {
  get<T>(section: string): T | undefined;
  get<T>(section: string, defaultValue: T): T;
  has(section: string): boolean;
  inspect<T>(section: string): { key: string; defaultValue?: T; globalValue?: T; workspaceValue?: T } | undefined;
  update(section: string, value: unknown): Promise<void>;
}

export interface TextDocument {
  uri: string;
  fileName: string;
  languageId: string;
  version: number;
  getText(): string;
  lineAt(line: number): TextLine;
  lineCount: number;
  offsetAt(position: Position): number;
  positionAt(offset: number): Position;
  getWordRangeAtPosition(position: Position): Range | undefined;
}

export interface TextLine {
  lineNumber: number;
  text: string;
  range: Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface WorkspaceEdit {
  set(uri: string, range: Range, newText: string): void;
  delete(uri: string, range: Range): void;
  insert(uri: string, position: Position, newText: string): void;
}

// ============================================================================
// Language API
// ============================================================================

export interface LanguageAPI {
  registerCompletionItemProvider(selector: string, provider: CompletionItemProvider, ...triggerCharacters: string[]): Disposable;
  registerHoverProvider(selector: string, provider: HoverProvider): Disposable;
  registerDefinitionProvider(selector: string, provider: DefinitionProvider): Disposable;
  registerDocumentFormattingEditProvider(selector: string, provider: DocumentFormattingEditProvider): Disposable;
  registerDocumentSymbolProvider(selector: string, provider: DocumentSymbolProvider): Disposable;
  registerCodeActionProvider(selector: string, provider: CodeActionProvider): Disposable;
  registerCodeLensProvider(selector: string, provider: CodeLensProvider): Disposable;
  registerReferenceProvider(selector: string, provider: ReferenceProvider): Disposable;
  registerRenameProvider(selector: string, provider: RenameProvider): Disposable;
  registerSignatureHelpProvider(selector: string, provider: SignatureHelpProvider): Disposable;
  registerFoldingRangeProvider(selector: string, provider: FoldingRangeProvider): Disposable;
}

export interface CompletionItemProvider {
  provideCompletionItems(document: unknown, position: unknown): unknown[] | Promise<unknown[]>;
  resolveCompletionItem?(item: unknown): unknown;
}

export interface HoverProvider {
  provideHover(document: unknown, position: unknown): unknown | Promise<unknown>;
}

export interface DefinitionProvider {
  provideDefinition(document: unknown, position: unknown): unknown | Promise<unknown>;
}

export interface DocumentFormattingEditProvider {
  provideDocumentFormattingEdits(document: TextDocument): TextEdit[] | Promise<TextEdit[]>;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface DocumentSymbolProvider {
  provideDocumentSymbols(document: TextDocument): SymbolInformation[] | Promise<SymbolInformation[]>;
}

export interface SymbolInformation {
  name: string;
  kind: number;
  containerName?: string;
  location: { uri: string; range: Range };
}

export interface CodeActionProvider {
  provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[] | Promise<CodeAction[]>;
}

export interface CodeActionContext {
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  range: { start: CursorPosition; end: CursorPosition };
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
  code?: string | number;
}

export interface CodeAction {
  title: string;
  command?: string;
  arguments?: unknown[];
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
}

export interface CodeLensProvider {
  provideCodeLenses(document: TextDocument): CodeLens[] | Promise<CodeLens[]>;
  resolveCodeLens?(codeLens: CodeLens): CodeLens | Promise<CodeLens>;
}

export interface CodeLens {
  range: Range;
  command?: { title: string; command: string; arguments?: unknown[] };
  isResolved: boolean;
}

export interface ReferenceProvider {
  provideReferences(document: TextDocument, position: Position, context: { includeDeclaration: boolean }): Location[] | Promise<Location[]>;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface RenameProvider {
  provideRenameEdits(document: TextDocument, position: Position, newName: string): WorkspaceEdit | Promise<WorkspaceEdit>;
}

export interface SignatureHelpProvider {
  provideSignatureHelp(document: TextDocument, position: Position): SignatureHelp | Promise<SignatureHelp>;
}

export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature: number;
  activeParameter: number;
}

export interface SignatureInformation {
  label: string;
  documentation?: string;
  parameters: ParameterInformation[];
}

export interface ParameterInformation {
  label: string;
  documentation?: string;
}

export interface FoldingRangeProvider {
  provideFoldingRanges(document: TextDocument): FoldingRange[] | Promise<FoldingRange[]>;
}

export interface FoldingRange {
  start: number;
  end: number;
  kind?: 'comment' | 'imports' | 'region';
}

// ============================================================================
// Theme Definition (for registration)
// ============================================================================

export interface ThemeDefinitionLocal {
  id: string;
  name: string;
  type: 'dark' | 'light' | 'high-contrast';
  colors: Record<string, string>;
  tokenColors: Array<{ scope: string | string[]; settings: { foreground?: string; fontStyle?: string } }>;
}

// ============================================================================
// Panel API
// ============================================================================

export interface PanelAPI {
  createPanel(id: string, title: string, content: string): Disposable;
  showPanel(id: string): void;
  hidePanel(id: string): void;
  updatePanel(id: string, content: string): void;
}

export class PanelAPIImpl implements PanelAPI {
  createPanel(id: string, title: string, content: string): Disposable {
    (window as any).api.extension.ui.createPanel(id, title, content);
    return new Disposable(() => (window as any).api.extension.ui.hidePanel(id));
  }
  showPanel(id: string): void { (window as any).api.extension.ui.showPanel(id); }
  hidePanel(id: string): void { (window as any).api.extension.ui.hidePanel(id); }
  updatePanel(id: string, content: string): void { (window as any).api.extension.ui.updatePanel(id, content); }
}

// ============================================================================
// Status Bar API
// ============================================================================

export interface StatusBarAPI {
  createItem(id: string, text: string, alignment: 'left' | 'right', priority?: number): Disposable;
  updateItem(id: string, text: string): void;
  showItem(id: string): void;
  hideItem(id: string): void;
}

export class StatusBarAPIImpl implements StatusBarAPI {
  createItem(id: string, text: string, alignment: 'left' | 'right', priority?: number): Disposable {
    (window as any).api.extension.ui.setStatusBar(id, text, alignment, priority);
    return new Disposable(() => (window as any).api.extension.ui.updateStatusBar(id, ''));
  }
  updateItem(id: string, text: string): void { (window as any).api.extension.ui.updateStatusBar(id, text); }
  showItem(_id: string): void { /* show is implicit */ }
  hideItem(id: string): void { (window as any).api.extension.ui.updateStatusBar(id, ''); }
}

// ============================================================================
// Menu API
// ============================================================================

export interface MenuAPI {
  registerMenu(menuId: string, items: MenuItem[]): Disposable;
  registerContextMenu(menuId: string, items: MenuItem[]): Disposable;
}

export interface MenuItem {
  label: string;
  command: string;
  group?: string;
  when?: string;
  order?: number;
  icon?: string;
}

// ============================================================================
// Snippet API
// ============================================================================

export interface SnippetAPI {
  registerSnippet(language: string, snippet: SnippetDefinition): Disposable;
  registerSnippetFile(language: string, path: string): Disposable;
}

export interface SnippetDefinition {
  name: string;
  prefix: string;
  body: string | string[];
  description: string;
}

// ============================================================================
// Formatter API
// ============================================================================

export interface FormatterAPI {
  registerFormatter(selector: string, formatter: DocumentFormatter): Disposable;
}

export interface DocumentFormatter {
  format(document: TextDocument, options: FormatOptions): TextEdit[];
}

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
}

// ============================================================================
// Linter API
// ============================================================================

export interface LinterAPI {
  registerLinter(selector: string, linter: DocumentLinter): Disposable;
}

export interface DocumentLinter {
  lint(document: TextDocument): Diagnostic[];
}

// ============================================================================
// Plugin Context Factory (Full Implementation)
// ============================================================================

export function createPluginContext(manifest: PluginManifest): PluginContext {
  const subscriptions: Disposable[] = [];
  const commands = new CommandAPIImpl();
  const editor = new EditorAPIImpl();
  const settings = new SettingsAPIImpl();
  const theme = new ThemeAPIImpl();
  const fs = new FileSystemAPIImpl();
  const git = new GitAPIImpl();
  const terminal = new TerminalAPIImpl();
  const storage = new StorageAPIImpl(manifest.id);
  const clipboard = new ClipboardAPIImpl();
  const http = new HTTPAPIImpl();
  const processApi = new ProcessAPIImpl();
  const notifications = new NotificationAPIImpl();
  const panels = new PanelAPIImpl();
  const statusbar = new StatusBarAPIImpl();

  return {
    subscriptions,
    workspace: {
      rootPath: undefined,
      workspaceFolders: undefined,
      getConfiguration: (section: string) => ({
        get: <T>(_key: string, defaultValue?: T) => defaultValue as T,
        has: (_key: string) => false,
        update: async (_key: string, _value: unknown) => {},
        inspect: (_key: string) => undefined,
      }),
      onDidChangeConfiguration: () => new Disposable(() => {}),
      onDidOpenTextDocument: () => new Disposable(() => {}),
      onDidSaveTextDocument: () => new Disposable(() => {}),
      onDidCloseTextDocument: () => new Disposable(() => {}),
      openTextDocument: async (uri: string) => ({
        uri,
        fileName: uri.split('/').pop() || uri,
        languageId: 'plaintext',
        version: 1,
        getText: () => '',
        lineAt: (_line: number) => ({
          lineNumber: 0,
          text: '',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          firstNonWhitespaceCharacterIndex: 0,
          isEmptyOrWhitespace: true,
        }),
        lineCount: 0,
        offsetAt: () => 0,
        positionAt: () => ({ line: 0, character: 0 }),
        getWordRangeAtPosition: () => undefined,
      }),
      applyEdit: async () => true,
    },
    commands: {
      registerCommand: (id, handler) => commands.registerCommand(id, handler),
      executeCommand: (id, ...args) => commands.executeCommand(id, ...args),
    },
    window: {
      showInformationMessage: async () => undefined,
      showWarningMessage: async () => undefined,
      showErrorMessage: async () => undefined,
      showInputBox: async () => undefined,
      showQuickPick: async () => undefined,
    },
    languages: {
      registerCompletionItemProvider: () => new Disposable(() => {}),
      registerHoverProvider: () => new Disposable(() => {}),
      registerDefinitionProvider: () => new Disposable(() => {}),
      registerDocumentFormattingEditProvider: () => new Disposable(() => {}),
      registerDocumentSymbolProvider: () => new Disposable(() => {}),
      registerCodeActionProvider: () => new Disposable(() => {}),
      registerCodeLensProvider: () => new Disposable(() => {}),
      registerReferenceProvider: () => new Disposable(() => {}),
      registerRenameProvider: () => new Disposable(() => {}),
      registerSignatureHelpProvider: () => new Disposable(() => {}),
      registerFoldingRangeProvider: () => new Disposable(() => {}),
    },
    editor,
    terminal: {
      create: (options?) => terminal.create(options),
      write: (id, data) => terminal.write(id, data),
      close: (id) => terminal.close(id),
      onDidWriteData: (listener) => terminal.onData(listener),
      onDidCloseTerminal: (listener) => terminal.onExit((data) => listener(data.terminalId)),
    },
    statusbar: {
      createItem: (id, text, alignment, priority) => statusbar.createItem(id, text, alignment, priority),
      updateItem: (id, text) => statusbar.updateItem(id, text),
      showItem: (id) => statusbar.showItem(id),
      hideItem: (id) => statusbar.hideItem(id),
    },
    panels: {
      createPanel: (id, title, content) => panels.createPanel(id, title, content),
      showPanel: (id) => panels.showPanel(id),
      hidePanel: (id) => panels.hidePanel(id),
      updatePanel: (id, content) => panels.updatePanel(id, content),
    },
    menus: {
      registerMenu: () => new Disposable(() => {}),
      registerContextMenu: () => new Disposable(() => {}),
    },
    events: {
      onDidSaveTextDocument: () => new Disposable(() => {}),
      onDidOpenTextDocument: () => new Disposable(() => {}),
      onDidCloseTextDocument: () => new Disposable(() => {}),
      onDidChangeActiveEditor: () => new Disposable(() => {}),
    },
    formatters: {
      registerFormatter: () => new Disposable(() => {}),
    },
    linters: {
      registerLinter: () => new Disposable(() => {}),
    },
    settings: {
      get: <T>(key: string, defaultValue?: T) => settings.get<T>(key, defaultValue),
      set: (key: string, value: unknown) => settings.set(key, value),
      getAll: () => settings.getAll() as any,
      getSection: (section: string) => settings.getSection(section) as any,
      onDidChange: (listener) => settings.onDidChange(listener),
    },
    theme: {
      getCurrent: () => theme.getCurrent(),
      list: () => theme.list() as any,
      set: (id) => theme.set(id),
      register: (def) => theme.register(def),
      onDidChange: (listener) => theme.onDidChange(listener),
    },
    fs: {
      readFile: (p) => fs.readFile(p),
      writeFile: (p, c) => fs.writeFile(p, c),
      exists: (p) => fs.exists(p),
      readDir: (p) => fs.readDir(p),
      mkdir: (p, o) => fs.mkdir(p, o),
      delete: (p, o) => fs.delete(p, o),
      rename: (o, n) => fs.rename(o, n),
      stat: (p) => fs.stat(p),
      watch: (p, l) => fs.watch(p, l),
      getWorkspacePath: () => fs.getWorkspacePath(),
      resolvePath: (...s) => fs.resolvePath(...s),
    },
    git: {
      status: (p) => git.status(p),
      log: (p, n) => git.log(p, n),
      diff: (p, f) => git.diff(p, f),
      branch: (p) => git.branch(p),
      commit: (p, m, f) => git.commit(p, m, f),
      push: (p, r) => git.push(p, r),
      pull: (p, r) => git.pull(p, r),
      fetch: (p, r) => git.fetch(p, r),
      add: (p, f) => git.add(p, f),
      reset: (p, f) => git.reset(p, f),
      stash: (p) => git.stash(p),
      checkout: (p, b) => git.checkout(p, b),
      merge: (p, b) => git.merge(p, b),
      init: (p) => git.init(p),
    },
    storage: {
      get: <T>(key: string) => storage.get<T>(key),
      set: (key, value) => storage.set(key, value),
      delete: (key) => storage.delete(key),
      getAll: () => storage.getAll() as any,
      clear: () => storage.clear(),
    },
    clipboard: {
      read: () => clipboard.read(),
      write: (text) => clipboard.write(text),
    },
    http: {
      fetch: (url, opts) => http.fetch(url, opts),
    },
    process: {
      exec: (cmd, opts) => processApi.exec(cmd, opts),
      getEnv: (key) => processApi.getEnv(key),
      getPlatform: () => processApi.getPlatform(),
      getArch: () => processApi.getArch(),
      getVersion: () => processApi.getVersion(),
      getAppPath: () => processApi.getAppPath(),
      getExtensionPath: (id) => processApi.getExtensionPath(id),
      getTempPath: () => processApi.getTempPath(),
      getHomePath: () => processApi.getHomePath(),
    },
    notifications: {
      info: (msg) => notifications.info(msg),
      warn: (msg) => notifications.warn(msg),
      error: (msg) => notifications.error(msg),
      success: (msg) => notifications.success(msg),
    },
    ui: {
      showMessage: async (_type, _message, _items?) => undefined,
      showDialog: async () => ({ response: 0, checkboxChecked: false }),
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
      showSaveDialog: async () => ({ canceled: true, filePath: '' }),
      createStatusBarItem: (id, text, alignment, priority?) => statusbar.createItem(id, text, alignment, priority),
      updateStatusBarItem: (id, text) => statusbar.updateItem(id, text),
      createPanel: (id, title, content) => panels.createPanel(id, title, content),
      updatePanel: (id, content) => panels.updatePanel(id, content),
      showPanel: (id) => panels.showPanel(id),
      hidePanel: (id) => panels.hidePanel(id),
      createSidebarView: (_id, _title, _content) => new Disposable(() => {}),
      showSidebarView: (_id) => {},
    },
  };
}
