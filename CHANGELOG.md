# CHANGELOG

## [0.2.0] - 2026-07-23

### Added
- Autonomous AI Agent system with multi-turn tool execution
- AI Agent tab in editor (Ctrl+Shift+A or ActivityBar robot icon)
- 10 built-in tools: readFile, writeFile, editFile, listFiles, searchFiles, terminalRun, gitStatus, gitLog, gitDiff, getOpenEditors
- Provider system: OpenRouter, 9Router, OpenAI-compatible, custom gateways with quick presets
- Chat with streaming, collapsible code blocks, copy button per message
- Slash commands: /clear, /reset, /context, /new, /forget, /help, /model, /tools, /status, /export, /settings
- Right-click context menu: "Ask AI Agent" and "Fix With AI Agent" on selected code
- Code prefill indicator with mode (Ask/Fix) before sending to agent
- Tool parameter fuzzy matching (handles variant names: with, search, find, from, etc.)
- Tool alias resolution (runFile→terminalRun, cat→readFile, ls→listFiles, grep→searchFiles, etc.)
- Loop detection (prevents AI from repeating same tool calls)
- Custom user/agent avatar emoji picker in Settings → AI Agent
- Agent enable/disable toggle (hides sidebar icon, closes agent tab, hides command palette entry)
- Memory system with TF-relevance search
- Rate limiting per provider with token bucket
- Session persistence across app restarts
- Real-time log viewer with level/category filters
- System health dashboard
- Context usage display in agent overview
- Agent settings: Providers, Agent Profiles, Tools, System & Health
- Context menu integration with editor (selected code → agent)
- Collapsible code blocks with expand/collapse, copy, line count
- Copy button on each message bubble (hover to reveal)

### Fixed
- Stream content blank after tool calls (race condition in content_done handler)
- Tool name validation (spaces → underscores for OpenAI API compatibility)
- nanoid ESM incompatibility (replaced with CJS crypto-based implementation)
- Missing tool_call_id in follow-up messages (proper OpenAI message format)
- Stuck after first tool call (tools definitions now passed in all follow-up calls)
- Unknown tool error handling (returns helpful message with available tools list)
- editFile parameter aliases (with, search, find, from, to, replace)
- Tool loop detection (same tool+args repeated → force final response)
- Agent enable/disable not working (now hides UI elements properly)
- Right-click Ask/Fix AI Agent not opening agent tab (event dispatch fixed)
- Settings "Open Full Settings" navigation to AI Agent category

### Changed
- Agent opens as editor tab instead of sidebar view
- Default agent permissions expanded (file:write, terminal:execute, git:write)
- All 10 tools enabled by default for new agents
- System prompt instructs AI to actually use tools, not just describe actions
- Existing agent configs auto-migrate new permissions and tools on startup
- Tasks tab removed from Agent panel (Chat, Logs, Config only)
- Robot icon for AI Agent in ActivityBar sidebar
- Send button arrow points right instead of up
- All green (#4caf50) replaced with system accent blue
- CollapsibleCodeBlock always starts collapsed
- Hover provider disabled in Monaco editor for cleaner UI
- Tool results show tool name + file path (e.g., `readFile /path/to/file`)
- Markdown renderer improved: proper typography, line height, font size
- Empty lines have 6px spacing for better readability
- Streaming content buffered via requestAnimationFrame for smooth rendering
