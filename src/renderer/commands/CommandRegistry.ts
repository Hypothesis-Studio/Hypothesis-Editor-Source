/**
 * Command Registry - Central command management with keybinding support.
 */
import type { Command, Keybinding } from '../../shared/types';
import { useEditorStore } from '../stores/editorStore';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private keybindings = new Map<string, string>(); // keybinding -> commandId
  private keybindingConflicts = new Map<string, string[]>(); // keybinding -> conflicting commandIds

  registerCommand(command: Command): void {
    this.commands.set(command.id, command);

    if (command.keybinding) {
      this.registerKeybinding(command.id, command.keybinding);
    }
  }

  unregisterCommand(id: string): void {
    const command = this.commands.get(id);
    if (command?.keybinding) {
      this.unregisterKeybinding(command.keybinding);
    }
    this.commands.delete(id);
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(category: string): Command[] {
    return Array.from(this.commands.values()).filter((cmd) => cmd.category === category);
  }

  async executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T> {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command not found: ${id}`);
    }

    try {
      const result = await command.handler(...args);
      return result as T;
    } catch (error) {
      console.error(`Error executing command ${id}:`, error);
      throw error;
    }
  }

  // Keybinding management
  registerKeybinding(commandId: string, keybinding: string): void {
    const normalized = this.normalizeKeybinding(keybinding);

    // Check for conflicts
    const existingCommand = this.keybindings.get(normalized);
    if (existingCommand && existingCommand !== commandId) {
      if (!this.keybindingConflicts.has(normalized)) {
        this.keybindingConflicts.set(normalized, [existingCommand]);
      }
      this.keybindingConflicts.get(normalized)!.push(commandId);
      console.warn(
        `Keybinding conflict: ${keybinding} is already registered for ${existingCommand}`,
      );
    }

    this.keybindings.set(normalized, commandId);
  }

  unregisterKeybinding(keybinding: string): void {
    const normalized = this.normalizeKeybinding(keybinding);
    this.keybindings.delete(normalized);
    this.keybindingConflicts.delete(normalized);
  }

  getKeybinding(commandId: string): string | undefined {
    for (const [key, id] of this.keybindings) {
      if (id === commandId) return key;
    }
    return undefined;
  }

  getKeybindingCommand(keybinding: string): string | undefined {
    const normalized = this.normalizeKeybinding(keybinding);
    return this.keybindings.get(normalized);
  }

  getKeybindingConflicts(): Map<string, string[]> {
    return new Map(this.keybindingConflicts);
  }

  hasConflict(keybinding: string): boolean {
    const normalized = this.normalizeKeybinding(keybinding);
    return this.keybindingConflicts.has(normalized);
  }

  getAllKeybindings(): Array<{ keybinding: string; commandId: string }> {
    return Array.from(this.keybindings.entries()).map(([key, id]) => ({
      keybinding: key,
      commandId: id,
    }));
  }

  // Normalize keybinding string for consistent comparison
  private normalizeKeybinding(keybinding: string): string {
    return keybinding
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/cmd/g, 'meta')
      .replace(/ctrl/g, 'ctrl')
      .replace(/shift/g, 'shift')
      .replace(/alt/g, 'alt');
  }

  // Check if a keyboard event matches a keybinding
  matchesKeybinding(event: KeyboardEvent, keybinding: string): boolean {
    const normalized = this.normalizeKeybinding(keybinding);
    const parts = normalized.split('+');

    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];

    // Check modifiers
    const requiredCtrl = modifiers.includes('ctrl');
    const requiredShift = modifiers.includes('shift');
    const requiredAlt = modifiers.includes('alt');
    const requiredMeta = modifiers.includes('meta');

    if (requiredCtrl !== event.ctrlKey) return false;
    if (requiredShift !== event.shiftKey) return false;
    if (requiredAlt !== event.altKey) return false;
    if (requiredMeta !== event.metaKey) return false;

    // Check key
    const eventKey = event.key.toLowerCase();
    return eventKey === key || event.code.toLowerCase() === `key${key}`;
  }

  // Process keyboard event and execute matching command
  handleKeyboardEvent(event: KeyboardEvent): boolean {
    for (const [keybinding, commandId] of this.keybindings) {
      if (this.matchesKeybinding(event, keybinding)) {
        const command = this.commands.get(commandId);
        if (command) {
          event.preventDefault();
          event.stopPropagation();
          this.executeCommand(commandId);
          return true;
        }
      }
    }
    return false;
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

// Register default commands
export function registerDefaultCommands(): void {
  const defaults: Command[] = [
    {
      id: 'file.new',
      label: 'New File',
      category: 'File',
      keybinding: 'Ctrl+N',
      handler: () => {
        window.api?.menu?.onChannel?.('menu:file-new', () => {});
        // Dispatch via IPC like the menu does
        const { BrowserWindow } = window as any;
        // Use the same path as App.tsx keyboard handler
        window.dispatchEvent(new CustomEvent('hypothesis:command', { detail: { command: 'file.new' } }));
      },
    },
    {
      id: 'file.open',
      label: 'Open File',
      category: 'File',
      keybinding: 'Ctrl+O',
      handler: async () => {
        await window.api.file.open();
      },
    },
    {
      id: 'file.save',
      label: 'Save',
      category: 'File',
      keybinding: 'Ctrl+S',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:command', { detail: { command: 'file.save' } }));
      },
    },
    {
      id: 'file.saveAs',
      label: 'Save As',
      category: 'File',
      keybinding: 'Ctrl+Shift+S',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:command', { detail: { command: 'file.saveAs' } }));
      },
    },
    {
      id: 'file.saveAll',
      label: 'Save All',
      category: 'File',
      keybinding: 'Ctrl+K S',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:command', { detail: { command: 'file.saveAll' } }));
      },
    },
    {
      id: 'editor.action.find',
      label: 'Find',
      category: 'Edit',
      keybinding: 'Ctrl+F',
      handler: () => {
        useEditorStore.getState().triggerFind();
      },
    },
    {
      id: 'editor.action.findReplace',
      label: 'Find and Replace',
      category: 'Edit',
      keybinding: 'Ctrl+H',
      handler: () => {
        useEditorStore.getState().triggerReplace();
      },
    },
    {
      id: 'editor.action.quickCommand',
      label: 'Command Palette',
      category: 'View',
      keybinding: 'Ctrl+Shift+P',
      handler: () => {
        useAppStore.getState().toggleCommandPalette();
      },
    },
    {
      id: 'workbench.action.quickOpen',
      label: 'Quick Open',
      category: 'View',
      keybinding: 'Ctrl+P',
      handler: () => {
        useAppStore.getState().showCommandPalette();
      },
    },
    {
      id: 'workbench.action.toggleSidebar',
      label: 'Toggle Sidebar',
      category: 'View',
      keybinding: 'Ctrl+B',
      handler: () => {
        useAppStore.getState().toggleSidebar();
      },
    },
    {
      id: 'workbench.action.terminal.toggle',
      label: 'Toggle Terminal',
      category: 'View',
      keybinding: 'Ctrl+`',
      handler: () => {
        const app = useAppStore.getState();
        app.togglePanel();
        app.setActivePanel('terminal');
      },
    },
    {
      id: 'editor.action.formatDocument',
      label: 'Format Document',
      category: 'Edit',
      keybinding: 'Shift+Alt+F',
      handler: () => {
        const { triggerFormat } = useEditorStore.getState();
        triggerFormat();
      },
    },
    {
      id: 'editor.action.commentLine',
      label: 'Toggle Line Comment',
      category: 'Edit',
      keybinding: 'Ctrl+/',
      handler: () => {
        useEditorStore.getState().triggerComment();
      },
    },
    {
      id: 'editor.action.blockComment',
      label: 'Toggle Block Comment',
      category: 'Edit',
      keybinding: 'Shift+Alt+A',
      handler: () => {
        const editor = useEditorStore.getState().activeEditor;
        if (editor) {
          editor.trigger('menu', 'editor.action.blockComment', undefined);
          editor.focus();
        }
      },
    },
    {
      id: 'editor.action.addSelectionToNextFindMatch',
      label: 'Add Selection to Next Find Match',
      category: 'Edit',
      keybinding: 'Ctrl+D',
      handler: () => {
        const editor = useEditorStore.getState().activeEditor;
        if (editor) {
          editor.trigger('menu', 'editor.action.addSelectionToNextFindMatch', undefined);
          editor.focus();
        }
      },
    },
    {
      id: 'editor.action.selectHighlights',
      label: 'Select All Occurrences',
      category: 'Edit',
      keybinding: 'Ctrl+Shift+L',
      handler: () => {
        const editor = useEditorStore.getState().activeEditor;
        if (editor) {
          editor.trigger('menu', 'editor.action.selectHighlights', undefined);
          editor.focus();
        }
      },
    },
    {
      id: 'workbench.action.closeActiveEditor',
      label: 'Close Editor',
      category: 'File',
      keybinding: 'Ctrl+W',
      handler: () => {
        const { activeTabId, closeTab } = useEditorStore.getState();
        if (activeTabId) closeTab(activeTabId);
      },
    },
    {
      id: 'workbench.action.closeAllEditors',
      label: 'Close All Editors',
      category: 'File',
      keybinding: 'Ctrl+Shift+W',
      handler: () => {
        const { tabs, closeTab } = useEditorStore.getState();
        [...tabs].forEach((t) => closeTab(t.id));
      },
    },
    {
      id: 'workbench.action.nextEditor',
      label: 'Next Editor',
      category: 'View',
      keybinding: 'Ctrl+PageDown',
      handler: () => {
        const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = (idx + 1) % tabs.length;
        setActiveTab(tabs[next].id);
      },
    },
    {
      id: 'workbench.action.previousEditor',
      label: 'Previous Editor',
      category: 'View',
      keybinding: 'Ctrl+PageUp',
      handler: () => {
        const { tabs, activeTabId, setActiveTab } = useEditorStore.getState();
        if (tabs.length <= 1) return;
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = (idx - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prev].id);
      },
    },
    {
      id: 'workbench.action.zoomIn',
      label: 'Zoom In',
      category: 'View',
      keybinding: 'Ctrl+=',
      handler: () => {
        const { settings, setSetting } = useSettingsStore.getState();
        const current = (settings['editor.fontSize'] as number) || 14;
        setSetting('editor.fontSize', Math.min(current + 1, 40));
      },
    },
    {
      id: 'workbench.action.zoomOut',
      label: 'Zoom Out',
      category: 'View',
      keybinding: 'Ctrl+-',
      handler: () => {
        const { settings, setSetting } = useSettingsStore.getState();
        const current = (settings['editor.fontSize'] as number) || 14;
        setSetting('editor.fontSize', Math.max(current - 1, 8));
      },
    },
    {
      id: 'workbench.action.zoomReset',
      label: 'Reset Zoom',
      category: 'View',
      keybinding: 'Ctrl+0',
      handler: () => {
        useSettingsStore.getState().setSetting('editor.fontSize', 14);
      },
    },
    {
      id: 'editor.screenshot.visible',
      label: 'Screenshot: Visible Code',
      category: 'Screenshot',
      keybinding: 'Ctrl+Shift+C',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:screenshot', { detail: { mode: 'visible' } }));
      },
    },
    {
      id: 'editor.screenshot.full',
      label: 'Screenshot: Full Code',
      category: 'Screenshot',
      keybinding: 'Ctrl+Shift+Alt+C',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:screenshot', { detail: { mode: 'full' } }));
      },
    },
    {
      id: 'editor.screenshot.selection',
      label: 'Screenshot: Selected Code',
      category: 'Screenshot',
      keybinding: 'Ctrl+K Ctrl+C',
      handler: () => {
        window.dispatchEvent(new CustomEvent('hypothesis:screenshot', { detail: { mode: 'selection' } }));
      },
    },
  ];

  for (const cmd of defaults) {
    commandRegistry.registerCommand(cmd);
  }
}
