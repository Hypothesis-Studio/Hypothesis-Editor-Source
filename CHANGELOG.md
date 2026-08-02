# CHANGELOG

## [0.2.9] - 2026-08-02

### Added
- **Realtime Chat Collaboration** — chat with others in real time directly inside the editor. Host a room on your local network (LAN/WebSocket) or share a public URL via the Tunnel feature. The chat opens as a dedicated editor tab so you can write code and chat at the same time.
- **Public rooms via Tunnel** — when hosting a room, toggle Public mode to generate a shareable link anyone can join from outside your network, powered by the existing Tunnel feature.
- **Kick participants** — room hosts can remove a participant from the room at any time.
- **AI Agent now works across multiple open folders** — when you have more than one project folder open, the AI Agent now sees all of them, can read and edit files from any folder, and mentions all open workspaces in its context.

### Fixed
- AI Agent no longer ignores additional workspace folders when multiple projects are open simultaneously.

## [0.2.8] - 2026-08-02

### Added
- **Mock Server panel in REST Client redesigned** — cleaner look, with a clearer indicator for whether the server is running.
- **AI-generated commit messages** — click the star icon in the commit message box and AI will write a clean commit message based on your changes.
- **Choose a dedicated AI agent for Source Control** — you can now pick which AI is used specifically for Git-related features (like the commit message generator) in Settings.
- **Work with multiple projects at once** — if you have more than one project folder open, the Source Control panel now shows a repository selector so you can switch between projects easily.
- **Preview your HTML at different screen sizes** — when previewing an HTML file, you can instantly check how it looks on Mobile, Tablet, Desktop, or a custom size.
- **Customize your keyboard shortcuts** — every shortcut can now be edited from Settings → Keyboard Shortcuts, with automatic warnings if a shortcut conflicts with another.
- **Zen Mode** — hide all panels and sidebars, leaving just the code editor. Toggle it with `Ctrl+Shift+Z`.
- **Sticky scroll fixed** — the function/class name you're working in now stays pinned at the top while you scroll, and it works across all programming languages, not just JavaScript/TypeScript.

### Fixed
- **Committing with nothing staged** — now shows a clear warning message instead of a confusing error.
- **Source Control buttons redesigned** — the Commit button is now bigger and easier to click, with tidier Add, Discard, Push, and Pull buttons underneath.
- **Status messages for every Git action** — staging, unstaging, discarding, switching branches, fetching, and stashing now all show a clear success or error message.
- **Edit multiple pieces of code with AI at once** — select several code blocks and ask AI to edit them all in one go (`Ctrl+K Ctrl+K`), with a preview of each change before you apply it.
- **Several keyboard shortcut conflicts resolved**, including Open Folder, Go to Symbol, and Zen Mode.

## [0.2.7] - 2026-07-26

### Added
- **Live Server** — instantly run a local folder as a website from inside the app, with automatic live-reload whenever a file changes, HTTPS support, and support for single-page apps (React, Vue, etc).
- **Docs and shortcuts page updated** — now covers the Web Browser, Tunnels, Live Server, and Database Explorer features.

### Fixed
- **Links now open inside the app** instead of launching an external browser.
- **Cleaner AI Agent responses** — it no longer shows raw technical output when a feature is turned off.
- **Chat session delete bug** — deleting the active chat session now properly starts a fresh, clean session instead of leaving old data behind.
- **Copy-paste in the AI Agent panel fixed** — shortcuts like Ctrl+C and Ctrl+V now work correctly in the chat area.
- **New right-click menu in AI Agent chat** — Copy a message, Select All, or Copy all messages at once.
- **Files edited by AI now update instantly in open tabs** — no more closing and reopening tabs to see changes.
- **AI Agent tool settings are now remembered** even after closing and reopening the app.

## [0.2.6] - 2026-07-26

### Added
- **Tunnels** — share a local server with a public URL in one click, great for quick demos or testing. Supports multiple tunnels at once, automatic reconnection if the connection drops, and a real-time activity log.

## [0.2.5] - 2026-07-25

### Added
- **Built-in Web Browser** — browse the web without leaving the app. Includes multiple tabs, bookmarks, history, downloads, in-page search, and zoom.

## [0.2.4] - 2026-07-25

### Added
- **Database Explorer** — manage SQLite, PostgreSQL, and MySQL databases directly from the app. Browse table structures, run queries, and review your query history.

### Fixed
- Several Database Explorer bugs fixed, including table data not showing up, schemas failing to load, and query history not refreshing.
- Confirmation dialogs and popups across the app are now more consistent and no longer misbehave when clicked.

## [0.2.3] - 2026-07-25

### Added
- **REST Client** — a full API testing tool built right into the app, similar to Postman or Insomnia. Organize request collections, use different authentication types, set up environment variables, and run entire collections at once.
- **Import and export collections** in Postman, OpenAPI, Swagger, Insomnia, HAR, and cURL formats.
- Docs and shortcuts pages redesigned for easier navigation.

### Fixed
- The REST Client shortcut was changed to `Ctrl+Shift+R` so it no longer conflicts with Search.
- Fixed missing fonts, an inconsistent-looking Send button, and several incorrect icons.
- Renaming collections and requests via right-click is now more reliable.

## [0.2.2] - 2026-07-24

### Added
- **Project Insights** — a full project analysis dashboard: file statistics, language breakdown, code complexity, dependencies, security issues, Git health, and duplicate code detection.
- **Expanded file previews** — now supports previewing HTML, Markdown, SVG, images, audio, video, and PDF files directly in the app, complete with playback controls and zoom.
- **Compare two open tabs side by side** — right-click a tab, choose "Compare With...", and see the differences visually.
- **Resizable code and preview panels** — drag the divider to adjust the split however you like.

### Changed
- Files that can be previewed (HTML, Markdown, images, etc) now open in preview mode by default instead of the code editor.

## [0.2.1] - 2026-07-24

### Added
- **New icon system** for a more consistent look across the app (file explorer, tabs, sidebar, git, search, terminal).
- **Choose an avatar** for yourself and for the AI Agent in Settings.
- **Copy-paste now works** in the Output, Console, and Problems panels.

### Fixed
- File search is now faster thanks to parallel processing, and automatically skips large files (>1MB) and binary files.
- Switching icon themes now applies instantly without needing to restart the app.
- Terminal, Console, Output, and Problems panels are now fully in sync when running a file — including automatic error detection from program output.

## [0.2.0] - 2026-07-23

### Added
- **Autonomous AI Agent** — an assistant that can read, write, and edit your files directly, run terminal commands, and check Git status — all through chat.
- Support for multiple AI providers (OpenRouter, 9Router, OpenAI-compatible, and more).
- Quick slash commands like `/clear`, `/help`, `/model`, and others.
- Right-click any selected code to ask a question or request a fix from the AI Agent.
- Customizable emoji avatars for you and the AI Agent.

### Fixed
- Various stability fixes for the AI Agent chat, including stalled responses, tool-call errors, and handling of unrecognized tools.
- The AI Agent now actually performs the actions it's asked to do (reading/writing files, etc) instead of just describing them.