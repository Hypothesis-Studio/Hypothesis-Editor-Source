/**
 * Slash Commands - Built-in commands for the Agent Chat.
 * All commands are executed locally (no API call).
 * Clean, professional output — no emoji.
 */

export interface SlashCommand {
  command: string;
  description: string;
  usage?: string;
  category: 'session' | 'memory' | 'agent' | 'ui';
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear', description: 'Clear all messages in current session', category: 'session' },
  { command: '/reset', description: 'Full reset: clear chat + all memory', category: 'session' },
  { command: '/new', description: 'Start a new chat session', category: 'session' },
  { command: '/sessions', description: 'List all sessions', category: 'session' },
  { command: '/forget', description: 'Clear all agent memory across sessions', category: 'memory' },
  { command: '/remember', description: 'Search memory entries', usage: '/remember [query]', category: 'memory' },
  { command: '/status', description: 'Show agent system health status', category: 'agent' },
  { command: '/model', description: 'Show current model and provider info', category: 'agent' },
  { command: '/tools', description: 'List available tools and their status', category: 'agent' },
  { command: '/help', description: 'Show all available commands', category: 'agent' },
  { command: '/export', description: 'Export chat history as JSON', category: 'ui' },
  { command: '/settings', description: 'Open full agent settings', category: 'ui' },
  { command: '/context', description: 'Reset context and start fresh', category: 'session' },
];

export interface CommandResult {
  handled: boolean;
  message?: string;
  action?: () => void;
}

export function executeSlashCommand(
  input: string,
  context: {
    sessionId: string | null;
    clearMessages: (sessionId: string) => void;
    createSession: (agentId: string) => Promise<unknown>;
    activeAgentId: string | null;
    clearMemory: (sessionId?: string) => void;
    searchMemory: (query: string) => void;
    loadHealthStatus: () => void;
    healthStatus: any;
    agentConfigs: any[];
    providers: any[];
    tools: any[];
    messages: any[];
    onOpenSettings?: () => void;
  },
): CommandResult {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (cmd) {
    case '/clear':
      if (context.sessionId) {
        context.clearMessages(context.sessionId);
        return { handled: true, message: 'Chat cleared.' };
      }
      return { handled: true, message: 'No active session to clear.' };

    case '/reset':
      if (context.sessionId) {
        context.clearMessages(context.sessionId);
      }
      context.clearMemory();
      return { handled: true, message: 'Full reset complete. Chat cleared, all memory wiped.' };

    case '/new':
      if (context.activeAgentId) {
        context.createSession(context.activeAgentId);
        return { handled: true, message: 'New session started.' };
      }
      return { handled: true, message: 'No agent selected.' };

    case '/sessions':
      return { handled: true, message: 'Use the session dropdown in the header to switch sessions.' };

    case '/forget':
      context.clearMemory();
      return { handled: true, message: 'All agent memory cleared across all sessions.' };

    case '/remember':
      if (args) {
        context.searchMemory(args);
        return { handled: true, message: `Searching memory for: "${args}"` };
      }
      return { handled: true, message: 'Usage: /remember [query]' };

    case '/status': {
      context.loadHealthStatus();
      const h = context.healthStatus;
      if (h) {
        return {
          handled: true,
          message: [
            '**System Status**',
            '',
            `- Agents: ${h.agents}`,
            `- Providers: ${h.providers.connected}/${h.providers.total} online`,
            `- Active Streams: ${h.activeStreams}`,
            `- Memory Entries: ${h.memoryEntries}`,
            `- Active Tasks: ${h.activeTasks}`,
          ].join('\n'),
        };
      }
      return { handled: true, message: 'Loading system status...' };
    }

    case '/model': {
      const agent = context.agentConfigs.find((a: any) => a.id === context.activeAgentId);
      if (!agent) return { handled: true, message: 'No agent selected.' };
      const provider = context.providers.find((p: any) => p.id === agent.providerId);
      return {
        handled: true,
        message: [
          '**Current Agent Configuration**',
          '',
          `- Name: ${agent.name}`,
          `- Provider: ${provider?.name || 'None'}`,
          `- Model: ${agent.modelId || 'None'}`,
          `- Temperature: ${agent.temperature}`,
          `- Max Tokens: ${agent.maxTokens}`,
          `- Streaming: ${agent.streaming ? 'ON' : 'OFF'}`,
          `- Memory: ${agent.memoryEnabled ? 'ON' : 'OFF'}`,
        ].join('\n'),
      };
    }

    case '/tools': {
      const enabled = context.tools.filter((t: any) => t.enabled);
      const disabled = context.tools.filter((t: any) => !t.enabled);
      const lines = ['**Available Tools**', '', `Enabled (${enabled.length}):`];
      for (const t of enabled) {
        lines.push(`- ${t.name} — ${t.description}${t.dangerous ? ' [dangerous]' : ''}`);
      }
      if (disabled.length > 0) {
        lines.push('', `Disabled (${disabled.length}):`);
        for (const t of disabled) {
          lines.push(`- ${t.name} — ${t.description}`);
        }
      }
      return { handled: true, message: lines.join('\n') };
    }

    case '/help': {
      const categories: Record<string, SlashCommand[]> = {};
      for (const c of SLASH_COMMANDS) {
        if (!categories[c.category]) categories[c.category] = [];
        categories[c.category].push(c);
      }
      const lines = ['**Available Commands**'];
      const catLabels: Record<string, string> = { session: 'Session', memory: 'Memory', agent: 'Agent', ui: 'UI' };
      for (const [cat, cmds] of Object.entries(categories)) {
        lines.push('', `**${catLabels[cat] || cat}:**`);
        for (const c of cmds) {
          lines.push(`- \`${c.command}\` — ${c.description}${c.usage ? ` (${c.usage})` : ''}`);
        }
      }
      return { handled: true, message: lines.join('\n') };
    }

    case '/export': {
      const data = JSON.stringify(context.messages, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-chat-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { handled: true, message: 'Chat exported as JSON.' };
    }

    case '/settings':
      context.onOpenSettings?.();
      return { handled: true, message: 'Opening agent settings...' };

    case '/context':
      if (context.sessionId) {
        context.clearMessages(context.sessionId);
      }
      context.clearMemory();
      return { handled: true, message: 'Context reset. Chat cleared, memory wiped, fresh start.' };

    default:
      if (cmd.startsWith('/')) {
        return { handled: true, message: `Unknown command: \`${cmd}\`\nType \`/help\` to see all available commands.` };
      }
      return { handled: false };
  }
}

export function filterSlashCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  const lower = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (c) => c.command.includes(lower) || c.description.toLowerCase().includes(lower),
  );
}
