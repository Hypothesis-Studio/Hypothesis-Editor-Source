/**
 * editorScreenshot.ts - Capture editor screenshots with styled header.
 * Pure native implementation using Canvas API + highlight.js (zero new dependencies)
 * Supports: full visible area, full scroll, and selected text only.
 */
import * as monaco from 'monaco-editor';
import hljs from 'highlight.js';

export type ScreenshotMode = 'visible' | 'full' | 'selection';

export interface ScreenshotOptions {
  mode: ScreenshotMode;
  editor: monaco.editor.IStandaloneCodeEditor;
  language: string;
  filename?: string;
  theme?: 'light' | 'dark';
  showLineNumbers?: boolean;
}

export interface ScreenshotResult {
  dataUrl: string;
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

interface CanvasConfig {
  padding: number;
  headerHeight: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  bgColor: string;
  headerBg: string;
  borderColor: string;
  textColor: string;
  langColor: string;
  countColor: string;
}

/**
 * Capture editor screenshot with macOS-style traffic light header
 */
export async function captureEditorScreenshot(
  options: ScreenshotOptions
): Promise<ScreenshotResult> {
  const { mode, editor, language, filename = 'code-screenshot.png', theme, showLineNumbers = false } = options;

  // Detect dark mode from themeStore state (most reliable),
  // fall back to body class, then OS preference
  const isDark = theme === 'dark' || 
    (theme === undefined && (() => {
      try {
        // Try to read from themeStore directly
        const { useThemeStore } = require('../stores/themeStore');
        const currentTheme = useThemeStore.getState().currentTheme;
        if (currentTheme) {
          // light themes
          if (currentTheme === 'hypothesis-light') return false;
          // dark themes
          if (currentTheme === 'hypothesis-dark' || currentTheme === 'vs-dark' || currentTheme === 'hc-black') return true;
          // extension themes — check type via extensionThemes map
          const ext = useThemeStore.getState().extensionThemes[currentTheme];
          if (ext) return ext.type === 'dark' || ext.type === 'hc';
          // fall through to body class check
        }
      } catch {}
      // Body class fallback
      if (document.body.classList.contains('hypothesis-dark')) return true;
      if (document.body.classList.contains('hypothesis-light')) return false;
      // VS Code dark theme classes
      if (document.body.classList.contains('vs-dark') || document.body.classList.contains('hc-black')) return true;
      // OS preference as last resort
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
    })());

  // Get editor font settings
  const editorOptions = editor.getOptions();
  const fontSize = editorOptions.get(monaco.editor.EditorOption.fontSize) || 14;
  const fontFamily = editorOptions.get(monaco.editor.EditorOption.fontFamily) || 'Consolas, "Courier New", monospace';
  const lineHeight = editorOptions.get(monaco.editor.EditorOption.lineHeight) || fontSize * 1.5;

  const config: CanvasConfig = {
    padding: 16,
    headerHeight: 36,
    fontSize,
    lineHeight,
    fontFamily,
    bgColor: isDark ? '#1e1e1e' : '#ffffff',
    headerBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)',
    textColor: isDark ? '#d4d4d4' : '#000000',
    langColor: isDark ? '#9cdcfe' : '#0070c1',
    countColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)',
  };

  let contentText: string;
  let lineCount: number;

  if (mode === 'visible') {
    const result = captureVisibleContent(editor);
    contentText = result.text;
    lineCount = result.lineCount;
  } else if (mode === 'full') {
    const result = captureFullContent(editor);
    contentText = result.text;
    lineCount = result.lineCount;
  } else {
    // selection
    const result = captureSelectedContent(editor);
    contentText = result.text;
    lineCount = result.lineCount;
  }

  // Apply syntax highlighting
  const highlightedHtml = applySyntaxHighlighting(contentText, language, isDark);

  // Render to canvas
  const canvas = await renderToCanvas(highlightedHtml, contentText, language, lineCount, config, showLineNumbers);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
      'image/png'
    );
  });

  const dataUrl = canvas.toDataURL('image/png');

  return { 
    dataUrl, 
    blob, 
    filename,
    width: canvas.width,
    height: canvas.height
  };
}

/**
 * Capture visible editor content (no scrolling)
 */
