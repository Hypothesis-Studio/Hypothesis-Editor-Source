/**
 * Update IPC Handlers - Check for updates via GitHub Releases API.
 */
import { ipcMain, shell } from 'electron';
import { APP_VERSION } from '../../shared/utils/appMeta';
import { logger } from '../utils/logger';

const GITHUB_OWNER = 'Hypothesis-Studio';
const GITHUB_REPO = 'Hypothesis-Editor';
const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  body: string;
  prerelease: boolean;
  draft: boolean;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

/**
 * Compare semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

export function registerUpdateIPC(): void {
  ipcMain.handle('update:check', async () => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': `${GITHUB_REPO}/${APP_VERSION}`,
          },
        },
      );

      if (!res.ok) {
        // If no "latest" release, try fetching all releases
        if (res.status === 404) {
          const allRes = await fetch(
            `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=5`,
            {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': `${GITHUB_REPO}/${APP_VERSION}`,
              },
            },
          );
          if (!allRes.ok) {
            return { hasUpdate: false, error: `GitHub API error: ${allRes.status}` };
          }
          const releases: GitHubRelease[] = await allRes.json() as GitHubRelease[];
          const stable = releases.find(r => !r.prerelease && !r.draft);
          if (!stable) {
            return { hasUpdate: false, error: 'No releases found' };
          }
          const hasUpdate = compareVersions(stable.tag_name, APP_VERSION) > 0;
          return {
            hasUpdate,
            currentVersion: APP_VERSION,
            latestVersion: stable.tag_name.replace(/^v/, ''),
            releaseUrl: stable.html_url,
            releaseName: stable.name || stable.tag_name,
            publishedAt: stable.published_at,
            releaseNotes: stable.body || '',
            assets: stable.assets.map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
          };
        }
        return { hasUpdate: false, error: `GitHub API error: ${res.status}` };
      }

      const release: GitHubRelease = await res.json() as GitHubRelease;
      const hasUpdate = compareVersions(release.tag_name, APP_VERSION) > 0;

      return {
        hasUpdate,
        currentVersion: APP_VERSION,
        latestVersion: release.tag_name.replace(/^v/, ''),
        releaseUrl: release.html_url,
        releaseName: release.name || release.tag_name,
        publishedAt: release.published_at,
        releaseNotes: release.body || '',
        assets: release.assets.map(a => ({ name: a.name, url: a.browser_download_url, size: a.size })),
      };
    } catch (err) {
      logger.error('Update check failed:', err);
      return { hasUpdate: false, error: (err as Error).message || 'Unknown error' };
    }
  });

  ipcMain.handle('update:openRelease', (_event, url: string) => {
    shell.openExternal(url || RELEASES_URL);
    return true;
  });
}
