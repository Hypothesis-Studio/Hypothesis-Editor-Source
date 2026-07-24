/**
 * Search IPC - Handles file search and replace operations.
 */
import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SearchOptions {
  query: string;
  rootPath?: string;
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  useIgnoreFiles?: boolean;
  followSymlinks?: boolean;
  maxResults?: number;
  include?: string;
  exclude?: string;
}

interface SearchResult {
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

interface ReplaceOptions {
  file: string;
  line: number;
  column: number;
  length: number;
  replace: string;
  rootPath?: string;
}

interface ReplaceAllOptions {
  query: string;
  replace: string;
  rootPath?: string;
  isRegex?: boolean;
  isCaseSensitive?: boolean;
  isWholeWord?: boolean;
  include?: string;
  exclude?: string;
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '.nuxt', 'build', 'coverage', '__pycache__', '.venv', 'venv']);
const BINARY_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'svg', 'mp3', 'mp4', 'wav', 'ogg', 'flac', 'avi', 'mkv', 'mov', 'webm', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'woff', 'woff2', 'ttf', 'otf', 'eot', 'sqlite', 'db', 'lock']);

async function walkDir(dir: string, maxDepth: number = 15): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (maxDepth <= 0) break;
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await walkDir(fullPath, maxDepth - 1));
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        if (!BINARY_EXT.has(ext)) results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getWorkspaceRoot(options: { rootPath?: string }): string | null {
  if (options.rootPath) return options.rootPath;
  return null;
}

export function registerSearchIPC(): void {
  ipcMain.handle('search:find', async (_event, options: SearchOptions): Promise<SearchResult[]> => {
    const { query, isRegex, isCaseSensitive, isWholeWord, maxResults = 1000 } = options;
    if (!query) return [];

    const rootPath = getWorkspaceRoot(options);
    if (!rootPath) return [];

    const pattern = isRegex
      ? new RegExp(query, isCaseSensitive ? 'g' : 'gi')
      : new RegExp(escapeRegex(query), isCaseSensitive ? 'g' : 'gi');

    const files = await walkDir(rootPath);
    const results: SearchResult[] = [];

    for (const file of files) {
      if (results.length >= maxResults) break;
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= maxResults) break;
          const line = lines[i];
          let match: RegExpExecArray | null;
          pattern.lastIndex = 0;
          while ((match = pattern.exec(line)) !== null) {
            if (results.length >= maxResults) break;
            if (isWholeWord) {
              const before = match.index > 0 ? line[match.index - 1] : ' ';
              const after = match.index + match[0].length < line.length ? line[match.index + match[0].length] : ' ';
              if (/\w/.test(before) || /\w/.test(after)) continue;
            }
            results.push({
              file, // Return full path so renderer can open it directly
              line: i + 1,
              column: match.index + 1,
              length: match[0].length,
              text: line.trim(),
              match: match[0],
              preview: {
                before: line.substring(Math.max(0, match.index - 40), match.index),
                match: match[0],
                after: line.substring(match.index + match[0].length, match.index + match[0].length + 40),
              },
            });
            if (!pattern.global) break;
          }
        }
      } catch { /* skip binary or unreadable files */ }
    }

    return results;
  });

  ipcMain.handle('search:replace', async (_event, options: ReplaceOptions): Promise<boolean> => {
    const { file, line, column, length, replace } = options;
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      const lineContent = lines[line - 1];
      if (!lineContent) return false;
      lines[line - 1] = lineContent.substring(0, column - 1) + replace + lineContent.substring(column - 1 + length);
      await fs.writeFile(file, lines.join('\n'), 'utf-8');
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('search:replace-all', async (_event, options: ReplaceAllOptions): Promise<number> => {
    const { query, replace, isRegex, isCaseSensitive } = options;

    const rootPath = getWorkspaceRoot(options);
    if (!rootPath) return 0;

    const pattern = isRegex
      ? new RegExp(query, isCaseSensitive ? 'g' : 'gi')
      : new RegExp(escapeRegex(query), isCaseSensitive ? 'g' : 'gi');

    const files = await walkDir(rootPath);
    let totalReplaced = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const newContent = content.replace(pattern, replace);
        if (newContent !== content) {
          const matches = content.match(pattern);
          totalReplaced += matches?.length || 0;
          await fs.writeFile(file, newContent, 'utf-8');
        }
      } catch { /* skip */ }
    }

    return totalReplaced;
  });
}