function captureVisibleContent(editor: monaco.editor.IStandaloneCodeEditor): { text: string; lineCount: number } {
  const model = editor.getModel();
  if (!model) return { text: '', lineCount: 0 };

  const visibleRanges = editor.getVisibleRanges();
  if (visibleRanges.length === 0) {
    const text = model.getValue();
    return { text, lineCount: text.split('\n').length };
  }

  const range = visibleRanges[0];
  const text = model.getValueInRange(range);
  const lineCount = text.split('\n').length;
  
  return { text, lineCount };
}

/**
 * Capture full editor content (entire document)
 */
function captureFullContent(editor: monaco.editor.IStandaloneCodeEditor): { text: string; lineCount: number } {
  const model = editor.getModel();
  const text = model?.getValue() || '';
  const lineCount = text.split('\n').length;
  
  return { text, lineCount };
}

/**
 * Capture selected text only
 */
function captureSelectedContent(editor: monaco.editor.IStandaloneCodeEditor): { text: string; lineCount: number } {
  const selection = editor.getSelection();
  const model = editor.getModel();

  if (!selection || !model || selection.isEmpty()) {
    throw new Error('No text selected');
  }

  const text = model.getValueInRange(selection);
  const lineCount = text.split('\n').length;

  return { text, lineCount };
}

/**
 * Apply syntax highlighting using highlight.js
 */
