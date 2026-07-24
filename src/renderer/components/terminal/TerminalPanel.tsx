/**
 * TerminalPanel - Multi-tab embedded terminal using xterm.js + node-pty.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { TerminalInstance } from '../../../shared/types';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Icon } from '../common/Icon';

interface TerminalEntry {
  instance: TerminalInstance;
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement;
}

export const TerminalPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termsRef = useRef<Map<string, TerminalEntry>>(new Map());
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const { setActiveTerminalId } = useAppStore();

  useEffect(() => {
    createTerminal();
    return () => {
      termsRef.current.forEach((e) => e.terminal.dispose());
      termsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    activeIdRef.current = activeId;
    setActiveTerminalId(activeId);
  }, [activeId, setActiveTerminalId]);

  // Fit on resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (activeId) {
        const entry = termsRef.current.get(activeId);
        if (entry) entry.fitAddon.fit();
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeId]);

  const showOnly = (id: string) => {
    termsRef.current.forEach((entry, key) => {
      entry.container.style.display = key === id ? 'block' : 'none';
    });
  };

  const createTerminal = async (name?: string) => {
    if (!containerRef.current) return;

    const instance = await window.api.terminal.create({
      name: name || `Terminal ${terminals.length + 1}`,
    });
    if (!instance) return;

    // Create container div
    const div = document.createElement('div');
    div.style.width = '100%';
    div.style.height = '100%';
    containerRef.current.appendChild(div);

    const rootStyle = getComputedStyle(document.documentElement);
    const getThemeColor = (varName: string, fallback: string): string => {
      try { return rootStyle.getPropertyValue(varName).trim() || fallback; } catch { return fallback; }
    };

    const fontSize = (useSettingsStore.getState().settings['terminal.integrated.fontSize'] as number) || 12;
    const fontFamily = (useSettingsStore.getState().settings['terminal.integrated.fontFamily'] as string) || "'JetBrains Mono', monospace";
    const lineHeight = (useSettingsStore.getState().settings['terminal.integrated.lineHeight'] as number) || 1.4;
    const scrollback = (useSettingsStore.getState().settings['terminal.integrated.scrollback'] as number) || 1000;
    const cursorStyle = (useSettingsStore.getState().settings['terminal.integrated.cursorStyle'] as string) || 'block';
    const cursorBlinking = useSettingsStore.getState().settings['terminal.integrated.cursorBlinking'] !== false;

    const terminal = new Terminal({
      fontSize,
      fontFamily,
      lineHeight,
      cursorBlink: cursorBlinking,
      cursorStyle: cursorStyle as any,
      scrollback,
      allowTransparency: true,
      theme: {
        background: getThemeColor('--theme-bg', '#1e1e1e'),
        foreground: getThemeColor('--theme-fg', '#cccccc'),
        cursor: getThemeColor('--theme-fg', '#cccccc'),
        cursorAccent: getThemeColor('--theme-bg', '#1e1e1e'),
        selectionBackground: getThemeColor('--theme-editor-selection', '#264f78'),
        selectionForeground: getThemeColor('--theme-fg', '#cccccc'),
        black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
        blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
        brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
        brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
        brightCyan: '#29b8db', brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(div);
    fitAddon.fit();

    termsRef.current.set(instance.id, { instance, terminal, fitAddon, container: div });

    // ── Intercept clear / cls sequences ───────────────────────────
    // On Windows, PowerShell's cls / Clear-Host may emit ANSI clear
    // sequences that leave blank lines in xterm.js.  We detect the
    // \x1b[2J (erase entire screen) sequence and replace it with a
    // full terminal.reset() which wipes both screen and scrollback.
    // After reset we write the remainder of the data so cursor-move
    // sequences (like \x1b[H]) are still applied.
    // Pipe data from backend → xterm
    window.api.terminal.onData(({ id, data }) => {
      if (id !== instance.id) return;

      // Fast path: no clear sequence → write directly
      if (!data.includes('\x1b[2J')) {
        terminal.write(data);
        return;
      }

      // Slow path: split on \x1b[2J, reset terminal at each occurrence
      const parts = data.split('\x1b[2J');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          // The previous part ended with \x1b[2J — fully clear the terminal
          terminal.reset();
        }
        terminal.write(parts[i]);
      }
    });

    // Handle exit
    window.api.terminal.onExit(({ id }) => {
      if (id === instance.id) terminal.write('\r\n\x1b[33m[Process exited]\x1b[0m\r\n');
    });

    // ── Clipboard: Copy / Paste / Cut ─────────────────────────────
    // Ctrl+C — copy selection to clipboard; if no selection, send SIGINT (default)
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      const ctrl = event.ctrlKey || event.metaKey;

      // Ctrl+Shift+C — always copy (bypass SIGINT)
      if (ctrl && event.shiftKey && event.key === 'C') {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
        return true;
      }

      // Ctrl+Shift+V — always paste (bypass shell)
      if (ctrl && event.shiftKey && event.key === 'V') {
        navigator.clipboard.readText().then((text) => {
          if (text) terminal.paste(text);
        });
        return false;
      }

      // Ctrl+C — copy if selection exists, else send SIGINT
      if (ctrl && !event.shiftKey && event.key === 'c') {
        const selection = terminal.getSelection();
        if (selection && selection.length > 0) {
          navigator.clipboard.writeText(selection);
          return false;
        }
        return true; // no selection → let SIGINT through
      }

      // Ctrl+V — paste
      if (ctrl && !event.shiftKey && event.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          if (text) terminal.paste(text);
        });
        return false;
      }

      // Ctrl+X — cut (copy selection, then delete it)
      if (ctrl && !event.shiftKey && event.key === 'x') {
        const selection = terminal.getSelection();
        if (selection && selection.length > 0) {
          navigator.clipboard.writeText(selection);
          terminal.clearSelection();
          // Send backspaces to delete the selected text
          for (let i = 0; i < selection.length; i++) {
            window.api.terminal.write(instance.id, '\x7f');
          }
          return false;
        }
        return true;
      }

      // Ctrl+A — select all terminal content
      if (ctrl && !event.shiftKey && event.key === 'a') {
        terminal.selectAll();
        return false;
      }

      return true;
    });

    // Right-click context menu for copy/paste
    terminal.attachCustomKeyEventHandler((event) => {
      // Let default handling pass through for all other keys
      return true;
    });
    // Right-click paste: xterm.js supports right-click paste by default
    // via the browser's context menu — we just need to make sure
    // the terminal textarea is accessible for clipboard events.

    // Pipe input from xterm → backend
    terminal.onData((data) => {
      window.api.terminal.write(instance.id, data);
    });

    // Resize sync
    terminal.onResize(({ cols, rows }) => {
      window.api.terminal.resize(instance.id, cols, rows);
    });

    // Show this terminal, hide others
    showOnly(instance.id);
    setTerminals((prev) => [...prev, instance]);
    setActiveId(instance.id);

    return instance;
  };

  const switchTerminal = useCallback((id: string) => {
    showOnly(id);
    const entry = termsRef.current.get(id);
    if (entry) {
      entry.fitAddon.fit();
      entry.terminal.focus();
    }
    setActiveId(id);
  }, []);

  const removeTerminal = useCallback((id: string) => {
    const entry = termsRef.current.get(id);
    if (entry) {
      entry.terminal.dispose();
      entry.container.remove();
      termsRef.current.delete(id);
    }
    setTerminals((prev) => {
      const remaining = prev.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        const newId = remaining[remaining.length - 1].id;
        setTimeout(() => switchTerminal(newId), 50);
      } else {
        setActiveId(null);
      }
      return remaining;
    });
  }, [switchTerminal]);

  const closeTerminal = useCallback(async (id: string) => {
    try {
      await window.api.terminal.close(id);
      removeTerminal(id);
    } catch (e) { console.error(e); }
  }, [removeTerminal]);

  const killTerminal = useCallback(async (id: string) => {
    try {
      await window.api.terminal.kill(id);
      removeTerminal(id);
    } catch (e) { console.error(e); }
  }, [removeTerminal]);

  const clearTerminal = useCallback(() => {
    const currentId = activeIdRef.current;
    if (currentId) {
      const entry = termsRef.current.get(currentId);
      if (entry) entry.terminal.reset();
    }
  }, []);

  // Expose methods for menu access
  useEffect(() => {
    (window as any).__terminalPanel = {
      createTerminal: () => createTerminal(),
      killTerminal: () => {
        const currentId = activeIdRef.current;
        if (currentId) {
          window.api.terminal.kill(currentId).catch(() => {});
          const entry = termsRef.current.get(currentId);
          if (entry) {
            entry.terminal.dispose();
            entry.container.remove();
            termsRef.current.delete(currentId);
          }
          setTerminals((prev) => {
            const remaining = prev.filter((t) => t.id !== currentId);
            if (remaining.length > 0) {
              const newId = remaining[remaining.length - 1].id;
              setTimeout(() => switchTerminal(newId), 50);
            } else {
              setActiveId(null);
            }
            return remaining;
          });
        }
      },
      clearTerminal,
    };
  }, [activeId, killTerminal, clearTerminal]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
      {/* Terminal tabs */}
      <div className="flex items-center h-8 px-2 gap-1" style={{ background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)' }}>
        {terminals.map((term) => (
          <div
            key={term.id}
            className="group flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded-t transition-colors"
            style={{
              color: term.id === activeId ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              backgroundColor: term.id === activeId ? 'var(--theme-bg)' : 'transparent',
            }}
            onClick={() => switchTerminal(term.id)}
          >
            <Icon name="terminal" size={12} />
            <span>{term.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTerminal(term.id); }}
              className="ml-1 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"
              title="Close"
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}

        <button
          onClick={() => createTerminal()}
          className="ml-1 p-1 rounded"
          style={{ color: 'var(--theme-fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'none'; }}
          title="New Terminal"
        >
          <Icon name="add" size={16} />
        </button>

        <div className="flex-1" />

        <button
          onClick={clearTerminal}
          style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 4 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-fg)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          title="Clear Terminal"
        >
          <Icon name="trash" size={16} />
        </button>

        <button
          onClick={() => {
            termsRef.current.forEach((entry, id) => {
              window.api.terminal.kill(id).catch(() => {});
              entry.terminal.dispose();
              entry.container.remove();
            });
            termsRef.current.clear();
            setTerminals([]);
            setActiveId(null);
          }}
          style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', borderRadius: 4 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-error)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          title="Kill All Terminals"
        >
          <Icon name="close" size={16} style={{ color: 'var(--theme-error)' }} />
        </button>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  );
};
