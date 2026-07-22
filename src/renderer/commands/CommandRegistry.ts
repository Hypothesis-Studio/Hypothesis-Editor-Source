/**
 * Command Registry - Central command management with keybinding support.
 */
import type { Command, Keybinding } from '../../shared/types';

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
        // Create new untitled file
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
        // Save current file
      },
    },
    {
      id: 'file.saveAs',
      label: 'Save As',
      category: 'File',
      keybinding: 'Ctrl+Shift+S',
      handler: () => {
        // Save as
      },
    },
    {
      id: 'file.saveAll',
      label: 'Save All',
      category: 'File',
      keybinding: 'Ctrl+K S',
      handler: () => {
        // Save all files
      },
    },
    {
      id: 'editor.action.find',
      label: 'Find',
      category: 'Edit',
      keybinding: 'Ctrl+F',
      handler: () => {
        // Open find widget
      },
    },
    {
      id: 'editor.action.findReplace',
      label: 'Find and Replace',
      category: 'Edit',
      keybinding: 'Ctrl+H',
      handler: () => {
        // Open find and replace widget
      },
    },
    {
      id: 'editor.action.quickCommand',
      label: 'Command Palette',
      category: 'View',
      keybinding: 'Ctrl+Shift+P',
      handler: () => {
        // Open command palette
      },
    },
    {
      id: 'workbench.action.quickOpen',
      label: 'Quick Open',
      category: 'View',
      keybinding: 'Ctrl+P',
      handler: () => {
        // Open quick open
      },
    },
    {
      id: 'workbench.action.toggleSidebar',
      label: 'Toggle Sidebar',
      category: 'View',
      keybinding: 'Ctrl+B',
      handler: () => {
        // Toggle sidebar
      },
    },
    {
      id: 'workbench.action.terminal.toggle',
      label: 'Toggle Terminal',
      category: 'View',
      keybinding: 'Ctrl+`',
      handler: () => {
        // Toggle terminal
      },
    },
    {
      id: 'editor.action.formatDocument',
      label: 'Format Document',
      category: 'Edit',
      keybinding: 'Shift+Alt+F',
      handler: () => {
        // Format document
      },
    },
    {
      id: 'editor.action.commentLine',
      label: 'Toggle Line Comment',
      category: 'Edit',
      keybinding: 'Ctrl+/',
      handler: () => {
        // Toggle comment
      },
    },
    {
      id: 'editor.action.blockComment',
      label: 'Toggle Block Comment',
      category: 'Edit',
      keybinding: 'Shift+Alt+A',
      handler: () => {
        // Toggle block comment
      },
    },
    {
      id: 'editor.action.addSelectionToNextFindMatch',
      label: 'Add Selection to Next Find Match',
      category: 'Edit',
      keybinding: 'Ctrl+D',
      handler: () => {
        // Add selection
      },
    },
    {
      id: 'editor.action.selectHighlights',
      label: 'Select All Occurrences',
      category: 'Edit',
      keybinding: 'Ctrl+Shift+L',
      handler: () => {
        // Select all
      },
    },
    {
      id: 'workbench.action.closeActiveEditor',
      label: 'Close Editor',
      category: 'File',
      keybinding: 'Ctrl+W',
      handler: () => {
        // Close active editor
      },
    },
    {
      id: 'workbench.action.closeAllEditors',
      label: 'Close All Editors',
      category: 'File',
      keybinding: 'Ctrl+Shift+W',
      handler: () => {
        // Close all editors
      },
    },
    {
      id: 'workbench.action.nextEditor',
      label: 'Next Editor',
      category: 'View',
      keybinding: 'Ctrl+PageDown',
      handler: () => {
        // Next editor
      },
    },
    {
      id: 'workbench.action.previousEditor',
      label: 'Previous Editor',
      category: 'View',
      keybinding: 'Ctrl+PageUp',
      handler: () => {
        // Previous editor
      },
    },
    {
      id: 'workbench.action.zoomIn',
      label: 'Zoom In',
      category: 'View',
      keybinding: 'Ctrl+=',
      handler: () => {
        // Zoom in
      },
    },
    {
      id: 'workbench.action.zoomOut',
      label: 'Zoom Out',
      category: 'View',
      keybinding: 'Ctrl+-',
      handler: () => {
        // Zoom out
      },
    },
    {
      id: 'workbench.action.zoomReset',
      label: 'Reset Zoom',
      category: 'View',
      keybinding: 'Ctrl+0',
      handler: () => {
        // Reset zoom
      },
    },
  ];

  for (const cmd of defaults) {
    commandRegistry.registerCommand(cmd);
  }
}
