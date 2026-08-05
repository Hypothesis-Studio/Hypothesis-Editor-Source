/**
 * DocumentationPage - In-app documentation with improved design.
 */
import React, { useState } from 'react';
import { WindowControls } from '../common/WindowControls';
import { useThemeStore } from '../../stores/themeStore';
import { APP_NAME, APP_VERSION, APP_DESCRIPTION } from '../../../shared/utils/appMeta';

const iconLight = new URL('../../assets/icons/icon-light.png', import.meta.url).href;
const iconDark = new URL('../../assets/icons/icon-dark.png', import.meta.url).href;

interface PageProps {
  onClose: () => void;
}

const NAV_SECTIONS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'editor', label: 'Editor' },
  { id: 'snippets', label: 'Code Snippets' },
  { id: 'sidebar', label: 'Sidebar & Panels' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'git', label: 'Git Integration' },
  { id: 'rest-client', label: 'REST Client' },
  { id: 'ai-agent', label: 'AI Agent' },
  { id: 'chat', label: 'Chat Collaboration' },
  { id: 'insights', label: 'Project Insights' },
  { id: 'preview', label: 'File Preview' },
  { id: 'browser', label: 'Web Browser' },
  { id: 'tunnels', label: 'Tunnels' },
  { id: 'live-server', label: 'Live Server' },
  { id: 'database', label: 'Database Explorer' },
  { id: 'extensions', label: 'Extensions' },
  { id: 'settings', label: 'Settings' },
  { id: 'tips', label: 'Tips & Tricks' },
];

