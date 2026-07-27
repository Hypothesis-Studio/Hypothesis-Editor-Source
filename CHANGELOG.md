# CHANGELOG

## [0.2.7] - 2026-07-26

### Added
- **Live Server** — embedded HTTP server with live-reload
  - Serve any local folder via HTTP or HTTPS (self-signed cert)
  - Live-reload via SSE (`/__hypothesis_sse__`) — works inside internal Web Browser
  - File watcher via `fs.watch` native (recursive) with 150ms debounce per file
  - CSS-only changes trigger CSS hot-swap (no full page reload)
  - SPA mode — serves `index.html` for unknown routes
  - CORS headers on all responses
  - Per-request log: method, path, status, bytes, duration, timestamp
  - Per-file-change log: file path, change type (add/change/unlink), timestamp
  - Auto port-finding if requested port is busy
  - Custom label per server (editable inline)
  - Toggle chips: Live Reload, Open in Browser, SPA Mode, CORS
  - Copy URL, Open in internal Web Browser, Open folder, Stop per server
  - Stop All button in footer
  - Server count + globe icon badge in form bar
  - Keyboard: accessible via Panel → Live Server tab
  - `LiveServerService` with full lifecycle management, dispose on app quit
  - Preload bridge: `api.liveServer.*` (start, stop, stopAll, list, get, updateLabel, copyUrl, openInBrowser, openFolder, findFreePort, onStatusChanged, onRequest, onFileChanged)
- **Documentation updated** — in-app docs (`DocumentationPage.tsx`) updated with new features:
  - Web Browser section (multi-tab, bookmarks, history, downloads, find in page)
  - Tunnels section (port forwarding, auto-reconnect, metrics)
  - Live Server section (live-reload, SPA mode, HTTPS, file watcher)
  - Database Explorer section (SQLite/PostgreSQL/MySQL, schema browser, query editor)
  - Activity Bar entries updated (Database Explorer, Web Browser)
  - Tips & Tricks updated with new keyboard shortcuts
- **Keyboard Shortcuts page updated** — added Web Browser section (`Ctrl+Shift+B`, new tab, close tab, find in page, etc.)

### Fixed
- **Open in Browser** (Live Server + Tunnels) — now opens URL in internal Web Browser tab instead of external browser
- **Panel tab order** — Live Server now appears before Tunnels
- **AI Agent raw JSON response** — when tools are disabled, AI no longer outputs raw JSON like `{"tool": "readFile", "path": "."}`. Added:
  - Disabled tools list injected into system prompt so AI knows what's unavailable
  - `sanitizeResponse()` post-processor catches raw tool-call JSON and replaces with professional message
  - Tool usage rules added to system prompt to prevent raw JSON output
  - Disabled tool check in streaming loop with clear error message
  - Professional error messages for disabled/unknown tools in both streaming and non-streaming paths
- **Session delete bug** — deleting the active session now properly clears messages and auto-creates a new empty session instead of leaving stale state
- **Tool enable/disable persistence** — tool enabled/disabled states now persist across app restarts via `agent.disabledTools` in AppStore

## [0.2.6] - 2026-07-26

### Added
- **Tunnels** — port forwarding via LocalTunnel
  - Forward any local port to a public URL instantly
  - Multi-tunnel support — run multiple tunnels simultaneously
  - Auto-reconnect with exponential backoff on disconnect
  - Custom subdomain support (optional)
  - Custom label per tunnel (editable inline via double-click)
  - Per-tunnel request activity log with method, status code, path, timestamp
  - Per-tunnel stats: request count, bytes in/out
  - Copy public URL to clipboard (one-click)
  - Open public URL in system browser
  - Close individual tunnel or close all at once
  - Status indicator: Connecting / Connected / Error / Closed with animated dot
  - Tunnel count + icon badge in form bar (accent color when active)
  - Keyboard: accessible via Panel → Tunnels tab
  - `TunnelService` with full lifecycle management, dispose on app quit
  - Preload bridge: `api.tunnel.*` (open, close, closeAll, list, get, updateLabel, copyUrl, openInBrowser, onStatusChanged, onRequest)

