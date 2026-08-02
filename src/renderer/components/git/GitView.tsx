/**
 * Git View Component - Source control sidebar panel.
 * Supports multi-root workspace: user can pick which folder to operate on.
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { GitStatus, GitBranch } from '../../../shared/types';
import { Icon } from '../common/Icon';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAppStore } from '../../stores/appStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { DropdownSelect } from '../common/DropdownSelect';
import { showConfirm } from '../../stores/dialogStore';

interface GitViewProps {
  repoPath?: string | null;
}

export const GitView: React.FC<GitViewProps> = ({ repoPath: propRepoPath }) => {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [repoPath, setRepoPath] = useState<string | null>(propRepoPath || null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const { openTab } = useEditorStore();
  const settings = useSettingsStore((s) => s.settings);
  const { setStatusMessage } = useAppStore();

  // Multi-workspace
  const folders = useWorkspaceStore((s) => s.folders);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(propRepoPath || null);

  // Sync selectedFolder → repoPath; auto-pick first valid git repo when folders change
  useEffect(() => {
    if (propRepoPath) { setSelectedFolder(propRepoPath); setRepoPath(propRepoPath); return; }
    if (selectedFolder && folders.includes(selectedFolder)) { setRepoPath(selectedFolder); return; }
    // Auto-pick first folder
    if (folders.length > 0) { setSelectedFolder(folders[0]); setRepoPath(folders[0]); }
    else { setSelectedFolder(null); setRepoPath(null); }
  }, [folders, propRepoPath]);

  const handleFolderSelect = (path: string) => {
    setSelectedFolder(path);
    setRepoPath(path);
    setStatus(null);
    setBranches([]);
    setCommitMessage('');
  };

  const loadStatus = useCallback(async () => {
    if (!repoPath) return;
    setIsLoading(true);
    try {
      const gitStatus = await window.api.git.status(repoPath) as GitStatus;
      setStatus(gitStatus);
    } catch (error) {
      console.error('Failed to load git status:', error);
    }
    setIsLoading(false);
  }, [repoPath]);

  const loadBranches = useCallback(async () => {
    if (!repoPath) return;
    try {
      const gitBranches = await window.api.git.branch(repoPath) as GitBranch[];
      setBranches(gitBranches);
    } catch (error) {
      console.error('Failed to load branches:', error);
    }
  }, [repoPath]);

  // Auto-detect repo from prop (propRepoPath overrides workspace selection)
  useEffect(() => {
    if (propRepoPath) { setSelectedFolder(propRepoPath); setRepoPath(propRepoPath); }
  }, [propRepoPath]);

  // Auto-fetch
  useEffect(() => {
    if (!repoPath) return;
    const autoFetch = settings['git.autofetch'];
    if (!autoFetch) return;
    const interval = setInterval(async () => {
      try {
        await window.api.git.fetch(repoPath);
        setLastFetched(Date.now());
        await loadStatus();
        await loadBranches();
      } catch {}
    }, 60000);
    return () => clearInterval(interval);
  }, [repoPath, settings, loadStatus, loadBranches]);

  useEffect(() => {
    if (repoPath) {
      loadStatus();
      loadBranches();
    }
  }, [repoPath, loadStatus, loadBranches]);

  const handleGenerateCommitMessage = async () => {
    if (!repoPath || !status) return;
    const hasStagedChanges = status.staged.length > 0;
    if (!hasStagedChanges && status.unstaged.length === 0 && status.untracked.length === 0) {
      setStatusMessage('No changes to generate commit message from', 'warning');
      return;
    }
    setIsGenerating(true);
    try {
      // Get staged diff (or fall back to full diff if nothing staged)
      let diff = '';
      if (hasStagedChanges) {
        diff = await (window.api.git as any).stagedDiff(repoPath);
      }
      if (!diff) {
        diff = await window.api.git.diff(repoPath) as unknown as string;
      }

      // Truncate diff to ~4000 chars to stay within context limits
      const diffTrimmed = diff.length > 4000 ? diff.slice(0, 4000) + '\n...(truncated)' : diff;

      // Build file summary from status
      const stagedSummary = status.staged.map(f => `${f.status[0].toUpperCase()} ${f.path}`).join('\n');
      const unstagedSummary = !hasStagedChanges
        ? [...status.unstaged.map(f => `${f.status[0].toUpperCase()} ${f.path}`), ...status.untracked.map(f => `U ${f}`)].join('\n')
        : '';
      const fileSummary = stagedSummary || unstagedSummary;

      const prompt = [
        'Generate a concise git commit message in Conventional Commits format (e.g. feat:, fix:, refactor:, chore:, docs:, style:, test:).',
        'Rules:',
        '- First line: type(scope): short summary, max 72 chars, imperative mood, no period',
        '- If needed, add a blank line then a short body (max 3 lines)',
        '- Output ONLY the commit message, no explanation, no markdown, no quotes',
        '',
        'Changed files:',
        fileSummary,
        '',
        diffTrimmed ? `Diff:\n${diffTrimmed}` : '',
      ].filter(Boolean).join('\n');

      // Use agent:chat:send with a throwaway session
      const api = (window as any).api;

      // Get first available agent config
      const configsResult = await api.agent.config.list();
      const configs: any[] = configsResult?.data ?? configsResult ?? [];
      const preferredAgentId = settings['git.commitMessageAgentId'] as string | undefined;
      const agentConfig = (preferredAgentId ? configs.find((c: any) => c.id === preferredAgentId) : null) ?? configs[0];
      if (!agentConfig) {
        setStatusMessage('No AI agent configured — add a provider in Settings → AI Agent', 'warning');
        return;
      }

      // Create a throwaway session
      const sessionResult = await api.agent.session.create(agentConfig.id, 'commit-msg-gen');
      const sessionId = sessionResult?.data?.id ?? sessionResult?.id;
      if (!sessionId) {
        setStatusMessage('Failed to create AI session', 'error');
        return;
      }

      const result = await api.agent.chat.send(sessionId, prompt, agentConfig.id);
      const message: string = result?.data?.content ?? result?.content ?? '';

      if (message.trim()) {
        setCommitMessage(message.trim());
        setStatusMessage('Commit message generated', 'success');
      } else {
        setStatusMessage('Could not generate commit message — check AI provider config', 'warning');
      }

      // Clean up throwaway session
      api.agent.session.delete(sessionId).catch(() => {});
    } catch (err: any) {
      console.error('Generate commit message failed:', err);
      setStatusMessage('Failed to generate commit message', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommit = async () => {
    if (!repoPath || !commitMessage.trim()) return;
    const smartCommit = settings['git.enableSmartCommit'];
    const hasStagedFiles = status && status.staged.length > 0;
    const hasUnstagedFiles = status && (status.unstaged.length > 0 || status.untracked.length > 0);

    try {
      if (smartCommit && !hasStagedFiles && hasUnstagedFiles) {
        // Smart Commit: auto-stage all unstaged/untracked files before committing
        const files = [
          ...(status?.unstaged.map(f => f.path) ?? []),
          ...(status?.untracked ?? []),
        ];
        await window.api.git.add(repoPath, files);
      } else if (!hasStagedFiles) {
        // No staged changes and Smart Commit is off — tell user to stage first
        if (hasUnstagedFiles) {
          setStatusMessage('No staged changes — use the + button to stage files before committing', 'warning');
        } else {
          setStatusMessage('Nothing to commit — working tree is clean', 'warning');
        }
        return;
      }
      await window.api.git.commit(repoPath, commitMessage);
      setCommitMessage('');
      await loadStatus();
      setStatusMessage('Committed successfully', 'success');
    } catch (error: any) {
      console.error('Commit failed:', error);
      // Surface a friendlier message for the "nothing staged" git error
      const msg: string = error?.message ?? '';
      if (msg.includes('no changes added to commit') || msg.includes('nothing to commit')) {
        setStatusMessage('Nothing staged — stage your changes first before committing', 'warning');
      } else {
        setStatusMessage(`Commit failed: ${msg.split('\n')[0]}`, 'error');
      }
    }
  };

  const handlePush = async () => {
    if (!repoPath) return;
    const confirmSync = settings['git.confirmSync'];
    if (confirmSync && status && status.behind > 0) {
      const proceed = await showConfirm(
        `You are ${status.behind} commit(s) behind. Push anyway?`,
        'Confirm Push'
      );
      if (!proceed) return;
    }
    try {
      await window.api.git.push(repoPath);
      await loadStatus();
      setStatusMessage('Pushed successfully', 'success');
    } catch (error) {
      console.error('Push failed:', error);
      setStatusMessage('Push failed', 'error');
    }
  };

  const handlePull = async () => {
    if (!repoPath) return;
    const confirmSync = settings['git.confirmSync'];
    if (confirmSync) {
      const proceed = await showConfirm('Pull changes from remote?', 'Confirm Pull');
      if (!proceed) return;
    }
    try {
      await window.api.git.pull(repoPath);
      await loadStatus();
      await loadBranches();
      setStatusMessage('Pulled successfully', 'success');
    } catch (error) {
      console.error('Pull failed:', error);
      setStatusMessage('Pull failed', 'error');
    }
  };

  const handleStage = async (file: string) => {
    if (!repoPath) return;
    const fileName = file.split(/[/\\]/).pop() ?? file;
    try {
      await window.api.git.add(repoPath, [file]);
      await loadStatus();
      setStatusMessage(`Staged: ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Stage failed:', error);
      setStatusMessage(`Failed to stage ${fileName}: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleUnstage = async (file: string) => {
    if (!repoPath) return;
    const fileName = file.split(/[/\\]/).pop() ?? file;
    try {
      await window.api.git.reset(repoPath, [file]);
      await loadStatus();
      setStatusMessage(`Unstaged: ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Unstage failed:', error);
      setStatusMessage(`Failed to unstage ${fileName}: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleStageAll = async () => {
    if (!repoPath || !status) return;
    const count = status.unstaged.length + status.untracked.length;
    try {
      const files = [...status.unstaged.map(f => f.path), ...status.untracked];
      await window.api.git.add(repoPath, files);
      await loadStatus();
      setStatusMessage(`Staged ${count} file${count !== 1 ? 's' : ''}`, 'success');
    } catch (error: any) {
      console.error('Stage all failed:', error);
      setStatusMessage(`Failed to stage all: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleUnstageAll = async () => {
    if (!repoPath || !status) return;
    const count = status.staged.length;
    try {
      const files = status.staged.map(f => f.path);
      await window.api.git.reset(repoPath, files);
      await loadStatus();
      setStatusMessage(`Unstaged ${count} file${count !== 1 ? 's' : ''}`, 'success');
    } catch (error: any) {
      console.error('Unstage all failed:', error);
      setStatusMessage(`Failed to unstage all: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleDiscard = async (file: string) => {
    if (!repoPath) return;
    const fileName = file.split(/[/\\]/).pop() ?? file;
    const confirmed = await showConfirm(`Discard changes to ${fileName}? This cannot be undone.`, 'Discard Changes');
    if (!confirmed) return;
    try {
      await window.api.git.discardFile(repoPath, file);
      await loadStatus();
      setStatusMessage(`Discarded changes: ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Discard failed:', error);
      setStatusMessage(`Failed to discard ${fileName}: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleDiscardAll = async () => {
    if (!repoPath || !status) return;
    const count = status.unstaged.length;
    const confirmed = await showConfirm(`Discard all ${count} unstaged change${count !== 1 ? 's' : ''}? This cannot be undone.`, 'Discard All Changes');
    if (!confirmed) return;
    try {
      await window.api.git.discardAll(repoPath);
      await loadStatus();
      setStatusMessage('Discarded all unstaged changes', 'success');
    } catch (error: any) {
      console.error('Discard all failed:', error);
      setStatusMessage(`Failed to discard changes: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleBranchSwitch = async (branchName: string) => {
    if (!repoPath) return;
    try {
      await window.api.git.checkout(repoPath, branchName);
      await loadStatus();
      await loadBranches();
      setStatusMessage(`Switched to branch: ${branchName}`, 'success');
    } catch (error: any) {
      console.error('Branch switch failed:', error);
      setStatusMessage(`Failed to switch branch: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleFetch = async () => {
    if (!repoPath) return;
    setStatusMessage('Fetching from remote\u2026', 'info');
    try {
      await window.api.git.fetch(repoPath);
      await loadStatus();
      await loadBranches();
      setStatusMessage('Fetch complete', 'success');
    } catch (error: any) {
      console.error('Fetch failed:', error);
      setStatusMessage(`Fetch failed: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleInit = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.init(repoPath);
      await loadStatus();
      await loadBranches();
      setStatusMessage('Git repository initialized', 'success');
    } catch (error: any) {
      console.error('Init failed:', error);
      setStatusMessage(`Failed to initialize repository: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const handleStash = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.stash(repoPath);
      await loadStatus();
      setStatusMessage('Changes stashed', 'success');
    } catch (error: any) {
      console.error('Stash failed:', error);
      setStatusMessage(`Stash failed: ${String(error?.message ?? error).split('\n')[0]}`, 'error');
    }
  };

  const openFileAtLocation = async (filePath: string, line?: number) => {
    try {
      const content = await window.api.file.read(filePath);
      const ext = filePath.split('.').pop() || '';
      const fileName = filePath.split(/[/\\]/).pop() || '';
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
        h: 'c', hpp: 'cpp', cs: 'csharp', swift: 'swift', kt: 'kotlin', php: 'php',
        html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less', json: 'json',
        xml: 'xml', yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown', sql: 'sql',
        sh: 'shell', bash: 'shell', zsh: 'shell', ps1: 'powershell', bat: 'bat', cmd: 'bat',
        dockerfile: 'dockerfile', txt: 'plaintext',
      };
      openTab({
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filePath, fileName, language: langMap[ext.toLowerCase()] || 'plaintext', content,
        isDirty: false, isPinned: false, isPreview: false, viewState: null,
        scrollTop: 0, scrollLeft: 0, cursorPosition: { line: line || 1, column: 1 },
        encoding: 'UTF-8', lineEnding: 'LF', savedContent: content,
        createdAt: Date.now(), modifiedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const currentBranch = branches.find((b) => b.current);
  const totalChanges = status ? status.staged.length + status.unstaged.length + status.untracked.length : 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>Source Control</span>
        <div className="flex items-center gap-1">
          <button onClick={handleFetch} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Fetch"
          >
            <Icon name="cloud-download" size={14} />
          </button>
          <button onClick={handleStash} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Stash"
          >
            <Icon name="git-stash" size={14} />
          </button>
          <button onClick={loadStatus} className="p-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
            title="Refresh"
          >
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Branch selector */}
      {/* Workspace folder selector — only shown when multiple folders are open */}
      {folders.length > 1 && (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)', background: 'var(--theme-bg-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="folder" size={11} style={{ color: 'var(--theme-fg-muted)', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--theme-fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Repository</span>
          </div>
          <DropdownSelect
            value={selectedFolder || ''}
            options={folders.map(f => ({
              value: f,
              label: f.split(/[/\\]/).pop() || f,
            }))}
            onChange={handleFolderSelect}
            placeholder="Select repository..."
            minWidth={160}
            maxWidth={300}
          />
          {selectedFolder && (
            <div style={{ marginTop: 3, fontSize: 10, color: 'var(--theme-fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={selectedFolder}>
              {selectedFolder}
            </div>
          )}
        </div>
      )}

      {/* Branch selector */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <DropdownSelect
          value={currentBranch?.name || ''}
          options={branches
            .filter(b => b.type === 'local')
            .map(b => ({ value: b.name, label: b.current ? `● ${b.name}` : b.name }))}
          onChange={handleBranchSwitch}
          placeholder="Select branch..."
          minWidth={160}
          maxWidth={300}
        />
      </div>

      {/* Commit message + actions */}
      <div className="px-3 py-2 space-y-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <div style={{ position: 'relative' }}>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full text-xs rounded px-2 py-1.5 resize-none outline-none"
            style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border-light)', height: 56, paddingRight: 30 }}
          />
          {/* AI generate button — inside textarea top-right */}
          <button
            onClick={handleGenerateCommitMessage}
            disabled={isGenerating || !repoPath || totalChanges === 0}
            title={isGenerating ? 'Generating...' : 'Generate commit message with AI'}
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 22, height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isGenerating ? 'var(--theme-bg-hover)' : 'transparent',
              border: 'none', borderRadius: 3, cursor: isGenerating || totalChanges === 0 ? 'not-allowed' : 'pointer',
              color: isGenerating ? 'var(--theme-accent)' : 'var(--theme-fg-muted)',
              opacity: (!repoPath || totalChanges === 0) ? 0.35 : 1,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => { if (!isGenerating && totalChanges > 0) { e.currentTarget.style.color = 'var(--theme-accent)'; e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}}
            onMouseLeave={e => { if (!isGenerating) { e.currentTarget.style.color = 'var(--theme-fg-muted)'; e.currentTarget.style.background = 'transparent'; }}}
          >
            {isGenerating
              ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M8 2a6 6 0 1 0 6 6" /></svg>
              : <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M12 9H4C3.173 9 2.5 9.673 2.5 10.5V11C2.5 11.123 2.562 14 8 14C13.438 14 13.5 11.123 13.5 11V10.5C13.5 9.673 12.827 9 12 9ZM12.5 10.991C12.497 11.073 12.372 13 8 13C3.628 13 3.503 11.073 3.5 11V10.5C3.5 10.224 3.724 10 4 10H12C12.276 10 12.5 10.224 12.5 10.5V10.991ZM5.5 8H10.5C11.327 8 12 7.327 12 6.5V3.5C12 2.673 11.327 2 10.5 2H8.5V1.5C8.5 1.224 8.276 1 8 1C7.724 1 7.5 1.224 7.5 1.5V2H5.5C4.673 2 4 2.673 4 3.5V6.5C4 7.327 4.673 8 5.5 8ZM5 3.5C5 3.224 5.224 3 5.5 3H10.5C10.776 3 11 3.224 11 3.5V6.5C11 6.776 10.776 7 10.5 7H5.5C5.224 7 5 6.776 5 6.5V3.5ZM5.75 5C5.75 4.586 6.086 4.25 6.5 4.25C6.914 4.25 7.25 4.586 7.25 5C7.25 5.414 6.914 5.75 6.5 5.75C6.086 5.75 5.75 5.414 5.75 5ZM8.75 5C8.75 4.586 9.086 4.25 9.5 4.25C9.914 4.25 10.25 4.586 10.25 5C10.25 5.414 9.914 5.75 9.5 5.75C9.086 5.75 8.75 5.414 8.75 5Z"/></svg>
            }
          </button>
        </div>
        {/* Primary: Commit button full width */}
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || totalChanges === 0}
          className="btn btn-primary text-xs w-full"
          style={{ opacity: (!commitMessage.trim() || totalChanges === 0) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
        >
          {/* Commit icon: checkmark inside circle */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5"/>
            <polyline points="5,8.5 7,10.5 11,6"/>
          </svg>
          Commit
        </button>

        {/* Secondary row: Stage All · Discard All · Push · Pull · Sync */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Stage All */}
          <button
            onClick={handleStageAll}
            disabled={!status || (status.unstaged.length === 0 && status.untracked.length === 0)}
            title="Stage All Changes"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '3px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
              color: 'var(--theme-fg-muted)',
              opacity: (!status || (status.unstaged.length === 0 && status.untracked.length === 0)) ? 0.4 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            {/* Add/Stage icon: plus in a box */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="2" width="12" height="12" rx="2"/>
              <line x1="8" y1="5" x2="8" y2="11"/>
              <line x1="5" y1="8" x2="11" y2="8"/>
            </svg>
            Add
          </button>

          {/* Discard All */}
          <button
            onClick={handleDiscardAll}
            disabled={!status || status.unstaged.length === 0}
            title="Discard All Changes"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '3px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
              color: 'var(--theme-fg-muted)',
              opacity: (!status || status.unstaged.length === 0) ? 0.4 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-error, #f87171)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            {/* Discard icon: undo arrow */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3,7 3,3 7,3"/>
              <path d="M3 3 a7 7 0 1 1 -1 5"/>
            </svg>
            Discard
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'var(--theme-border)', flexShrink: 0 }} />

          {/* Push */}
          <button
            onClick={handlePush}
            disabled={!repoPath}
            title="Push"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '3px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
              color: 'var(--theme-fg-muted)',
              opacity: !repoPath ? 0.4 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            {/* Push icon: arrow pointing up with line at bottom */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="12" x2="8" y2="3"/>
              <polyline points="4.5,6.5 8,3 11.5,6.5"/>
              <line x1="3" y1="13" x2="13" y2="13"/>
            </svg>
            Push
          </button>

          {/* Pull */}
          <button
            onClick={handlePull}
            disabled={!repoPath}
            title="Pull"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '3px 6px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
              background: 'var(--theme-bg-tertiary)', border: '1px solid var(--theme-border)',
              color: 'var(--theme-fg-muted)',
              opacity: !repoPath ? 0.4 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--theme-bg-tertiary)'; e.currentTarget.style.color = 'var(--theme-fg-muted)'; }}
          >
            {/* Pull icon: arrow pointing down with line at top */}
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="3" x2="8" y2="12"/>
              <polyline points="4.5,8.5 8,12 11.5,8.5"/>
              <line x1="3" y1="2" x2="13" y2="2"/>
            </svg>
            Pull
          </button>
        </div>
      </div>

      {/* Changes list */}
      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>Loading...</div>
        )}

        {!isLoading && !repoPath && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>
            <p className="mb-2">No repository detected</p>
            <div className="flex gap-1 justify-center">
              <button onClick={async () => {
                const result = await window.api.file.dialogOpen({ properties: ['openDirectory'] });
                if (!result.canceled && result.filePaths.length > 0) setRepoPath(result.filePaths[0]);
              }} className="btn btn-secondary text-xs">Open Repository</button>
            </div>
          </div>
        )}

        {!isLoading && repoPath && status && totalChanges === 0 && (
          <div className="p-4 text-center text-xs" style={{ color: 'var(--theme-fg-muted)' }}>
            <Icon name="check" size={32} style={{ color: 'var(--theme-success)' }} className="mx-auto mb-2" />
            <p>No changes detected</p>
            {status.ahead > 0 && <p className="mt-1" style={{ color: 'var(--theme-warning)' }}>{status.ahead} commit(s) ahead of {status.upstream || 'origin'}</p>}
            {status.behind > 0 && <p className="mt-1" style={{ color: 'var(--theme-warning)' }}>{status.behind} commit(s) behind {status.upstream || 'origin'}</p>}
          </div>
        )}

        {/* Staged changes */}
        {status && status.staged.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--theme-bg-tertiary)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>
                Staged Changes <span style={{ color: 'var(--theme-fg-muted)' }}>({status.staged.length})</span>
              </span>
              <button onClick={handleUnstageAll} className="text-[10px] px-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                title="Unstage All"
              >
                −
              </button>
            </div>
            {status.staged.map((file) => (
              <div key={file.path} className="flex items-center px-4 py-0.5 text-xs group cursor-pointer"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                onClick={() => openFileAtLocation(repoPath + '/' + file.path)}
              >
                <span className="mr-2" style={{ color: file.status === 'added' ? 'var(--theme-success)' : file.status === 'modified' ? 'var(--theme-warning)' : 'var(--theme-error)' }}>
                  {file.status === 'added' ? 'A' : file.status === 'modified' ? 'M' : 'D'}
                </span>
                <span className="truncate flex-1" style={{ color: 'var(--theme-fg)' }}>{file.path.split('/').pop()}</span>
                <button onClick={(e) => { e.stopPropagation(); handleUnstage(file.path); }}
                  className="opacity-0 group-hover:opacity-100 px-1" style={{ color: 'var(--theme-fg-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                  title="Unstage"
                >
                  <Icon name="dash" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Unstaged changes */}
        {status && status.unstaged.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--theme-bg-tertiary)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>
                Changes <span style={{ color: 'var(--theme-fg-muted)' }}>({status.unstaged.length})</span>
              </span>
              <div className="flex gap-1">
                <button onClick={handleStageAll} className="text-[10px] px-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                  title="Stage All"
                >
                  +
                </button>
              </div>
            </div>
            {status.unstaged.map((file) => (
              <div key={file.path} className="flex items-center px-4 py-0.5 text-xs group cursor-pointer"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                onClick={() => openFileAtLocation(repoPath + '/' + file.path)}
              >
                <span className="mr-2" style={{ color: file.status === 'added' ? 'var(--theme-success)' : file.status === 'modified' ? 'var(--theme-warning)' : 'var(--theme-error)' }}>
                  {file.status === 'added' ? 'A' : file.status === 'modified' ? 'M' : 'D'}
                </span>
                <span className="truncate flex-1" style={{ color: 'var(--theme-fg)' }}>{file.path.split('/').pop()}</span>
                <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); handleDiscard(file.path); }}
                    className="px-1" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-error)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Discard Changes"
                  >
                    <Icon name="discard" size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleStage(file.path); }}
                    className="px-1" style={{ color: 'var(--theme-fg-muted)' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                    title="Stage"
                  >
                    <Icon name="add" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Untracked files */}
        {status && status.untracked.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1.5" style={{ background: 'var(--theme-bg-tertiary)' }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--theme-fg)' }}>
                Untracked <span style={{ color: 'var(--theme-fg-muted)' }}>({status.untracked.length})</span>
              </span>
              <button onClick={handleStageAll} className="text-[10px] px-1 rounded" style={{ color: 'var(--theme-fg-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                title="Stage All"
              >
                +
              </button>
            </div>
            {status.untracked.map((file) => (
              <div key={file} className="flex items-center px-4 py-0.5 text-xs group cursor-pointer"
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--theme-bg-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                onClick={() => openFileAtLocation(repoPath + '/' + file)}
              >
                <span className="mr-2" style={{ color: 'var(--theme-success)' }}>U</span>
                <span className="truncate flex-1" style={{ color: 'var(--theme-fg)' }}>{file.split('/').pop()}</span>
                <button onClick={(e) => { e.stopPropagation(); handleStage(file); }}
                  className="opacity-0 group-hover:opacity-100 px-1" style={{ color: 'var(--theme-fg-muted)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--theme-fg-muted)'; }}
                  title="Stage"
                >
                  <Icon name="add" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {repoPath && (
        <div className="px-3 py-1.5 text-[10px]" style={{ borderTop: '1px solid var(--theme-border)', color: 'var(--theme-fg-muted)' }}>
          {currentBranch?.name || 'HEAD'} • {totalChanges} change{totalChanges !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};