export const DocumentationPage: React.FC<PageProps> = ({ onClose }) => {
  const currentTheme = useThemeStore((s) => s.currentTheme);
  const isLight = currentTheme.includes('light') || currentTheme === 'vs';
  const iconSrc = isLight ? iconDark : iconLight;
  const [activeSection, setActiveSection] = useState('getting-started');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--theme-bg)', color: 'var(--theme-fg)' }}>
      {/* Title bar */}
      <div style={{ display: 'flex', alignItems: 'center', height: 36, background: 'var(--theme-bg-tertiary)', borderBottom: '1px solid var(--theme-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 8 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-fg-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
          >
            <svg width={16} height={16} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Editor
          </button>
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: 'var(--theme-fg)' }}>Documentation — {APP_NAME}</div>
        <WindowControls />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left nav */}
        <div style={{ width: 200, borderRight: '1px solid var(--theme-border)', overflow: 'auto', padding: '16px 0', flexShrink: 0 }}>
          <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <img src={iconSrc} alt={APP_NAME} style={{ width: 24, height: 24 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)' }}>{APP_NAME}</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 16px 6px' }}>Contents</div>
          {NAV_SECTIONS.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)} style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '6px 16px',
              background: activeSection === s.id ? 'var(--theme-bg-active)' : 'transparent',
              border: 'none', borderLeft: activeSection === s.id ? '2px solid var(--theme-accent)' : '2px solid transparent',
              color: activeSection === s.id ? 'var(--theme-fg)' : 'var(--theme-fg-muted)',
              cursor: 'pointer', fontSize: 12,
            }}
              onMouseEnter={e => { if (activeSection !== s.id) e.currentTarget.style.background = 'var(--theme-bg-hover, var(--theme-bg-secondary))'; }}
              onMouseLeave={e => { if (activeSection !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >{s.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 48px' }}>
          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              <img src={iconSrc} alt={APP_NAME} style={{ width: 80, height: 80 }} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 6 }}>{APP_NAME} Editor</h1>
            <p style={{ fontSize: 13, color: 'var(--theme-fg-muted)' }}>{APP_DESCRIPTION} — v{APP_VERSION}</p>
          </div>

          {/* Getting Started */}
          <div id="doc-getting-started">
            <Section title="Getting Started">
              <Card>
                <SubSection title="Opening Files">
                  <List items={[
                    ['Ctrl+O', 'Open one or more files from your filesystem'],
                    ['Ctrl+N', 'Create a new untitled file'],
                    ['Drag & Drop', 'Drag files directly into the editor window'],
                    ['File Explorer', 'Click any file in the sidebar to open it'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Saving Files">
                  <List items={[
                    ['Ctrl+S', 'Save the current file'],
                    ['Ctrl+Shift+S', 'Save with a new name or location'],
                    ['Auto Save', 'Enable in Settings → Files → Auto Save'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Editor */}
          <div id="doc-editor">
            <Section title="Editor">
              <Card>
                <FeatureGrid features={[
                  ['Syntax Highlighting', '80+ languages with rich color themes'],
                  ['IntelliSense', 'Auto-completion, parameter hints, quick info'],
                  ['Semantic Highlighting', 'TypeScript/JS use semantic token colors for accurate highlighting'],
                  ['Bracket Colorization', 'Matching brackets are color-coded'],
                  ['Minimap', 'Code overview sidebar (toggle via View menu)'],
                  ['Breadcrumbs', 'File path & symbol navigation above editor'],
                  ['Word Wrap', 'Soft-wrap long lines (Alt+Z to toggle)'],
                  ['Line Numbers', 'Absolute, relative, or interval display'],
                  ['Sticky Scroll', 'Current scope stays visible at top'],
                  ['Multi-Cursor', 'Ctrl+Click to add cursors, Ctrl+D for next match'],
                  ['Code Folding', 'Collapse/expand blocks with gutter icons'],
                  ['Find & Replace', 'Regex, case sensitivity, whole word, loop through matches'],
                  ['Format on Save', 'Auto-format with configured formatter'],
                  ['Inline Suggestions', 'Ghost-text suggestions appear while typing'],
                  ['Tab Completion', 'Press Tab to accept snippet or suggestion'],
                  ['Unicode Highlight', 'Flags ambiguous or invisible characters for security'],
                  ['Compare Files', 'Right-click any code tab → Compare With... to open a side-by-side diff'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Code Snippets */}
          <div id="doc-snippets">
            <Section title="Code Snippets">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Manage reusable code templates with tab stops and variable placeholders. Open via <Kbd>Ctrl+Shift+P</Kbd> → Snippets or the snippet icon in the toolbar.
                </p>
                <SubSection title="Built-in Snippets">
                  <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 8 }}>
                    664 built-in snippets across 21 languages — TypeScript, JavaScript, Python, Go, Rust, Java, C, C++, C#, PHP, Ruby, SQL, HTML, CSS, SCSS, JSON, YAML, Markdown, Shell, and more.
                    Type a prefix (e.g. <code style={{ background: 'var(--theme-bg)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>slugify</code>, <code style={{ background: 'var(--theme-bg)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>toCamelCase</code>) and select from the suggestion dropdown.
                  </p>
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Snippet Manager">
                  <List items={[
                    ['New Snippet', 'Click New Snippet button — fill in name, prefix, language, and body'],
                    ['Prefix', 'The trigger word you type in the editor to invoke the snippet'],
                    ['Body', 'Snippet content — use ${1:placeholder} for tab stops, $0 for final cursor'],
                    ['Language', 'Scope the snippet to a specific language so it only appears in relevant files'],
                    ['Edit', 'Select any snippet from the list and modify fields, then Save Changes'],
                    ['Delete', 'Select a snippet and click Delete'],
                    ['Search', 'Filter snippets by name, prefix, or description'],
                    ['Filter by Language', 'Use the language dropdown to narrow the list'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Import & Export">
                  <List items={[
                    ['Import', 'Click Import → choose .code-snippets file or paste JSON — compatible with VS Code snippet format'],
                    ['Export', 'Click Export to download snippets as a .code-snippets file'],
                    ['Scope on Import', 'Select a language scope to apply to all imported snippets'],
                    ['VS Code compatible', 'Full support for VS Code .code-snippets format including tab stops and placeholders'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Snippet Syntax">
                  <List items={[
                    ['$1, $2, ...', 'Tab stops — press Tab to jump between them'],
                    ['${1:placeholder}', 'Tab stop with default placeholder text'],
                    ['${1|opt1,opt2|}', 'Tab stop with a choice dropdown'],
                    ['$0', 'Final cursor position after all tab stops'],
                    ['$TM_FILENAME', 'Current file name variable'],
                    ['$CURRENT_DATE', 'Current date'],
                    ['$CLIPBOARD', 'Contents of the clipboard'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Sidebar */}
          <div id="doc-sidebar">
            <Section title="Sidebar & Panels">
              <Card>
                <SubSection title="Activity Bar">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Explorer (Ctrl+Shift+E)', 'Browse and manage project files'],
                      ['Search (Ctrl+Shift+F)', 'Search across all files with regex'],
                      ['Source Control (Ctrl+Shift+G)', 'Git integration'],
                      ['AI Agent (Ctrl+Shift+A)', 'Autonomous AI coding assistant'],
                      ['REST Client (Ctrl+Shift+R)', 'API testing client like Postman'],
                      ['Database Explorer', 'Connect and query SQLite, PostgreSQL, MySQL'],
                      ['Web Browser', 'Embedded multi-tab browser'],
                      ['Project Insights', 'Code health & analytics dashboard'],
                      ['Extensions', 'Install and manage .hyp extensions'],
                      ['Settings (Ctrl+,)', 'All editor and app preferences'],
                    ].map(([name, desc], i) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 0' }}>
                        <div style={{ fontWeight: 500, color: 'var(--theme-fg)', marginBottom: 2 }}>{name}</div>
                        <div style={{ color: 'var(--theme-fg-muted)', fontSize: 11 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Bottom Panel">
                  <List items={[
                    ['Terminal (Ctrl+`)', 'Integrated terminal with multi-tab support'],
                    ['Output', 'Build and task output logs'],
                    ['Problems', 'Linter errors, warnings, diagnostics'],
                    ['Console', 'Debug console for expression evaluation'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Terminal */}
          <div id="doc-terminal">
            <Section title="Integrated Terminal">
              <Card>
                <List items={[
                  ['Ctrl+`', 'Toggle terminal panel'],
                  ['Ctrl+Shift+`', 'Open a new terminal instance'],
                  ['Ctrl+F5', 'Run current file (auto-detects language)'],
                  ['Shift+F5', 'Stop running process'],
                  ['Multi-tab', 'Create multiple terminal sessions'],
                  ['Shell detection', 'Uses system default: PowerShell, bash, zsh'],
                  ['Supported languages', 'JS, TS, Python, Ruby, Go, Rust, Java, Shell, PHP'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Git */}
          <div id="doc-git">
            <Section title="Git Integration">
              <Card>
                <List items={[
                  ['Source Control Panel', 'Ctrl+Shift+G — view changed, staged, untracked files'],
                  ['Stage & Commit', 'Stage individual files or all changes at once'],
                  ['Push / Pull / Fetch', 'Remote sync operations in the panel toolbar'],
                  ['Branch Management', 'Switch, create, and merge branches'],
                  ['Stash', 'Stash and pop changes from the panel'],
                  ['Diff Viewer', 'Click any changed file to see side-by-side diff'],
                  ['Inline Diff', 'Gutter indicators show added/modified/deleted lines'],
                  ['Git Log', 'View commit history with messages and authors'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* REST Client */}
          <div id="doc-rest-client">
            <Section title="REST Client">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Full-featured API testing client built into the editor. Open with <Kbd>Ctrl+Shift+R</Kbd> or the send icon in the Activity Bar.
                </p>
                <SubSection title="Collections & Requests">
                  <List items={[
                    ['New Collection', 'Click folder+ icon in sidebar toolbar'],
                    ['New Request', 'Click + icon or right-click collection → New Request'],
                    ['Rename', 'Right-click collection → Rename (inline edit)'],
                    ['Duplicate', 'Right-click request → Duplicate'],
                    ['Generate cURL', 'Right-click request → Generate cURL (copies to clipboard)'],
                    ['Delete', 'Right-click → Delete (themed confirmation dialog)'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Request Builder">
                  <List items={[
                    ['Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS'],
                    ['URL bar', 'Supports environment variables: {{baseUrl}}/path'],
                    ['Params tab', 'Query parameters as key-value pairs'],
                    ['Headers tab', 'Custom request headers'],
                    ['Body tab', 'raw JSON/text, form-data, x-www-form-urlencoded, binary'],
                    ['Auth tab', 'Bearer, Basic, API Key, OAuth2, Digest, AWS SigV4'],
                    ['Scripts tab', 'Pre-request and test scripts (sandboxed JS)'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Response Viewer">
                  <List items={[
                    ['Body', 'Pretty-printed JSON/XML with syntax highlighting'],
                    ['Headers', 'All response headers with copy'],
                    ['Cookies', 'Response cookie inspector'],
                    ['Timeline', 'Request timing breakdown (DNS, connect, TTFB, transfer)'],
                    ['Tests', 'Test assertion results from scripts'],
                    ['TLS Info', 'Certificate details for HTTPS requests'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Environments & Import/Export">
                  <List items={[
                    ['Environments', 'Create named environments with variable sets'],
                    ['Activate', 'Switch active environment to swap {{variables}}'],
                    ['Import', 'Postman v2/v2.1, OpenAPI 3, Swagger 2, Insomnia, HAR, cURL'],
                    ['Export', 'REST Client native, Postman v2.1, OpenAPI 3, cURL, HAR'],
                    ['Collection Runner', 'Run all requests in a collection with progress'],
                    ['History', 'All sent requests with status, duration, and re-open'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* AI Agent */}
          <div id="doc-ai-agent">
            <Section title="AI Agent">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Autonomous AI coding assistant. Open with <Kbd>Ctrl+Shift+A</Kbd> or the robot icon in the Activity Bar.
                </p>
                <SubSection title="Usage">
                  <List items={[
                    ['Chat', 'Send messages in natural language'],
                    ['Ask AI Agent', 'Right-click selected code in editor'],
                    ['Fix With AI', 'Right-click selected code → Fix With AI Agent'],
                    ['Streaming', 'Real-time responses with collapsible code blocks'],
                    ['Memory', 'Persistent context across sessions'],
                    ['Tasks', 'Create and track multi-step tasks'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Slash Commands">
                  <List items={[
                    ['/clear', 'Clear chat messages'],
                    ['/reset', 'Full reset — chat + memory'],
                    ['/context', 'Reset context only'],
                    ['/new', 'Start a new session'],
                    ['/help', 'Show all available commands'],
                    ['/model', 'Show current model info'],
                    ['/tools', 'List available tools'],
                    ['/status', 'System health check'],
                    ['/export', 'Export chat history as JSON'],
                    ['/settings', 'Open agent settings'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Built-in Tools">
                  <FeatureGrid features={[
                    ['readFile', 'Read file contents'],
                    ['writeFile', 'Write or create files'],
                    ['editFile', 'Targeted file edits'],
                    ['listFiles', 'List directory contents'],
                    ['searchFiles', 'Search for patterns in files'],
                    ['terminalRun', 'Execute terminal commands'],
                    ['git', 'Git operations'],
                    ['fetchUrl', 'Fetch web content'],
                    ['insertCode', 'Insert code at cursor position'],
                    ['getEditorContent', 'Read current editor content'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Providers">
                  <List items={[
                    ['OpenRouter', 'Access 100+ models via openrouter.ai'],
                    ['9Router', 'Custom routing provider'],
                    ['OpenAI-compatible', 'Any OpenAI-compatible API endpoint'],
                    ['Custom Gateway', 'Self-hosted or custom model gateway'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Chat Collaboration */}
          <div id="doc-chat">
            <Section title="Chat Collaboration">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Real-time chat with teammates directly inside the editor. Host a room on your local network or share a public link via Tunnel.
                </p>
                <SubSection title="Getting Started">
                  <List items={[
                    ['Create Room', 'Click the chat icon in the Activity Bar → New Room'],
                    ['Join Room', 'Enter the room URL or local IP shared by the host'],
                    ['Public Room', 'Enable Public mode to get a shareable internet link via Tunnel'],
                    ['Join Approval', 'Hosts can require approval before anyone enters the room'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Messaging">
                  <List items={[
                    ['Send Message', 'Type in the compose bar and press Enter'],
                    ['Markdown', 'Full Markdown support — bold, italic, code blocks, tables, lists'],
                    ['Reply', 'Hover a message and click the reply icon to quote it'],
                    ['Edit & Delete', 'Hover your own message to edit or delete it'],
                    ['Reactions', 'Hover a message and click an emoji to react (one per person)'],
                    ['Read Receipts', 'Double checkmark appears once another participant reads your message'],
                    ['Code Snippets', 'Click <> in compose bar → pick language → send syntax-highlighted code'],
                    ['File Attachments', 'Attach images, videos, audio, documents up to 50 MB'],
                    ['Inline Media', 'Images, videos, and audio play inline without downloading'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="AI Assistant">
                  <List items={[
                    ['Invite AI', 'Hosts can toggle AI assistant on/off in any room'],
                    ['@ai mention', 'Type @ai anywhere in your message to get an AI response'],
                    ['Typing indicator', 'AI shows a breathing typing indicator while preparing a response'],
                    ['Conversation only', 'AI in chat cannot read files or run commands — focused on conversation'],
                    ['Choose agent', 'Settings → Chat Collaboration to pick which AI agent responds to @ai'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Host Controls">
                  <List items={[
                    ['/clear', 'Clear all chat messages'],
                    ['/ai on | /ai off', 'Toggle the AI assistant'],
                    ['/kick <name>', 'Remove a participant from the room'],
                    ['/close', 'Shut down the room and disconnect everyone'],
                    ['Presence', 'Sidebar shows which file and line each participant is editing'],
                    ['Regenerate URL', 'If the tunnel drops, regenerate a new public URL without disconnecting anyone'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Project Insights */}
          <div id="doc-insights">
            <Section title="Project Insights">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Code health and analytics dashboard. Open via the dashboard icon in the Activity Bar or View → Project Insights.
                </p>
                <FeatureGrid features={[
                  ['Overview', 'File count, total lines, size, last modified'],
                  ['Languages', 'Breakdown by language with line counts and percentages'],
                  ['Complexity', 'Cyclomatic complexity per file, hotspot detection'],
                  ['Dependencies', 'npm package list with version and license info'],
                  ['Security', 'npm audit results — vulnerabilities by severity'],
                  ['Git Health', 'Commit frequency, contributor count, active days'],
                  ['Duplicates', 'Duplicate code block detection across files'],
                  ['Health Score', 'Overall project health score with breakdown'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* File Preview */}
          <div id="doc-preview">
            <Section title="File Preview">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Files with previewable formats open in a dedicated preview pane from the File Explorer.
                </p>
                <List items={[
                  ['Markdown (.md)', 'Rendered HTML preview with syntax-highlighted code blocks'],
                  ['HTML (.html)', 'Live iframe preview of HTML pages'],
                  ['SVG (.svg)', 'Vector image preview with zoom'],
                  ['Images', 'PNG, JPG, GIF, WEBP, BMP — with file info'],
                  ['Audio', 'MP3, WAV, OGG, FLAC — built-in player with controls'],
                  ['Video', 'MP4, WEBM, OGV — built-in player with controls'],
                  ['PDF (.pdf)', 'Embedded PDF viewer'],
                  ['Plain text', 'Fallback plain text viewer for unknown formats'],
                  ['File watching', 'Preview auto-refreshes when the source file changes'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Web Browser */}
          <div id="doc-browser">
            <Section title="Web Browser">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Full-featured embedded web browser. Open with <Kbd>Ctrl+Shift+B</Kbd> or the globe icon in the Activity Bar.
                </p>
                <FeatureGrid features={[
                  ['Multi-Tab', 'Open multiple tabs with independent navigation'],
                  ['Navigation Bar', 'URL input, back/forward, reload, home button'],
                  ['Find in Page', 'Ctrl+F search within the current web page'],
                  ['Bookmarks', 'Save and organize favorite URLs'],
                  ['History', 'Browse history with timestamps and re-open'],
                  ['Downloads', 'Track and manage file downloads'],
                  ['Sidebar', 'Quick access to bookmarks, history, and downloads'],
                  ['New Tab Page', 'Speed dial with bookmarks and recent history'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Tunnels */}
          <div id="doc-tunnels">
            <Section title="Tunnels">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Expose local ports to the internet via localtunnel. Open from the View menu or Command Palette.
                </p>
                <FeatureGrid features={[
                  ['Port Forwarding', 'Expose any local port to a public URL'],
                  ['Custom Subdomain', 'Request a preferred subdomain for the tunnel'],
                  ['Auto-Reconnect', 'Automatically reconnect on disconnect with exponential backoff'],
                  ['Request Metrics', 'Track request count, bytes in/out per tunnel'],
                  ['Copy URL', 'One-click copy of the public URL to clipboard'],
                  ['Open in Browser', 'Open the public URL directly in your default browser'],
                  ['Multiple Tunnels', 'Run several tunnels simultaneously'],
                  ['Status Events', 'Real-time status updates (connecting, connected, error, closed)'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Live Server */}
          <div id="doc-live-server">
            <Section title="Live Server">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Production-grade local HTTP server with live-reload. Open from the View menu or Command Palette.
                </p>
                <FeatureGrid features={[
                  ['Static File Serving', 'Serve any local directory as a website'],
                  ['Live Reload', 'Auto-refresh pages on file changes via SSE'],
                  ['SPA Mode', 'Serve index.html for all unknown routes'],
                  ['CORS Headers', 'Configurable CORS on all responses'],
                  ['HTTPS', 'Optional self-signed HTTPS with auto-generated cert'],
                  ['Request Log', 'Per-request metrics (method, path, status, bytes, duration)'],
                  ['Auto Port Finding', 'Automatically finds a free port if requested one is busy'],
                  ['File Watcher', 'chokidar-based watching with configurable extensions'],
                ]} />
              </Card>
            </Section>
          </div>

          {/* Database Explorer */}
          <div id="doc-database">
            <Section title="Database Explorer">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Connect, browse, and query databases visually. Open from the database icon in the Activity Bar or View menu.
                </p>
                <SubSection title="Supported Databases">
                  <FeatureGrid features={[
                    ['SQLite', 'Local .db files via sql.js (WASM, no native deps)'],
                    ['PostgreSQL', 'Full network connection support'],
                    ['MySQL / MariaDB', 'Full network connection support'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Features">
                  <FeatureGrid features={[
                    ['Schema Browser', 'Browse databases, tables, views, columns, indexes, and foreign keys'],
                    ['Query Editor', 'Write and execute SQL with syntax highlighting'],
                    ['Table Data Viewer', 'Browse table contents with pagination and sorting'],
                    ['Inline Cell Editing', 'Double-click any cell to edit it directly — Enter/Tab to save, Escape to cancel'],
                    ['Foreign Key Navigation', 'FK columns show a → button to jump straight to the referenced row'],
                    ['Export Table Data', 'Export any table as CSV, JSON, or SQL INSERT statements from the toolbar'],
                    ['Query History', 'Track and re-run previous queries'],
                    ['Connection Manager', 'Save and manage multiple database connections'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="ER Diagram">
                  <List items={[
                    ['Generate', 'Click the ER Diagram button in the database toolbar to generate from schema'],
                    ['Interactive canvas', 'Pan, zoom, and drag table cards freely on the canvas'],
                    ['Tables & relations', 'Shows all tables, columns, primary keys, foreign keys, and relations'],
                    ['Minimap', 'Thumbnail overview in the corner for navigation across large diagrams'],
                    ['Export PNG', 'Save the diagram as a PNG image from the diagram toolbar'],
                    ['Export SVG', 'Save the diagram as an SVG vector file from the diagram toolbar'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Extensions */}
          <div id="doc-extensions">
            <Section title="Extensions">
              <Card>
                <SubSection title="Overview">
                  <p style={{ fontSize: 12, marginBottom: 8 }}>
                    Extensions use the <code style={{ background: 'var(--theme-bg)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>.hyp</code> format — a tar archive containing <code style={{ background: 'var(--theme-bg)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>package.json</code> and <code style={{ background: 'var(--theme-bg)', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>extension.js</code>.
                  </p>
                  <List items={[
                    ['Install', 'Drag a .hyp file onto the Extensions panel or click Install'],
                    ['Enable/Disable', 'Toggle extensions without uninstalling'],
                    ['Uninstall', 'Remove extension and its files'],
                    ['Export', 'Re-export any installed extension as .hyp'],
                    ['Install location', '~/.hypothesis/extensions/'],
                    ['npm deps', 'Extensions with dependencies auto-run npm install'],
                  ]} />
                </SubSection>
              </Card>
              <Card>
                <SubSection title="Building Extensions">
                  <List items={[
                    ['Boilerplate', 'Use hypothesis-extension-boilerplate as a starter'],
                    ['package.json', 'name, version, main (entry point), contributes'],
                    ['Commands', 'Register commands via contributes.commands'],
                    ['Context menus', 'Add items to editor right-click menus'],
                    ['API', 'Access hypothesis.workspace, hypothesis.editor, hypothesis.ui'],
                  ]} />
                </SubSection>
              </Card>
            </Section>
          </div>

          {/* Settings */}
          <div id="doc-settings">
            <Section title="Settings">
              <Card>
                <p style={{ fontSize: 12, color: 'var(--theme-fg-muted)', marginBottom: 12 }}>
                  Open with <Kbd>Ctrl+,</Kbd> or the gear icon in the Activity Bar.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Editor', 'Font, size, tab size, word wrap, minimap, suggestions, hover, find, unicode highlight, semantic highlighting'],
                    ['Themes', 'Hypothesis Dark, Hypothesis Light, VS Dark, HC Black, and installed extension themes'],
                    ['Files', 'Auto-save, trim whitespace, insert final newline, format on save'],
                    ['Terminal', 'Shell path, font family, size, cursor style, scrollback'],
                    ['Git', 'User name, email, auto-fetch, commit signing'],
                    ['AI Agent', 'Provider, model, API key, tools, memory, rate limits'],
                    ['Extensions', 'Manage installed .hyp extensions'],
                    ['Icon Theme', 'Material, Codi, None'],
                    ['Accessibility', 'Accessibility mode for screen readers'],
                    ['Window', 'Zoom level, restore windows on startup'],
                  ].map(([name, desc], i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0' }}>
                      <div style={{ fontWeight: 600, color: 'var(--theme-accent)', marginBottom: 2 }}>{name}</div>
                      <div style={{ color: 'var(--theme-fg-muted)', fontSize: 11 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>

          {/* Tips */}
          <div id="doc-tips">
            <Section title="Tips & Tricks">
              <Card>
                <List items={[
                  ['Command Palette', 'Ctrl+Shift+P — access any command by name'],
                  ['Zen Mode', 'Ctrl+Shift+Z — distraction-free full-screen editing'],
                  ['Quick Open', 'Ctrl+P — fuzzy-search and open any file'],
                  ['Go to Line', 'Ctrl+G — jump directly to a line number'],
                  ['Multi-select', 'Ctrl+D to select next match, Ctrl+Shift+L for all'],
                  ['Code Snippets', 'Type a snippet prefix and press Tab to expand — 664 built-in snippets across 21 languages'],
                  ['Compare Files', 'Right-click a code tab → Compare With... to open side-by-side diff'],
                  ['REST Client', 'Ctrl+Shift+R — test APIs without leaving the editor'],
                  ['AI Agent', 'Ctrl+Shift+A — ask AI to write, fix, or explain code'],
                  ['Chat Collaboration', 'Chat icon — collaborate with teammates in real-time, use @ai to invoke AI'],
                  ['Web Browser', 'Ctrl+Shift+B — browse the web inside the editor'],
                  ['Tunnels', 'Expose local ports to the internet via localtunnel'],
                  ['Live Server', 'Serve local folders with live-reload on file changes'],
                  ['Database Explorer', 'Connect, browse, and query databases — generate ER diagrams in one click'],
                  ['Project Insights', 'Dashboard icon — check code health before shipping'],
                  ['File Preview', 'Click any image/markdown/HTML in Explorer to preview'],
                  ['Breadcrumbs', 'Click symbols in breadcrumb bar to navigate functions'],
                  ['Keyboard Shortcuts', 'Help → Keyboard Shortcuts for full reference'],
                ]} />
              </Card>
            </Section>
          </div>

          <div style={{ height: 60 }} />
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', borderRadius: 3, padding: '1px 6px', fontSize: 11, color: 'var(--theme-fg)', fontFamily: "'JetBrains Mono', monospace" }}>
    {children}
  </kbd>
);

const kbdStyle: React.CSSProperties = {
  background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-fg-dim)', borderRadius: 3,
  padding: '1px 6px', fontSize: 11, color: 'var(--theme-fg)', fontFamily: "'JetBrains Mono', monospace",
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 36 }}>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-fg)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--theme-border)' }}>
      {title}
    </h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>
);

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    background: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-light, var(--theme-border))',
    borderRadius: 8, padding: '16px 20px', fontSize: 13, lineHeight: 1.8,
  }}>
    {children}
  </div>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 12 }}>
    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>{title}</h4>
    {children}
  </div>
);

const List: React.FC<{ items: [string, string][] }> = ({ items }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    {items.map(([label, desc], i) => (
      <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, padding: '3px 0' }}>
        <span style={{ color: 'var(--theme-accent)', fontWeight: 500, minWidth: 180, flexShrink: 0 }}>{label}</span>
        <span style={{ color: 'var(--theme-fg)' }}>{desc}</span>
      </div>
    ))}
  </div>
);

const FeatureGrid: React.FC<{ features: [string, string][] }> = ({ features }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    {features.map(([name, desc], i) => (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 0' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-fg)' }}>{name}</span>
        <span style={{ fontSize: 11, color: 'var(--theme-fg-muted)' }}>{desc}</span>
      </div>
    ))}
  </div>
);
