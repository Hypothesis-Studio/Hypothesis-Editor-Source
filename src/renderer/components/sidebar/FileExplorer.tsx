/**
 * File Explorer — Multi-root workspace with per-folder toolbar.
 *
 * Layout:
 *   Workspace (global)  ─── Collapse All · Reload · Clear All
 *   📁 folder-a         ─── +File · +Folder · ↻ · ✕
 *     ├── file1.ts
 *     └── sub/
 *   📁 folder-b         ─── +File · +Folder · ↻ · ✕
 *     └── file2.py
 *
 * Features:
 *   - Drag-drop between workspaces
 *   - Copy-paste across workspaces with auto-rename
 *   - Keyboard shortcuts: Del, Ctrl+C/X/V, F2
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useEditorStore } from '../../stores/editorStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { renderFileIcon, renderFolderIcon, type IconTheme } from '../../utils/fileIcons';
import { showAlert, showConfirm } from '../../stores/dialogStore';

interface FileExplorerProps {
  rootPath?: string | null;
  activeFilePath?: string | null;
  onCloseFolder?: () => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ rootPath, activeFilePath, onCloseFolder }) => {
  const { folders, addFolder, removeFolder } = useWorkspaceStore();
  const [rootFiles, setRootFiles] = useState<Map<string, FileEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; type: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState<{ type: 'file' | 'folder'; parentPath: string } | null>(null);
  const [createValue, setCreateValue] = useState('');
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [dragSource, setDragSource] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; type: 'file' | 'directory'; action: 'copy' | 'cut' } | null>(null);
  const [clipboardVisible, setClipboardVisible] = useState(false);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [sortBy, setSortBy] = useState<'name' | 'type' | 'modified'>('name');
  const revealedRef = useRef<Set<string>>(new Set());
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const expandedRef = useRef<Set<string>>(new Set());
  const { openTab } = useEditorStore();

  const rootPaths = folders.length > 0 ? folders : rootPath ? [rootPath] : [];

  const setExpandedSync = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof updater === 'function') {
      setExpanded(prev => { const next = updater(prev); expandedRef.current = next; return next; });
    } else {
      expandedRef.current = updater;
      setExpanded(updater);
    }
  };

  // ── Keyboard shortcuts (global for explorer) ────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selected) return;
      // Don't handle if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // Don't handle if Monaco editor is focused
      const isEditorFocused = document.activeElement?.closest('.monaco-editor') || document.activeElement?.closest('.monaco-editor-background') || document.activeElement?.closest('[data-mode-id]');
      if (isEditorFocused) return;
      // Don't handle if terminal is focused
      const isTerminalFocused = document.activeElement?.closest('.xterm-helper-textarea');
      if (isTerminalFocused) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteRef.current(selected);
      } else if (e.key === 'F2') {
        e.preventDefault();
        startRename(selected);
      } else if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        const entry = findEntry(selected);
        if (entry) handleCopy(selected, entry.type);
      } else if (e.ctrlKey && e.key === 'x') {
        e.preventDefault();
        const entry = findEntry(selected);
        if (entry) handleCut(selected, entry.type);
      } else if (e.ctrlKey && e.key === 'v' && clipboard) {
        e.preventDefault();
        const targetDir = selected && findEntry(selected)?.type === 'directory' ? selected : findRootForPath(selected || '') || rootPaths[0];
        if (targetDir) handlePaste(targetDir);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, clipboard]);

  // ── Load all roots ──────────────────────────────────────────────
  useEffect(() => {
    if (rootPaths.length > 0) loadAllRoots();
    else { setRootFiles(new Map()); setExpandedSync(new Set()); setSelected(null); }
  }, [rootPaths.join('|')]);

  useEffect(() => () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current); if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current); }, []);
  useEffect(() => { if (renaming && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); } }, [renaming]);
  useEffect(() => { if (creating && createInputRef.current) createInputRef.current.focus(); }, [creating]);

  // ── File watcher — auto-refresh on disk changes ────────────────
  useEffect(() => {
    for (const rp of rootPaths) {
      (window as any).api?.fileWatcher?.start?.(rp);
    }
    const unsub = (window as any).api?.fileWatcher?.onEvent?.((evt: { type: string; path: string; dirPath: string }) => {
      // Debounce rapid changes
      if ((refreshRoot as any)._timer) clearTimeout((refreshRoot as any)._timer);
      (refreshRoot as any)._timer = setTimeout(() => {
        for (const rp of rootPaths) {
          refreshRoot(rp);
        }
      }, 150);
    });
    return () => {
      unsub?.();
      for (const rp of rootPaths) {
        (window as any).api?.fileWatcher?.stop?.(rp);
      }
    };
  }, [rootPaths.join('|')]);

  // ── Auto-reveal active file in explorer ─────────────────────────
  useEffect(() => {
    if (!activeFilePath) return;
    const rp = findRootForPath(activeFilePath);
    if (!rp) return;
    // Expand all parent directories
    const parts = activeFilePath.replace(rp, '').split(/[/\\]/).filter(Boolean);
    let current = rp;
    const newExpanded = new Set(expanded);
    for (let i = 0; i < parts.length - 1; i++) {
      current = `${current}/${parts[i]}`;
      newExpanded.add(current);
    }
    if (newExpanded.size !== expanded.size) {
      setExpandedSync(newExpanded);
    }
    setSelected(activeFilePath);
  }, [activeFilePath]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.context-menu')) setContextMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [contextMenu]);

  // ── Data loading ────────────────────────────────────────────────
  const loadAllRoots = async () => {
    setIsLoading(true);
    const newMap = new Map<string, FileEntry[]>();
    const removed: string[] = [];
    for (const rp of rootPaths) {
      try {
        const entries = await window.api.directory.read(rp);
        if (expandedRef.current.size > 0) await restoreExpandedChildren(entries, new Set(expandedRef.current));
        newMap.set(rp, entries);
      } catch {
        // Folder missing — auto-remove from workspace + stop watcher
        (window as any).api?.fileWatcher?.stop?.(rp);
        removeFolder(rp);
        removed.push(rp);
      }
    }
    if (removed.length > 0) {
      // Clean up local state for removed folders
      const newExpanded = new Set(expandedRef.current);
      for (const rp of removed) {
        newMap.delete(rp);
        for (const key of newExpanded) {
          if (key === rp || key.startsWith(rp + '/') || key.startsWith(rp + '\\')) newExpanded.delete(key);
        }
      }
      setExpandedSync(newExpanded);
      if (selected && removed.some(rp => selected === rp || selected.startsWith(rp + '/') || selected.startsWith(rp + '\\'))) setSelected(null);
    }
    setRootFiles(newMap);
    setIsLoading(false);
  };

  const refreshRoot = async (rp: string) => {
    try {
      const entries = await window.api.directory.read(rp);
      await restoreExpandedChildren(entries, new Set(expandedRef.current));
      setRootFiles(prev => { const n = new Map(prev); n.set(rp, entries); return n; });
    } catch {
      // Folder missing — auto-remove from workspace + stop watcher
      (window as any).api?.fileWatcher?.stop?.(rp);
      removeFolder(rp);
      setRootFiles(prev => { const n = new Map(prev); n.delete(rp); return n; });
      const newExpanded = new Set(expandedRef.current);
      for (const key of newExpanded) {
        if (key === rp || key.startsWith(rp + '/') || key.startsWith(rp + '\\')) newExpanded.delete(key);
      }
      setExpandedSync(newExpanded);
      if (selected && (selected === rp || selected.startsWith(rp + '/') || selected.startsWith(rp + '\\'))) setSelected(null);
    }
  };

  const restoreExpandedChildren = async (entries: FileEntry[], ep: Set<string>) => {
    for (const e of entries) {
      if (e.type === 'directory' && ep.has(e.path)) {
        try { e.children = await window.api.directory.read(e.path); await restoreExpandedChildren(e.children, ep); }
        catch { ep.delete(e.path); }
      }
    }
  };

  // ── Tree helpers ────────────────────────────────────────────────
  const toggleExpand = async (path: string) => {
    const s = new Set(expanded);
    if (s.has(path)) s.delete(path);
    else {
      s.add(path);
      const entry = findEntry(path);
      if (entry && (!entry.children || entry.children.length === 0)) {
        try { entry.children = await window.api.directory.read(path); setRootFiles(new Map(rootFiles)); } catch {}
      }
    }
    setExpandedSync(s);
  };

  const findEntry = (p: string): FileEntry | null => {
    for (const entries of rootFiles.values()) { const f = findEntryIn(entries, p); if (f) return f; }
    return null;
  };
  const findEntryIn = (entries: FileEntry[], p: string): FileEntry | null => {
    for (const e of entries) { if (e.path === p) return e; if (e.children) { const f = findEntryIn(e.children, p); if (f) return f; } }
    return null;
  };
  // Listen for file-save events from editor to auto-refresh explorer
  useEffect(() => {
    const onFileSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.filePath) {
        // Refresh all roots — file might be in any workspace folder
        for (const rp of rootPaths) {
          refreshRoot(rp);
        }
      }
    };
    window.addEventListener('hypothesis:file-saved', onFileSaved);
    return () => window.removeEventListener('hypothesis:file-saved', onFileSaved);
  }, [rootPaths.join('|')]);

  const findRootForPath = (p: string): string | undefined => {
    for (const rp of rootPaths) { if (p === rp || p.startsWith(rp + '/') || p.startsWith(rp + '\\')) return rp; }
    return undefined;
  };

  // ── Open file ───────────────────────────────────────────────────
  const openFile = async (entry: FileEntry) => {
    try {
      const content = await window.api.file.read(entry.path);
      const ext = entry.name.split('.').pop() || '';
      const enablePreview = useSettingsStore.getState().settings['workbench.editor.enablePreview'] !== false;
      openTab({
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filePath: entry.path, fileName: entry.name, language: getLang(ext), content,
        isDirty: false, isPinned: false, isPreview: enablePreview, viewState: null,
        scrollTop: 0, scrollLeft: 0, cursorPosition: { line: 1, column: 1 },
        encoding: 'UTF-8', lineEnding: 'LF', savedContent: content,
        createdAt: Date.now(), modifiedAt: Date.now(),
      });
    } catch {}
  };

  // ── Click / Double-click ────────────────────────────────────────
  const handleClick = (entry: FileEntry) => {
    setSelected(entry.path);
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (entry.type === 'directory') toggleExpand(entry.path);
      else openFile(entry);
    }, 250);
  };
  const handleDoubleClick = (entry: FileEntry) => {
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    startRename(entry.path);
  };

  // ── Create ──────────────────────────────────────────────────────
  const startCreate = (type: 'file' | 'folder', parentPath: string) => {
    setRenaming(null); setCreating({ type, parentPath }); setCreateValue(''); setContextMenu(null);
    if (!expanded.has(parentPath)) { const s = new Set(expanded); s.add(parentPath); setExpandedSync(s); }
  };
  const confirmCreate = async () => {
    if (!creating) return;
    const name = createValue.trim();
    if (!name) { setCreating(null); return; }
    if (/[<>:"/\\|?*]/.test(name)) { await showAlert('Invalid characters in name'); return; }
    try {
      const fullPath = `${creating.parentPath}/${name}`;
      if (creating.type === 'file') await window.api.file.create(fullPath);
      else await window.api.directory.create(fullPath);
      const rp = findRootForPath(creating.parentPath);
      if (rp) await refreshRoot(rp);
    } catch (e) { await showAlert(`Failed to create: ${(e as Error).message || e}`); }
    setCreating(null);
  };
  const cancelCreate = () => { setCreating(null); };

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async (targetPath: string) => {
    setContextMenu(null);
    const entry = findEntry(targetPath);
    const name = targetPath.split(/[/\\]/).pop();
    const isDir = entry?.type === 'directory';
    const confirmed = await showConfirm(isDir ? `Delete folder "${name}" and all contents?` : `Delete file "${name}"?`, 'Delete');
    if (!confirmed) return;
    try {
      await window.api.file.delete(targetPath);
      useEditorStore.getState().tabs.filter(t => t.filePath === targetPath || t.filePath?.startsWith(targetPath + '/')).forEach(t => useEditorStore.getState().closeTab(t.id));
      setSelected(s => s === targetPath ? null : s);
      const rp = findRootForPath(targetPath);
      if (rp) await refreshRoot(rp);
    } catch (e) { await showAlert(`Failed to delete: ${(e as Error).message || e}`); }
  };

  // ── Delete (ref for keyboard handler) ──────────────────────────
  const handleDeleteRef = useRef(handleDelete);
  useEffect(() => { handleDeleteRef.current = handleDelete; });

  // ── Rename ──────────────────────────────────────────────────────
  const startRename = (path: string) => {
    setCreating(null); setRenaming(path); setRenameValue(path.split(/[/\\]/).pop() || ''); setContextMenu(null);
  };
  const confirmRename = async () => {
    if (!renaming) return;
    const newName = renameValue.trim();
    const oldName = renaming.split(/[/\\]/).pop();
    if (!newName || newName === oldName) { setRenaming(null); return; }
    if (/[<>:"/\\|?*]/.test(newName)) { await showAlert('Invalid characters'); return; }
    try {
      const dir = renaming.substring(0, Math.max(renaming.lastIndexOf('/'), renaming.lastIndexOf('\\')));
      await window.api.file.rename(renaming, `${dir}/${newName}`);
      useEditorStore.getState().tabs.filter(t => t.filePath === renaming).forEach(t => {
        useEditorStore.getState().updateTab(t.id, { filePath: `${dir}/${newName}`, fileName: newName, language: getLang(newName.split('.').pop() || '') });
      });
      const rp = findRootForPath(renaming);
      if (rp) await refreshRoot(rp);
    } catch (e) { await showAlert(`Failed to rename: ${(e as Error).message || e}`); }
    setRenaming(null);
  };
  const cancelRename = () => { setRenaming(null); };

  // ── Clipboard ───────────────────────────────────────────────────
  const copyPathToClipboard = (path: string) => { navigator.clipboard.writeText(path).catch(() => {}); setContextMenu(null); };
  const copyRelativePath = (fullPath: string) => {
    const rp = findRootForPath(fullPath);
    navigator.clipboard.writeText(rp ? fullPath.replace(rp, '').replace(/^[/\\]/, '') : fullPath).catch(() => {});
    setContextMenu(null);
  };
  const handleCopy = (path: string, type: string) => { setClipboard({ path, type: type as 'file' | 'directory', action: 'copy' }); showClipboardIndicator(); setContextMenu(null); };
  const handleCut = (path: string, type: string) => { setClipboard({ path, type: type as 'file' | 'directory', action: 'cut' }); showClipboardIndicator(); setContextMenu(null); };

  const showClipboardIndicator = () => {
    setClipboardVisible(true);
    if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    clipboardTimerRef.current = setTimeout(() => setClipboardVisible(false), 3000);
  };
  const generateCopyName = async (dir: string, name: string): Promise<string> => {
    const dot = name.lastIndexOf('.'); const hasExt = dot > 0;
    const base = hasExt ? name.substring(0, dot) : name; const ext = hasExt ? name.substring(dot) : '';
    let candidate = `${base}-copy${ext}`; let n = 2;
    while (await window.api.file.exists(`${dir}/${candidate}`)) { candidate = `${base}-copy(${n})${ext}`; n++; }
    return candidate;
  };
  const handlePaste = async (targetDir: string) => {
    if (!clipboard) return; setContextMenu(null);
    const srcName = clipboard.path.split(/[/\\]/).pop() || 'item';
    try {
      if (clipboard.action === 'cut') {
        const dest = `${targetDir}/${srcName}`;
        if (clipboard.path !== dest) {
          await window.api.file.move(clipboard.path, dest);
          useEditorStore.getState().tabs.filter(t => t.filePath === clipboard.path).forEach(t => useEditorStore.getState().updateTab(t.id, { filePath: dest }));
        }
        setClipboard(null);
      } else {
        const newName = await generateCopyName(targetDir, srcName);
        await window.api.file.copy(clipboard.path, `${targetDir}/${newName}`);
      }
      const rp = findRootForPath(targetDir);
      if (rp) await refreshRoot(rp);
      // Also refresh source root if different
      const srcRp = findRootForPath(clipboard.path);
      if (srcRp && srcRp !== rp) await refreshRoot(srcRp);
    } catch (e) { await showAlert(`Failed to paste: ${(e as Error).message || e}`); }
  };

  // ── Drag & Drop (cross-workspace) ───────────────────────────────
  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.stopPropagation(); setDragSource(path);
    e.dataTransfer.setData('text/plain', path); e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, targetPath: string, targetType: string) => {
    e.preventDefault(); e.stopPropagation();
    if (targetType === 'directory' && targetPath !== dragSource && !targetPath.startsWith(dragSource || '\x00')) {
      e.dataTransfer.dropEffect = 'move'; setDragTarget(targetPath);
    } else { e.dataTransfer.dropEffect = 'none'; setDragTarget(null); }
  };
  const handleDragLeave = (e: React.DragEvent) => {
    const r = e.relatedTarget as HTMLElement;
    if (r && e.currentTarget.contains(r)) return;
    setDragTarget(null);
  };
  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault(); e.stopPropagation(); setDragTarget(null); setDragSource(null);
    const src = e.dataTransfer.getData('text/plain');
    if (!src || src === targetPath) return;
    const name = src.split(/[/\\]/).pop(); if (!name) return;
    if (targetPath.startsWith(src)) return;
    try {
      await window.api.file.move(src, `${targetPath}/${name}`);
      useEditorStore.getState().tabs.filter(t => t.filePath === src).forEach(t => useEditorStore.getState().updateTab(t.id, { filePath: `${targetPath}/${name}` }));
      const rp = findRootForPath(targetPath); if (rp) await refreshRoot(rp);
      const srcRp = findRootForPath(src); if (srcRp && srcRp !== rp) await refreshRoot(srcRp);
    } catch (e) { await showAlert(`Failed to move: ${(e as Error).message || e}`); }
  };
  const handleRootDrop = async (e: React.DragEvent, rp: string) => {
    if (!rp || !dragSource) return;
    e.preventDefault(); e.stopPropagation(); setDragTarget(null); setDragSource(null);
    const src = e.dataTransfer.getData('text/plain');
    if (!src || src === rp) return;
    const name = src.split(/[/\\]/).pop(); if (!name) return;
    if (rp.startsWith(src)) return;
    try {
      await window.api.file.move(src, `${rp}/${name}`);
      useEditorStore.getState().tabs.filter(t => t.filePath === src).forEach(t => useEditorStore.getState().updateTab(t.id, { filePath: `${rp}/${name}` }));
      await refreshRoot(rp);
      const srcRp = findRootForPath(src); if (srcRp && srcRp !== rp) await refreshRoot(srcRp);
    } catch (e) { await showAlert(`Failed to move: ${(e as Error).message || e}`); }
  };

  // ── Settings ───────────────────────────────────────────────────
  const treeIndent = useSettingsStore((s) => (s.settings['workbench.tree.indent'] as number) ?? 8);
  const iconTheme = (useSettingsStore((s) => s.settings['workbench.iconTheme'] as string) || 'vs-seti') as IconTheme;

  // ── Icon ────────────────────────────────────────────────────────
  const getIcon = (entry: FileEntry): React.ReactElement | null => {
    if (entry.type === 'directory') return renderFolderIcon(expanded.has(entry.path), iconTheme);
    return renderFileIcon(entry.extension.toLowerCase(), iconTheme);
  };

  // ── Context menu items ──────────────────────────────────────────
  const getContextMenuItems = () => {
    if (!contextMenu) return [];
    const items: Array<{ label: string; action: () => void; className?: string; shortcut?: string; separator?: boolean }> = [];
    const isDir = contextMenu.type === 'directory';
    const entry = findEntry(contextMenu.path);
    const isRoot = rootPaths.includes(contextMenu.path);

    if (isDir) {
      items.push({ label: 'New File', action: () => startCreate('file', contextMenu.path) });
      items.push({ label: 'New Folder', action: () => startCreate('folder', contextMenu.path) });
      items.push({ label: expanded.has(contextMenu.path) ? 'Collapse' : 'Expand', action: () => { toggleExpand(contextMenu.path); setContextMenu(null); } });
      items.push({ separator: true, label: '', action: () => {} });
    } else {
      items.push({ label: 'Open', action: () => { if (entry) openFile(entry); setContextMenu(null); } });
      items.push({ separator: true, label: '', action: () => {} });
    }
    // Clipboard
    items.push({ label: 'Cut', action: () => handleCut(contextMenu.path, contextMenu.type), shortcut: 'Ctrl+X' });
    items.push({ label: 'Copy', action: () => handleCopy(contextMenu.path, contextMenu.type), shortcut: 'Ctrl+C' });
    // Paste options
    if (clipboard) {
      if (isDir) {
        items.push({ label: `Paste${clipboard.action === 'cut' ? ' (Move)' : ' (Copy)'}`, action: () => handlePaste(contextMenu.path), shortcut: 'Ctrl+V' });
      }
      // Paste into each workspace
      for (const rp of rootPaths) {
        if (isDir && rp === contextMenu.path) continue;
        items.push({ label: `Paste into ${rp.split(/[/\\]/).pop()}`, action: () => handlePaste(rp) });
      }
    }
    items.push({ separator: true, label: '', action: () => {} });
    items.push({ label: 'Rename', action: () => startRename(contextMenu.path), shortcut: 'F2' });
    items.push({ label: 'Delete', action: () => handleDelete(contextMenu.path), shortcut: 'Del', className: 'text-[var(--theme-error)]' });
    items.push({ separator: true, label: '', action: () => {} });
    items.push({ label: 'Copy Path', action: () => copyPathToClipboard(contextMenu.path) });
    items.push({ label: 'Copy Relative Path', action: () => copyRelativePath(contextMenu.path) });
    items.push({ label: 'Copy Name', action: () => { navigator.clipboard.writeText(contextMenu.path.split(/[/\\]/).pop() || '').catch(() => {}); setContextMenu(null); } });
    // Professional editor features
    if (isDir) {
      items.push({ separator: true, label: '', action: () => {} });
      items.push({ label: 'Open in Terminal', action: () => { (window as any).api?.file?.openInTerminal?.(contextMenu.path); setContextMenu(null); } });
      items.push({ label: 'Reveal in File Manager', action: () => { (window as any).api?.file?.revealInFileManager?.(contextMenu.path); setContextMenu(null); } });
      items.push({ label: 'Search in Folder...', action: () => { useAppStore.getState().setActiveSidebarView('search'); useAppStore.getState().sidebarVisible || useAppStore.getState().toggleSidebar(); setContextMenu(null); } });
    } else {
      items.push({ separator: true, label: '', action: () => {} });
      items.push({ label: 'Reveal in File Manager', action: () => { (window as any).api?.file?.revealInFileManager?.(contextMenu.path); setContextMenu(null); } });
      items.push({ label: 'Open Containing Folder in Terminal', action: () => { const dir = contextMenu.path.substring(0, Math.max(contextMenu.path.lastIndexOf('/'), contextMenu.path.lastIndexOf('\\\\'))); (window as any).api?.file?.openInTerminal?.(dir); setContextMenu(null); } });
    }
    if (isDir && !isRoot) {
      items.push({ separator: true, label: '', action: () => {} });
      items.push({ label: 'Refresh', action: () => { refreshRoot(contextMenu.path); setContextMenu(null); } });
    }
    if (isRoot) {
      items.push({ separator: true, label: '', action: () => {} });
      items.push({ label: 'Remove from Workspace', action: () => { removeFolder(contextMenu.path); setContextMenu(null); } });
    }
    return items;
  };

  // ── Render tree entry ───────────────────────────────────────────
  const renderEntry = (entry: FileEntry, depth: number = 0) => {
    const isExpanded = expanded.has(entry.path);
    const isSelected = selected === entry.path;
    const isRenaming = renaming === entry.path;
    const isDropTarget = dragTarget === entry.path && entry.type === 'directory';
    const isDragging = dragSource === entry.path;
    const hasClipboard = !!clipboard;

    return (
      <div key={entry.path}>
        <div
          className={`flex items-center h-[22px] cursor-pointer text-xs group transition-colors duration-75
            ${isSelected ? 'bg-[var(--theme-bg-active)]' : ''}
            ${isDropTarget ? 'ring-1 ring-[var(--theme-accent)] ring-inset' : ''}
            ${isDragging ? 'opacity-40' : ''}`}
            style={{ background: isSelected ? 'var(--theme-bg-active)' : isDropTarget ? 'var(--theme-bg-active)' : undefined, paddingLeft: `${depth * treeIndent + 8}px` }}
            onMouseEnter={(e) => { if (!isSelected && !isDropTarget) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { if (!isSelected && !isDropTarget) e.currentTarget.style.background = ''; }}

          onClick={() => handleClick(entry)}
          onDoubleClick={() => handleDoubleClick(entry)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setSelected(entry.path); setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 400), path: entry.path, type: entry.type }); }}
          draggable={!isRenaming}
          onDragStart={(e) => handleDragStart(e, entry.path)}
          onDragOver={(e) => handleDragOver(e, entry.path, entry.type)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, entry.path)}
        >
          {entry.type === 'directory' ? (
            <span className={`mr-1 w-3 text-center text-[10px]`} style={{ color: isExpanded ? 'var(--theme-fg)' : 'var(--theme-fg-muted)' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          ) : <span className="mr-1 w-3" />}
          <span className="mr-1.5 text-sm leading-none flex-shrink-0">{getIcon(entry)}</span>
          {isRenaming ? (
            <input ref={renameInputRef} type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={confirmRename} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') cancelRename(); }}
              className="flex-1 text-xs px-1 py-0 outline-none min-w-0 rounded-sm" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-accent)' }} onClick={e => e.stopPropagation()} />
          ) : (
            <span className="truncate select-none" style={{ color: 'var(--theme-fg)' }}>{entry.name}</span>
          )}
          {/* Clipboard indicator */}
          {clipboard?.path === entry.path && (
            <span className="ml-auto mr-1 text-[10px]" style={{ color: 'var(--theme-fg-muted)' }}>{clipboard.action === 'cut' ? '✂' : '📋'}</span>
          )}
        </div>
        {entry.type === 'directory' && isExpanded && (
          <div>
            {creating && creating.parentPath === entry.path && (
              <div className="flex items-center h-[22px] text-xs" style={{ paddingLeft: `${(depth + 1) * treeIndent + 8}px` }}>
                <span className="mr-1 w-3" /><span className="mr-1.5 text-sm">{creating.type === 'file' ? '📄' : '📁'}</span>
                <input ref={createInputRef} type="text" value={createValue} onChange={e => setCreateValue(e.target.value)} onBlur={confirmCreate} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') cancelCreate(); }}
                  className="flex-1 text-xs px-1 py-0 outline-none min-w-0 rounded-sm" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-accent)' }} placeholder={creating.type === 'file' ? 'filename.ts' : 'folder-name'} />
              </div>
            )}
            {entry.children?.map(child => renderEntry(child, depth + 1))}
            {entry.children?.length === 0 && (
              <div className="h-[22px] flex items-center text-[10px] italic" style={{ color: 'var(--theme-fg-dim)', paddingLeft: `${(depth + 1) * treeIndent + 24}px` }}>(empty)</div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render a single workspace root ──────────────────────────────
  const renderWorkspace = (rp: string) => {
    const entries = rootFiles.get(rp) || [];
    const rootName = rp.split(/[/\\]/).pop() || rp;
    const isSingle = rootPaths.length === 1;
    const isDropTarget = dragTarget === rp;

    return (
      <div key={rp} className="mb-0.5">
        {/* ── Workspace header with per-folder toolbar ── */}
        <div
          className={`flex items-center h-[24px] cursor-pointer text-xs group transition-colors
            ${isDropTarget ? 'ring-1 ring-[var(--theme-accent)] ring-inset' : ''}`}
            style={{ background: isDropTarget ? 'var(--theme-bg-active)' : undefined, paddingLeft: '4px' }}
            onMouseEnter={(e) => { if (!isDropTarget) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { if (!isDropTarget) e.currentTarget.style.background = ''; }}
          onClick={() => { if (!isSingle) { const s = new Set(expanded); s.has(rp) ? s.delete(rp) : s.add(rp); setExpandedSync(s); } }}
          onContextMenu={e => { e.preventDefault(); setSelected(rp); setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 400), path: rp, type: 'directory' }); }}
          onDragOver={e => { if (dragSource && dragSource !== rp) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragTarget(rp); } }}
          onDragLeave={handleDragLeave}
          onDrop={e => handleRootDrop(e, rp)}
        >
          {/* Expand arrow (only in multi-root) */}
          {!isSingle && (
            <span className="mr-1 w-3 text-center text-[10px]" style={{ color: 'var(--theme-fg-muted)' }}>
              {expanded.has(rp) ? '▼' : '▶'}
            </span>
          )}
          <span className="mr-1.5" style={{ display: 'inline-flex', alignItems: 'center' }}>{renderFolderIcon(true, iconTheme, 14)}</span>
          <span className="truncate font-semibold uppercase tracking-wider text-[11px]" style={{ color: 'var(--theme-fg)' }}>
            {rootName}
          </span>

          {/* ── Per-folder toolbar ── */}
          <div className="flex-1" />
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 mr-1 transition-opacity">
            <button onClick={e => { e.stopPropagation(); startCreate('file', rp); }} className="p-0.5 rounded" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }} title="New File">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); startCreate('folder', rp); }} className="p-0.5 rounded" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }} title="New Folder">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); refreshRoot(rp); }} className="p-0.5 rounded" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }} title="Refresh">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            <button onClick={e => { e.stopPropagation(); (window as any).api?.fileWatcher?.stop?.(rp); removeFolder(rp); setRootFiles(prev => { const n = new Map(prev); n.delete(rp); return n; }); const newExpanded = new Set(expanded); for (const key of newExpanded) { if (key === rp || key.startsWith(rp + '/') || key.startsWith(rp + '\\')) newExpanded.delete(key); } setExpandedSync(newExpanded); if (selected && (selected === rp || selected.startsWith(rp + '/') || selected.startsWith(rp + '\\'))) setSelected(null); }} className="p-0.5 rounded" style={{ color: 'var(--theme-fg-muted)' }} onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-error)'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }} title="Remove">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Inline create at root */}
        {creating && creating.parentPath === rp && (
          <div className="flex items-center h-[22px] text-xs" style={{ paddingLeft: '20px' }}>
            <span className="mr-1 w-3" /><span className="mr-1.5 text-sm">{creating.type === 'file' ? '📄' : '📁'}</span>
            <input ref={createInputRef} type="text" value={createValue} onChange={e => setCreateValue(e.target.value)} onBlur={confirmCreate} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') cancelCreate(); }}
              className="flex-1 text-xs px-1 py-0 outline-none min-w-0 rounded-sm" style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-accent)' }} placeholder={creating.type === 'file' ? 'filename.ts' : 'folder-name'} />
          </div>
        )}

        {/* Drop indicator */}
        {dragSource && dragTarget === rp && (
          <div className="h-6 mx-2 mb-0.5 border border-dashed rounded flex items-center justify-center text-[10px]" style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-accent)', background: 'var(--theme-bg-active)' }}>
            Drop here to move to {rootName}
          </div>
        )}

        {/* Tree entries */}
        {(isSingle || expanded.has(rp)) && (
          <div className="py-0.5">
            {entries.map(e => renderEntry(e, isSingle ? 0 : 1))}
          </div>
        )}
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col select-none">
      {/* ── Global workspace header ── */}
      <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ color: 'var(--theme-fg-muted)', borderBottom: '1px solid var(--theme-border)' }}>
        <span className="font-semibold uppercase tracking-wider">
          Workspace{rootPaths.length > 1 ? ` (${rootPaths.length})` : ''}
        </span>
        {/* Global toolbar: Collapse All · Reload · Clear All */}
        <div className="flex gap-0.5">
          <button
            onClick={() => { setExpandedSync(new Set()); loadAllRoots(); }}
            className={`p-1 rounded ${rootPaths.length > 0 ? '' : 'opacity-30 cursor-default'}`}
              style={rootPaths.length > 0 ? { color: 'var(--theme-fg-muted)' } : {}}
              onMouseEnter={(e) => { if (rootPaths.length > 0) { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = rootPaths.length > 0 ? 'var(--theme-fg-muted)' : ''; }}
            title="Collapse All"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={loadAllRoots}
            className={`p-1 rounded ${rootPaths.length > 0 ? '' : 'opacity-30 cursor-default'}`}
              style={rootPaths.length > 0 ? { color: 'var(--theme-fg-muted)' } : {}}
              onMouseEnter={(e) => { if (rootPaths.length > 0) { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = rootPaths.length > 0 ? 'var(--theme-fg-muted)' : ''; }}
            title="Reload"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onCloseFolder}
            className={`p-1 rounded ${rootPaths.length > 0 ? '' : 'opacity-30 cursor-default'}`}
              style={rootPaths.length > 0 ? { color: 'var(--theme-fg-muted)' } : {}}
              onMouseEnter={(e) => { if (rootPaths.length > 0) { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; } }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = rootPaths.length > 0 ? 'var(--theme-fg-muted)' : ''; }}
            title="Clear All"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Clipboard indicator (auto-hide 3s) ── */}
      {clipboard && clipboardVisible && (
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] animate-fade-in" style={{ color: 'var(--theme-fg-muted)', background: 'var(--theme-bg-secondary)', borderBottom: '1px solid var(--theme-border)' }}>
          <span>{clipboard.action === 'cut' ? '✂️' : '📋'}</span>
          <span className="truncate">{clipboard.path.split(/[/\\]/).pop()}</span>
          <span className="ml-auto" style={{ color: 'var(--theme-fg-dim)' }}>Ctrl+V to paste</span>
        </div>
      )}

      {/* ── Tree content ── */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <div className="text-xs animate-pulse" style={{ color: 'var(--theme-fg-muted)' }}>Loading...</div>
          </div>
        ) : rootPaths.length === 0 ? (
          <div className="p-4 text-xs text-center whitespace-pre-line leading-relaxed" style={{ color: 'var(--theme-fg-muted)' }}>
            {'No folder opened.\nUse File → Open Folder to get started.'}
          </div>
        ) : (
          <div className="py-0.5">
            {rootPaths.map(rp => renderWorkspace(rp))}
          </div>
        )}
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <div className="context-menu fixed z-[9999]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
          {getContextMenuItems().map((item, i) =>
            item.separator ? <div key={i} className="context-menu-separator" /> : (
              <div key={i} className={`context-menu-item ${item.className || ''}`} onClick={item.action}>
                <span>{item.label}</span>
                {item.shortcut && <kbd className="ml-4 text-[10px]" style={{ color: 'var(--theme-fg-muted)' }}>{item.shortcut}</kbd>}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
};

function getLang(ext: string): string {
  const m: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact', py: 'python', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin', php: 'php', html: 'html', css: 'css', scss: 'scss', json: 'json', xml: 'xml', yaml: 'yaml', md: 'markdown', sql: 'sql', sh: 'shell', txt: 'plaintext' };
  return m[ext.toLowerCase()] || 'plaintext';
}
