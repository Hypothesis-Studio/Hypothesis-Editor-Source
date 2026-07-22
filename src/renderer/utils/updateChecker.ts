/**
 * Update Checker — fetches latest release from GitHub and compares with current version.
 */

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  publishedAt: string;
  releaseNotes: string;
  assets: Array<{ name: string; url: string; size: number }>;
  error?: string;
}

/**
 * Check for updates via the main process (GitHub Releases API).
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const result = await (window as any).api?.update?.check?.();
    if (!result) {
      return {
        hasUpdate: false,
        currentVersion: '',
        latestVersion: '',
        releaseUrl: '',
        releaseName: '',
        publishedAt: '',
        releaseNotes: '',
        assets: [],
        error: 'Update API not available',
      };
    }
    return result;
  } catch (err) {
    return {
      hasUpdate: false,
      currentVersion: '',
      latestVersion: '',
      releaseUrl: '',
      releaseName: '',
      publishedAt: '',
      releaseNotes: '',
      assets: [],
      error: (err as Error).message || 'Unknown error',
    };
  }
}

/**
 * Open release page in external browser.
 */
export function openReleaseUrl(url: string): void {
  (window as any).api?.update?.openRelease?.(url);
}
