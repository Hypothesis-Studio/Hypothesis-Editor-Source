/**
 * Slash Commands - Built-in commands for the Agent Chat.
 * Includes AI-powered commands that send smart prefilled prompts to the agent.
 */

export interface SlashCommand {
  command: string;
  description: string;
  usage?: string;
  category: 'session' | 'memory' | 'agent' | 'ui' | 'ai';
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Session
  { command: '/clear', description: 'Clear all messages in current session', category: 'session' },
  { command: '/reset', description: 'Full reset: clear chat + all memory', category: 'session' },
  { command: '/new', description: 'Start a new chat session', category: 'session' },
  { command: '/sessions', description: 'List all sessions', category: 'session' },
  { command: '/context', description: 'Reset context and start fresh', category: 'session' },
  // Memory
  { command: '/forget', description: 'Clear all agent memory across sessions', category: 'memory' },
  { command: '/remember', description: 'Search memory entries', usage: '/remember [query]', category: 'memory' },
  // Agent
  { command: '/status', description: 'Show agent system health status', category: 'agent' },
  { command: '/model', description: 'Show current model and provider info', category: 'agent' },
  { command: '/tools', description: 'List available tools and their status', category: 'agent' },
  { command: '/help', description: 'Show all available commands', category: 'agent' },
  // UI
  { command: '/export', description: 'Export chat history as JSON', category: 'ui' },
  { command: '/settings', description: 'Open full agent settings', category: 'ui' },
  // AI-powered
  { command: '/fix', description: 'Fix errors in current file or selection', usage: '/fix [description]', category: 'ai' },
  { command: '/explain', description: 'Explain current file or selected code', usage: '/explain [focus]', category: 'ai' },
  { command: '/test', description: 'Generate tests for current file', usage: '/test [framework]', category: 'ai' },
  { command: '/commit', description: 'Generate a commit message from git diff', category: 'ai' },
  { command: '/review', description: 'Code review current file', usage: '/review [focus area]', category: 'ai' },
  { command: '/refactor', description: 'Refactor current file or selection', usage: '/refactor [goal]', category: 'ai' },
  { command: '/docs', description: 'Generate documentation for current file', category: 'ai' },
  { command: '/optimize', description: 'Optimize performance of current file', category: 'ai' },
];

