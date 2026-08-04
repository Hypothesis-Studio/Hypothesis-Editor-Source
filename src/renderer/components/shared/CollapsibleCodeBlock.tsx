/**
 * CollapsibleCodeBlock - Shared syntax-highlighted, collapsible code block.
 * Used in both AgentChat and Chat Collaboration message lists.
 * Theme-aware: adapts to dark/light via --theme-bg CSS variable.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import hljs from 'highlight.js';

// ── Theme detection ────────────────────────────────────────────────────────────

function isDarkTheme(): boolean {
  // Detect via --theme-bg luminance
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--theme-bg').trim();
  if (!bg) return true; // default dark
  // Parse hex or rgb
  let r = 0, g = 0, b = 0;
  if (bg.startsWith('#')) {
    const hex = bg.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (bg.startsWith('rgb')) {
    const m = bg.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  }
  // Relative luminance
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 128;
}

// ── Highlight.js themes ────────────────────────────────────────────────────────

const DARK_THEME = `
.hljs{color:#d4d4d4;background:transparent}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569cd6}.hljs-link{color:#569cd6}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-number,.hljs-class{color:#b5cea8}.hljs-string,.hljs-meta .hljs-string{color:#ce9178}.hljs-regexp,.hljs-template-literal{color:#d16969}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#dcdcaa}.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#9b9b9b}.hljs-variable,.hljs-template-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:#ffd700}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}.hljs-bullet,.hljs-selector-tag,.hljs-selector-id,.hljs-selector-class,.hljs-selector-attr,.hljs-selector-pseudo{color:#d7ba7d}.hljs-addition{color:#b5cea8;background:rgba(181,206,168,0.08)}.hljs-deletion{color:#ce9178;background:rgba(206,145,120,0.08)}.hljs-operator{color:#d4d4d4}.hljs-punctuation{color:#808080}
`;

const LIGHT_THEME = `
.hljs{color:#000000;background:transparent}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#0000ff}.hljs-link{color:#0000ff}.hljs-built_in,.hljs-type{color:#267f99}.hljs-number,.hljs-class{color:#098658}.hljs-string,.hljs-meta .hljs-string{color:#a31515}.hljs-regexp,.hljs-template-literal{color:#811f3f}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#795e26}.hljs-comment,.hljs-quote{color:#008000;font-style:italic}.hljs-doctag{color:#008000}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#800000}.hljs-variable,.hljs-template-variable{color:#001080}.hljs-attr,.hljs-attribute{color:#001080}.hljs-section{color:#800000}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:bold}.hljs-bullet,.hljs-selector-tag,.hljs-selector-id,.hljs-selector-class{color:#800000}.hljs-addition{color:#098658;background:rgba(9,134,88,0.08)}.hljs-deletion{color:#a31515;background:rgba(163,21,21,0.08)}.hljs-operator{color:#000000}.hljs-punctuation{color:#555555}
`;

let injectedTheme: 'dark' | 'light' | null = null;

function ensureTheme(dark: boolean) {
  const wanted = dark ? 'dark' : 'light';
  if (injectedTheme === wanted) return;
  let el = document.getElementById('hljs-theme-dynamic');
  if (!el) {
    el = document.createElement('style');
    el.id = 'hljs-theme-dynamic';
    document.head.appendChild(el);
  }
  el.textContent = dark ? DARK_THEME : LIGHT_THEME;
  injectedTheme = wanted;
}

// ── Highlight helper ───────────────────────────────────────────────────────────

function highlight(code: string, lang: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

interface CollapsibleCodeBlockProps {
  lang: string;
  code: string;
  lineCount?: number;
  defaultCollapsed?: boolean;
}

export const CollapsibleCodeBlock: React.FC<CollapsibleCodeBlockProps> = ({
  lang, code, lineCount: lineCountProp, defaultCollapsed = true,
}) => {
  const lines = code.split('\n');
  const lineCount = lineCountProp ?? lines.length;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(true);
  const codeRef = useRef<HTMLElement>(null);

  // Detect theme on mount and on CSS variable change
  useEffect(() => {
    const update = () => {
      const d = isDarkTheme();
      setDark(d);
      ensureTheme(d);
    };
    update();
    // Re-check when theme might change via MutationObserver on :root style
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!collapsed && codeRef.current) {
      codeRef.current.innerHTML = highlight(code, lang);
    }
  }, [collapsed, code, lang]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try { await navigator.clipboard.writeText(code); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // ── Theme-aware colors ───────────────────────────────────────────────────────
  const codeBg       = dark ? '#1e1e1e' : '#f5f5f5';
  const headerBg     = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const headerBorder = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const outerBorder  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
  const langColor    = dark ? '#9cdcfe' : '#0070c1';
  const codeColor    = dark ? '#d4d4d4' : '#000000';
  const countColor   = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  const chevronColor = dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const copyBg       = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const copyBorder   = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)';
  const copyColor    = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const previewColor = dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.35)';
  const moreColor    = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.25)';

  return (
    <div style={{
      background: codeBg,
      borderRadius: 8,
      border: `1px solid ${outerBorder}`,
      margin: '6px 0',
      overflow: 'hidden',
      boxShadow: dark ? '0 2px 8px rgba(0,0,0,0.25)' : '0 1px 4px rgba(0,0,0,0.1)',
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 12px', cursor: 'pointer',
          background: headerBg,
          borderBottom: collapsed ? 'none' : `1px solid ${headerBorder}`,
          userSelect: 'none',
        }}
      >
        {/* Chevron */}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          stroke={chevronColor} strokeWidth="1.8" strokeLinecap="round"
          style={{ transition: 'transform 0.15s', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <polyline points="2,3 5,7 8,3" />
        </svg>

        {/* Traffic lights */}
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840', display: 'inline-block', flexShrink: 0 }} />

        <span style={{ width: 1, height: 11, background: outerBorder, margin: '0 2px', flexShrink: 0 }} />

        {/* Language */}
        <span style={{ fontSize: 10, fontWeight: 600, color: langColor, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {lang || 'plaintext'}
        </span>

        {/* Line count */}
        <span style={{ fontSize: 10, color: countColor, marginRight: 4 }}>
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(137,209,133,0.15)' : copyBg,
            border: `1px solid ${copied ? 'rgba(137,209,133,0.4)' : copyBorder}`,
            borderRadius: 4, cursor: 'pointer',
            color: copied ? '#89d185' : copyColor,
            fontSize: 10, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '2px 7px', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (!copied) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'; }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.background = copyBg; }}
        >
          {copied
            ? <><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#89d185" strokeWidth="2.5" strokeLinecap="round"><path d="M3 8l4 4 6-7" /></svg>Copied</>
            : <><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="5" y="5" width="9" height="10" rx="1.5" /><path d="M3 11H2a1 1 0 01-1-1V2a1 1 0 011-1h8a1 1 0 011 1v2" /></svg>Copy</>
          }
        </button>
      </div>

      {/* Code body */}
      {!collapsed && (
        <pre style={{
          margin: 0, padding: '12px 14px',
          overflowX: 'auto', maxHeight: 420,
          fontSize: 12.5, lineHeight: 1.6,
          background: codeBg, color: codeColor,
          userSelect: 'text', cursor: 'text',
        }}>
          <code
            ref={codeRef}
            className={lang ? `language-${lang}` : ''}
            style={{ fontFamily: 'inherit', userSelect: 'text' }}
          />
        </pre>
      )}

      {/* Collapsed preview */}
      {collapsed && (
        <div
          onClick={() => setCollapsed(false)}
          style={{
            padding: '7px 14px', cursor: 'pointer',
            fontSize: 11.5, lineHeight: 1.5,
            color: previewColor,
            fontFamily: 'inherit',
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            background: codeBg,
          }}
        >
          {lines.slice(0, 2).join(' ↵ ')}
          {lineCount > 2 && (
            <span style={{ color: moreColor }}> … +{lineCount - 2} more lines — click to expand</span>
          )}
        </div>
      )}
    </div>
  );
};
