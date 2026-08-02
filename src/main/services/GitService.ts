/**
 * Git Service - Git operations via command execution.
 * Uses child_process to execute git commands directly.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import type { GitStatus, GitBranch, GitCommit } from '../../shared/types';

const execFileAsync = promisify(execFile);

export class GitService {
  private async exec(args: string[], cwd: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });
      return stdout.trim();
    } catch (error: unknown) {
      const err = error as { stderr?: string; message?: string; code?: number };
      const msg = err.stderr || err.message || '';
      if (msg.includes('not a git repository') || err.code === 128) {
        // Not a git repo — return empty so callers can handle gracefully
        return '';
      }
      logger.error(`Git error: ${msg}`);
      throw error;
    }
  }

  async isGitRepo(repoPath: string): Promise<boolean> {
    try {
      const result = await this.exec(['rev-parse', '--is-inside-work-tree'], repoPath);
      return result === 'true';
    } catch {
      return false;
    }
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const status = await this.exec(['status', '--porcelain=v1', '-b'], repoPath);
    const lines = status.split('\n');
    const branchLine = lines[0];
    const branchMatch = branchLine.match(/## (.+?)(?:\.\.\.(.+?))?(?:\s+\[ahead (\d+), behind (\d+)\])?$/);

    const branch = branchMatch?.[1] || 'unknown';
    const upstream = branchMatch?.[2] || null;
    const ahead = parseInt(branchMatch?.[3] || '0', 10);
    const behind = parseInt(branchMatch?.[4] || '0', 10);

    const staged: GitStatus['staged'] = [];
    const unstaged: GitStatus['unstaged'] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.length < 4) continue;

      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3);

      if (indexStatus === '?' && workTreeStatus === '?') {
        untracked.push(filePath);
        continue;
      }

      if (indexStatus === 'U' || workTreeStatus === 'U') {
        conflicted.push(filePath);
        continue;
      }

      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({
          path: filePath,
          status: this.mapStatus(indexStatus),
        });
      }

      if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
        unstaged.push({
          path: filePath,
          status: this.mapStatus(workTreeStatus),
        });
      }
    }

    return { branch, upstream, ahead, behind, staged, unstaged, untracked, conflicted };
  }

  async commit(repoPath: string, message: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      await this.exec(['add', ...files], repoPath);
    }
    return this.exec(['commit', '-m', message], repoPath);
  }

  async push(repoPath: string, remote?: string): Promise<string> {
    return this.exec(['push', remote || 'origin'], repoPath);
  }

  async pull(repoPath: string, remote?: string): Promise<string> {
    return this.exec(['pull', remote || 'origin'], repoPath);
  }

  async fetch(repoPath: string, remote?: string): Promise<string> {
    return this.exec(['fetch', remote || 'origin'], repoPath);
  }

  async clone(url: string, destination: string): Promise<string> {
    return this.exec(['clone', url, destination], process.cwd());
  }

  async getBranches(repoPath: string): Promise<GitBranch[]> {
    const output = await this.exec(['branch', '-a', '-v'], repoPath);
    const branches: GitBranch[] = [];

    for (const line of output.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const current = trimmed.startsWith('*');
      const parts = trimmed.replace(/^\*\s*/, '').split(/\s+/);
      const name = parts[0];
      const isRemote = name.startsWith('remotes/');

      branches.push({
        name: isRemote ? name.replace('remotes/', '') : name,
        current,
        remote: isRemote ? name.split('/')[1] : null,
        upstream: null,
        type: isRemote ? 'remote' : 'local',
      });
    }

    return branches;
  }

  async checkout(repoPath: string, branch: string): Promise<string> {
    return this.exec(['checkout', branch], repoPath);
  }

  async merge(repoPath: string, branch: string): Promise<string> {
    return this.exec(['merge', branch], repoPath);
  }

  async getStagedDiff(repoPath: string): Promise<string> {
    return this.exec(['diff', '--cached', '--unified=3'], repoPath);
  }

  async diff(repoPath: string, file?: string): Promise<string> {
    const args = ['diff'];
    if (file) args.push(file);
    return this.exec(args, repoPath);
  }

  async log(repoPath: string, maxCount: number = 100): Promise<GitCommit[]> {
    const format = '%H|%h|%an|%ae|%ad|%s|%P';
    const output = await this.exec([
      'log',
      `--pretty=format:${format}`,
      `--max-count=${maxCount}`,
      '--date=iso',
    ], repoPath);

    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, shortHash, author, email, date, message, parents] = line.split('|');
      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(date),
        message,
        parents: parents ? parents.split(' ') : [],
      };
    });
  }

  async stash(repoPath: string): Promise<string> {
    return this.exec(['stash'], repoPath);
  }

  async add(repoPath: string, files: string[]): Promise<string> {
    return this.exec(['add', ...files], repoPath);
  }

  async reset(repoPath: string, files?: string[]): Promise<string> {
    if (files && files.length > 0) {
      return this.exec(['reset', 'HEAD', ...files], repoPath);
    }
    return this.exec(['reset'], repoPath);
  }

  async init(repoPath: string): Promise<string> {
    return this.exec(['init'], repoPath);
  }

  async discardFile(repoPath: string, file: string): Promise<string> {
    return this.exec(['checkout', '--', file], repoPath);
  }

  async discardAll(repoPath: string): Promise<string> {
    return this.exec(['checkout', '--', '.'], repoPath);
  }

  private mapStatus(code: string): 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' {
    switch (code) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      case 'C':
        return 'copied';
      default:
        return 'modified';
    }
  }
}