## [0.2.5] - 2026-07-25

### Added
- **Web Browser** — full production-grade embedded browser
  - Multi-tab browsing dengan tab bar (add, close, pin, favicon, loading spinner)
  - Address bar dengan lock icon (HTTPS), search suggestions (history + bookmarks + URL detect)
  - Back, Forward, Reload/Stop, Home navigation buttons
  - Bookmark manager — add/remove/folders, star button di toolbar
  - History sidebar — grouped by day (Today/Yesterday/weekday/date), search, delete, clear all
  - Downloads sidebar — progress bar, speed, pause/resume/cancel, show in folder, clear completed
  - Find in page (Ctrl+F) dengan previous/next/close
  - Zoom in/out/reset dengan level indicator
  - Developer Tools toggle
  - New Tab page — clock, search bar, quick links, recent visits
  - Keyboard shortcut: `Ctrl+Shift+B`
  - ActivityBar: globe/browser icon di Group 2
  - View menu entry: "Web Browser" `CmdOrCtrl+Shift+B`
  - Command Palette: "Open Web Browser"
  - Webview crash recovery screen
  - Download progress via Electron `will-download` session event
  - Settings: homepage, search engine, download path, JS/images toggle, proxy
  - Persistent history, bookmarks, downloads via JSON files di userData
  - `app.getAppPath()`-safe WASM path resolution (same pattern as DB Explorer)

## [0.2.4] - 2026-07-25

### Added
- **Database Explorer** — full production-grade database client
  - SQLite, PostgreSQL, MySQL/MariaDB support
  - Connection manager with test connection, edit, delete
  - Schema browser: tables, views, columns, indexes, foreign keys, row count
  - Table Data viewer: pagination, row numbering, alternating rows, NULL highlighting
  - Query Editor: multi-tab, syntax-aware, Ctrl+Enter to run, colored result badges
  - Query History: grouped by day (Today/Yesterday), OK/Error badges, click to re-open
  - Resizable sidebar with hover/drag highlight
  - Open via `Ctrl+Shift+D` or Activity Bar database icon
  - View menu entry and Command Palette: "Open Database Explorer"

### Fixed
- **Database Explorer** — SQLite `sql.js` WASM async initialization (was calling sync on Promise)
- **Database Explorer** — MySQL table data using backtick quoting instead of double-quote
- **Database Explorer** — Schema not loading due to missing `await` on all `db.prepare()` calls
- **Database Explorer** — Table Data always showing 0 rows due to sync/async mismatch
- **Database Explorer** — History not refreshing after query execution
- **Database Explorer** — `totalRows`/`columns`/`rows` undefined crash in TableDataViewer
- **Database Explorer** — WASM file path resolved via `app.getAppPath()` for build robustness
- **UI** — ModalShell backdrop click now uses `target === currentTarget` check to prevent closing when clicking inside inputs
- **UI** — Modal inputs now have `userSelect: text` and `pointerEvents: auto` to fix typing issues
- **UI** — Confirm/delete dialogs now use red `#e53e3e` button consistently (explorer + database)
- **UI** — `ConfirmDialog` and `GlobalDialog` buttons use full inline style to prevent CSS class override

## [0.2.3] - 2026-07-25

