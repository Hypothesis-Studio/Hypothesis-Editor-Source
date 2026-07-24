/**
 * Project Insights - Type Definitions
 * Comprehensive project analysis data structures.
 */

// ── File Statistics ──────────────────────────────────────────────
export interface FileStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;           // bytes
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  largestFile: FileInfo | null;
  newestFile: FileInfo | null;
  oldestFile: FileInfo | null;
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lines: number;
  modifiedAt: string;
  createdAt: string;
}

// ── Language Breakdown ───────────────────────────────────────────
export interface LanguageStat {
  language: string;
  extension: string;
  fileCount: number;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  totalSize: number;
  percentage: number;           // 0-100, percentage of total lines
}

// ── Complexity Metrics ───────────────────────────────────────────
export interface ComplexityMetrics {
  averageFileSize: number;      // lines
  maxFileSize: number;
  averageFunctionLength: number;
  maxFunctionLength: number;
  deeplyNestedFiles: ComplexFile[];
  longFiles: ComplexFile[];
  largeFiles: ComplexFile[];
  overallScore: number;         // 0-100, higher = more complex
}

export interface ComplexFile {
  path: string;
  name: string;
  value: number;
  metric: 'lines' | 'depth' | 'functions' | 'size';
}

// ── Dependency Analysis ──────────────────────────────────────────
export interface DependencyAnalysis {
  totalDependencies: number;
  totalDevDependencies: number;
  outdated: OutdatedDependency[];
  unused: string[];
  missing: string[];
  licenseBreakdown: LicenseInfo[];
  totalSizeEstimate: string;
}

export interface OutdatedDependency {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependency' | 'devDependency';
  severity: 'patch' | 'minor' | 'major';
}

export interface LicenseInfo {
  license: string;
  count: number;
  packages: string[];
}

// ── Security Audit ───────────────────────────────────────────────
export interface SecurityAudit {
  totalVulnerabilities: number;
  critical: SecurityVulnerability[];
  high: SecurityVulnerability[];
  moderate: SecurityVulnerability[];
  low: SecurityVulnerability[];
  info: SecurityVulnerability[];
  lastScanned: string | null;
  scanDuration: number;         // ms
}

export interface SecurityVulnerability {
  name: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
  title: string;
  url: string;
  range: string;
  fixAvailable: boolean | string;
}

// ── Git Health ───────────────────────────────────────────────────
export interface GitHealth {
  isRepo: boolean;
  branch: string;
  totalCommits: number;
  recentCommits: GitCommitSummary[];
  contributors: ContributorStat[];
  uncommittedChanges: number;
  untrackedFiles: number;
  aheadBehind: { ahead: number; behind: number };
  lastCommitDate: string | null;
  stashCount: number;
}

export interface GitCommitSummary {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface ContributorStat {
  name: string;
  email: string;
  commits: number;
  insertions: number;
  deletions: number;
}

// ── Project Health Score ─────────────────────────────────────────
export interface ProjectHealthScore {
  overall: number;              // 0-100
  breakdown: {
    codeQuality: number;
    documentation: number;
    testing: number;
    security: number;
    dependencies: number;
    gitHygiene: number;
  };
  recommendations: HealthRecommendation[];
}

export interface HealthRecommendation {
  id: string;
  category: 'quality' | 'security' | 'dependency' | 'testing' | 'documentation' | 'git';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  action?: string;
}

// ── File Type Distribution (for treemap/chart) ──────────────────
export interface FileTypeDistribution {
  extension: string;
  label: string;
  fileCount: number;
  totalSize: number;
  totalLines: number;
  color: string;
}

// ── Duplicate Detection ──────────────────────────────────────────
export interface DuplicateGroup {
  hash: string;
  files: string[];
  lineCount: number;
  wastedLines: number;
}

export interface DuplicateAnalysis {
  totalDuplicateGroups: number;
  totalWastedLines: number;
  totalWastedBytes: number;
  groups: DuplicateGroup[];
}

// ── Full Insights Result ─────────────────────────────────────────
export interface ProjectInsights {
  projectPath: string;
  projectName: string;
  scannedAt: string;
  scanDuration: number;         // ms
  fileStats: FileStats;
  languages: LanguageStat[];
  complexity: ComplexityMetrics;
  dependencies: DependencyAnalysis;
  security: SecurityAudit;
  git: GitHealth;
  healthScore: ProjectHealthScore;
  fileTypeDistribution: FileTypeDistribution[];
  duplicates: DuplicateAnalysis;
}

// ── Scan Progress ────────────────────────────────────────────────
export interface ScanProgress {
  phase: 'files' | 'languages' | 'complexity' | 'dependencies' | 'security' | 'git' | 'health' | 'duplicates' | 'complete';
  progress: number;             // 0-100
  message: string;
}

// ── IPC Channel Names ────────────────────────────────────────────
export const INSIGHTS_CHANNELS = {
  SCAN_PROJECT: 'insights:scan-project',
  SCAN_PROGRESS: 'insights:scan-progress',
  GET_CACHED: 'insights:get-cached',
  CLEAR_CACHE: 'insights:clear-cache',
  RUN_AUDIT: 'insights:run-audit',
  CHECK_OUTDATED: 'insights:check-outdated',
  FIND_DUPLICATES: 'insights:find-duplicates',
} as const;
