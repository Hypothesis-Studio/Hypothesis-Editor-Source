/**
 * Git View Component - Source control sidebar panel.
 */
import React, { useState, useEffect, useCallback } from 'react';
import type { GitStatus, GitBranch } from '../../../shared/types';
import { Icon } from '../common/Icon';
import { useEditorStore } from '../../stores/editorStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAppStore } from '../../stores/appStore';
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
  const { openTab } = useEditorStore();
  const settings = useSettingsStore((s) => s.settings);
  const { setStatusMessage } = useAppStore();

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

  // Auto-detect repo from prop
  useEffect(() => {
    if (propRepoPath) setRepoPath(propRepoPath);
  }, [propRepoPath]);

  // Auto-detect git repo on mount
  useEffect(() => {
    if (!repoPath) return;
    const gitEnabled = settings['git.enabled'] !== false;
    if (!gitEnabled) return;
    const check = async () => {
      try {
        const isRepo = await window.api.git.isGitRepo(repoPath);
        if (!isRepo) {
          // Try parent directories
          let path = repoPath;
          for (let i = 0; i < 5; i++) {
            const parent = path.replace(/[\\/][^\\/]+$/, '');
            if (parent === path) break;
            const parentIsRepo = await window.api.git.isGitRepo(parent);
            if (parentIsRepo) { setRepoPath(parent); return; }
            path = parent;
          }
        }
      } catch {}
    };
    check();
  }, [repoPath, settings]);

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

  const handleCommit = async () => {
    if (!repoPath || !commitMessage.trim()) return;
    const smartCommit = settings['git.enableSmartCommit'];
    try {
      // If smart commit is enabled and no staged changes, stage all first
      if (smartCommit && status && status.staged.length === 0) {
        const files = [...status.unstaged.map(f => f.path), ...status.untracked];
        if (files.length > 0) {
          await window.api.git.add(repoPath, files);
        }
      }
      await window.api.git.commit(repoPath, commitMessage);
      setCommitMessage('');
      await loadStatus();
      setStatusMessage('Committed successfully', 'success');
    } catch (error) {
      console.error('Commit failed:', error);
      setStatusMessage('Commit failed', 'error');
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
    try {
      await window.api.git.add(repoPath, [file]);
      await loadStatus();
    } catch (error) {
      console.error('Stage failed:', error);
    }
  };

  const handleUnstage = async (file: string) => {
    if (!repoPath) return;
    try {
      await window.api.git.reset(repoPath, [file]);
      await loadStatus();
    } catch (error) {
      console.error('Unstage failed:', error);
    }
  };

  const handleStageAll = async () => {
    if (!repoPath || !status) return;
    try {
      const files = [...status.unstaged.map(f => f.path), ...status.untracked];
      await window.api.git.add(repoPath, files);
      await loadStatus();
    } catch (error) {
      console.error('Stage all failed:', error);
    }
  };

  const handleUnstageAll = async () => {
    if (!repoPath || !status) return;
    try {
      const files = status.staged.map(f => f.path);
      await window.api.git.reset(repoPath, files);
      await loadStatus();
    } catch (error) {
      console.error('Unstage all failed:', error);
    }
  };

  const handleDiscard = async (file: string) => {
    if (!repoPath) return;
    try {
      await window.api.git.discardFile(repoPath, file);
      await loadStatus();
    } catch (error) {
      console.error('Discard failed:', error);
    }
  };

  const handleDiscardAll = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.discardAll(repoPath);
      await loadStatus();
    } catch (error) {
      console.error('Discard all failed:', error);
    }
  };

  const handleBranchSwitch = async (branchName: string) => {
    if (!repoPath) return;
    try {
      await window.api.git.checkout(repoPath, branchName);
      await loadStatus();
      await loadBranches();
    } catch (error) {
      console.error('Branch switch failed:', error);
    }
  };

  const handleFetch = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.fetch(repoPath);
      await loadStatus();
      await loadBranches();
    } catch (error) {
      console.error('Fetch failed:', error);
    }
  };

  const handleInit = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.init(repoPath);
      await loadStatus();
      await loadBranches();
    } catch (error) {
      console.error('Init failed:', error);
    }
  };

  const handleStash = async () => {
    if (!repoPath) return;
    try {
      await window.api.git.stash(repoPath);
      await loadStatus();
    } catch (error) {
      console.error('Stash failed:', error);
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
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="w-full text-xs rounded px-2 py-1.5 resize-none outline-none"
          style={{ background: 'var(--theme-bg-tertiary)', color: 'var(--theme-fg)', border: '1px solid var(--theme-border-light)', height: 56 }}
        />
        <div className="flex gap-1">
          <button onClick={handleCommit} disabled={!commitMessage.trim() || totalChanges === 0}
            className="btn btn-primary text-xs flex-1"
            style={{ opacity: (!commitMessage.trim() || totalChanges === 0) ? 0.5 : 1 }}
          >
            Commit
          </button>
          <button onClick={handlePush} className="btn btn-secondary text-xs">Push</button>
          <button onClick={handlePull} className="btn btn-secondary text-xs">Pull</button>
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
