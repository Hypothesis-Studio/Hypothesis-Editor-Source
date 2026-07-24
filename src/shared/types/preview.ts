/**
 * Preview System — Type Definitions
 * Supports: HTML, Markdown, SVG, images, audio, video, PDF, and code files.
 */

// ── Supported Preview Categories ─────────────────────────────────
export type PreviewCategory =
  | 'html'
  | 'markdown'
  | 'svg'
  | 'image'
  | 'audio'
  | 'video'
  | 'pdf'
  | 'code'
  | 'text'
  | 'unsupported';

// ── Preview Mode ─────────────────────────────────────────────────
export type PreviewMode = 'preview' | 'source' | 'split';

// ── File Type Mapping ────────────────────────────────────────────
export interface FileTypeMapping {
  extensions: string[];
  category: PreviewCategory;
  mimePrefix: string;
  label: string;
  icon: string;
}

export const FILE_TYPE_MAP: FileTypeMapping[] = [
  { extensions: ['.html', '.htm'], category: 'html', mimePrefix: 'text/html', label: 'HTML', icon: 'code' },
  { extensions: ['.md', '.mdx', '.markdown'], category: 'markdown', mimePrefix: 'text/markdown', label: 'Markdown', icon: 'markdown' },
  { extensions: ['.svg'], category: 'svg', mimePrefix: 'image/svg+xml', label: 'SVG', icon: 'file-media' },
  { extensions: ['.png'], category: 'image', mimePrefix: 'image/png', label: 'PNG', icon: 'file-media' },
  { extensions: ['.jpg', '.jpeg'], category: 'image', mimePrefix: 'image/jpeg', label: 'JPEG', icon: 'file-media' },
  { extensions: ['.gif'], category: 'image', mimePrefix: 'image/gif', label: 'GIF', icon: 'file-media' },
  { extensions: ['.bmp'], category: 'image', mimePrefix: 'image/bmp', label: 'BMP', icon: 'file-media' },
  { extensions: ['.webp'], category: 'image', mimePrefix: 'image/webp', label: 'WebP', icon: 'file-media' },
  { extensions: ['.ico'], category: 'image', mimePrefix: 'image/x-icon', label: 'ICO', icon: 'file-media' },
  { extensions: ['.avif'], category: 'image', mimePrefix: 'image/avif', label: 'AVIF', icon: 'file-media' },
  { extensions: ['.apng'], category: 'image', mimePrefix: 'image/apng', label: 'APNG', icon: 'file-media' },
  { extensions: ['.mp3'], category: 'audio', mimePrefix: 'audio/mpeg', label: 'MP3', icon: 'file-media' },
  { extensions: ['.wav'], category: 'audio', mimePrefix: 'audio/wav', label: 'WAV', icon: 'file-media' },
  { extensions: ['.ogg'], category: 'audio', mimePrefix: 'audio/ogg', label: 'OGG', icon: 'file-media' },
  { extensions: ['.flac'], category: 'audio', mimePrefix: 'audio/flac', label: 'FLAC', icon: 'file-media' },
  { extensions: ['.aac', '.m4a'], category: 'audio', mimePrefix: 'audio/aac', label: 'AAC', icon: 'file-media' },
  { extensions: ['.wma'], category: 'audio', mimePrefix: 'audio/x-ms-wma', label: 'WMA', icon: 'file-media' },
  { extensions: ['.mp4', '.m4v'], category: 'video', mimePrefix: 'video/mp4', label: 'MP4', icon: 'file-media' },
  { extensions: ['.webm'], category: 'video', mimePrefix: 'video/webm', label: 'WebM', icon: 'file-media' },
  { extensions: ['.mkv'], category: 'video', mimePrefix: 'video/x-matroska', label: 'MKV', icon: 'file-media' },
  { extensions: ['.avi'], category: 'video', mimePrefix: 'video/x-msvideo', label: 'AVI', icon: 'file-media' },
  { extensions: ['.mov'], category: 'video', mimePrefix: 'video/quicktime', label: 'MOV', icon: 'file-media' },
  { extensions: ['.wmv'], category: 'video', mimePrefix: 'video/x-ms-wmv', label: 'WMV', icon: 'file-media' },
  { extensions: ['.ogv'], category: 'video', mimePrefix: 'video/ogg', label: 'OGV', icon: 'file-media' },
  { extensions: ['.pdf'], category: 'pdf', mimePrefix: 'application/pdf', label: 'PDF', icon: 'file-pdf' },
  { extensions: ['.txt', '.log', '.ini', '.cfg', '.conf', '.env', '.gitignore', '.editorconfig'], category: 'text', mimePrefix: 'text/plain', label: 'Text', icon: 'file-text' },
];

// Code extensions that Monaco can handle (for source view in split mode)
export const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html', '.htm', '.css', '.scss',
  '.less', '.sass', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.kt', '.php', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.sql', '.xml', '.yaml', '.yml', '.toml', '.md', '.graphql', '.dockerfile', '.vue',
  '.svelte', '.astro', '.lua', '.r', '.dart', '.ex', '.exs', '.erl', '.hs', '.ml',
  '.clj', '.scala', '.groovy', '.gradle', '.cmake', '.makefile',
]);

// ── Preview Data ─────────────────────────────────────────────────
export interface PreviewData {
  filePath: string;
  fileName: string;
  category: PreviewCategory;
  mimeType: string;
  /** For text/html/markdown/code — file content as string */
  content?: string;
  /** For binary files — data URL (data:mime;base64,...) */
  dataUrl?: string;
  /** File size in bytes */
  fileSize: number;
  /** Last modified timestamp */
  lastModified: string;
  /** For markdown — rendered HTML */
  renderedHtml?: string;
  /** Dimensions for images */
  dimensions?: { width: number; height: number };
  /** Duration for audio/video in seconds */
  duration?: number;
}

// ── Preview State ────────────────────────────────────────────────
export interface PreviewState {
  zoom: number;          // 100 = 100%
  panX: number;
  panY: number;
  isPlaying: boolean;
  currentTime: number;
  volume: number;        // 0-1
  mode: PreviewMode;
  autoReload: boolean;
}

// ── IPC Channels ─────────────────────────────────────────────────
export const PREVIEW_CHANNELS = {
  LOAD_PREVIEW: 'preview:load',
  GET_PREVIEW_DATA: 'preview:get-data',
  WATCH_FILE: 'preview:watch',
  UNWATCH_FILE: 'preview:unwatch',
  FILE_CHANGED: 'preview:file-changed',
  RENDER_MARKDOWN: 'preview:render-markdown',
  GET_FILE_TYPE: 'preview:get-file-type',
} as const;
