/**
 * Renderer Utilities - UI utility functions.
 */

/**
 * Get language ID from file extension.
 */
export function getLanguageFromExtension(ext: string): string {
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    mjs: 'javascript', cjs: 'javascript', mts: 'typescript', cts: 'typescript',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    cs: 'csharp', swift: 'swift', kt: 'kotlin', kts: 'kotlin',
    php: 'php', phtml: 'php', blade: 'php',
    html: 'html', htm: 'html', vue: 'vue', svelte: 'svelte',
    css: 'css', scss: 'scss', less: 'less', sass: 'scss',
    json: 'json', jsonc: 'json', json5: 'json',
    xml: 'xml', xsd: 'xml', svg: 'xml', xsl: 'xml',
    yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', mdx: 'markdown', markdown: 'markdown',
    sql: 'sql', mysql: 'sql', pgsql: 'sql', sqlite: 'sql',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    ps1: 'powershell', psm1: 'powershell', psd1: 'powershell',
    bat: 'bat', cmd: 'bat',
    dockerfile: 'dockerfile', containerfile: 'dockerfile',
    txt: 'plaintext', text: 'plaintext', log: 'plaintext',
    ini: 'ini', cfg: 'ini', conf: 'ini', config: 'ini',
    env: 'dotenv', dotenv: 'dotenv',
    graphql: 'graphql', gql: 'graphql',
    prisma: 'prisma',
    dart: 'dart',
    lua: 'lua',
    r: 'r', R: 'r',
    scala: 'scala', sc: 'scala',
    clj: 'clojure', cljs: 'clojure',
    ex: 'elixir', exs: 'elixir',
    erl: 'erlang', hrl: 'erlang',
    hs: 'haskell', lhs: 'haskell',
    ml: 'ocaml', mli: 'ocaml',
    fs: 'fsharp', fsx: 'fsharp', fsi: 'fsharp',
    zig: 'zig',
    nim: 'nim',
    v: 'v',
    jl: 'julia',
    groovy: 'groovy', gradle: 'groovy',
    cmake: 'cmake',
    makefile: 'makefile', make: 'makefile',
    proto: 'protobuf',
    tf: 'terraform', hcl: 'terraform',
    sol: 'solidity',
    regex: 'regex', re: 'regex',
  };
  return langMap[ext.toLowerCase()] || 'plaintext';
}

/**
 * Get file icon emoji based on extension.
 */
export function getFileIcon(filename: string, isDirectory?: boolean, isExpanded?: boolean): string {
  if (isDirectory) return isExpanded ? '📂' : '📁';
  
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    ts: '📘', tsx: '⚛️', js: '📒', jsx: '⚛️', mjs: '📒', cjs: '📒',
    py: '🐍', rb: '💎', rs: '🦀', go: '🔵', java: '☕',
    c: '🔧', cpp: '🔧', h: '🔧', hpp: '🔧', cs: '🟣',
    swift: '🔶', kt: '🟠', php: '🐘',
    html: '🌐', htm: '🌐', vue: '💚', svelte: '🧡',
    css: '🎨', scss: '🎨', less: '🎨', sass: '🎨',
    json: '📋', xml: '📰', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    md: '📝', mdx: '📝',
    sql: '🗄️', mysql: '🗄️', pgsql: '🗄️',
    sh: '🐚', bash: '🐚', zsh: '🐚', fish: '🐚',
    ps1: '💠', bat: '⬛', cmd: '⬛',
    dockerfile: '🐳', containerfile: '🐳',
    gitignore: '🙈', gitattributes: '🙈', gitmodules: '🙈',
    txt: '📄', log: '📄', csv: '📊',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️', ico: '🖼️',
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵',
    mp4: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', ppt: '📙', pptx: '📙',
    zip: '📦', tar: '📦', gz: '📦', rar: '📦', '7z': '📦',
    env: '🔐', envrc: '🔐',
    lock: '🔒', sum: '🔒',
    ini: '⚙️', cfg: '⚙️', conf: '⚙️',
    graphql: '◈', gql: '◈',
    prisma: '◆',
    dart: '🎯',
    lua: '🌙',
    r: '📊',
    scala: '🔴',
    zig: '⚡',
    nim: '👑',
    jl: '🟣',
    tf: '🏗️', hcl: '🏗️',
    proto: '📡',
    sol: '💎',
    regex: '🔍',
  };
  return iconMap[ext] || '📄';
}

/**
 * Format file size.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format relative time.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get relative path from base.
 */
export function getRelativePath(fullPath: string, basePath: string): string {
  const normalizedFull = fullPath.replace(/\\/g, '/');
  const normalizedBase = basePath.replace(/\\/g, '/');
  if (normalizedFull.startsWith(normalizedBase)) {
    return normalizedFull.slice(normalizedBase.length).replace(/^\//, '');
  }
  return normalizedFull;
}

/**
 * Check if a file is binary based on extension.
 */
export function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const binaryExtensions = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
    'mp3', 'wav', 'ogg', 'flac', 'aac',
    'mp4', 'avi', 'mkv', 'webm', 'mov',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'zip', 'tar', 'gz', 'rar', '7z', 'bz2',
    'exe', 'dll', 'so', 'dylib',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'sqlite', 'db',
  ]);
  return binaryExtensions.has(ext);
}

/**
 * Sanitize filename for display.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_');
}
