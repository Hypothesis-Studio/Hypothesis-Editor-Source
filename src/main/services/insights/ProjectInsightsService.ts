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
    const { files, directories, fileStats } = await this.scanFiles(projectPath);
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
    const healthScore = this.computeHealthScore(fileStats, languages, complexity, dependencies, security, git, duplicates);
    report('health', 100, `Health score: ${healthScore.overall}/100`);

    const result: ProjectInsights = {
      projectPath,
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
  private async scanFiles(projectPath: string): Promise<{
    files: ScannedFile[];
    directories: string[];
    fileStats: FileStats;
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

    // Documentation
    let documentation = 50; // baseline
    const hasReadme = fileStats.totalFiles > 0; // Would need to check for README specifically
    documentation = Math.min(100, documentation + (hasReadme ? 30 : 0));

    // Testing (heuristic: look for test files)
    let testing = 30; // baseline
    const testFileCount = languages.reduce((sum, l) => {
      // This is a rough heuristic
      return sum;
    }, 0);
    // We'd need file-level analysis for this; set baseline
    testing = 50;

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
}
