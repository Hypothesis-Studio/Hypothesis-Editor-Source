/**
 * Plugin SDK - API exposed to plugins for extending Hypothesis.
 * This is the public interface plugins use to interact with the editor.
 */
import type {
  PluginManifest,
  PluginContext,
  PluginDisposable,
  PluginCommand,
  PluginCommandRegistry,
  PluginWindowRegistry,
  PluginWorkspace,
  PluginLanguageRegistry,
  CompletionItemProvider,
  HoverProvider,
  DefinitionProvider,
} from '../../shared/types';

// ============================================================================
// Plugin Disposable
// ============================================================================

export class Disposable implements PluginDisposable {
  private _fn: () => void;

  constructor(fn: () => void) {
    this._fn = fn;
  }

  dispose(): void {
    this._fn();
  }
}

// ============================================================================
// Plugin API
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
    if (!handler) throw new Error(`Command not found: ${id}`);
    return handler(...args) as T;
  }

  getCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  hasCommand(id: string): boolean {
    return this.commands.has(id);
  }
}

// ============================================================================
// Window API
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
  kind: SymbolKind;
  containerName?: string;
  location: { uri: string; range: Range };
}

export enum SymbolKind {
  File = 0,
  Module = 1,
  Namespace = 2,
  Package = 3,
  Class = 4,
  Method = 5,
  Property = 6,
  Field = 7,
  Constructor = 8,
  Enum = 9,
  Interface = 10,
  Function = 11,
  Variable = 12,
  Constant = 13,
  String = 14,
  Number = 15,
  Boolean = 16,
  Array = 17,
  Object = 18,
  Key = 19,
  Null = 20,
  EnumMember = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export interface CodeActionProvider {
  provideCodeActions(document: TextDocument, range: Range, context: CodeActionContext): CodeAction[] | Promise<CodeAction[]>;
}

export interface CodeActionContext {
  diagnostics: Diagnostic[];
}

export interface Diagnostic {
  range: Range;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
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
// Theme API
// ============================================================================

export interface ThemeAPI {
  registerTheme(theme: ThemeDefinition): Disposable;
  getCurrentTheme(): ThemeDefinition;
  onDidChangeTheme(listener: (theme: ThemeDefinition) => void): Disposable;
}

export interface ThemeDefinition {
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

// ============================================================================
// Status Bar API
// ============================================================================

export interface StatusBarAPI {
  createItem(id: string, text: string, alignment: 'left' | 'right', priority?: number): Disposable;
  updateItem(id: string, text: string): void;
  showItem(id: string): void;
  hideItem(id: string): void;
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
// Plugin Context Factory
// ============================================================================

export function createPluginContext(manifest: PluginManifest): PluginContext {
  const subscriptions: Disposable[] = [];
  const commands = new CommandAPIImpl();

  return {
    subscriptions,
    workspace: {
      rootPath: undefined,
      workspaceFolders: undefined,
      getConfiguration: () => ({}),
      onDidChangeConfiguration: () => new Disposable(() => {}),
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
    },
  };
}
