# CHANGELOG

## [0.2.2] - 2026-07-24

### Added
- **Project Insights feature** — comprehensive project analysis dashboard
  - Full project scan: file statistics, language breakdown, code complexity, dependencies, security vulnerabilities, git health, and duplicate detection
  - 9-phase analysis engine in main process (ProjectInsightsService)
  - Interactive UI with 8 sections: Overview, Languages, Complexity, Dependencies, Security, Git, Health, Duplicates
  - Reusable chart and card components: MetricCard, HealthRing, SectionHeader, DataTable
  - ActivityBar icon and View menu entry for quick access
  - Real-time scan progress events and 5-minute caching
- **File Preview system** — professional multi-format file preview
  - HTML: sandboxed iframe rendering
  - Markdown: themed HTML rendering via `marked`
  - SVG: inline rendering with zoom/pan and transparency grid
  - Images (PNG, JPG, GIF, BMP, WebP, AVIF, APNG): zoom, pan, fit-to-view, pixel-level inspection
  - Audio (MP3, WAV, OGG, FLAC, AAC, WMA): full transport controls, seek, volume, mute
  - Video (MP4, WebM, MKV, AVI, MOV): fullscreen, seek, volume, overlay controls, auto-hide
  - PDF: iframe viewer
  - Code/Text: Monaco editor in read-only mode with syntax highlighting
  - Auto-reload on file change (chokidar file watcher)
  - Open in system viewer button
  - Toolbar with zoom controls, reload, and file info
- "Open Project Insights" command added to Command Palette
- **Diff between tabs** — Monaco-powered side-by-side diff viewer
  - Right-click tab → "Compare With..." to select a target tab for comparison
  - Tab picker dialog shows all other open tabs with file paths
  - DiffEditor component with split view, resizable divider, and synced scrolling
  - Header bar showing both file names with close button
  - Escape key to exit diff mode
  - Command Palette: "Compare Active Tab With..." and "Exit Diff Mode" commands
  - `startDiff()` / `exitDiffMode()` in editor store for clean state management
- **Resizable side-by-side preview** — drag divider between code and preview panels
  - Split ratio remembered per session (default 50/50)
  - Drag range clamped to 15%–85% to prevent panels from collapsing
  - Resize overlay blocks iframe/content from stealing mouse events during drag
  - `user-select: none` and `cursor: col-resize` applied globally during resize
  - Accent-colored hover feedback on resize handle (6px wide)

### Changed
- Icon color system: icons inside accent-colored buttons now inherit white via CSS `.hypothesis-icon { color: inherit }` — no hardcoded color overrides needed in component code
- Codi SVG icons use `fill="currentColor"` which follows CSS `color` property automatically
- Previewable files (HTML, Markdown, SVG, images, audio, video, PDF) open in preview mode by default instead of code editor
- Drag-and-drop previewable files opens them in preview mode

### Fixed
- Suppressed Monaco "unusual line terminators" warning dialog (`unusualLineTerminators: 'off'`)
  - Previously showed modal when opening media files or files with non-standard line endings

## [0.2.1] - 2026-07-24

### Added
- Icon system: IconRegistry + Icon component using SVG icon packs (material, codi)
- File explorer, tabs, sidebar, git, search, terminal, extensions — all use SVG icons
- Extension icon theme support via `contributes.iconThemes` in plugin manifest
- Profile avatar SVG picker for AI agent and user in Settings → AI Agent
- Default profile avatars (different for user and agent)
- Search IPC handler (`search:find`, `search:replace`, `search:replace-all`)
- Copy-paste support (Ctrl+C/V) in Output, Console, and Problems panels
- Context menu with Copy in terminal output panels

### Changed
- Default icon theme: material (was vscode-style hardcoded)
- All emoji and inline SVGs replaced with icon pack SVGs
- Icon theme setting options: Material, Codi, None
- Agent avatar uses profile SVG images instead of emoji/text characters
- File explorer loads directories in parallel (Promise.all for multi-root)
- Search runs with parallel file reads (concurrency limit 10)
- Search skips files > 1MB and binary files for speed

### Fixed
- Icon theme setting now reactive — changing theme updates file explorer immediately
- Icons load synchronously via `eager` glob import (no flash of missing icons)
- Fallback chain: theme icon → codi icon → generic file/folder icon
- Extension icon themes auto-register via IPC on plugin activation
- Search sidebar now works (search:find IPC handler registered)
- Search results include preview context (before/match/after)
- Agent chat avatar shows SVG profile image instead of text letter
- Output/Console/Problems panels text is selectable and copyable

### Run System
- Terminal/Console/Output/Problems panels fully synchronized via runStore
- Run File (Ctrl+F5) captures stdout/stderr to Output and Console panels
- Problems panel auto-parses errors from stderr (Node.js, Python, compiler patterns)
- Process exit codes and signals properly displayed
- Clear buttons in Output and Problems panels
- Problem entries clickable to switch to Output context
- `src/main/ipc/run.ipc.ts` — Child process execution with structured output
- `src/renderer/stores/runStore.ts` — Zustand store for run state
- `run:started`, `run:stdout`, `run:stderr`, `run:exit`, `run:error` IPC channels

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
