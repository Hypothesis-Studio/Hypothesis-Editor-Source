/**
 * Tool Registry - Manages and executes agent tools.
 * Tools provide file system, terminal, git, search, and editor operations.
 */
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  AgentPermission,
} from '../../../shared/types/agent';
import { AgentError } from '../../../shared/types/agent';
import { logger } from '../../utils/logger';
import { FileService } from '../FileService';
import { GitService } from '../GitService';
import type { AppStore } from '../AppStore';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs/promises';

const log = logger.scope('ToolRegistry');

type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private fileService: FileService;
  private gitService: GitService;
  private appStore?: AppStore;

  constructor(fileService: FileService, gitService: GitService, appStore?: AppStore) {
    this.fileService = fileService;
    this.gitService = gitService;
    this.appStore = appStore;
  }

  initialize(): void {
    this.registerBuiltinTools();
    log.info(`Registered ${this.tools.size} tools`);
  }

  private registerBuiltinTools(): void {
    // â”€â”€ File Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.register({
      id: 'readFile',
      name: 'readFile',
      description: 'Read the contents of a file at the given path',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Absolute or workspace-relative file path', required: true },
        { name: 'startLine', type: 'number', description: 'Start line (1-indexed)', required: false },
        { name: 'endLine', type: 'number', description: 'End line (1-indexed)', required: false },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath);
      const content = await fs.readFile(filePath, 'utf-8');
      if (args.startLine || args.endLine) {
        const lines = content.split('\n');
        const start = Math.max(0, ((args.startLine as number) || 1) - 1);
        const end = Math.min(lines.length, (args.endLine as number) || lines.length);
        const sliced = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
        return { success: true, output: sliced, executionTimeMs: 0 };
      }
      return { success: true, output: content, executionTimeMs: 0 };
    });

    this.register({
      id: 'writeFile',
      name: 'writeFile',
      description: 'Write content to a file, creating directories if needed',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'content', type: 'string', description: 'File content', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const filePath = this.resolvePath((args.path ?? args.filePath ?? args.file_path ?? args.filename ?? args.file) as string, ctx.workspacePath);
      const content = (args.content ?? args.text ?? args.data ?? args.body) as string;
      if (!filePath || content === undefined) {
        return { success: false, output: '', error: 'Missing path or content parameter', executionTimeMs: 0 };
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, output: `Written to ${filePath}`, executionTimeMs: 0 };
    });

    this.register({
      id: 'listFiles',
      name: 'listFiles',
      description: 'List files and directories in a path',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Directory path', required: true },
        { name: 'recursive', type: 'boolean', description: 'List recursively', required: false },
        { name: 'pattern', type: 'string', description: 'Glob pattern filter', required: false },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const dirPath = this.resolvePath(args.path as string, ctx.workspacePath);
      const recursive = args.recursive === true;
      const entries: string[] = [];

      const listDir = async (dir: string, depth: number = 0) => {
        if (depth > 10) return;
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith('.') && item.name !== '.env') continue;
          const fullPath = path.join(dir, item.name);
          const relPath = path.relative(dirPath, fullPath);
          if (item.isDirectory()) {
            entries.push(`${relPath}/`);
            if (recursive) await listDir(fullPath, depth + 1);
          } else {
            entries.push(relPath);
          }
        }
      };

      await listDir(dirPath);
      return { success: true, output: entries.join('\n'), executionTimeMs: 0 };
    });

    this.register({
      id: 'searchFiles',
      name: 'searchFiles',
      description: 'Search for text patterns across files',
      category: 'search',
      parameters: [
        { name: 'query', type: 'string', description: 'Search query (string or regex)', required: true },
        { name: 'path', type: 'string', description: 'Directory to search in', required: false },
        { name: 'include', type: 'string', description: 'File pattern to include (e.g. *.ts)', required: false },
        { name: 'isRegex', type: 'boolean', description: 'Treat query as regex', required: false },
        { name: 'maxResults', type: 'number', description: 'Maximum results', required: false },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const searchPath = this.resolvePath((args.path as string) || '.', ctx.workspacePath);
      const query = args.query as string;
      const isRegex = args.isRegex === true;
      const maxResults = (args.maxResults as number) || 50;
      const pattern = isRegex ? new RegExp(query, 'gi') : null;

      const results: Array<{ file: string; line: number; text: string }> = [];

      const searchDir = async (dir: string) => {
        if (results.length >= maxResults) return;
        try {
          const items = await fs.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            if (results.length >= maxResults) break;
            if (item.name.startsWith('.') || item.name === 'node_modules') continue;
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory()) {
              await searchDir(fullPath);
            } else {
              if (args.include) {
                const includePattern = (args.include as string).replace('*', '');
                if (!item.name.endsWith(includePattern) && !item.name.includes(includePattern.replace('.', ''))) continue;
              }
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= maxResults) break;
                  const match = isRegex ? pattern!.test(lines[i]) : lines[i].includes(query);
                  if (match) {
                    results.push({
                      file: path.relative(searchPath, fullPath),
                      line: i + 1,
                      text: lines[i].trim().substring(0, 200),
                    });
                  }
                  if (isRegex) pattern!.lastIndex = 0;
                }
              } catch { /* Skip unreadable files */ }
            }
          }
        } catch { /* Skip unreadable dirs */ }
      };

      await searchDir(searchPath);
      const output = results.length > 0
        ? results.map(r => `${r.file}:${r.line}: ${r.text}`).join('\n')
        : 'No results found.';
      return { success: true, output, executionTimeMs: 0 };
    });

    this.register({
      id: 'editFile',
      name: 'editFile',
      description: 'Replace specific text in a file (search and replace)',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'oldText', type: 'string', description: 'Text to find', required: true },
        { name: 'newText', type: 'string', description: 'Replacement text', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath);
      // Accept multiple param name variants for robustness
      const oldText = (args.oldText ?? args.old_text ?? args.search ?? args.find ?? args.from) as string;
      const newText = (args.newText ?? args.new_text ?? args.replace ?? args.to ?? args.replacement ?? args.with) as string;
      if (!oldText || newText === undefined) {
        return { success: false, output: '', error: 'Missing oldText or newText parameter', executionTimeMs: 0 };
      }
      let content = await fs.readFile(filePath, 'utf-8');
      if (!content.includes(oldText)) {
        return { success: false, output: '', error: `oldText not found in file: ${filePath}`, executionTimeMs: 0 };
      }
      content = content.replace(oldText, newText);
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true, output: `File updated: ${filePath}`, executionTimeMs: 0 };
    });

    // â”€â”€ Terminal Tool â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.register({
      id: 'terminalRun',
      name: 'terminalRun',
      description: 'Execute a shell command and return its output',
      category: 'terminal',
      parameters: [
        { name: 'command', type: 'string', description: 'Shell command to execute', required: true },
        { name: 'cwd', type: 'string', description: 'Working directory', required: false },
        { name: 'timeout', type: 'number', description: 'Timeout in ms (default 30000)', required: false },
      ],
      requiredPermissions: ['terminal:execute'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const cwd = args.cwd ? this.resolvePath(args.cwd as string, ctx.workspacePath) : ctx.workspacePath || process.cwd();
      const timeout = (args.timeout as number) || 30000;
      try {
        const output = execSync(args.command as string, {
          cwd,
          timeout,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 5,
          windowsHide: true,
        });
        return { success: true, output: output.trim(), executionTimeMs: 0 };
      } catch (err: any) {
        return {
          success: false,
          output: (err.stdout || '').trim(),
          error: (err.stderr || err.message || '').trim(),
          executionTimeMs: 0,
        };
      }
    });

    // â”€â”€ Git Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.register({
      id: 'gitStatus',
      name: 'gitStatus',
      description: 'Get the current git repository status',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
      ],
      requiredPermissions: ['git:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const repoPath = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath);
      try {
        const status = await this.gitService.getStatus(repoPath);
        const output = [
          `Branch: ${status.branch}`,
          status.upstream ? `Upstream: ${status.upstream} (ahead: ${status.ahead}, behind: ${status.behind})` : '',
          status.staged.length > 0 ? `\nStaged:\n${status.staged.map((f: any) => `  ${f.status}: ${f.path}`).join('\n')}` : '',
          status.unstaged.length > 0 ? `\nUnstaged:\n${status.unstaged.map((f: any) => `  ${f.status}: ${f.path}`).join('\n')}` : '',
          status.untracked.length > 0 ? `\nUntracked:\n${status.untracked.map((f: any) => `  ${f}`).join('\n')}` : '',
        ].filter(Boolean).join('\n');
        return { success: true, output, executionTimeMs: 0 };
      } catch (err: any) {
        return { success: false, output: '', error: err.message, executionTimeMs: 0 };
      }
    });

    this.register({
      id: 'gitLog',
      name: 'gitLog',
      description: 'View recent git commits',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'maxCount', type: 'number', description: 'Number of commits', required: false },
      ],
      requiredPermissions: ['git:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const repoPath = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath);
      try {
        const commits = await this.gitService.log(repoPath, (args.maxCount as number) || 10);
        const output = commits.map(c =>
          `${c.shortHash} ${c.message} (${c.author}, ${new Date(c.date).toLocaleDateString()})`
        ).join('\n');
        return { success: true, output, executionTimeMs: 0 };
      } catch (err: any) {
        return { success: false, output: '', error: err.message, executionTimeMs: 0 };
      }
    });

    this.register({
      id: 'gitDiff',
      name: 'gitDiff',
      description: 'View file changes in the repository',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'file', type: 'string', description: 'Specific file to diff', required: false },
      ],
      requiredPermissions: ['git:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const repoPath = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath);
      try {
        const diff = await this.gitService.diff(repoPath, args.file as string) as any;
        const output = diff.hunks ? diff.hunks.map((h: any) =>
          h.changes.map((c: any) => c.content).join('\n')
        ).join('\n') : String(diff);
        return { success: true, output: output || 'No changes', executionTimeMs: 0 };
      } catch (err: any) {
        return { success: false, output: '', error: err.message, executionTimeMs: 0 };
      }
    });

    // â”€â”€ Editor Tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    this.register({
      id: 'getOpenEditors',
      name: 'getOpenEditors',
      description: 'List all currently open editor tabs',
      category: 'editor',
      parameters: [],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (_args, _ctx) => {
      // This communicates via IPC in runtime; placeholder for tool definition
      return { success: true, output: 'Open editors retrieved via IPC', executionTimeMs: 0 };
    });
  }

  private register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.id, { definition, handler });
  }

  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }

  getTool(id: string): RegisteredTool | undefined {
    return this.tools.get(id);
  }

  enableTool(id: string): void {
    const tool = this.tools.get(id);
    if (tool) {
      tool.definition.enabled = true;
      this.saveDisabledTools();
    }
  }

  disableTool(id: string): void {
    const tool = this.tools.get(id);
    if (tool) {
      tool.definition.enabled = false;
      this.saveDisabledTools();
    }
  }

  /** Save the set of disabled tool IDs to persistent storage */
  private saveDisabledTools(): void {
    if (!this.appStore) return;
    const disabled = Array.from(this.tools.values())
      .filter(t => !t.definition.enabled)
      .map(t => t.definition.id);
    this.appStore.set('agent.disabledTools', disabled);
  }

  /** Load disabled tool states from persistent storage */
  loadDisabledTools(): void {
    if (!this.appStore) return;
    const disabled = this.appStore.get('agent.disabledTools') as string[] | undefined;
    if (disabled && Array.isArray(disabled)) {
      for (const id of disabled) {
        const tool = this.tools.get(id);
        if (tool) tool.definition.enabled = false;
      }
    }
  }

  async execute(
    toolId: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new AgentError(`Tool ${toolId} not found`, 'NOT_FOUND', 'tool');
    }
    if (!tool.definition.enabled) {
      throw new AgentError(
        `Tool "${toolId}" is currently disabled. Enable it in Settings → AI Agent → Tools, or ask the user to enable it.`,
        'DISABLED', 'tool',
      );
    }

    // Check permissions
    for (const perm of tool.definition.requiredPermissions) {
      if (!context.permissions.includes(perm)) {
        throw new AgentError(
          `Missing permission: ${perm}`,
          'PERMISSION_DENIED',
          'tool',
          undefined,
          false,
        );
      }
    }

    // Validate required parameters (with fuzzy matching for common variants)
    const paramAliases: Record<string, string[]> = {
      path: ['path', 'filePath', 'file_path', 'filename', 'file'],
      content: ['content', 'text', 'data', 'body'],
      command: ['command', 'cmd', 'shell'],
      oldText: ['oldText', 'old_text', 'search', 'find', 'from'],
      newText: ['newText', 'new_text', 'replace', 'to', 'replacement', 'with'],
      query: ['query', 'search', 'pattern', 'text'],
    };
    for (const param of tool.definition.parameters) {
      if (param.required) {
        const aliases = paramAliases[param.name] || [param.name];
        const hasParam = aliases.some(alias => alias in args);
        if (!hasParam) {
          // Try to resolve from aliases
          for (const alias of aliases) {
            if (alias in args && alias !== param.name) {
              args[param.name] = args[alias];
              break;
            }
          }
          if (!(param.name in args)) {
            throw new AgentError(
              `Missing required parameter: ${param.name}`,
              'VALIDATION_ERROR',
              'validation',
            );
          }
        }
      }
    }

    const start = Date.now();
    try {
      const result = await tool.handler(args, context);
      result.executionTimeMs = Date.now() - start;
      log.debug(`Tool ${toolId} executed in ${result.executionTimeMs}ms`);
      return result;
    } catch (err) {
      const executionTimeMs = Date.now() - start;
      if (err instanceof AgentError) throw err;
      throw new AgentError(
        `Tool execution failed: ${(err as Error).message}`,
        'EXECUTION_ERROR',
        'tool',
        undefined,
        false,
      );
    }
  }

  private resolvePath(p: string, workspacePath?: string): string {
    if (path.isAbsolute(p)) return p;
    return path.resolve(workspacePath || process.cwd(), p);
  }

  /**
   * Convert tool definitions to OpenAI function-calling format.
   */
  toOpenAITools(toolIds: string[]): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return toolIds
      .map(id => this.tools.get(id))
      .filter((t): t is RegisteredTool => t !== undefined && t.definition.enabled)
      .map(t => {
        // OpenAI function names must match ^[a-zA-Z0-9_-]+$ — no spaces
        const functionName = t.definition.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        return {
          type: 'function' as const,
          function: {
            name: functionName,
            description: t.definition.description,
            parameters: {
              type: 'object',
              properties: Object.fromEntries(
                t.definition.parameters.map(p => [p.name, {
                  type: p.type,
                  description: p.description,
                  ...(p.enum ? { enum: p.enum } : {}),
                  ...(p.default !== undefined ? { default: p.default } : {}),
                }])
              ),
              required: t.definition.parameters.filter(p => p.required).map(p => p.name),
            },
          },
        };
      });
  }

  /**
   * Resolve a sanitized function name back to the original tool ID.
   */
  private toolAliases: Record<string, string> = {
    runFile: 'terminalRun',
    run: 'terminalRun',
    execute: 'terminalRun',
    exec: 'terminalRun',
    shell: 'terminalRun',
    bash: 'terminalRun',
    createFile: 'writeFile',
    newFile: 'writeFile',
    save: 'writeFile',
    saveFile: 'writeFile',
    modify: 'editFile',
    update: 'editFile',
    replace: 'editFile',
    find: 'searchFiles',
    search: 'searchFiles',
    grep: 'searchFiles',
    ls: 'listFiles',
    dir: 'listFiles',
    cat: 'readFile',
    view: 'readFile',
    status: 'gitStatus',
    log: 'gitLog',
    history: 'gitLog',
  };

  resolveToolId(functionName: string): string | undefined {
    // Direct match
    if (this.tools.has(functionName)) return functionName;
    // Alias match
    const aliasTarget = this.toolAliases[functionName];
    if (aliasTarget && this.tools.has(aliasTarget)) return aliasTarget;
    // Sanitized name match
    for (const [id, t] of this.tools) {
      const sanitized = t.definition.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      if (sanitized === functionName) return id;
    }
    return undefined;
  }
}