### Added
- **REST Client** — full production-grade API testing client (like Postman/Insomnia)
  - Collections and folder organization with drag-and-drop ordering
  - Request builder: URL bar, Params, Headers, Body (raw/form-data/urlencoded/binary), Auth, Scripts tabs
  - Auth types: Bearer, Basic, API Key, OAuth2, Digest, AWS SigV4
  - Pre-request and test scripts (sandboxed JS engine)
  - Response viewer: Body (pretty/raw), Headers, Cookies, Timeline, Tests, TLS Info
  - JSON syntax highlighting in response body
  - Environments with variable sets and `{{variable}}` interpolation
  - Collection Runner with per-request progress and assertion results
  - Import: Postman v2/v2.1, OpenAPI 3, Swagger 2, Insomnia, HAR, cURL
  - Export: REST Client native, Postman v2.1, OpenAPI 3, cURL, HAR
  - Request history with status, duration, re-open, and Clear button
  - cURL generator (right-click request → Generate cURL → copies to clipboard)
  - Inline rename on collection/request (replaces broken `prompt()` in Electron)
  - Themed confirmation dialogs for delete (uses app `showConfirm` from dialogStore)
  - Open via `Ctrl+Shift+R` or Activity Bar send icon
  - View menu entry and Command Palette: "Open REST Client"
- **ModalShell** — shared modal wrapper component (`src/renderer/components/common/ModalShell.tsx`)
  - Standardized overlay: backdrop blur, z-index 99999, 8px border-radius, themed border and box-shadow
  - `modalStyles` export with shared button/input/label styles for all dialogs
  - Used by CurlImportDialog, ImportDialog, ExportDialog, EnvironmentManager
- **DocumentationPage** redesign
  - Left navigation sidebar with smooth anchor scroll
  - New sections: REST Client, Project Insights, File Preview, Extensions
  - Updated: AI Agent (full tool list, slash commands, providers), Settings, Sidebar, Tips & Tricks
- **KeyboardShortcutsPage** update
  - New sections: REST Client shortcuts, Multi-Cursor expanded
  - Slash commands rendered with muted style to distinguish from keyboard shortcuts
  - `kbd` keys styled with border-bottom for physical keycap look
  - Multi-key sequences rendered as separate badge pairs

### Changed
- REST Client keyboard shortcut changed from `Ctrl+Shift+F` to `Ctrl+Shift+R` (Ctrl+Shift+F is Search)
  - Updated in: Electron menu accelerator, App.tsx handler, CommandPalette, KeyboardShortcutsPage, ActivityBar tooltip
- All REST Client dialogs refactored to use `ModalShell` for consistent app-wide modal styling
- Context menu in REST Client sidebar: `zIndex` raised to 9998/9999, position clamped to viewport, danger items have separator and red-tinted hover, icon opacity 0.85
- Delete actions in REST Client context menu now use `showConfirm()` instead of native `confirm()` — matches FileExplorer behavior and respects app theme
- `EnvironmentManager`: Add button icon changed from invalid `plus` to `add`
- `CurlImportDialog`: icon updated to `terminal`
- `ImportDialog`: icon updated to `upload`, auto-detects format from file extension
- `ExportDialog`: icon updated to `download`

### Fixed
- **Error #310** in `ResponseViewer.tsx` — `prettyBody` useMemo was called after conditional early returns (Rules of Hooks violation); moved above all early returns
- **Font `ERR_FILE_NOT_FOUND`** — all 28 font files (JetBrainsMono, FiraCode, CascadiaCode, GeistMono, MonaspaceArgon variants) copied to `public/fonts/`; `@font-face` paths in `fonts.css` updated from relative `./fonts/` to absolute `/fonts/` so Vite serves them from the public root
- **REST Client Send button** restyled to match AI Agent send button: square 36×36px, `var(--theme-accent)` background, inline SVG arrow/cancel icons, no text label
- **Editor Add button** cleanup: removed dashed border, icon changed from `plus` to `add`, proper hover effect added
- **Rename via context menu** no longer uses `prompt()` (broken in Electron renderer); replaced with inline `<input>` rendered in place of the name span, commit on Enter/blur, cancel on Escape
- **Generate cURL** in context menu wrapped in try/catch with proper error logging
- **REST Client toolbar icons**: Import cURL → `terminal`, Import → `upload`, Export → `download` (all match valid codi SVG filenames)

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
