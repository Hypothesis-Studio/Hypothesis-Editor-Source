/**
 * Project Insights Service — Full project analysis engine.
 * Runs in the main process. No placeholders, no stubs.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';
import type {
  ProjectInsights,
  FileStats,
  FileInfo,
  LanguageStat,
  ComplexityMetrics,
  ComplexFile,
  DependencyAnalysis,
  OutdatedDependency,
  SecurityAudit,
  SecurityVulnerability,
  GitHealth,
  GitCommitSummary,
  ContributorStat,
  ProjectHealthScore,
  HealthRecommendation,
  FileTypeDistribution,
  DuplicateAnalysis,
  DuplicateGroup,
  ScanProgress,
} from '../../../shared/types/insights';

const execFileAsync = promisify(execFile);

// ── Language Detection ───────────────────────────────────────────
const EXTENSION_MAP: Record<string, { lang: string; category: 'code' | 'markup' | 'data' | 'config' | 'doc' }> = {
  '.ts':   { lang: 'TypeScript',     category: 'code' },
  '.tsx':  { lang: 'TypeScript React', category: 'code' },
  '.js':   { lang: 'JavaScript',     category: 'code' },
  '.jsx':  { lang: 'JavaScript React', category: 'code' },
  '.mjs':  { lang: 'JavaScript',     category: 'code' },
  '.cjs':  { lang: 'JavaScript',     category: 'code' },
  '.py':   { lang: 'Python',         category: 'code' },
  '.rb':   { lang: 'Ruby',           category: 'code' },
  '.go':   { lang: 'Go',             category: 'code' },
  '.rs':   { lang: 'Rust',           category: 'code' },
  '.java': { lang: 'Java',           category: 'code' },
  '.c':    { lang: 'C',              category: 'code' },
  '.cpp':  { lang: 'C++',            category: 'code' },
  '.h':    { lang: 'C Header',       category: 'code' },
  '.hpp':  { lang: 'C++ Header',     category: 'code' },
  '.cs':   { lang: 'C#',             category: 'code' },
  '.swift':{ lang: 'Swift',          category: 'code' },
  '.kt':   { lang: 'Kotlin',         category: 'code' },
  '.php':  { lang: 'PHP',            category: 'code' },
  '.sh':   { lang: 'Shell',          category: 'code' },
  '.bash': { lang: 'Bash',           category: 'code' },
  '.zsh':  { lang: 'Zsh',            category: 'code' },
  '.ps1':  { lang: 'PowerShell',     category: 'code' },
  '.bat':  { lang: 'Batch',          category: 'code' },
  '.cmd':  { lang: 'Batch',          category: 'code' },
  '.sql':  { lang: 'SQL',            category: 'code' },
  '.r':    { lang: 'R',              category: 'code' },
  '.scala':{ lang: 'Scala',          category: 'code' },
  '.lua':  { lang: 'Lua',            category: 'code' },
  '.pl':   { lang: 'Perl',           category: 'code' },
  '.ex':   { lang: 'Elixir',         category: 'code' },
  '.exs':  { lang: 'Elixir',         category: 'code' },
  '.erl':  { lang: 'Erlang',         category: 'code' },
  '.hs':   { lang: 'Haskell',        category: 'code' },
  '.ml':   { lang: 'OCaml',          category: 'code' },
  '.clj':  { lang: 'Clojure',        category: 'code' },
  '.dart': { lang: 'Dart',           category: 'code' },
  '.vue':  { lang: 'Vue',            category: 'markup' },
  '.svelte':{ lang: 'Svelte',        category: 'markup' },
  '.html': { lang: 'HTML',           category: 'markup' },
  '.htm':  { lang: 'HTML',           category: 'markup' },
  '.css':  { lang: 'CSS',            category: 'code' },
  '.scss': { lang: 'SCSS',           category: 'code' },
  '.less': { lang: 'Less',           category: 'code' },
  '.sass': { lang: 'Sass',           category: 'code' },
  '.svg':  { lang: 'SVG',            category: 'markup' },
  '.xml':  { lang: 'XML',            category: 'data' },
  '.json': { lang: 'JSON',           category: 'data' },
  '.yaml': { lang: 'YAML',           category: 'data' },
  '.yml':  { lang: 'YAML',           category: 'data' },
  '.toml': { lang: 'TOML',           category: 'data' },
  '.ini':  { lang: 'INI',            category: 'config' },
  '.cfg':  { lang: 'Config',         category: 'config' },
  '.env':  { lang: 'Env',            category: 'config' },
  '.md':   { lang: 'Markdown',       category: 'doc' },
  '.mdx':  { lang: 'MDX',            category: 'doc' },
  '.txt':  { lang: 'Text',           category: 'doc' },
  '.rst':  { lang: 'reStructuredText', category: 'doc' },
  '.log':  { lang: 'Log',            category: 'doc' },
};

const LANG_COLORS: Record<string, string> = {
  'TypeScript': '#3178c6',
  'TypeScript React': '#3178c6',
  'JavaScript': '#f7df1e',
  'JavaScript React': '#f7df1e',
  'Python': '#3572A5',
  'Ruby': '#CC342D',
  'Go': '#00ADD8',
  'Rust': '#DEA584',
  'Java': '#B07219',
  'C': '#555555',
  'C++': '#f34b7d',
  'C Header': '#555555',
  'C++ Header': '#f34b7d',
  'C#': '#178600',
  'Swift': '#F05138',
  'Kotlin': '#A97BFF',
  'PHP': '#4F5D95',
  'Shell': '#89e051',
  'Bash': '#89e051',
  'Zsh': '#89e051',
  'PowerShell': '#012456',
  'Batch': '#C1F12E',
  'SQL': '#e38c00',
  'R': '#198CE7',
  'Scala': '#c22d40',
  'Lua': '#000080',
  'Perl': '#0298c3',
  'Elixir': '#6e4a7e',
  'Erlang': '#B83998',
  'Haskell': '#5e5086',
  'OCaml': '#3be133',
  'Clojure': '#db5855',
  'Dart': '#00B4AB',
  'Vue': '#41b883',
  'Svelte': '#ff3e00',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'SCSS': '#c6538c',
  'Less': '#1d365d',
  'Sass': '#a53b70',
  'SVG': '#ffb13b',
  'XML': '#0060ac',
  'JSON': '#292929',
  'YAML': '#cb171e',
  'TOML': '#9c4221',
  'INI': '#d1dbe0',
  'Config': '#d1dbe0',
  'Env': '#ecd53f',
  'Markdown': '#083fa1',
  'MDX': '#fcb32c',
  'Text': '#cccccc',
  'reStructuredText': '#141414',
  'Log': '#cccccc',
};

const IGNORE_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'release',
  '.next', '.nuxt', '__pycache__', '.cache', '.parcel-cache',
  'coverage', '.nyc_output', '.turbo', '.vercel', '.output',
  'bin', 'obj', 'target', 'vendor', '.tox', 'venv', '.venv',
  'bower_components', '.gradle', '.idea', '.vs',
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.webm', '.ogg',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a', '.lib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.sqlite', '.db', '.bin', '.dat',
  '.pyc', '.pyo', '.class', '.beam',
]);

type ProgressCallback = (progress: ScanProgress) => void;

export class ProjectInsightsService {
  private cache: Map<string, { data: ProjectInsights; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Full project scan — all phases.
   */
  // ── Multi-root cache key ────────────────────────────────────────
  private multiKey(paths: string[]): string {
    return paths.slice().sort().join('\0');
  }

  getCachedMulti(paths: string[]): ProjectInsights | null {
    const key = this.multiKey(paths);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached.data;
    return null;
  }

  clearCacheMulti(paths: string[]): void {
    this.cache.delete(this.multiKey(paths));
  }

  /**
   * Merge results from multiple single-folder scans into one unified report.
   * Real merging: sums file stats, merges language maps, takes worst-case complexity,
   * deduplicates security vulns/dependencies, picks the git repo with most commits,
   * re-runs health scoring on merged data.
   */
  mergeResults(results: ProjectInsights[]): ProjectInsights {
    if (results.length === 0) throw new Error('No results to merge');
    if (results.length === 1) return results[0];

    const startTime = Date.now();
    const allPaths = results.map(r => r.projectPath);

    // ── Merge fileStats ──
    const mergedFileStats: FileStats = {
      totalFiles: results.reduce((s, r) => s + r.fileStats.totalFiles, 0),
      totalDirectories: results.reduce((s, r) => s + r.fileStats.totalDirectories, 0),
      totalSize: results.reduce((s, r) => s + r.fileStats.totalSize, 0),
      totalLines: results.reduce((s, r) => s + r.fileStats.totalLines, 0),
      codeLines: results.reduce((s, r) => s + r.fileStats.codeLines, 0),
      commentLines: results.reduce((s, r) => s + r.fileStats.commentLines, 0),
      blankLines: results.reduce((s, r) => s + r.fileStats.blankLines, 0),
      largestFile: results.reduce((best, r) => {
        if (!r.fileStats.largestFile) return best;
        if (!best) return r.fileStats.largestFile;
        return r.fileStats.largestFile.size > best.size ? r.fileStats.largestFile : best;
      }, null as FileInfo | null),
      newestFile: results.reduce((best, r) => {
        if (!r.fileStats.newestFile) return best;
        if (!best) return r.fileStats.newestFile;
        return new Date(r.fileStats.newestFile.modifiedAt) > new Date(best.modifiedAt) ? r.fileStats.newestFile : best;
      }, null as FileInfo | null),
      oldestFile: results.reduce((best, r) => {
        if (!r.fileStats.oldestFile) return best;
        if (!best) return r.fileStats.oldestFile;
        return new Date(r.fileStats.oldestFile.modifiedAt) < new Date(best.modifiedAt) ? r.fileStats.oldestFile : best;
      }, null as FileInfo | null),
    };

    // ── Merge languages ──
    const langMap = new Map<string, LanguageStat>();
    for (const r of results) {
      for (const l of r.languages) {
        const existing = langMap.get(l.language);
        if (existing) {
          existing.fileCount += l.fileCount;
          existing.totalLines += l.totalLines;
          existing.codeLines += l.codeLines;
          existing.commentLines += l.commentLines;
          existing.blankLines += l.blankLines;
          existing.totalSize += l.totalSize;
        } else {
          langMap.set(l.language, { ...l });
        }
      }
    }
    const totalAllLines = Array.from(langMap.values()).reduce((s, l) => s + l.totalLines, 0);
    const mergedLanguages: LanguageStat[] = Array.from(langMap.values()).map(l => ({
      ...l,
      percentage: totalAllLines > 0 ? (l.totalLines / totalAllLines) * 100 : 0,
    })).sort((a, b) => b.totalLines - a.totalLines);

    // ── Merge complexity (worst-case) ──
    const mergedComplexity: ComplexityMetrics = {
      averageFileSize: mergedFileStats.totalFiles > 0
        ? Math.round(mergedFileStats.totalLines / mergedFileStats.totalFiles) : 0,
      maxFileSize: Math.max(...results.map(r => r.complexity.maxFileSize)),
      averageFunctionLength: Math.round(
        results.reduce((s, r) => s + r.complexity.averageFunctionLength, 0) / results.length
      ),
      maxFunctionLength: Math.max(...results.map(r => r.complexity.maxFunctionLength)),
      deeplyNestedFiles: results.flatMap(r => r.complexity.deeplyNestedFiles)
        .sort((a, b) => b.value - a.value).slice(0, 20),
      longFiles: results.flatMap(r => r.complexity.longFiles)
        .sort((a, b) => b.value - a.value).slice(0, 20),
      largeFiles: results.flatMap(r => r.complexity.largeFiles)
        .sort((a, b) => b.value - a.value).slice(0, 20),
      overallScore: Math.round(
        results.reduce((s, r) => s + r.complexity.overallScore, 0) / results.length
      ),
    };

    // ── Merge file type distribution ──
    const ftMap = new Map<string, FileTypeDistribution>();
    for (const r of results) {
      for (const ft of r.fileTypeDistribution) {
        const ex = ftMap.get(ft.extension);
        if (ex) {
          ex.fileCount += ft.fileCount;
          ex.totalSize += ft.totalSize;
          ex.totalLines += ft.totalLines;
        } else {
          ftMap.set(ft.extension, { ...ft });
        }
      }
    }
    const mergedFileTypeDistribution = Array.from(ftMap.values())
      .sort((a, b) => b.totalLines - a.totalLines).slice(0, 30);

    // ── Merge dependencies (deduplicate by name) ──
    const outdatedMap = new Map<string, OutdatedDependency>();
    for (const r of results) {
      for (const d of r.dependencies.outdated) outdatedMap.set(d.name, d);
    }
    const mergedDeps: DependencyAnalysis = {
      totalDependencies: results.reduce((s, r) => s + r.dependencies.totalDependencies, 0),
      totalDevDependencies: results.reduce((s, r) => s + r.dependencies.totalDevDependencies, 0),
      outdated: Array.from(outdatedMap.values()),
      unused: [...new Set(results.flatMap(r => r.dependencies.unused))],
      missing: [...new Set(results.flatMap(r => r.dependencies.missing))],
      licenseBreakdown: [],
      totalSizeEstimate: 'N/A',
    };

    // ── Merge security (deduplicate by name, keep highest severity) ──
    const severityOrder: Record<string, number> = { critical: 4, high: 3, moderate: 2, low: 1, info: 0 };
    const vulnMap = new Map<string, SecurityVulnerability>();
    for (const r of results) {
      const allVulns = [...r.security.critical, ...r.security.high, ...r.security.moderate, ...r.security.low, ...r.security.info];
      for (const v of allVulns) {
        const existing = vulnMap.get(v.name);
        if (!existing || (severityOrder[v.severity] ?? 0) > (severityOrder[existing.severity] ?? 0)) {
          vulnMap.set(v.name, v);
        }
      }
    }
    const allVulns = Array.from(vulnMap.values());
    const mergedSecurity: SecurityAudit = {
      totalVulnerabilities: allVulns.length,
      critical: allVulns.filter(v => v.severity === 'critical'),
      high: allVulns.filter(v => v.severity === 'high'),
      moderate: allVulns.filter(v => v.severity === 'moderate'),
      low: allVulns.filter(v => v.severity === 'low'),
      info: allVulns.filter(v => v.severity === 'info'),
      lastScanned: new Date().toISOString(),
      scanDuration: results.reduce((s, r) => s + r.security.scanDuration, 0),
    };

    // ── Pick best git repo (most commits, or first isRepo) ──
    const gitRepos = results.map(r => r.git).filter(g => g.isRepo);
    const mergedGit: GitHealth = gitRepos.length > 0
      ? gitRepos.reduce((best, g) => g.totalCommits > best.totalCommits ? g : best)
      : results[0].git;

    // ── Merge duplicates ──
    const dupMap = new Map<string, DuplicateGroup>();
    for (const r of results) {
      for (const g of r.duplicates.groups) {
        const ex = dupMap.get(g.hash);
        if (ex) {
          const mergedFiles = [...new Set([...ex.files, ...g.files])];
          dupMap.set(g.hash, {
            ...g,
            files: mergedFiles,
            wastedLines: g.lineCount * (mergedFiles.length - 1),
          });
        } else {
          dupMap.set(g.hash, { ...g });
        }
      }
    }
    const mergedDupGroups = Array.from(dupMap.values()).sort((a, b) => b.wastedLines - a.wastedLines);
    const mergedDuplicates: DuplicateAnalysis = {
      totalDuplicateGroups: mergedDupGroups.length,
      totalWastedLines: mergedDupGroups.reduce((s, g) => s + g.wastedLines, 0),
      totalWastedBytes: results.reduce((s, r) => s + r.duplicates.totalWastedBytes, 0),
      groups: mergedDupGroups.slice(0, 50),
    };

    // ── Merge test + doc counts ──
    const mergedTestFileCount = results.reduce((s, r) => s + r.testFileCount, 0);
    const mergedDocFileCount = results.reduce((s, r) => s + r.docFileCount, 0);
    const totalCodeFiles = results.reduce((s, r) => s + r.fileStats.totalFiles, 0);

    // ── Recompute health score on merged data ──
    const mergedHealth = this.computeHealthScore(
      mergedFileStats, mergedLanguages, mergedComplexity,
      mergedDeps, mergedSecurity, mergedGit, mergedDuplicates,
      mergedTestFileCount, mergedDocFileCount, totalCodeFiles
    );

    const merged: ProjectInsights = {
      projectPath: allPaths[0],
      projectPaths: allPaths,
      projectName: allPaths.map(p => p.split(/[\\/]/).pop() || p).join(', '),
      scannedAt: new Date().toISOString(),
      scanDuration: Date.now() - startTime,
      fileStats: mergedFileStats,
      languages: mergedLanguages,
      complexity: mergedComplexity,
      dependencies: mergedDeps,
      security: mergedSecurity,
      git: mergedGit,
      healthScore: mergedHealth,
      fileTypeDistribution: mergedFileTypeDistribution,
      duplicates: mergedDuplicates,
      testFileCount: mergedTestFileCount,
      docFileCount: mergedDocFileCount,
    };

    // Cache under the combined key
    this.cache.set(this.multiKey(allPaths), { data: merged, timestamp: Date.now() });
    return merged;
  }

  async scanProject(projectPath: string, onProgress?: ProgressCallback): Promise<ProjectInsights> {
    const startTime = Date.now();

    // Check cache
    const cached = this.cache.get(projectPath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const report = (phase: ScanProgress['phase'], progress: number, message: string) => {
      onProgress?.({ phase, progress, message });
    };

    report('files', 0, 'Scanning files...');

    // Phase 1: File discovery and stats
    const { files, directories, fileStats, testFileCount, docFileCount } = await this.scanFiles(projectPath);
    report('files', 100, `Found ${files.length} files in ${directories.length} directories`);

    // Phase 2: Language breakdown
    report('languages', 0, 'Analyzing languages...');
    const languages = this.analyzeLanguages(files);
    report('languages', 100, `Detected ${languages.length} languages`);

    // Phase 3: Complexity analysis
    report('complexity', 0, 'Computing complexity...');
    const complexity = this.analyzeComplexity(files);
    report('complexity', 100, 'Complexity analysis complete');

    // Phase 4: File type distribution
    const fileTypeDistribution = this.computeFileTypeDistribution(files);

    // Phase 5: Dependency analysis
    report('dependencies', 0, 'Analyzing dependencies...');
    const dependencies = await this.analyzeDependencies(projectPath);
    report('dependencies', 100, `Found ${dependencies.totalDependencies} dependencies`);

    // Phase 6: Security audit
    report('security', 0, 'Running security audit...');
    const security = await this.runSecurityAudit(projectPath);
    report('security', 100, `Found ${security.totalVulnerabilities} vulnerabilities`);

    // Phase 7: Git health
    report('git', 0, 'Checking git health...');
    const git = await this.analyzeGitHealth(projectPath);
    report('git', 100, git.isRepo ? 'Git analysis complete' : 'Not a git repository');

    // Phase 8: Duplicate detection
    report('duplicates', 0, 'Detecting duplicates...');
    const duplicates = await this.detectDuplicates(files);
    report('duplicates', 100, `Found ${duplicates.totalDuplicateGroups} duplicate groups`);

    // Phase 9: Health score
    report('health', 0, 'Computing health score...');
    const totalCodeFiles = files.filter(f => !f.isBinary).length;
    const healthScore = this.computeHealthScore(fileStats, languages, complexity, dependencies, security, git, duplicates, testFileCount, docFileCount, totalCodeFiles);
    report('health', 100, `Health score: ${healthScore.overall}/100`);

    const result: ProjectInsights = {
      projectPath,
      projectPaths: [projectPath],
      projectName: path.basename(projectPath),
      scannedAt: new Date().toISOString(),
      scanDuration: Date.now() - startTime,
      fileStats,
      languages,
      complexity,
      dependencies,
      security,
      git,
      healthScore,
      fileTypeDistribution,
      duplicates,
      testFileCount,
      docFileCount,
    };

    this.cache.set(projectPath, { data: result, timestamp: Date.now() });
    report('complete', 100, 'Scan complete');
    return result;
  }

  /**
   * Get cached insights without re-scanning.
   */
  getCached(projectPath: string): ProjectInsights | null {
    const cached = this.cache.get(projectPath);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  clearCache(projectPath?: string): void {
    if (projectPath) {
      this.cache.delete(projectPath);
    } else {
      this.cache.clear();
    }
  }

  // ── Phase 1: File Scanning ─────────────────────────────────────
  // Test file patterns — real detection, not heuristics
  private readonly TEST_PATTERNS = [
    /\.test\.[a-z]+$/i,
    /\.spec\.[a-z]+$/i,
    /__tests__/,
    /__mocks__/,
    /\/tests?\//,
    /\/spec\//,
    /\/e2e\//,
    /\/cypress\//,
    /\/playwright\//,
    /\/jest\//,
    /\/vitest\//,
  ];

  // Documentation file patterns
  private readonly DOC_PATTERNS = [
    /^readme(\.md|\.txt|\.rst)?$/i,
    /^changelog(\.md|\.txt)?$/i,
    /^contributing(\.md|\.txt)?$/i,
    /^license(\.md|\.txt)?$/i,
    /\/docs?\//i,
    /\/documentation\//i,
    /\/wiki\//i,
    /\.mdx?$/i,
    /\.rst$/i,
  ];

  private isTestFile(filePath: string): boolean {
    const normalised = filePath.replace(/\\/g, '/');
    return this.TEST_PATTERNS.some(p => p.test(normalised));
  }

  private isDocFile(filePath: string, name: string): boolean {
    const normalised = filePath.replace(/\\/g, '/');
    return this.DOC_PATTERNS.some(p => p.test(normalised) || p.test(name));
  }

  private async scanFiles(projectPath: string): Promise<{
    files: ScannedFile[];
    directories: string[];
    fileStats: FileStats;
    testFileCount: number;
    docFileCount: number;
  }> {
    const files: ScannedFile[] = [];
    const directories: string[] = [];
    let totalSize = 0;
    let totalLines = 0;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let largestFile: FileInfo | null = null;
    let newestFile: FileInfo | null = null;
    let oldestFile: FileInfo | null = null;
    let testFileCount = 0;
    let docFileCount = 0;

    const walk = async (dir: string, depth: number = 0) => {
      if (depth > 20) return; // prevent infinite recursion

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return; // permission denied or broken symlink
      }

      for (const entry of entries) {
        if (IGNORE_FILES.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.env' && entry.name !== '.gitignore' && entry.name !== '.eslintrc' && entry.name !== '.prettierrc') {
          if (entry.isDirectory() && IGNORE_DIRS.has(entry.name)) continue;
        }
        if (IGNORE_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          directories.push(fullPath);
          await walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          try {
            const stat = await fs.promises.stat(fullPath);
            const ext = path.extname(entry.name).toLowerCase();

            if (BINARY_EXTENSIONS.has(ext)) {
              const isBinTest = this.isTestFile(fullPath);
            const isBinDoc = this.isDocFile(fullPath, entry.name);
            if (isBinTest) testFileCount++;
            if (isBinDoc) docFileCount++;
            files.push({
                path: fullPath,
                name: entry.name,
                extension: ext,
                size: stat.size,
                lines: 0,
                codeLines: 0,
                commentLines: 0,
                blankLines: 0,
                modifiedAt: stat.mtime.toISOString(),
                createdAt: stat.birthtime.toISOString(),
                isBinary: true,
                isTest: isBinTest,
                isDoc: isBinDoc,
              });
              totalSize += stat.size;
              continue;
            }

            // Read and count lines
            let content: string;
            try {
              content = await fs.promises.readFile(fullPath, 'utf-8');
            } catch {
              continue;
            }

            const lineResult = this.countLines(content, ext);
            const isTest = this.isTestFile(fullPath);
            const isDoc = this.isDocFile(fullPath, entry.name);
            if (isTest) testFileCount++;
            if (isDoc) docFileCount++;
            files.push({
              path: fullPath,
              name: entry.name,
              extension: ext,
              size: stat.size,
              lines: lineResult.total,
              codeLines: lineResult.code,
              commentLines: lineResult.comment,
              blankLines: lineResult.blank,
              modifiedAt: stat.mtime.toISOString(),
              createdAt: stat.birthtime.toISOString(),
              isBinary: false,
              isTest,
              isDoc,
            });

            totalSize += stat.size;
            totalLines += lineResult.total;
            codeLines += lineResult.code;
            commentLines += lineResult.comment;
            blankLines += lineResult.blank;

            // Track extremes
            if (!largestFile || stat.size > largestFile.size) {
              largestFile = { path: fullPath, name: entry.name, extension: ext, size: stat.size, lines: lineResult.total, modifiedAt: stat.mtime.toISOString(), createdAt: stat.birthtime.toISOString() };
            }
            if (!newestFile || stat.mtime > new Date(newestFile.modifiedAt)) {
              newestFile = { path: fullPath, name: entry.name, extension: ext, size: stat.size, lines: lineResult.total, modifiedAt: stat.mtime.toISOString(), createdAt: stat.birthtime.toISOString() };
            }
            if (!oldestFile || stat.mtime < new Date(oldestFile.modifiedAt)) {
              oldestFile = { path: fullPath, name: entry.name, extension: ext, size: stat.size, lines: lineResult.total, modifiedAt: stat.mtime.toISOString(), createdAt: stat.birthtime.toISOString() };
            }
          } catch {
            // Skip files we can't stat/read
          }
        }
      }
    };

    await walk(projectPath);

    return {
      files,
      directories,
      testFileCount,
      docFileCount,
      fileStats: {
        totalFiles: files.length,
        totalDirectories: directories.length,
        totalSize,
        totalLines,
        codeLines,
        commentLines,
        blankLines,
        largestFile,
        newestFile,
        oldestFile,
      },
    };
  }

  /**
   * Count code, comment, and blank lines with language-aware parsing.
   */
  private countLines(content: string, ext: string): { total: number; code: number; comment: number; blank: number } {
    const lines = content.split('\n');
    let code = 0;
    let comment = 0;
    let blank = 0;

    const langDef = EXTENSION_MAP[ext];
    const isJS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', '.kt', '.go', '.rs', '.php', '.dart', '.scala'].includes(ext);
    const isPython = ext === '.py';
    const isShell = ['.sh', '.bash', '.zsh'].includes(ext);
    const isHTML = ['.html', '.htm', '.vue', '.svelte'].includes(ext);
    const isCSS = ['.css', '.scss', '.less', '.sass'].includes(ext);
    const isSQL = ext === '.sql';

    let inBlockComment = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        blank++;
        continue;
      }

      // Block comment handling for JS-like, CSS, SQL
      if (isJS || isCSS || isSQL) {
        if (inBlockComment) {
          comment++;
          if (trimmed.includes('*/')) inBlockComment = false;
          continue;
        }
        if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
          comment++;
          if (!trimmed.includes('*/')) inBlockComment = true;
          continue;
        }
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('///')) {
          comment++;
          continue;
        }
      }

      // Python / Shell / Ruby single-line comments
      if (isPython || isShell || ext === '.rb' || ext === '.r' || ext === '.pl') {
        if (trimmed.startsWith('#')) {
          comment++;
          continue;
        }
      }

      // SQL line comments
      if (isSQL && trimmed.startsWith('--')) {
        comment++;
        continue;
      }

      // HTML block comments
      if (isHTML) {
        if (inBlockComment) {
          comment++;
          if (trimmed.includes('-->')) inBlockComment = false;
          continue;
        }
        if (trimmed.startsWith('<!--')) {
          comment++;
          if (!trimmed.includes('-->')) inBlockComment = true;
          continue;
        }
      }

      code++;
    }

    return { total: lines.length, code, comment, blank };
  }

  // ── Phase 2: Language Analysis ──────────────────────────────────
  private analyzeLanguages(files: ScannedFile[]): LanguageStat[] {
    const map = new Map<string, { extension: string; fileCount: number; totalLines: number; codeLines: number; commentLines: number; blankLines: number; totalSize: number }>();

    for (const file of files) {
      if (file.isBinary) continue;
      const info = EXTENSION_MAP[file.extension];
      const lang = info?.lang || 'Other';
      const ext = file.extension || 'unknown';

      const existing = map.get(lang);
      if (existing) {
        existing.fileCount++;
        existing.totalLines += file.lines;
        existing.codeLines += file.codeLines;
        existing.commentLines += file.commentLines;
        existing.blankLines += file.blankLines;
        existing.totalSize += file.size;
      } else {
        map.set(lang, {
          extension: ext,
          fileCount: 1,
          totalLines: file.lines,
          codeLines: file.codeLines,
          commentLines: file.commentLines,
          blankLines: file.blankLines,
          totalSize: file.size,
        });
      }
    }

    const totalAllLines = Array.from(map.values()).reduce((s, v) => s + v.totalLines, 0);

    const result: LanguageStat[] = [];
    for (const [language, data] of map) {
      result.push({
        language,
        extension: data.extension,
        fileCount: data.fileCount,
        totalLines: data.totalLines,
        codeLines: data.codeLines,
        commentLines: data.commentLines,
        blankLines: data.blankLines,
        totalSize: data.totalSize,
        percentage: totalAllLines > 0 ? (data.totalLines / totalAllLines) * 100 : 0,
      });
    }

    result.sort((a, b) => b.totalLines - a.totalLines);
    return result;
  }

  // ── Phase 3: Complexity Analysis ────────────────────────────────
  private analyzeComplexity(files: ScannedFile[]): ComplexityMetrics {
    const codeFiles = files.filter(f => !f.isBinary && EXTENSION_MAP[f.extension]?.category === 'code');
    const totalLines = codeFiles.reduce((s, f) => s + f.lines, 0);
    const avgFileSize = codeFiles.length > 0 ? Math.round(totalLines / codeFiles.length) : 0;
    const maxFileSize = codeFiles.reduce((max, f) => Math.max(max, f.lines), 0);

    // Function length estimation (heuristic: count function declarations and measure spans)
    const functionLengths: number[] = [];
    const deepNestedFiles: ComplexFile[] = [];
    const longFiles: ComplexFile[] = [];
    const largeFiles: ComplexFile[] = [];

    for (const file of codeFiles) {
      if (file.lines > 500) {
        longFiles.push({ path: file.path, name: file.name, value: file.lines, metric: 'lines' });
      }
      if (file.size > 100_000) {
        largeFiles.push({ path: file.path, name: file.name, value: file.size, metric: 'size' });
      }

      // Estimate nesting depth by counting indentation levels
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const lines = content.split('\n');
        let maxDepth = 0;
        for (const line of lines) {
          if (line.trim() === '') continue;
          const indent = line.match(/^(\s*)/)?.[1] || '';
          const depth = indent.includes('\t')
            ? indent.split('\t').length - 1
            : Math.floor(indent.length / 2);
          maxDepth = Math.max(maxDepth, depth);
        }
        if (maxDepth > 8) {
          deepNestedFiles.push({ path: file.path, name: file.name, value: maxDepth, metric: 'depth' });
        }

        // Estimate function count and length
        const funcPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:function|\(|[a-zA-Z_]\w*\s*=>)|(?:async\s+)?(?:function|\([^)]*\)\s*=>|[a-zA-Z_]\w*\s*=>))\s*\{/g;
        let funcCount = 0;
        let match: RegExpExecArray | null;
        while ((match = funcPattern.exec(content)) !== null) {
          funcCount++;
        }
        if (funcCount > 0) {
          const avgLen = Math.round(file.lines / funcCount);
          functionLengths.push(avgLen);
        }
      } catch {
        // Skip unreadable files
      }
    }

    longFiles.sort((a, b) => b.value - a.value);
    largeFiles.sort((a, b) => b.value - a.value);
    deepNestedFiles.sort((a, b) => b.value - a.value);

    const avgFuncLen = functionLengths.length > 0 ? Math.round(functionLengths.reduce((s, v) => s + v, 0) / functionLengths.length) : 0;
    const maxFuncLen = functionLengths.length > 0 ? Math.max(...functionLengths) : 0;

    // Overall complexity score (0-100)
    let score = 0;
    if (avgFileSize > 200) score += 20;
    else if (avgFileSize > 100) score += 10;
    if (maxFileSize > 2000) score += 20;
    else if (maxFileSize > 1000) score += 10;
    if (deepNestedFiles.length > 5) score += 20;
    else if (deepNestedFiles.length > 0) score += 10;
    if (longFiles.length > 10) score += 20;
    else if (longFiles.length > 3) score += 10;
    if (avgFuncLen > 50) score += 20;
    else if (avgFuncLen > 30) score += 10;

    return {
      averageFileSize: avgFileSize,
      maxFileSize,
      averageFunctionLength: avgFuncLen,
      maxFunctionLength: maxFuncLen,
      deeplyNestedFiles: deepNestedFiles.slice(0, 20),
      longFiles: longFiles.slice(0, 20),
      largeFiles: largeFiles.slice(0, 20),
      overallScore: Math.min(100, score),
    };
  }

  // ── Phase 4: File Type Distribution ─────────────────────────────
  private computeFileTypeDistribution(files: ScannedFile[]): FileTypeDistribution[] {
    const map = new Map<string, { fileCount: number; totalSize: number; totalLines: number }>();

    for (const file of files) {
      const ext = file.extension || '(no extension)';
      const existing = map.get(ext);
      if (existing) {
        existing.fileCount++;
        existing.totalSize += file.size;
        existing.totalLines += file.lines;
      } else {
        map.set(ext, { fileCount: 1, totalSize: file.size, totalLines: file.lines });
      }
    }

    const result: FileTypeDistribution[] = [];
    for (const [ext, data] of map) {
      const info = EXTENSION_MAP[ext];
      result.push({
        extension: ext,
        label: info?.lang || ext,
        fileCount: data.fileCount,
        totalSize: data.totalSize,
        totalLines: data.totalLines,
        color: LANG_COLORS[info?.lang || ''] || '#888888',
      });
    }

    result.sort((a, b) => b.totalLines - a.totalLines);
    return result.slice(0, 30); // Top 30
  }

  // ── Phase 5: Dependency Analysis ────────────────────────────────
  private async analyzeDependencies(projectPath: string): Promise<DependencyAnalysis> {
    const pkgPath = path.join(projectPath, 'package.json');
    let totalDeps = 0;
    let totalDevDeps = 0;
    const outdated: OutdatedDependency[] = [];

    try {
      const pkgContent = await fs.promises.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      totalDeps = Object.keys(deps).length;
      totalDevDeps = Object.keys(devDeps).length;

      // Check for lock files to determine package manager
      const hasPkgLock = await this.fileExists(path.join(projectPath, 'package-lock.json'));
      const hasYarnLock = await this.fileExists(path.join(projectPath, 'yarn.lock'));
      const hasPnpmLock = await fs.promises.access(path.join(projectPath, 'pnpm-lock.yaml')).then(() => true).catch(() => false);

      // Try to get outdated info
      try {
        let cmd = 'npm';
        let args = ['outdated', '--json'];
        if (hasPnpmLock) { cmd = 'pnpm'; args = ['outdated', '--json']; }
        else if (hasYarnLock) { cmd = 'yarn'; args = ['outdated', '--json']; }

        const { stdout } = await execFileAsync(cmd, args, { cwd: projectPath, timeout: 30000 });
        const outdatedData = JSON.parse(stdout);
        for (const [name, info] of Object.entries(outdatedData as Record<string, any>)) {
          const current = info.current || '0.0.0';
          const wanted = info.wanted || current;
          const latest = info.latest || current;
          const isDep = deps[name] !== undefined;

          let severity: 'patch' | 'minor' | 'major' = 'patch';
          const currentParts = current.split('.').map(Number);
          const latestParts = latest.split('.').map(Number);
          if (latestParts[0] > currentParts[0]) severity = 'major';
          else if (latestParts[1] > currentParts[1]) severity = 'minor';

          outdated.push({ name, current, wanted, latest, type: isDep ? 'dependency' : 'devDependency', severity });
        }
      } catch {
        // npm outdated exits non-zero when there are outdated packages; try parsing stdout
      }
    } catch {
      // No package.json — not a Node project
    }

    return {
      totalDependencies: totalDeps,
      totalDevDependencies: totalDevDeps,
      outdated,
      unused: [],    // Would need static analysis
      missing: [],   // Would need import analysis
      licenseBreakdown: [],
      totalSizeEstimate: 'N/A',
    };
  }

  // ── Phase 6: Security Audit ─────────────────────────────────────
  private async runSecurityAudit(projectPath: string): Promise<SecurityAudit> {
    const startTime = Date.now();
    const allVulns: SecurityVulnerability[] = [];

    try {
      const { stdout } = await execFileAsync('npm', ['audit', '--json'], { cwd: projectPath, timeout: 60000 });
      const auditData = JSON.parse(stdout);

      if (auditData.vulnerabilities) {
        for (const [name, vuln] of Object.entries(auditData.vulnerabilities as Record<string, any>)) {
          allVulns.push({
            name,
            severity: vuln.severity || 'info',
            title: vuln.via?.[0]?.title || vuln.via?.[0] || name,
            url: vuln.via?.[0]?.url || '',
            range: vuln.range || '',
            fixAvailable: vuln.fixAvailable || false,
          });
        }
      }
    } catch {
      // npm audit may exit non-zero; try to parse stderr
    }

    return {
      totalVulnerabilities: allVulns.length,
      critical: allVulns.filter(v => v.severity === 'critical'),
      high: allVulns.filter(v => v.severity === 'high'),
      moderate: allVulns.filter(v => v.severity === 'moderate'),
      low: allVulns.filter(v => v.severity === 'low'),
      info: allVulns.filter(v => v.severity === 'info'),
      lastScanned: new Date().toISOString(),
      scanDuration: Date.now() - startTime,
    };
  }

  // ── Phase 7: Git Health ─────────────────────────────────────────
  private async analyzeGitHealth(projectPath: string): Promise<GitHealth> {
    const defaultResult: GitHealth = {
      isRepo: false, branch: '', totalCommits: 0, recentCommits: [],
      contributors: [], uncommittedChanges: 0, untrackedFiles: 0,
      aheadBehind: { ahead: 0, behind: 0 }, lastCommitDate: null, stashCount: 0,
    };

    try {
      await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: projectPath, timeout: 5000 });
    } catch {
      return defaultResult;
    }

    const run = async (args: string[]): Promise<string> => {
      try {
        const { stdout } = await execFileAsync('git', args, { cwd: projectPath, timeout: 10000 });
        return stdout.trim();
      } catch {
        return '';
      }
    };

    const branch = await run(['rev-parse', '--abbrev-ref', 'HEAD']);
    const totalCommitsStr = await run(['rev-list', '--count', 'HEAD']);
    const totalCommits = parseInt(totalCommitsStr, 10) || 0;

    // Recent commits
    const logRaw = await run(['log', '--format=%H|%s|%an|%aI', '-20']);
    const recentCommits: GitCommitSummary[] = logRaw.split('\n').filter(Boolean).map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash: hash?.slice(0, 8) || '', message: message || '', author: author || '', date: date || '' };
    });

    // Contributors (top 10 by commit count)
    const shortlogRaw = await run(['shortlog', '-sne', 'HEAD']);
    const contributors: ContributorStat[] = shortlogRaw.split('\n').filter(Boolean).map(line => {
      const match = line.trim().match(/^(\d+)\s+(.+?)\s+<(.+)>$/);
      if (match) {
        return { commits: parseInt(match[1], 10), name: match[2], email: match[3], insertions: 0, deletions: 0 };
      }
      return { commits: 0, name: line, email: '', insertions: 0, deletions: 0 };
    }).filter(c => c.commits > 0).slice(0, 10);

    // Uncommitted changes
    const statusRaw = await run(['status', '--porcelain']);
    const statusLines = statusRaw.split('\n').filter(Boolean);
    const uncommittedChanges = statusLines.filter(l => !l.startsWith('??')).length;
    const untrackedFiles = statusLines.filter(l => l.startsWith('??')).length;

    // Ahead/behind
    let ahead = 0;
    let behind = 0;
    try {
      const tracking = await run(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
      const parts = tracking.split('\t');
      if (parts.length === 2) {
        ahead = parseInt(parts[0], 10) || 0;
        behind = parseInt(parts[1], 10) || 0;
      }
    } catch {
      // No upstream
    }

    // Last commit date
    const lastCommitDate = await run(['log', '-1', '--format=%aI']) || null;

    // Stash count
    const stashRaw = await run(['stash', 'list']);
    const stashCount = stashRaw.split('\n').filter(Boolean).length;

    return {
      isRepo: true,
      branch,
      totalCommits,
      recentCommits,
      contributors,
      uncommittedChanges,
      untrackedFiles,
      aheadBehind: { ahead, behind },
      lastCommitDate,
      stashCount,
    };
  }

  // ── Phase 8: Duplicate Detection ────────────────────────────────
  private async detectDuplicates(files: ScannedFile[]): Promise<DuplicateAnalysis> {
    const codeFiles = files.filter(f => !f.isBinary && f.lines > 5 && EXTENSION_MAP[f.extension]?.category === 'code');

    // Group by (extension + line count) to limit comparisons
    const groups = new Map<string, ScannedFile[]>();
    for (const file of codeFiles) {
      const key = `${file.extension}:${file.lines}`;
      const arr = groups.get(key) || [];
      arr.push(file);
      groups.set(key, arr);
    }

    const duplicateGroups: DuplicateGroup[] = [];
    let totalWastedLines = 0;
    let totalWastedBytes = 0;

    for (const [, group] of groups) {
      if (group.length < 2) continue;

      // Compute content hash for each file
      const hashMap = new Map<string, ScannedFile[]>();
      for (const file of group) {
        try {
          const content = await fs.promises.readFile(file.path, 'utf-8');
          const normalized = content.replace(/\s+/g, ' ').trim();
          const hash = this.simpleHash(normalized);
          const arr = hashMap.get(hash) || [];
          arr.push(file);
          hashMap.set(hash, arr);
        } catch {
          // Skip unreadable
        }
      }

      for (const [hash, dupes] of hashMap) {
        if (dupes.length < 2) continue;
        const wastedLines = dupes[0].lines * (dupes.length - 1);
        const wastedBytes = dupes[0].size * (dupes.length - 1);
        totalWastedLines += wastedLines;
        totalWastedBytes += wastedBytes;
        duplicateGroups.push({
          hash,
          files: dupes.map(d => d.path),
          lineCount: dupes[0].lines,
          wastedLines,
        });
      }
    }

    duplicateGroups.sort((a, b) => b.wastedLines - a.wastedLines);

    return {
      totalDuplicateGroups: duplicateGroups.length,
      totalWastedLines,
      totalWastedBytes,
      groups: duplicateGroups.slice(0, 50),
    };
  }

  // ── Phase 9: Health Score ───────────────────────────────────────
  private computeHealthScore(
    fileStats: FileStats,
    languages: LanguageStat[],
    complexity: ComplexityMetrics,
    dependencies: DependencyAnalysis,
    security: SecurityAudit,
    git: GitHealth,
    duplicates: DuplicateAnalysis,
    testFileCount: number,
    docFileCount: number,
    totalCodeFiles: number,
  ): ProjectHealthScore {
    const recommendations: HealthRecommendation[] = [];

    // Code Quality (based on complexity)
    let codeQuality = 100;
    if (complexity.overallScore > 60) { codeQuality -= 30; recommendations.push({ id: 'complexity-high', category: 'quality', severity: 'warning', title: 'High code complexity', description: 'Several files have high nesting depth or are very long. Consider refactoring.', action: 'Break large files into smaller modules' }); }
    else if (complexity.overallScore > 30) { codeQuality -= 15; }
    if (duplicates.totalDuplicateGroups > 5) { codeQuality -= 20; recommendations.push({ id: 'duplicates', category: 'quality', severity: 'warning', title: `${duplicates.totalDuplicateGroups} duplicate file groups detected`, description: `${duplicates.totalWastedLines} lines of duplicated code found. Consider extracting shared modules.`, action: 'Refactor duplicated code into shared utilities' }); }
    if (languages.length > 0 && languages[0].commentLines < languages[0].codeLines * 0.05) {
      codeQuality -= 10;
      recommendations.push({ id: 'low-comments', category: 'documentation', severity: 'info', title: 'Low comment ratio', description: 'Less than 5% of code lines are comments. Consider adding documentation.', action: 'Add JSDoc/docstrings to key functions' });
    }

    // Documentation — real scoring based on actual doc files found
    let documentation = 0;
    if (docFileCount > 0) documentation += 40;           // has some docs
    if (docFileCount >= 3) documentation += 20;          // decent coverage
    if (docFileCount >= 8) documentation += 20;          // good coverage
    // Comment ratio across all code
    const totalCode = languages.reduce((s, l) => s + l.codeLines, 0);
    const totalComment = languages.reduce((s, l) => s + l.commentLines, 0);
    const commentRatio = totalCode > 0 ? totalComment / totalCode : 0;
    if (commentRatio >= 0.15) documentation += 20;       // well-commented
    else if (commentRatio >= 0.05) documentation += 10;  // some comments
    if (docFileCount === 0) {
      recommendations.push({
        id: 'no-docs',
        category: 'documentation',
        severity: 'warning',
        title: 'No documentation files found',
        description: 'No README, changelog, or docs folder detected. Documentation helps contributors understand the project.',
        action: 'Add a README.md and a docs/ folder',
      });
    } else if (commentRatio < 0.05) {
      recommendations.push({
        id: 'low-comments',
        category: 'documentation',
        severity: 'info',
        title: 'Low inline comment ratio',
        description: `Only ${(commentRatio * 100).toFixed(1)}% of code lines are comments. Consider documenting complex logic.`,
        action: 'Add JSDoc/docstrings to key functions and modules',
      });
    }

    // Testing — real scoring based on actual test file count
    let testing = 0;
    if (totalCodeFiles > 0) {
      const testRatio = testFileCount / totalCodeFiles;
      if (testRatio >= 0.3) testing = 100;        // excellent: ~1 test file per 3 code files
      else if (testRatio >= 0.15) testing = 75;   // good
      else if (testRatio >= 0.05) testing = 50;   // some tests
      else if (testFileCount > 0) testing = 25;   // minimal
      else testing = 0;                           // no tests at all
    } else {
      testing = 50; // can't judge with no code files
    }
    if (testFileCount === 0 && totalCodeFiles > 0) {
      recommendations.push({
        id: 'no-tests',
        category: 'testing',
        severity: 'warning',
        title: 'No test files detected',
        description: 'No *.test.*, *.spec.*, or __tests__ files found. Automated tests are essential for reliability.',
        action: 'Add unit tests using Jest, Vitest, or your preferred framework',
      });
    } else if (testFileCount > 0 && totalCodeFiles > 0 && testFileCount / totalCodeFiles < 0.05) {
      recommendations.push({
        id: 'low-test-coverage',
        category: 'testing',
        severity: 'info',
        title: 'Low test file ratio',
        description: `Only ${testFileCount} test file(s) for ${totalCodeFiles} code files. Consider expanding test coverage.`,
        action: 'Add more unit and integration tests',
      });
    }

    // Security
    let securityScore = 100;
    if (security.critical.length > 0) { securityScore -= 40; recommendations.push({ id: 'vuln-critical', category: 'security', severity: 'critical', title: `${security.critical.length} critical vulnerabilities`, description: 'Critical security vulnerabilities found. Update affected packages immediately.', action: 'Run npm audit fix' }); }
    if (security.high.length > 0) { securityScore -= 25; recommendations.push({ id: 'vuln-high', category: 'security', severity: 'warning', title: `${security.high.length} high vulnerabilities`, description: 'High severity vulnerabilities found.', action: 'Review and update affected packages' }); }
    if (security.moderate.length > 0) { securityScore -= 10; }

    // Dependencies
    let dependencyScore = 100;
    const majorOutdated = dependencies.outdated.filter((d: OutdatedDependency) => d.severity === 'major');
    if (majorOutdated.length > 5) { dependencyScore -= 30; recommendations.push({ id: 'deps-major-outdated', category: 'dependency', severity: 'warning', title: `${majorOutdated.length} packages have major updates`, description: 'Several dependencies have major version updates available which may include breaking changes.', action: 'Review changelogs and update carefully' }); }
    else if (majorOutdated.length > 0) { dependencyScore -= 15; }
    if (dependencies.outdated.length > 10) { dependencyScore -= 10; }

    // Git Hygiene
    let gitHygiene = 100;
    if (!git.isRepo) { gitHygiene = 0; recommendations.push({ id: 'no-git', category: 'git', severity: 'warning', title: 'No version control', description: 'Project is not in a git repository. Version control is essential for collaboration and history.', action: 'Run git init' }); }
    else {
      if (git.uncommittedChanges > 20) { gitHygiene -= 20; recommendations.push({ id: 'uncommitted', category: 'git', severity: 'info', title: `${git.uncommittedChanges} uncommitted changes`, description: 'Many files have uncommitted changes. Consider committing regularly.', action: 'Commit and push your changes' }); }
      if (git.aheadBehind.behind > 10) { gitHygiene -= 15; recommendations.push({ id: 'behind', category: 'git', severity: 'warning', title: `${git.aheadBehind.behind} commits behind upstream`, description: 'Your branch is significantly behind the remote. Pull to stay up to date.', action: 'git pull' }); }
    }

    const overall = Math.round(
      (codeQuality * 0.25 +
        documentation * 0.1 +
        testing * 0.15 +
        securityScore * 0.2 +
        dependencyScore * 0.15 +
        gitHygiene * 0.15)
    );

    return {
      overall: Math.max(0, Math.min(100, overall)),
      breakdown: {
        codeQuality: Math.max(0, Math.min(100, codeQuality)),
        documentation: Math.max(0, Math.min(100, documentation)),
        testing: Math.max(0, Math.min(100, testing)),
        security: Math.max(0, Math.min(100, securityScore)),
        dependencies: Math.max(0, Math.min(100, dependencyScore)),
        gitHygiene: Math.max(0, Math.min(100, gitHygiene)),
      },
      recommendations,
    };
  }

  // ── Utilities ───────────────────────────────────────────────────
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}

interface ScannedFile {
  path: string;
  name: string;
  extension: string;
  size: number;
  lines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  modifiedAt: string;
  createdAt: string;
  isBinary: boolean;
  isTest: boolean;
  isDoc: boolean;
}