function applySyntaxHighlighting(code: string, language: string, isDark: boolean): string {
  try {
    // Comprehensive Monaco → hljs language mapping
    const langMap: Record<string, string> = {
      // Web
      javascript: 'javascript',
      javascriptreact: 'javascript',
      jsx: 'javascript',
      typescript: 'typescript',
      typescriptreact: 'typescript',
      tsx: 'typescript',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      jsonc: 'json',
      graphql: 'graphql',
      wasm: 'wasm',

      // Systems
      c: 'c',
      cpp: 'cpp',
      'c++': 'cpp',
      csharp: 'csharp',
      'c#': 'csharp',
      rust: 'rust',
      go: 'go',
      swift: 'swift',
      kotlin: 'kotlin',
      java: 'java',
      scala: 'scala',
      dart: 'dart',
      objectivec: 'objectivec',
      'objective-c': 'objectivec',

      // Scripting
      python: 'python',
      ruby: 'ruby',
      rb: 'ruby',
      php: 'php',
      perl: 'perl',
      lua: 'lua',
      r: 'r',
      julia: 'julia',
      groovy: 'groovy',
      elixir: 'elixir',
      erlang: 'erlang',
      clojure: 'clojure',
      haskell: 'haskell',
      fsharp: 'fsharp',
      'f#': 'fsharp',
      ocaml: 'ocaml',
      coffeescript: 'coffeescript',

      // Shell / CLI
      bash: 'bash',
      sh: 'bash',
      shell: 'bash',
      zsh: 'bash',
      powershell: 'powershell',
      ps1: 'powershell',
      bat: 'dos',
      cmd: 'dos',

      // Data / Config
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'ini',
      ini: 'ini',
      properties: 'properties',
      env: 'properties',
      dockerfile: 'dockerfile',
      nginx: 'nginx',
      apache: 'apache',
      terraform: 'hcl',
      hcl: 'hcl',

      // Database
      sql: 'sql',
      mysql: 'sql',
      pgsql: 'sql',
      plsql: 'sql',
      redis: 'redis',

      // Markup / Docs
      markdown: 'markdown',
      md: 'markdown',
      mdx: 'markdown',
      latex: 'latex',
      tex: 'latex',
      rst: 'plaintext',

      // Other
      protobuf: 'protobuf',
      proto: 'protobuf',
      makefile: 'makefile',
      cmake: 'cmake',
      nix: 'nix',
      solidity: 'solidity',
      wgsl: 'wgsl',
      hlsl: 'glsl',
      glsl: 'glsl',
      vb: 'vbnet',
      vbnet: 'vbnet',
      apex: 'java',  // closest approximation
      abap: 'plaintext',
      plaintext: 'plaintext',
      text: 'plaintext',
    };

    const normalized = language.toLowerCase();
    const hljsLang = langMap[normalized] || normalized;
    
    if (hljs.getLanguage(hljsLang)) {
      const highlighted = hljs.highlight(code, { language: hljsLang });
      return highlighted.value;
    } else {
      // Fallback: try the raw name, then auto-detect
      try {
        const highlighted = hljs.highlight(code, { language: normalized });
        return highlighted.value;
      } catch {
        const highlighted = hljs.highlightAuto(code);
        return highlighted.value;
      }
    }
  } catch (error) {
    console.warn('Syntax highlighting failed, using plain text:', error);
    return escapeHtml(code);
  }
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Parse HTML from highlight.js and extract styled tokens
 */
interface Token {
  text: string;
  color: string;
}

function parseHighlightedHtml(html: string, baseColor: string, isDark: boolean): Token[] {
  const tokens: Token[] = [];
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // VS Code-accurate color scheme mapping for all hljs token classes
  const colorMap: Record<string, string> = isDark ? {
    // Keywords & control flow
    'hljs-keyword':          '#569cd6',
    'hljs-built_in':         '#4ec9b0',
    'hljs-type':             '#4ec9b0',
    'hljs-literal':          '#569cd6',  // true/false/null
    'hljs-number':           '#b5cea8',
    'hljs-operator':         '#d4d4d4',
    'hljs-punctuation':      '#d4d4d4',
    'hljs-property':         '#9cdcfe',

    // Strings & templates
    'hljs-string':           '#ce9178',
    'hljs-regexp':           '#d16969',
    'hljs-char':             '#ce9178',
    'hljs-char.escape_':     '#d7ba7d',
    'hljs-subst':            '#d4d4d4',  // template literal ${...}
    'hljs-template-tag':     '#569cd6',
    'hljs-template-variable':'#9cdcfe',

    // Identifiers
    'hljs-variable':         '#9cdcfe',
    'hljs-variable.language_':'#569cd6', // this, self, super
    'hljs-variable.constant_':'#4fc1ff',
    'hljs-title':            '#dcdcaa',  // function/method names
    'hljs-title.class_':     '#4ec9b0',
    'hljs-title.class_.inherited__': '#4ec9b0',
    'hljs-title.function_':  '#dcdcaa',
    'hljs-class':            '#4ec9b0',
    'hljs-function':         '#dcdcaa',
    'hljs-params':           '#d4d4d4',

    // Comments & docs
    'hljs-comment':          '#6a9955',
    'hljs-doctag':           '#608b4e',
    'hljs-meta':             '#9b9b9b',
    'hljs-meta.prompt_':     '#608b4e',
    'hljs-meta keyword_':    '#569cd6',
    'hljs-meta string_':     '#ce9178',

    // Markup / HTML / XML
    'hljs-tag':              '#808080',
    'hljs-name':             '#569cd6',
    'hljs-attr':             '#9cdcfe',
    'hljs-attribute':        '#9cdcfe',
    'hljs-namespace':        '#4ec9b0',
    'hljs-selector-id':      '#d7ba7d',
    'hljs-selector-class':   '#d7ba7d',
    'hljs-selector-attr':    '#d7ba7d',
    'hljs-selector-pseudo':  '#d7ba7d',
    'hljs-selector-tag':     '#d7ba7d',

    // Diff
    'hljs-addition':         '#b5cea8',
    'hljs-deletion':         '#ce9178',

    // Misc
    'hljs-symbol':           '#b5cea8',
    'hljs-bullet':           '#6796e6',
    'hljs-link':             '#ce9178',
    'hljs-formula':          '#9cdcfe',
    'hljs-emphasis':         '#d4d4d4',
    'hljs-strong':           '#d4d4d4',
    'hljs-quote':            '#6a9955',
    'hljs-code':             '#ce9178',
    'hljs-section':          '#ffd700',
  } : {
    // Keywords & control flow
    'hljs-keyword':          '#0000ff',
    'hljs-built_in':         '#267f99',
    'hljs-type':             '#267f99',
    'hljs-literal':          '#0000ff',
    'hljs-number':           '#098658',
    'hljs-operator':         '#000000',
    'hljs-punctuation':      '#383a42',
    'hljs-property':         '#001080',

    // Strings & templates
    'hljs-string':           '#a31515',
    'hljs-regexp':           '#811f3f',
    'hljs-char':             '#a31515',
    'hljs-char.escape_':     '#ee0000',
    'hljs-subst':            '#000000',
    'hljs-template-tag':     '#0000ff',
    'hljs-template-variable':'#001080',

    // Identifiers
    'hljs-variable':         '#001080',
    'hljs-variable.language_':'#0000ff',
    'hljs-variable.constant_':'#0070c1',
    'hljs-title':            '#795e26',
    'hljs-title.class_':     '#267f99',
    'hljs-title.class_.inherited__': '#267f99',
    'hljs-title.function_':  '#795e26',
    'hljs-class':            '#267f99',
    'hljs-function':         '#795e26',
    'hljs-params':           '#001080',

    // Comments & docs
    'hljs-comment':          '#008000',
    'hljs-doctag':           '#008000',
    'hljs-meta':             '#808080',
    'hljs-meta.prompt_':     '#008000',
    'hljs-meta keyword_':    '#0000ff',
    'hljs-meta string_':     '#a31515',

    // Markup / HTML / XML
    'hljs-tag':              '#800000',
    'hljs-name':             '#800000',
    'hljs-attr':             '#ff0000',
    'hljs-attribute':        '#ff0000',
    'hljs-namespace':        '#267f99',
    'hljs-selector-id':      '#800000',
    'hljs-selector-class':   '#800000',
    'hljs-selector-attr':    '#800000',
    'hljs-selector-pseudo':  '#800000',
    'hljs-selector-tag':     '#800000',

    // Diff
    'hljs-addition':         '#098658',
    'hljs-deletion':         '#a31515',

    // Misc
    'hljs-symbol':           '#098658',
    'hljs-bullet':           '#0451a5',
    'hljs-link':             '#a31515',
    'hljs-formula':          '#001080',
    'hljs-emphasis':         '#000000',
    'hljs-strong':           '#000000',
    'hljs-quote':            '#008000',
    'hljs-code':             '#a31515',
    'hljs-section':          '#800000',
  };

  function getColorForClasses(className: string): string | null {
    if (!className) return null;
    // Try full compound class first (e.g. "hljs-title class_")
    if (colorMap[className]) return colorMap[className];
    // Try each individual class token
    const parts = className.split(/\s+/);
    for (const part of parts) {
      if (colorMap[part]) return colorMap[part];
    }
    // Try joined variants hljs uses (e.g. "hljs-variable language_")
    if (parts.length >= 2) {
      const joined = parts[0] + '.' + parts.slice(1).join('.');
      if (colorMap[joined]) return colorMap[joined];
    }
    return null;
  }

  function walkNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        tokens.push({ text, color: baseColor });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const className = el.className || '';
      const resolved = getColorForClasses(className);
      const color = resolved || baseColor;
      
      if (el.childNodes.length === 0) {
        const text = el.textContent || '';
        if (text) tokens.push({ text, color });
      } else {
        const prevBase = baseColor;
        baseColor = color;
        el.childNodes.forEach(walkNode);
        baseColor = prevBase;
      }
    }
  }

  tempDiv.childNodes.forEach(walkNode);
  
  return tokens;
}

