import { describe, it, expect, beforeEach } from 'vitest';

/**
 * CommandRegistry - Tests
 */
import { CommandRegistry } from '../../commands/CommandRegistry';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('registerCommand', () => {
    it('should register a command', () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler: () => {},
      });
      expect(registry.getCommand('test.command')).toBeDefined();
    });

    it('should register command with keybinding', () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        keybinding: 'Ctrl+K',
        handler: () => {},
      });
      expect(registry.getKeybinding('test.command')).toBe('ctrl+k');
    });
  });

  describe('unregisterCommand', () => {
    it('should unregister a command', () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler: () => {},
      });
      registry.unregisterCommand('test.command');
      expect(registry.getCommand('test.command')).toBeUndefined();
    });
  });

  describe('executeCommand', () => {
    it('should execute a command', async () => {
      let executed = false;
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler: () => {
          executed = true;
        },
      });
      await registry.executeCommand('test.command');
      expect(executed).toBe(true);
    });

    it('should return command result', async () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler: () => 'result',
      });
      const result = await registry.executeCommand('test.command');
      expect(result).toBe('result');
    });

    it('should throw for unknown command', async () => {
      await expect(registry.executeCommand('unknown')).rejects.toThrow(
        'Command not found: unknown',
      );
    });

    it('should pass arguments to handler', async () => {
      let receivedArgs: unknown[] = [];
      registry.registerCommand({
        id: 'test.command',
        label: 'Test Command',
        handler: (...args) => {
          receivedArgs = args;
        },
      });
      await registry.executeCommand('test.command', 'a', 'b', 'c');
      expect(receivedArgs).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getCommands', () => {
    it('should return all commands', () => {
      registry.registerCommand({
        id: 'cmd1',
        label: 'Command 1',
        handler: () => {},
      });
      registry.registerCommand({
        id: 'cmd2',
        label: 'Command 2',
        handler: () => {},
      });
      expect(registry.getCommands()).toHaveLength(2);
    });
  });

  describe('getCommandsByCategory', () => {
    it('should return commands by category', () => {
      registry.registerCommand({
        id: 'cmd1',
        label: 'Command 1',
        category: 'File',
        handler: () => {},
      });
      registry.registerCommand({
        id: 'cmd2',
        label: 'Command 2',
        category: 'Edit',
        handler: () => {},
      });
      registry.registerCommand({
        id: 'cmd3',
        label: 'Command 3',
        category: 'File',
        handler: () => {},
      });
      expect(registry.getCommandsByCategory('File')).toHaveLength(2);
      expect(registry.getCommandsByCategory('Edit')).toHaveLength(1);
    });
  });

  describe('keybinding management', () => {
    it('should register keybinding', () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test',
        handler: () => {},
      });
      registry.registerKeybinding('test.command', 'Ctrl+K');
      expect(registry.getKeybindingCommand('ctrl+k')).toBe('test.command');
    });

    it('should unregister keybinding', () => {
      registry.registerCommand({
        id: 'test.command',
        label: 'Test',
        handler: () => {},
      });
      registry.registerKeybinding('test.command', 'Ctrl+K');
      registry.unregisterKeybinding('Ctrl+K');
      expect(registry.getKeybindingCommand('ctrl+k')).toBeUndefined();
    });

    it('should detect conflicts', () => {
      registry.registerCommand({
        id: 'cmd1',
        label: 'Command 1',
        handler: () => {},
      });
      registry.registerCommand({
        id: 'cmd2',
        label: 'Command 2',
        handler: () => {},
      });
      registry.registerKeybinding('cmd1', 'Ctrl+K');
      registry.registerKeybinding('cmd2', 'Ctrl+K');
      expect(registry.hasConflict('ctrl+k')).toBe(true);
    });

    it('should get all keybindings', () => {
      registry.registerCommand({
        id: 'cmd1',
        label: 'Command 1',
        keybinding: 'Ctrl+A',
        handler: () => {},
      });
      registry.registerCommand({
        id: 'cmd2',
        label: 'Command 2',
        keybinding: 'Ctrl+B',
        handler: () => {},
      });
      const keybindings = registry.getAllKeybindings();
      expect(keybindings).toHaveLength(2);
    });
  });
});
