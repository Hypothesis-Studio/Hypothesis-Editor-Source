# CHANGELOG

## [0.2.11] - 2026-08-05

### Fixed
- **Builtin snippets now appear in editor completion** — 664 built-in snippets across 21 languages (TypeScript, JavaScript, Python, Go, Rust, Java, C, C++, C#, PHP, Ruby, SQL, HTML, CSS, SCSS, JSON, YAML, Markdown, Shell, and more) were previously blocked from showing up in the editor autocomplete due to an incorrect filter. They now appear correctly when typing a matching prefix.
- **Snippet suggestions trigger automatically while typing** — The snippet completion provider previously only activated on manual `Ctrl+Space`. It now triggers automatically as you type, matching prefixes in real time.
- **Snippet suggestions work inside strings and comments** — `quickSuggestions` is now explicitly enabled for all contexts including strings and comments, so snippets appear everywhere in the file.
- **Tab completion enabled for snippets** — `tabCompletion` was previously turned off, preventing Tab from being used to accept snippet suggestions. It is now enabled.

## [0.2.10] - 2026-08-04

### Added
- **Syntax highlighting in code blocks** — Code snippets and code blocks in both AI Agent chat and Chat Collaboration now display with full syntax highlighting. Supports 40+ languages including TypeScript, Python, Rust, Go, Java, PHP, SQL, Bash, and more.
- **Collapsible code blocks** — All code blocks are collapsed by default to keep conversations easy to scan. Click to expand and read the full code, or collapse it again when done.
- **Code blocks adapt to your theme** — Code block colors automatically follow your current editor theme. Dark themes get a VS Code Dark+ palette; light themes switch to a matching light palette — no manual changes needed.
- **More language options for code snippets** — The language picker in Chat Collaboration now includes 40+ languages, up from 15.
- **Tool output with syntax highlighting** — When the AI Agent uses tools like read, write, or edit, the output is now shown with syntax highlighting and can be expanded or collapsed.
- **Jump to original message** — Clicking a reply quote in Chat Collaboration scrolls to and highlights the original message, just like WhatsApp.
- **Play media directly in chat** — Images, videos, and audio files sent in Chat Collaboration now display inline. Videos and audio play directly without downloading first. A Save button appears on hover when you want to keep the file.
- **Support for video and audio attachments** — Chat Collaboration now accepts video (MP4, WebM, MKV, MOV) and audio (MP3, WAV, AAC, FLAC, OGG) files in addition to images and documents. File size limit raised to 50 MB.

### Improved
- **Code snippets send without a chat bubble** — Code snippets in Chat Collaboration now appear full-width without a message bubble wrapper, making them easier to read.
- **Compose bar exits code mode after sending** — After sending a code snippet, the compose bar automatically returns to regular text mode.
- **Inline code blocks in messages** — Code fences inside regular chat messages (e.g. AI responses with example code) now render with the same highlighted, collapsible style as standalone code snippets.
- **Code snippets support reply and reactions** — You can now reply to and react on code snippet messages, same as regular messages.
- **One reaction per person per message** — Each participant can only have one active reaction per message. Picking a new emoji automatically removes the previous one.
- **Chat files stored on disk, not in memory** — Shared files are now saved to disk on the host machine instead of being held in memory. This prevents memory buildup in long or busy sessions. Files are served directly to participants over the local network and cleaned up automatically when the room is closed.
- **AI Agent session history stored per file** — AI Agent conversation history is now saved as individual files instead of one large data store. This keeps memory usage low no matter how many sessions you have, and deleting a session removes all its data immediately.

### Fixed
- **Cloudflare tunnel no longer disconnects when switching tabs** — Cloudflare tunnels now run reliably inside the app process using the official `cloudflared` Node.js package, the same way LocalTunnel works. Previously the tunnel would drop whenever you opened the editor, settings, or browser tab.
- **Second chat room no longer fails to start** — Creating a second room now correctly picks a free port that isn't already used by the first room.
- **Public URL no longer resets when switching editor tabs** — The room's public URL is now managed exclusively by tunnel events and is no longer accidentally cleared by unrelated status updates.

## [0.2.9] - 2026-08-02

### Added
- **Real-time Chat Collaboration** — Chat with teammates directly inside the editor while still writing code. Host a room on your local network or share a public link via the Tunnel feature.
- **Public Rooms via Tunnel** — Enable Public mode when creating a room to get a shareable link for anyone outside your local network. If the tunnel drops, hosts can regenerate a new public URL without disconnecting anyone already in the room.
- **AI Assistant in Chat** — Hosts can invite an AI assistant to any room. Mention `@ai` anywhere in your message — at the start, middle, or end — and the AI responds instantly as its own bubble. Works for bare `@ai`, `hello @ai`, or `what can @ai do`. Can be toggled on/off at any time.
- **@ai mention badge** — Typing `@ai` in the compose bar turns it into a styled badge chip, just like mention tags in Slack or Discord.
- **Choose a dedicated AI agent for Chat** — In Settings → Chat Collaboration, pick which AI agent responds to `@ai` mentions in chat rooms, separate from agents used elsewhere.
- **AI is typing indicator** — While the AI is preparing a response, a breathing typing indicator appears showing "AI Assistant is typing…" — visible to everyone in the room, disappears the moment the response arrives.
- **Multi-user typing indicator** — Shows up to 3 names at once (e.g. Alice, John, AI Assistant are typing…). If more people are typing, the rest are shown as a count (e.g. +2 others). AI Assistant name is highlighted in purple to stand out.
- **Host slash commands** — Room hosts can type `/` to get a command menu: `/clear` to clear chat history, `/ai on` or `/ai off` to toggle the AI, `/kick <name>` to remove a participant, and `/close` to shut down the room.
- **Select and copy messages** — Click and drag to select any message text, AI response, or code snippet to copy it. Code blocks also have a one-click Copy button.
- **Download files from chat** — Clicking a file attachment opens a Save dialog defaulting to your Downloads folder. Works on Windows, macOS, and Linux.
- **AI in chat is conversation-only** — The AI assistant in chat rooms focuses purely on conversation. It cannot read files, run commands, or access your workspace — keeping it fast, focused, and safe for collaboration.
- **Typing Indicator** — Animated bouncing dots appear when someone is composing a message.
- **Send Code Snippets** — Click the `<>` button in the compose bar, pick a language, and your code renders with syntax highlighting and a one-click copy button for all participants.
- **Send Files** — Attach files up to 2 MB. Images render inline; other files appear as download cards.
- **Markdown rendering** — All chat messages render full Markdown: bold, italic, code blocks, lists, tables, blockquotes, headings, and links.
- **Message Reactions** — Hover any message and click an emoji to react. Reactions sync live to all participants.
- **Reply to Messages** — Hover a message and click the reply icon to quote it as context for your reply.
- **Join Approval Queue** — Hosts can require approval before anyone enters the room. Approve or deny each request individually.
- **Presence & Cursor Sharing** — The participant sidebar shows which file and line each person is editing, updated live.
- **Kick Participants** — Hosts can remove any participant from the room at any time.
- **Edit & Delete Messages** — Hover your own message to edit or delete it; changes are visible to everyone instantly.
- **Read Receipts** — A double-checkmark appears once another participant has read your message.
- **Chat History Persistence** — Message history (up to 500 messages per room) and active rooms are saved and restored automatically the next time you open the app.
- **ER Diagram Generator** — Generate an Entity Relationship diagram from any connected database schema in one click. The interactive SVG canvas shows all tables, columns, primary keys, foreign keys, and relations — with pan, zoom, and draggable table cards.
- **ER Diagram Minimap** — A thumbnail overview in the corner of the canvas for quick navigation across large diagrams.
- **Inline Cell Editing** — Double-click any cell in the Table Data viewer to edit it directly. Enter or Tab to save, Escape to cancel.
- **Foreign Key Navigation** — FK columns show a → button next to each value to jump straight to the referenced row.
- **Export Table Data** — Export any table as CSV, JSON, or SQL INSERT statements from the toolbar.
- **Export ER Diagram** — Save the current diagram as PNG or SVG from the diagram toolbar.
- **Database Explorer redesigned** — Cleaner SVG icons and file-explorer-style tree lines for easier navigation through tables, views, and columns.
- **AI Agent works across multiple folders** — With more than one project folder open, the AI Agent can read and edit files from all of them.

### Fixed
- Fixed `@ai` not responding when the AI agent service was not properly connected on startup.
- Fixed the compose bar not clearing after sending a code snippet.
- Fixed input area auto-clearing unexpectedly after sending files.
- AI Agent now performs better when multiple projects are open at the same time.
- Fixed a bug that sometimes caused AI Agent to stop responding mid-reply.
- Stopped or cancelled AI responses are now saved instead of lost.
- Fixed a session hang when switching sessions while AI was working.
- Improved AI connection stability so responses complete even with brief connection drops.
- Improved AI Agent performance with Anthropic and Gemini providers.

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