/**
 * Render screenshot to canvas with header and syntax-highlighted code
 */
async function renderToCanvas(
  highlightedHtml: string,
  plainText: string,
  language: string,
  lineCount: number,
  config: CanvasConfig,
  showLineNumbers: boolean
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Set font for measurement
  ctx.font = `${config.fontSize}px ${config.fontFamily}`;

  // Measure content dimensions
  const lines = plainText.split('\n');
  const lineNumWidth = showLineNumbers ? 40 : 0;
  const maxWidth = Math.max(
    600, // minimum width
    ...lines.map(line => ctx.measureText(line).width)
  );

  const contentWidth = Math.min(1200, maxWidth + config.padding * 2 + lineNumWidth); // max 1200px
  const contentHeight = lineCount * config.lineHeight + config.padding * 2;
  const totalHeight = config.headerHeight + contentHeight + 2; // +2 for borders

  // Set canvas size (2x for retina)
  const scale = 2;
  canvas.width = contentWidth * scale;
  canvas.height = totalHeight * scale;
  canvas.style.width = `${contentWidth}px`;
  canvas.style.height = `${totalHeight}px`;
  
  ctx.scale(scale, scale);

  // Draw background with rounded corners
  ctx.fillStyle = config.bgColor;
  roundRect(ctx, 0, 0, contentWidth, totalHeight, 8);
  ctx.fill();

  // Draw border
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, contentWidth - 1, totalHeight - 1, 8);
  ctx.stroke();

  // Draw header background
  ctx.fillStyle = config.headerBg;
  ctx.fillRect(0, 0, contentWidth, config.headerHeight);

  // Draw header bottom border
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, config.headerHeight);
  ctx.lineTo(contentWidth, config.headerHeight);
  ctx.stroke();

  // Draw traffic lights (macOS style)
  const trafficY = config.headerHeight / 2;
  const trafficX = 14;
  const trafficRadius = 6;
  const trafficGap = 8;

  // Red
  ctx.fillStyle = '#ff5f57';
  ctx.beginPath();
  ctx.arc(trafficX, trafficY, trafficRadius, 0, Math.PI * 2);
  ctx.fill();

  // Yellow
  ctx.fillStyle = '#febc2e';
  ctx.beginPath();
  ctx.arc(trafficX + trafficRadius * 2 + trafficGap, trafficY, trafficRadius, 0, Math.PI * 2);
  ctx.fill();

  // Green
  ctx.fillStyle = '#28c840';
  ctx.beginPath();
  ctx.arc(trafficX + (trafficRadius * 2 + trafficGap) * 2, trafficY, trafficRadius, 0, Math.PI * 2);
  ctx.fill();

  // Draw separator
  const sepX = trafficX + (trafficRadius * 2 + trafficGap) * 3 + 8;
  ctx.strokeStyle = config.borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sepX, trafficY - 7);
  ctx.lineTo(sepX, trafficY + 7);
  ctx.stroke();

  // Draw language label
  ctx.font = `600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = config.langColor;
  ctx.textBaseline = 'middle';
  const langLabel = (language || 'plaintext').toUpperCase();
  ctx.fillText(langLabel, sepX + 12, trafficY);

  // Draw line count (right side)
  ctx.font = `11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = config.countColor;
  const countText = `${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`;
  const countWidth = ctx.measureText(countText).width;
  ctx.fillText(countText, contentWidth - countWidth - 14, trafficY);

  // Draw code content with syntax highlighting
  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.textBaseline = 'top';
  
  const isDark = config.bgColor === '#1e1e1e';
  const tokens = parseHighlightedHtml(highlightedHtml, config.textColor, isDark);
  
  // Line numbers (lineNumWidth already declared above in sizing section)
  const lineNumColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  
  let currentLine = 0;
  let currentX = config.padding + lineNumWidth;
  const startY = config.headerHeight + config.padding;

  // Draw line numbers
  if (showLineNumbers) {
    ctx.font = `${config.fontSize}px ${config.fontFamily}`;
    ctx.fillStyle = lineNumColor;
    ctx.textAlign = 'right';
    for (let i = 1; i <= lineCount; i++) {
      ctx.fillText(
        String(i),
        config.padding + lineNumWidth - 8,
        startY + (i - 1) * config.lineHeight
      );
    }
    ctx.textAlign = 'left';
  }

  for (const token of tokens) {
    const tokenLines = token.text.split('\n');
    
    for (let i = 0; i < tokenLines.length; i++) {
      const lineText = tokenLines[i];
      
      if (i > 0) {
        // New line
        currentLine++;
        currentX = config.padding + lineNumWidth;
      }
      
      if (lineText) {
        ctx.fillStyle = token.color;
        ctx.fillText(lineText, currentX, startY + currentLine * config.lineHeight);
        currentX += ctx.measureText(lineText).width;
      }
    }
  }

  return canvas;
}

