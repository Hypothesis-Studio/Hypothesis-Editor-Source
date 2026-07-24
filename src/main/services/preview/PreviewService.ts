/**
 * Preview Service — Main process service for file preview operations.
 * Handles file type detection, content reading, markdown rendering, and file watching.
 */
import * as fs from 'fs';
import * as path from 'path';
import type {
  PreviewData,
  PreviewCategory,
} from '../../../shared/types/preview';
import {
  FILE_TYPE_MAP,
  CODE_EXTENSIONS,
  PREVIEW_CHANNELS,
} from '../../../shared/types/preview';
import { BrowserWindow } from 'electron';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

// ── MIME Detection ───────────────────────────────────────────────
const EXTENSION_MIME: Record<string, string> = {
  '.html': 'text/html', '.htm': 'text/html',
  '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.xml': 'text/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.avif': 'image/avif', '.apng': 'image/apng',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/aac',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime', '.wmv': 'video/x-ms-wmv', '.ogv': 'video/ogg',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown', '.mdx': 'text/markdown', '.markdown': 'text/markdown',
  '.txt': 'text/plain', '.log': 'text/plain',
  '.py': 'text/x-python', '.rb': 'text/x-ruby', '.go': 'text/x-go',
  '.rs': 'text/x-rust', '.java': 'text/x-java', '.c': 'text/x-c',
  '.cpp': 'text/x-c++', '.h': 'text/x-c', '.hpp': 'text/x-c++',
  '.cs': 'text/x-csharp', '.swift': 'text/x-swift', '.kt': 'text/x-kotlin',
  '.php': 'text/x-php', '.sh': 'text/x-shellscript', '.sql': 'text/x-sql',
  '.ts': 'text/typescript', '.tsx': 'text/typescriptreact',
  '.jsx': 'text/javascriptreact',
};

// Binary file extensions that should be read as data URLs
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.avif', '.apng',
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
  '.mp4', '.m4v', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.ogv',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.otf', '.eot',
]);

// Text extensions that should be rendered as code (not binary)
const TEXT_AS_BINARY = new Set(['.pdf']);

export class PreviewService {
  private watchers: Map<string, FSWatcher> = new Map();

  constructor() {}

  /**
   * Detect the preview category for a file extension.
   */
  getFileCategory(ext: string): PreviewCategory {
    const lower = ext.toLowerCase();
    for (const mapping of FILE_TYPE_MAP) {
      if (mapping.extensions.includes(lower)) {
        return mapping.category;
      }
    }
    if (CODE_EXTENSIONS.has(lower)) return 'code';
    return 'unsupported';
  }

