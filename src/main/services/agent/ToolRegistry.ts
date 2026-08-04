/**
 * Tool Registry - Manages and executes agent tools.
 * Production-grade: 25+ tools covering file, terminal, git, web, editor, and project operations.
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
import https from 'https';
import http from 'http';
import { IncomingMessage } from 'http';
import { BrowserWindow } from 'electron';

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
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
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
      const filePath = this.resolvePath((args.path ?? args.filePath ?? args.file_path ?? args.filename ?? args.file) as string, ctx.workspacePath, ctx.workspaceFolders);
      const content = (args.content ?? args.text ?? args.data ?? args.body) as string;
      if (!filePath || content === undefined) {
        return { success: false, output: '', error: 'Missing path or content parameter', executionTimeMs: 0 };
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      this.broadcastFileChanged(filePath);
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
      const dirPath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
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
      const searchPath = this.resolvePath((args.path as string) || ".", ctx.workspacePath, ctx.workspaceFolders);
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
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
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
      this.broadcastFileChanged(filePath);
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
      const cwd = args.cwd ? this.resolvePath(args.cwd as string, ctx.workspacePath, ctx.workspaceFolders) : ctx.workspacePath || process.cwd();
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
      const repoPath = this.resolvePath((args.repoPath as string) || ".", ctx.workspacePath, ctx.workspaceFolders);
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
      const repoPath = this.resolvePath((args.repoPath as string) || ".", ctx.workspacePath, ctx.workspaceFolders);
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
      const repoPath = this.resolvePath((args.repoPath as string) || ".", ctx.workspacePath, ctx.workspaceFolders);
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


    // -- Web Tools -------------------------------------------------------------
    this.register({
      id: 'fetchWebPage',
      name: 'fetchWebPage',
      description: 'Fetch and return the text content of a web page (strips HTML tags, max 50KB)',
      category: 'web',
      parameters: [
        { name: 'url', type: 'string', description: 'Full URL to fetch (http or https)', required: true },
      ],
      requiredPermissions: ['web:fetch'],
      dangerous: false,
      enabled: true,
    }, async (args, _ctx) => {
      const url = (args.url ?? args.href ?? args.link) as string;
      if (!url) return { success: false, output: '', error: 'Missing url parameter', executionTimeMs: 0 };
      const start = Date.now();
      try {
        const text = await this.fetchUrl(url);
        return { success: true, output: text, executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: '', error: err.message, executionTimeMs: Date.now() - start };
      }
    });

    // -- Extended File Tools ---------------------------------------------------
    this.register({
      id: 'createDirectory',
      name: 'createDirectory',
      description: 'Create a directory (and any missing parent directories)',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'Directory path to create', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const dirPath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true, output: `Created directory: ${dirPath}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'deleteFile',
      name: 'deleteFile',
      description: 'Delete a file. Cannot delete directories or files outside the workspace.',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path to delete', required: true },
      ],
      requiredPermissions: ['file:delete'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      const wsRoot = ctx.workspacePath || process.cwd();
      if (!filePath.startsWith(wsRoot)) {
        return { success: false, output: '', error: `Refusing to delete file outside workspace: ${filePath}`, executionTimeMs: Date.now() - start };
      }
      const stat = await fs.stat(filePath).catch(() => null);
      if (!stat) return { success: false, output: '', error: `File not found: ${filePath}`, executionTimeMs: Date.now() - start };
      if (stat.isDirectory()) return { success: false, output: '', error: `Path is a directory. Use removeDirectory instead.`, executionTimeMs: Date.now() - start };
      await fs.unlink(filePath);
      this.broadcastFileChanged(filePath);
      return { success: true, output: `Deleted: ${filePath}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'moveFile',
      name: 'moveFile',
      description: 'Move or rename a file or directory',
      category: 'file',
      parameters: [
        { name: 'source', type: 'string', description: 'Source path', required: true },
        { name: 'destination', type: 'string', description: 'Destination path', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const src = this.resolvePath((args.source ?? args.from ?? args.src) as string, ctx.workspacePath, ctx.workspaceFolders);
      const dst = this.resolvePath((args.destination ?? args.to ?? args.dest) as string, ctx.workspacePath, ctx.workspaceFolders);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.rename(src, dst);
      this.broadcastFileChanged(dst);
      return { success: true, output: `Moved: ${src} -> ${dst}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'copyFile',
      name: 'copyFile',
      description: 'Copy a file to a new location',
      category: 'file',
      parameters: [
        { name: 'source', type: 'string', description: 'Source file path', required: true },
        { name: 'destination', type: 'string', description: 'Destination file path', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const src = this.resolvePath((args.source ?? args.from ?? args.src) as string, ctx.workspacePath, ctx.workspaceFolders);
      const dst = this.resolvePath((args.destination ?? args.to ?? args.dest) as string, ctx.workspacePath, ctx.workspaceFolders);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      this.broadcastFileChanged(dst);
      return { success: true, output: `Copied: ${src} -> ${dst}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'getFileInfo',
      name: 'getFileInfo',
      description: 'Get metadata about a file or directory (size, modified date, type)',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File or directory path', required: true },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      const stat = await fs.stat(filePath);
      const info = [
        `Path: ${filePath}`,
        `Type: ${stat.isDirectory() ? 'directory' : stat.isSymbolicLink() ? 'symlink' : 'file'}`,
        `Size: ${stat.size} bytes (${(stat.size / 1024).toFixed(2)} KB)`,
        `Modified: ${stat.mtime.toISOString()}`,
        `Created: ${stat.birthtime.toISOString()}`,
        `Permissions: ${(stat.mode & 0o777).toString(8)}`,
      ].join('\n');
      return { success: true, output: info, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'insertAtLine',
      name: 'insertAtLine',
      description: 'Insert text at a specific line number in a file (existing content shifts down)',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'line', type: 'number', description: 'Line number to insert at (1-indexed)', required: true },
        { name: 'content', type: 'string', description: 'Text to insert', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      const lineNum = Math.max(1, args.line as number);
      const insertContent = (args.content ?? args.text) as string;
      const existing = await fs.readFile(filePath, 'utf-8');
      const lines = existing.split('\n');
      lines.splice(lineNum - 1, 0, insertContent);
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      this.broadcastFileChanged(filePath);
      return { success: true, output: `Inserted at line ${lineNum} in ${filePath}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'replaceLines',
      name: 'replaceLines',
      description: 'Replace a range of lines in a file with new content',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'startLine', type: 'number', description: 'Start line (1-indexed, inclusive)', required: true },
        { name: 'endLine', type: 'number', description: 'End line (1-indexed, inclusive)', required: true },
        { name: 'content', type: 'string', description: 'Replacement content', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      const startLine = Math.max(1, args.startLine as number);
      const endLine = Math.max(startLine, args.endLine as number);
      const newContent = (args.content ?? args.text) as string;
      const existing = await fs.readFile(filePath, 'utf-8');
      const lines = existing.split('\n');
      const replacementLines = newContent.split('\n');
      lines.splice(startLine - 1, endLine - startLine + 1, ...replacementLines);
      await fs.writeFile(filePath, lines.join('\n'), 'utf-8');
      this.broadcastFileChanged(filePath);
      return { success: true, output: `Replaced lines ${startLine}-${endLine} in ${filePath}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'appendToFile',
      name: 'appendToFile',
      description: 'Append content to the end of a file (creates file if it does not exist)',
      category: 'file',
      parameters: [
        { name: 'path', type: 'string', description: 'File path', required: true },
        { name: 'content', type: 'string', description: 'Content to append', required: true },
      ],
      requiredPermissions: ['file:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      const appendContent = (args.content ?? args.text) as string;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.appendFile(filePath, appendContent, 'utf-8');
      this.broadcastFileChanged(filePath);
      return { success: true, output: `Appended to ${filePath}`, executionTimeMs: Date.now() - start };
    });

    // -- Extended Git Tools ----------------------------------------------------
    this.register({
      id: 'gitAdd',
      name: 'gitAdd',
      description: 'Stage files for commit (git add)',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'files', type: 'string', description: 'Files to stage (space-separated, or "." for all)', required: false },
      ],
      requiredPermissions: ['git:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const files = (args.files as string) || '.';
      try {
        const out = execSync(`git add ${files}`, { cwd, encoding: 'utf-8', timeout: 15000 });
        return { success: true, output: out.trim() || `Staged: ${files}`, executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: err.stdout || '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'gitCommit',
      name: 'gitCommit',
      description: 'Commit staged changes with a message',
      category: 'git',
      parameters: [
        { name: 'message', type: 'string', description: 'Commit message', required: true },
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
      ],
      requiredPermissions: ['git:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const message = (args.message ?? args.msg ?? args.m) as string;
      if (!message) return { success: false, output: '', error: 'Missing commit message', executionTimeMs: Date.now() - start };
      try {
        const out = execSync(`git commit -m ${JSON.stringify(message)}`, { cwd, encoding: 'utf-8', timeout: 15000 });
        return { success: true, output: out.trim(), executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: err.stdout || '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'gitCheckout',
      name: 'gitCheckout',
      description: 'Switch to a branch or create a new branch (git checkout)',
      category: 'git',
      parameters: [
        { name: 'branch', type: 'string', description: 'Branch name to checkout', required: true },
        { name: 'create', type: 'boolean', description: 'Create branch if it does not exist (-b flag)', required: false },
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
      ],
      requiredPermissions: ['git:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const branch = (args.branch ?? args.name) as string;
      const create = args.create === true || args.create === 'true';
      const flag = create ? '-b ' : '';
      try {
        const out = execSync(`git checkout ${flag}${branch}`, { cwd, encoding: 'utf-8', timeout: 15000 });
        return { success: true, output: out.trim() || `Switched to branch: ${branch}`, executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: err.stdout || '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'gitBranch',
      name: 'gitBranch',
      description: 'List all branches in the repository',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'all', type: 'boolean', description: 'Show all branches including remote', required: false },
      ],
      requiredPermissions: ['git:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const flag = args.all ? '-a' : '';
      try {
        const out = execSync(`git branch ${flag}`.trim(), { cwd, encoding: 'utf-8', timeout: 10000 });
        return { success: true, output: out.trim(), executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'gitPush',
      name: 'gitPush',
      description: 'Push commits to remote repository',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'remote', type: 'string', description: 'Remote name (default: origin)', required: false },
        { name: 'branch', type: 'string', description: 'Branch to push (default: current)', required: false },
        { name: 'setUpstream', type: 'boolean', description: 'Set upstream tracking (-u flag)', required: false },
      ],
      requiredPermissions: ['git:write'],
      dangerous: true,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const remote = (args.remote as string) || 'origin';
      const branch = (args.branch as string) || '';
      const upstreamFlag = args.setUpstream ? '-u ' : '';
      const target = branch ? `${remote} ${branch}` : remote;
      try {
        const out = execSync(`git push ${upstreamFlag}${target}`.trim(), { cwd, encoding: 'utf-8', timeout: 60000 });
        return { success: true, output: out.trim() || 'Push successful', executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: err.stdout || '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'gitPull',
      name: 'gitPull',
      description: 'Pull latest changes from remote repository',
      category: 'git',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Repository path', required: false },
        { name: 'remote', type: 'string', description: 'Remote name (default: origin)', required: false },
        { name: 'branch', type: 'string', description: 'Branch to pull (default: current)', required: false },
      ],
      requiredPermissions: ['git:write'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const remote = (args.remote as string) || 'origin';
      const branch = (args.branch as string) || '';
      const target = branch ? `${remote} ${branch}` : remote;
      try {
        const out = execSync(`git pull ${target}`.trim(), { cwd, encoding: 'utf-8', timeout: 60000 });
        return { success: true, output: out.trim() || 'Pull successful', executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: err.stdout || '', error: err.stderr || err.message, executionTimeMs: Date.now() - start };
      }
    });

    // -- Editor / Project Tools ------------------------------------------------
    this.register({
      id: 'openInEditor',
      name: 'openInEditor',
      description: 'Open a file in the editor (brings it into focus as an active tab)',
      category: 'editor',
      parameters: [
        { name: 'path', type: 'string', description: 'File path to open', required: true },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const filePath = this.resolvePath(args.path as string, ctx.workspacePath, ctx.workspaceFolders);
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('agent:open-file', { filePath });
      }
      return { success: true, output: `Opened in editor: ${filePath}`, executionTimeMs: Date.now() - start };
    });

    this.register({
      id: 'runTests',
      name: 'runTests',
      description: 'Run project tests. Auto-detects vitest, jest, npm test, or pytest.',
      category: 'terminal',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Project root path', required: false },
        { name: 'filter', type: 'string', description: 'Test name filter/pattern', required: false },
        { name: 'timeout', type: 'number', description: 'Timeout in ms (default: 60000)', required: false },
      ],
      requiredPermissions: ['terminal:execute'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const filter = args.filter as string | undefined;
      const timeout = (args.timeout as number) || 60000;
      let command = 'npm test';
      try {
        const pkgRaw = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const scripts: Record<string, string> = pkg.scripts || {};
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['vitest'] || scripts['test']?.includes('vitest')) {
          command = filter ? `npx vitest run --reporter=verbose -t "${filter}"` : 'npx vitest run --reporter=verbose';
        } else if (deps['jest'] || scripts['test']?.includes('jest')) {
          command = filter ? `npx jest --verbose "${filter}"` : 'npx jest --verbose';
        } else if (scripts['test']) {
          command = `npm test${filter ? ` -- --grep "${filter}"` : ''}`;
        }
      } catch {
        try {
          await fs.access(path.join(cwd, 'pyproject.toml'));
          command = filter ? `python -m pytest -v -k "${filter}"` : 'python -m pytest -v';
        } catch { /* use npm test */ }
      }
      try {
        const out = execSync(command, { cwd, encoding: 'utf-8', timeout, maxBuffer: 1024 * 1024 * 5 });
        return { success: true, output: out.trim(), executionTimeMs: Date.now() - start };
      } catch (err: any) {
        return { success: false, output: (err.stdout || '').trim(), error: (err.stderr || err.message || '').trim(), executionTimeMs: Date.now() - start };
      }
    });

    this.register({
      id: 'getProjectInfo',
      name: 'getProjectInfo',
      description: 'Get project metadata from package.json, pyproject.toml, Cargo.toml, or go.mod',
      category: 'file',
      parameters: [
        { name: 'repoPath', type: 'string', description: 'Project root path', required: false },
      ],
      requiredPermissions: ['file:read'],
      dangerous: false,
      enabled: true,
    }, async (args, ctx) => {
      const start = Date.now();
      const cwd = this.resolvePath((args.repoPath as string) || '.', ctx.workspacePath, ctx.workspaceFolders);
      const candidates = [
        { file: 'package.json', type: 'Node.js' },
        { file: 'pyproject.toml', type: 'Python' },
        { file: 'Cargo.toml', type: 'Rust' },
        { file: 'go.mod', type: 'Go' },
        { file: 'pom.xml', type: 'Java/Maven' },
      ];
      const results: string[] = [];
      for (const { file, type } of candidates) {
        try {
          const content = await fs.readFile(path.join(cwd, file), 'utf-8');
          results.push(`=== ${type} (${file}) ===\n${content.substring(0, 3000)}`);
        } catch { /* not found */ }
      }
      if (results.length === 0) return { success: false, output: '', error: 'No project manifest found', executionTimeMs: Date.now() - start };
      return { success: true, output: results.join('\n\n'), executionTimeMs: Date.now() - start };
    });
  }

  /**
   * Broadcast a file-changed event to all renderer windows so open tabs
   * reload their content from disk automatically.
   */
  private broadcastFileChanged(filePath: string): void {
    const payload = { filePath };
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:file-changed', payload);
      }
    }
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

  private resolvePath(p: string, workspacePath?: string, workspaceFolders?: string[]): string {
    if (path.isAbsolute(p)) return p;
    // Try primary workspace first
    const primary = workspacePath || process.cwd();
    const primaryResolved = path.resolve(primary, p);
    // If no multi-root folders, return primary
    if (!workspaceFolders || workspaceFolders.length === 0) return primaryResolved;
    // For write/create operations, always use primary
    // For read operations, try each folder and return first that exists
    try {
      const fsSync = require('fs');
      if (fsSync.existsSync(primaryResolved)) return primaryResolved;
      for (const folder of workspaceFolders) {
        if (folder === primary) continue;
        const candidate = path.resolve(folder, p);
        if (fsSync.existsSync(candidate)) return candidate;
      }
    } catch { /* fall through */ }
    // Default: primary workspace
    return primaryResolved;
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

  /**
   * Fetch a URL using Node's built-in http/https modules.
   * Strips HTML tags, follows redirects up to 5 hops, returns max 50KB of text.
   */
  private fetchUrl(urlStr: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const MAX_SIZE = 50 * 1024;
      const MAX_REDIRECTS = 5;

      const doRequest = (currentUrl: string, redirectsLeft: number) => {
        let parsed: URL;
        try { parsed = new URL(currentUrl); } catch { reject(new Error(`Invalid URL: ${currentUrl}`)); return; }

        const lib = parsed.protocol === 'https:' ? https : http;
        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; HypothesisEditor/1.0)',
            'Accept': 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout: 15000,
        };

        const req = lib.request(options, (res: IncomingMessage) => {
          // Follow redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return; }
            const nextUrl = res.headers.location.startsWith('http')
              ? res.headers.location
              : new URL(res.headers.location, currentUrl).toString();
            doRequest(nextUrl, redirectsLeft - 1);
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          let totalSize = 0;
          res.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize <= MAX_SIZE) chunks.push(chunk);
          });
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            // Strip HTML tags and normalize whitespace
            const text = raw
              .replace(/<script[\s\S]*?<\/script>/gi, '')
              .replace(/<style[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/[ \t]+/g, ' ')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
            resolve(text.substring(0, MAX_SIZE));
          });
          res.on('error', reject);
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
        req.end();
      };

      doRequest(urlStr, MAX_REDIRECTS);
    });
  }

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