/**
 * Helper to draw rounded rectangle
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Show screenshot preview in a modal and trigger download via Electron save dialog
 */
// Singleton guard — only one screenshot modal open at a time
let _screenshotModalOpen = false;

export async function showScreenshotPreviewAndSave(result: ScreenshotResult): Promise<void> {
  // Prevent double modal
  if (_screenshotModalOpen) {
    document.querySelectorAll('.hypothesis-screenshot-overlay').forEach(el => el.remove());
  }
  _screenshotModalOpen = true;

  // Detect system/app theme from themeStore
  let isDark = true;
  try {
    const { useThemeStore } = require('../stores/themeStore');
    const ct = useThemeStore.getState().currentTheme;
    if (ct === 'hypothesis-light') isDark = false;
    else if (ct === 'hypothesis-dark' || ct === 'vs-dark' || ct === 'hc-black') isDark = true;
    else {
      const ext = useThemeStore.getState().extensionThemes[ct];
      isDark = ext ? ext.type !== 'light' : true;
    }
  } catch {
    isDark = document.body.classList.contains('hypothesis-dark') ||
      (!document.body.classList.contains('hypothesis-light') &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches !== false);
  }

  const colors = isDark
    ? { bg: '#252526', bgSub: '#1e1e1e', border: '#3c3c3c', fg: '#cccccc', fgMuted: '#858585', btnBg: 'rgba(255,255,255,0.06)', btnHover: 'rgba(255,255,255,0.12)', previewBg: '#141414' }
    : { bg: '#f3f3f3', bgSub: '#ffffff', border: '#d4d4d4', fg: '#333333', fgMuted: '#616161', btnBg: 'rgba(0,0,0,0.05)', btnHover: 'rgba(0,0,0,0.1)', previewBg: '#e8e8e8' };

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'hypothesis-screenshot-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: ${isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.45)'};
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    animation: fadeIn 0.18s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const modal = document.createElement('div');
  modal.style.cssText = `
    background: ${colors.bg};
    border: 1px solid ${colors.border};
    border-radius: 10px;
    padding: 0;
    width: min(92vw, 860px);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,${isDark ? '0.6' : '0.25'}), 0 4px 16px rgba(0,0,0,0.15);
    animation: slideUp 0.2s ease-out;
    overflow: hidden;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px 12px;
    border-bottom: 1px solid ${colors.border};
    flex-shrink: 0;
  `;

  const titleWrap = document.createElement('div');
  titleWrap.style.cssText = `display: flex; align-items: center; gap: 8px;`;

  const titleIcon = document.createElement('span');
  titleIcon.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="2"/><path d="M1 11l4-4 3 3 3-4 4 5"/></svg>`;
  titleIcon.style.cssText = `color: ${colors.fgMuted}; display:flex; align-items:center;`;

  const title = document.createElement('span');
  title.textContent = 'Screenshot Preview';
  title.style.cssText = `color: ${colors.fg}; font-size: 13px; font-weight: 600; letter-spacing: 0.01em;`;

  const sizeLabel = document.createElement('span');
  sizeLabel.textContent = `${result.width} × ${result.height}px`;
  sizeLabel.style.cssText = `color: ${colors.fgMuted}; font-size: 11px;`;

  titleWrap.appendChild(titleIcon);
  titleWrap.appendChild(title);
  titleWrap.appendChild(sizeLabel);

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>`;
  closeBtn.style.cssText = `
    background: ${colors.btnBg};
    border: 1px solid ${colors.border};
    color: ${colors.fgMuted};
    cursor: pointer;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px;
    transition: all 0.15s;
    flex-shrink: 0;
  `;
  closeBtn.onmouseenter = () => { closeBtn.style.background = colors.btnHover; closeBtn.style.color = colors.fg; };
  closeBtn.onmouseleave = () => { closeBtn.style.background = colors.btnBg; closeBtn.style.color = colors.fgMuted; };

  // Preview area
  const previewContainer = document.createElement('div');
  previewContainer.style.cssText = `
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${colors.previewBg};
    padding: 24px;
    min-height: 0;
  `;

  const imgWrap = document.createElement('div');
  imgWrap.style.cssText = `
    box-shadow: 0 8px 32px rgba(0,0,0,${isDark ? '0.5' : '0.2'});
    border-radius: 8px;
    overflow: hidden;
    max-width: 100%;
    display: inline-flex;
  `;

  const img = document.createElement('img');
  img.src = result.dataUrl;
  img.style.cssText = `max-width: 100%; height: auto; display: block;`;
  img.draggable = false;

  imgWrap.appendChild(img);
  previewContainer.appendChild(imgWrap);

  // Footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    align-items: center;
    padding: 12px 18px;
    border-top: 1px solid ${colors.border};
    flex-shrink: 0;
    background: ${colors.bg};
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    padding: 6px 16px;
    background: ${colors.btnBg};
    border: 1px solid ${colors.border};
    color: ${colors.fg};
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.15s;
    font-family: inherit;
  `;
  cancelBtn.onmouseenter = () => cancelBtn.style.background = colors.btnHover;
  cancelBtn.onmouseleave = () => cancelBtn.style.background = colors.btnBg;

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save As...';
  saveBtn.style.cssText = `
    padding: 6px 18px;
    background: var(--theme-accent, #007acc);
    border: 1px solid transparent;
    color: #ffffff;
    border-radius: 5px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: opacity 0.15s;
    font-family: inherit;
  `;
  saveBtn.onmouseenter = () => saveBtn.style.opacity = '0.85';
  saveBtn.onmouseleave = () => saveBtn.style.opacity = '1';

  const cleanup = () => {
    _screenshotModalOpen = false;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s ease-out';
    setTimeout(() => { if (overlay.parentNode) document.body.removeChild(overlay); }, 160);
  };

  closeBtn.onclick = cleanup;
  cancelBtn.onclick = cleanup;
  overlay.onclick = (e) => { if (e.target === overlay) cleanup(); };

  saveBtn.onclick = async () => {
    saveBtn.textContent = 'Saving...';
    saveBtn.style.opacity = '0.7';
    saveBtn.style.pointerEvents = 'none';
    try {
      const savePath = await (window as any).api?.file?.saveScreenshot?.(result.blob, result.filename);
      if (savePath) {
        cleanup();
        showSuccessNotification(`Screenshot saved to ${savePath}`);
      } else {
        saveBtn.textContent = 'Save As...';
        saveBtn.style.opacity = '1';
        saveBtn.style.pointerEvents = '';
      }
    } catch (error) {
      console.error('Failed to save screenshot:', error);
      saveBtn.textContent = 'Save As...';
      saveBtn.style.opacity = '1';
      saveBtn.style.pointerEvents = '';
    }
  };

  // Inject animation styles once
  if (!document.getElementById('screenshot-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'screenshot-modal-styles';
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
    document.head.appendChild(style);
  }

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  modal.appendChild(header);
  modal.appendChild(previewContainer);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Show success notification
 */
function showSuccessNotification(message: string): void {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--theme-bg-secondary, #2d2d30);
    border: 1px solid var(--theme-border, #3c3c3c);
    border-radius: 6px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.3s ease-out;
    color: var(--theme-fg, #cccccc);
    font-size: 13px;
    max-width: 400px;
  `;

  notification.innerHTML = `
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: #28c840; flex-shrink: 0;">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
    </svg>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);

  // Add animation
  if (!document.getElementById('screenshot-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'screenshot-notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Show a non-blocking toast for screenshot errors/info
 */
export function showScreenshotToast(message: string, type: 'error' | 'info' = 'info'): void {
  // Remove any existing toast first
  document.querySelectorAll('.hypothesis-screenshot-toast').forEach(el => el.remove());

  const isDark = document.body.classList.contains('hypothesis-dark') ||
    !document.body.classList.contains('hypothesis-light');

  const bg     = isDark ? '#2d2d30' : '#ffffff';
  const border = type === 'error' ? '#f48771' : (isDark ? '#3c3c3c' : '#d4d4d4');
  const fg     = isDark ? '#cccccc' : '#333333';
  const iconColor = type === 'error' ? '#f48771' : '#28c840';
  const icon = type === 'error'
    ? `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>`
    : `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>`;

  const toast = document.createElement('div');
  toast.className = 'hypothesis-screenshot-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${bg};
    border: 1px solid ${border};
    border-radius: 6px;
    padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,${isDark ? '0.4' : '0.15'});
    z-index: 10002;
    display: flex;
    align-items: center;
    gap: 8px;
    color: ${fg};
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 360px;
    animation: toastIn 0.2s ease-out;
    pointer-events: none;
  `;
  toast.innerHTML = `<span style="color:${iconColor};flex-shrink:0;display:flex">${icon}</span><span>${message}</span>`;
  document.body.appendChild(toast);

  if (!document.getElementById('screenshot-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'screenshot-toast-styles';
    style.textContent = `
      @keyframes toastIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      @keyframes toastOut { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.2s ease-out';
    setTimeout(() => toast.remove(), 200);
  }, type === 'error' ? 4000 : 2500);
}
