/**
 * Utility functions for formatting data in the insights UI.
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}

export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'moderate': return '#f59e0b';
    case 'low': return '#3b82f6';
    case 'info': return '#6b7280';
    case 'major': return '#ef4444';
    case 'minor': return '#f59e0b';
    case 'patch': return '#10b981';
    default: return '#6b7280';
  }
}