  /**
   * Get MIME type for a file extension.
   */
  getMimeType(ext: string): string {
    return EXTENSION_MIME[ext.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Check if a file extension is previewable.
   */
  isPreviewable(ext: string): boolean {
    const category = this.getFileCategory(ext);
    return category !== 'unsupported';
  }

  /**
   * Check if a file is binary (should be read as data URL).
   */
  isBinary(ext: string): boolean {
    return BINARY_EXTENSIONS.has(ext.toLowerCase()) && !TEXT_AS_BINARY.has(ext.toLowerCase());
  }

  /**
   * Load preview data for a file.
   */
  async loadPreview(filePath: string): Promise<PreviewData> {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const category = this.getFileCategory(ext);
    const mimeType = this.getMimeType(ext);

    // Get file stats
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(filePath);
    } catch (error: any) {
      throw new Error(`Cannot read file: ${error?.message || String(error)}`);
    }

    const base: Omit<PreviewData, 'content' | 'dataUrl' | 'renderedHtml' | 'dimensions' | 'duration'> = {
      filePath,
      fileName,
      category,
      mimeType,
      fileSize: stat.size,
      lastModified: stat.mtime.toISOString(),
    };

    // Binary files → store file path (components use file:// URL directly)
    if (this.isBinary(ext)) {
      return { ...base, filePath };
    }

    // Text-based files → content string
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // Markdown → render to HTML
    if (category === 'markdown') {
      const renderedHtml = await this.renderMarkdown(content);
      return { ...base, content, renderedHtml };
    }

    // HTML → wrap in sandboxed iframe-friendly content
    if (category === 'html') {
      return { ...base, content };
    }

    // SVG → content for inline rendering
    if (category === 'svg') {
      return { ...base, content };
    }

    // Everything else (code, text) → content
    return { ...base, content };
  }

  /**
   * Render Markdown to HTML with theme-aware styling.
   * Uses a lightweight custom parser (no ESM dependency).
   */
  async renderMarkdown(markdown: string): Promise<string> {
    try {
      return this.parseMarkdown(markdown);
    } catch {
      return `<p style="color: #f87171;">Failed to render Markdown</p>`;
    }
  }

  /**
   * Lightweight Markdown → HTML parser.
   * Supports: headings, bold, italic, code, links, images, lists, blockquotes, horizontal rules, tables.
   */
  private parseMarkdown(src: string): string {
    let html = '';
    const lines = src.split('\n');
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockContent = '';
    let inTable = false;
    let tableRows: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';
    let inBlockquote = false;
    let blockquoteContent = '';

    const flushBlockquote = () => {
      if (inBlockquote && blockquoteContent) {
        html += `<blockquote>${this.inline(blockquoteContent.trim())}</blockquote>\n`;
        blockquoteContent = '';
        inBlockquote = false;
      }
    };

    const flushTable = () => {
      if (inTable && tableRows.length > 0) {
        html += this.buildTable(tableRows);
        tableRows = [];
        inTable = false;
      }
    };

    const flushList = () => {
      if (inList) {
        html += `</${listType}>\n`;
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Fenced code blocks
      if (line.trimStart().startsWith('```')) {
        flushBlockquote(); flushTable(); flushList();
        if (inCodeBlock) {
          const escaped = codeBlockContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html += `<pre><code class="language-${codeBlockLang}">${escaped}</code></pre>\n`;
          inCodeBlock = false;
          codeBlockContent = '';
          codeBlockLang = '';
        } else {
          inCodeBlock = true;
          codeBlockLang = line.trimStart().slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent += (codeBlockContent ? '\n' : '') + line;
        continue;
      }

      const trimmed = line.trim();

      // Blank line
      if (trimmed === '') {
        flushBlockquote(); flushTable(); flushList();
        continue;
      }

      // Horizontal rule
      if (/^([-*_])\s*\1\s*\1[\s-]*$/.test(trimmed)) {
        flushBlockquote(); flushTable(); flushList();
        html += '<hr>\n';
        continue;
      }

      // Headings
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushBlockquote(); flushTable(); flushList();
        const level = headingMatch[1].length;
        const text = this.inline(headingMatch[2].replace(/\s*#+\s*$/, ''));
        html += `<h${level}>${text}</h${level}>\n`;
        continue;
      }

      // Table rows
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        flushBlockquote(); flushList();
        // Check if separator row
        if (/^\|[\s\-:|]+\|$/.test(trimmed)) continue;
        inTable = true;
        tableRows.push(trimmed);
        continue;
      } else {
        flushTable();
      }

      // Blockquote
      if (trimmed.startsWith('> ')) {
        flushTable(); flushList();
        inBlockquote = true;
        blockquoteContent += trimmed.slice(2) + ' ';
        continue;
      } else {
        flushBlockquote();
      }

      // Unordered list
      const ulMatch = trimmed.match(/^[-*+]\s+(.+)$/);
      if (ulMatch) {
        flushBlockquote(); flushTable();
        if (!inList || listType !== 'ul') { flushList(); html += '<ul>\n'; inList = true; listType = 'ul'; }
        html += `<li>${this.inline(ulMatch[1])}</li>\n`;
        continue;
      }

      // Ordered list
      const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        flushBlockquote(); flushTable();
        if (!inList || listType !== 'ol') { flushList(); html += '<ol>\n'; inList = true; listType = 'ol'; }
        html += `<li>${this.inline(olMatch[1])}</li>\n`;
        continue;
      }

      // Paragraph
      flushList();
      html += `<p>${this.inline(trimmed)}</p>\n`;
    }

    flushBlockquote(); flushTable(); flushList();

    // Close unclosed code block
    if (inCodeBlock) {
      const escaped = codeBlockContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<pre><code>${escaped}</code></pre>\n`;
    }

    return html;
  }

  /**
   * Process inline Markdown elements: bold, italic, code, links, images, strikethrough.
   */
  private inline(text: string): string {
    // Images: ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%" />');
    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold+Italic: ***text*** or ___text___
    text = text.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
    text = text.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');
    // Bold: **text** or __text__
    text = text.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
    text = text.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/_(.+?)_/g, '<em>$1</em>');
    // Strikethrough: ~~text~~
    text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    return text;
  }

  /**
   * Build an HTML table from pipe-separated rows.
   */
  private buildTable(rows: string[]): string {
    if (rows.length === 0) return '';
    const parseCells = (row: string) => row.split('|').slice(1, -1).map(c => c.trim());
    const headers = parseCells(rows[0]);
    let html = '<table>\n<thead>\n<tr>';
    for (const h of headers) html += `<th>${this.inline(h)}</th>`;
    html += '</tr>\n</thead>\n<tbody>\n';
    for (let i = 1; i < rows.length; i++) {
      const cells = parseCells(rows[i]);
      html += '<tr>';
      for (const c of cells) html += `<td>${this.inline(c)}</td>`;
      html += '</tr>\n';
    }
    html += '</tbody>\n</table>\n';
    return html;
  }

  /**
   * Start watching a file for changes. Sends IPC events to the renderer.
   */
  startWatching(filePath: string, sender: Electron.WebContents): void {
    if (this.watchers.has(filePath)) return;

    const watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    watcher.on('change', () => {
      if (!sender.isDestroyed()) {
        sender.send(PREVIEW_CHANNELS.FILE_CHANGED, { filePath });
      }
    });

    watcher.on('error', (err) => {
      console.error(`Preview watcher error for ${filePath}:`, err);
      this.stopWatching(filePath);
    });

    this.watchers.set(filePath, watcher);
  }

  /**
   * Stop watching a file.
   */
  stopWatching(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  /**
   * Stop all file watchers.
   */
  stopAllWatchers(): void {
    for (const [filePath, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