export interface CommandResult {
  handled: boolean;
  message?: string;
  aiPrompt?: string;
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
    activeFilePath?: string;
    selectedCode?: string;
  },
): CommandResult {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  const { activeFilePath, selectedCode } = context;

  switch (cmd) {
    case '/clear':
      if (context.sessionId) {
        context.clearMessages(context.sessionId);
        return { handled: true, message: 'Chat cleared.' };
      }
      return { handled: true, message: 'No active session to clear.' };

    case '/reset':
      if (context.sessionId) context.clearMessages(context.sessionId);
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
        lines.push(`- ${t.name} - ${t.description}${t.dangerous ? ' [dangerous]' : ''}`);
      }
      if (disabled.length > 0) {
        lines.push('', `Disabled (${disabled.length}):`);
        for (const t of disabled) lines.push(`- ${t.name} - ${t.description}`);
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
      const catLabels: Record<string, string> = {
        session: 'Session', memory: 'Memory', agent: 'Agent', ui: 'UI', ai: 'AI-Powered',
      };
      for (const [cat, cmds] of Object.entries(categories)) {
        lines.push('', `**${catLabels[cat] || cat}:**`);
        for (const c of cmds) {
          lines.push(`- \`${c.command}\` - ${c.description}${c.usage ? ` (${c.usage})` : ''}`);
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
      if (context.sessionId) context.clearMessages(context.sessionId);
      context.clearMemory();
      return { handled: true, message: 'Context reset. Chat cleared, memory wiped, fresh start.' };

    // ── AI-Powered Commands ──────────────────────────────────────────────────

    case '/fix': {
      if (!activeFilePath && !selectedCode) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const focusNote = args ? `\n\nFocus on: ${args}` : '';
      const codeSection = selectedCode
        ? `\n\nSelected code to fix:\n\`\`\`\n${selectedCode}\n\`\`\``
        : '';
      const aiPrompt = activeFilePath
        ? `Fix all errors and issues in \`${activeFilePath}\`. Use readFile to read the current content, identify all bugs, syntax errors, type errors, and logical issues, then use editFile or writeFile to fix them. After fixing, verify the changes are correct.${codeSection}${focusNote}`
        : `Fix the following code — identify all bugs, syntax errors, and issues, then provide the corrected version:\n\`\`\`\n${selectedCode}\n\`\`\`${focusNote}`;
      return { handled: true, aiPrompt };
    }

    case '/explain': {
      if (!activeFilePath && !selectedCode) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const focus = args || 'overall structure and purpose';
      const codeSection = selectedCode
        ? `\n\nCode to explain:\n\`\`\`\n${selectedCode}\n\`\`\``
        : '';
      const aiPrompt = activeFilePath
        ? `Read the file \`${activeFilePath}\` and provide a clear, detailed explanation of what it does, its architecture, key functions, data flows, and any complex logic. Focus on: ${focus}.${codeSection}`
        : `Explain the following code clearly and in detail — its purpose, how it works, key logic, and any patterns used. Focus on: ${focus}:${codeSection}`;
      return { handled: true, aiPrompt };
    }

    case '/test': {
      if (!activeFilePath) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const framework = args || 'auto-detect from package.json';
      const aiPrompt = `Read \`${activeFilePath}\` and generate comprehensive tests for all exported functions, classes, and components. Steps:\n1. Read the source file to understand all exports and their behavior\n2. Check package.json (getProjectInfo or readFile) to detect the test framework (${framework})\n3. Create a test file next to the source file (e.g. \`${activeFilePath.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1')}\`)\n4. Write thorough tests: happy path, edge cases, error cases\n5. Run the tests with runTests to verify they pass`;
      return { handled: true, aiPrompt };
    }

    case '/commit': {
      const aiPrompt = `Generate a conventional commit message for the current changes:\n1. Run gitStatus to see all staged and unstaged changes\n2. Run gitDiff to see the actual code changes\n3. Analyze the changes and generate a commit message following the format: \`type(scope): description\`\n   - Types: feat, fix, refactor, docs, test, chore, style, perf\n   - Keep description under 72 chars\n   - Add a body if changes are complex\n4. Output the commit message clearly\n5. Ask if you should stage all changes (gitAdd) and commit (gitCommit) with that message`;
      return { handled: true, aiPrompt };
    }

    case '/review': {
      if (!activeFilePath) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const focus = args || 'all aspects';
      const aiPrompt = `Read \`${activeFilePath}\` and perform a thorough code review. Check for:\n- Bugs and logical errors\n- Security vulnerabilities (injection, XSS, auth bypass, etc.)\n- Performance issues (N+1 queries, unnecessary re-renders, memory leaks)\n- Code style and consistency\n- Best practices and design patterns\n- Maintainability and readability\n- Missing error handling\n- Type safety issues\n\nFocus on: ${focus}\n\nProvide specific, actionable feedback with line references where possible.`;
      return { handled: true, aiPrompt };
    }

    case '/refactor': {
      if (!activeFilePath && !selectedCode) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const goal = args || 'readability, maintainability, and performance';
      const codeSection = selectedCode
        ? `\n\nCode to refactor:\n\`\`\`\n${selectedCode}\n\`\`\``
        : '';
      const aiPrompt = activeFilePath
        ? `Read \`${activeFilePath}\` and refactor it to improve ${goal}. Make the actual changes using editFile or writeFile. Explain what you changed and why.${codeSection}`
        : `Refactor the following code to improve ${goal}. Provide the refactored version with an explanation of the changes:${codeSection}`;
      return { handled: true, aiPrompt };
    }

    case '/docs': {
      if (!activeFilePath) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const aiPrompt = `Read \`${activeFilePath}\` and generate comprehensive documentation:\n1. Add JSDoc/TSDoc comments for all exported functions, classes, interfaces, and types\n2. Document parameters, return types, and thrown errors\n3. Add usage examples for complex APIs\n4. Include @since, @example, and @remarks where helpful\n5. Update the file with the documentation using writeFile or editFile\n6. Preserve all existing functionality — only add/update comments`;
      return { handled: true, aiPrompt };
    }

    case '/optimize': {
      if (!activeFilePath && !selectedCode) {
        return { handled: true, message: 'No active file. Open a file in the editor first.' };
      }
      const codeSection = selectedCode
        ? `\n\nCode to optimize:\n\`\`\`\n${selectedCode}\n\`\`\``
        : '';
      const aiPrompt = activeFilePath
        ? `Read \`${activeFilePath}\` and optimize it for performance:\n1. Identify algorithmic complexity issues (O(n²) loops, redundant computations)\n2. Find memory inefficiencies (unnecessary allocations, leaks)\n3. Detect unnecessary re-renders or expensive operations (if React)\n4. Look for I/O bottlenecks (sequential async calls that could be parallel)\n5. Apply the optimizations using editFile or writeFile\n6. Explain each optimization and the expected improvement${codeSection}`
        : `Optimize the following code for performance. Identify bottlenecks, suggest improvements, and provide the optimized version with explanations:${codeSection}`;
      return { handled: true, aiPrompt };
    }

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