import { promises as fs, Stats } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { minimatch } from 'minimatch';
import {
  ExploreTreeParams,
  TreeNode,
  FileStats,
  DEFAULT_SKIP_PATTERNS,
  VALIDATION_LIMITS,
  GitStatus,
  GitStatusInfo,
  SearchMatch,
  SearchMatchType,
  DependencyGraph,
  IconThemeName,
  IconSet,
  Symbol
} from './types.js';
import { getFilePreview } from './preview.js';
import { extractSymbols } from './symbols.js';
import { analyzeDependencies } from './dependency-graph.js';
import { PerformanceTracker, timeOperation } from './performance.js';

const execAsync = promisify(exec);

/**
 * Validates and normalizes a path to prevent path traversal attacks.
 * Returns the resolved absolute path if valid, throws if path is invalid.
 */
async function validatePath(inputPath: string, rootPath?: string): Promise<string> {
  // Resolve to absolute path and normalize (removes .. and .)
  const resolvedPath = path.resolve(inputPath);

  // Check the path exists
  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error(`Path does not exist: ${inputPath}`);
  }

  // Get the real path (resolves symlinks)
  const realPath = await fs.realpath(resolvedPath);

  // If we have a root path, ensure we're not escaping it
  if (rootPath) {
    const realRoot = await fs.realpath(rootPath);
    if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
      throw new Error(`Path escapes root directory: ${inputPath}`);
    }
  }

  return realPath;
}

/**
 * Synchronously checks if a path would escape the root via symlink.
 * Used during traversal for performance (avoids await in loop).
 */
function isPathSafe(targetPath: string, rootPath: string): boolean {
  try {
    const resolvedTarget = path.resolve(targetPath);
    // Note: This doesn't resolve symlinks synchronously, but traverseDirectory
    // will catch symlink escapes when it tries to stat the file
    return resolvedTarget.startsWith(rootPath + path.sep) || resolvedTarget === rootPath;
  } catch {
    return false;
  }
}

export async function exploreTree(params: ExploreTreeParams): Promise<TreeNode> {
  // Validate and normalize the input path (security: prevents path traversal)
  const validatedRootPath = await validatePath(params.path);

  // Apply validation limits
  const depth = Math.min(
    Math.max(1, params.depth ?? VALIDATION_LIMITS.defaultDepth),
    VALIDATION_LIMITS.maxDepth
  );
  const preview_lines = Math.min(
    Math.max(0, params.preview_lines ?? VALIDATION_LIMITS.defaultPreviewLines),
    VALIDATION_LIMITS.maxPreviewLines
  );
  const max_symbols = Math.min(
    Math.max(1, params.max_symbols ?? VALIDATION_LIMITS.defaultMaxSymbols),
    VALIDATION_LIMITS.maxSymbolsPerFile
  );
  const max_files = Math.min(
    Math.max(1, params.max_files ?? VALIDATION_LIMITS.defaultMaxFiles),
    VALIDATION_LIMITS.maxFilesPerDirectory
  );

  const {
    show_symbols = false,  // Default to false to reduce token usage
    symbols_only_exported = false,
    filter = undefined,
    show_imports = false,
    show_git_status = false,
    show_dependency_graph = false,
    show_performance = false,
    icon_theme = 'emoji',
    custom_icons = undefined,
    search = undefined,
    skip_patterns = DEFAULT_SKIP_PATTERNS
  } = params;

  // Get git status if requested
  const gitStatusMap = show_git_status ? await getGitStatus(validatedRootPath) : new Map();

  // Analyze dependencies if requested
  const dependencyGraph = show_dependency_graph ? await analyzeDependencies(validatedRootPath) : undefined;

  const result = await traverseDirectory(validatedRootPath, {
    depth,
    preview_lines,
    show_symbols,
    symbols_only_exported,
    max_symbols,
    filter: filter || '',
    show_imports,
    show_git_status,
    show_dependency_graph,
    show_performance,
    icon_theme,
    custom_icons,
    search,
    max_files,
    skip_patterns,
    currentDepth: 0,
    gitStatusMap,
    dependencyGraph,
    rootPath: validatedRootPath
  });

  // Add dependency graph as proper metadata (not the error hack)
  if (show_dependency_graph && dependencyGraph) {
    result.metadata = {
      dependencyGraph: {
        stats: dependencyGraph.stats,
        circularDependencies: dependencyGraph.circularDependencies,
        clusters: dependencyGraph.clusters
      }
    };
  }

  return result;
}

interface TraverseOptions {
  depth: number;
  preview_lines: number;
  show_symbols: boolean;
  symbols_only_exported: boolean;
  max_symbols: number;
  filter: string;
  show_imports: boolean;
  show_git_status: boolean;
  show_dependency_graph: boolean;
  show_performance: boolean;
  icon_theme: IconThemeName | 'custom';
  custom_icons?: Partial<IconSet>;
  search?: string;
  max_files: number;
  skip_patterns: string[];
  currentDepth: number;
  gitStatusMap: Map<string, GitStatusInfo>;
  dependencyGraph?: DependencyGraph;
  rootPath: string; // For security: prevents symlink escapes
}

async function traverseDirectory(
  dirPath: string,
  options: TraverseOptions
): Promise<TreeNode> {
  const name = path.basename(dirPath);

  // Handle permission errors at directory level
  let stats: Stats;
  try {
    stats = await fs.stat(dirPath);
  } catch (error) {
    const errCode = (error as NodeJS.ErrnoException).code;
    const errorMsg = errCode === 'EACCES' ? 'Permission denied' : `Cannot access: ${errCode || error}`;
    return {
      name,
      type: 'directory',
      path: dirPath,
      children: [],
      error: errorMsg
    };
  }

  // Check if we should skip this directory
  if (shouldSkip(name, dirPath, options.skip_patterns)) {
    return {
      name,
      type: 'directory',
      path: dirPath,
      children: []
    };
  }

  if (!stats.isDirectory()) {
    return createFileNode(dirPath, stats, options);
  }

  // Create directory node
  const node: TreeNode = {
    name,
    type: 'directory',
    path: dirPath,
    children: []
  };

  // Check depth limit
  if (options.currentDepth >= options.depth) {
    try {
      const entries = await fs.readdir(dirPath);
      node.children = [{
        name: `... ${entries.length} items`,
        type: 'file',
        path: ''
      }];
    } catch (error) {
      const errCode = (error as NodeJS.ErrnoException).code;
      node.error = errCode === 'EACCES' ? 'Permission denied' : `Cannot read: ${errCode || error}`;
    }
    return node;
  }

  // Read directory contents
  try {
    const entries = await fs.readdir(dirPath);

    // Warn about large directories that may produce excessive output
    const LARGE_DIR_THRESHOLD = 50;
    if (entries.length > LARGE_DIR_THRESHOLD && options.currentDepth === 0) {
      node.error = `Large directory: ${entries.length} items. Consider using 'filter' param or reducing 'depth'.`;
    }

    const sortedEntries = entries.sort((a, b) => {
      // Directories first, then files
      const aPath = path.join(dirPath, a);
      const bPath = path.join(dirPath, b);
      return a.localeCompare(b);
    });

    // Process entries
    let fileCount = 0;
    for (const entry of sortedEntries) {
      if (fileCount >= options.max_files) {
        node.children!.push({
          name: `... ${sortedEntries.length - fileCount} more items`,
          type: 'file',
          path: ''
        });
        break;
      }

      const entryPath = path.join(dirPath, entry);

      // Skip based on patterns
      if (shouldSkip(entry, entryPath, options.skip_patterns)) {
        continue;
      }

      // Security: Check if path escapes root (e.g., via symlink)
      if (!isPathSafe(entryPath, options.rootPath)) {
        continue; // Silently skip paths that escape the root
      }

      try {
        // Resolve symlinks and verify the real path is still within root
        const realEntryPath = await fs.realpath(entryPath);
        if (!realEntryPath.startsWith(options.rootPath + path.sep) && realEntryPath !== options.rootPath) {
          continue; // Symlink points outside root, skip it
        }

        const entryStats = await fs.stat(entryPath);
        
        if (entryStats.isDirectory()) {
          const childNode = await traverseDirectory(entryPath, {
            ...options,
            currentDepth: options.currentDepth + 1
          });
          node.children!.push(childNode);
        } else if (!options.filter || minimatch(entry, options.filter)) {
          const fileNode = await createFileNode(entryPath, entryStats, options);
          node.children!.push(fileNode);
          fileCount++;
        }
      } catch (error) {
        // Handle permission errors gracefully
        node.children!.push({
          name: entry,
          type: 'file',
          path: entryPath,
          error: 'Permission denied'
        });
      }
    }
  } catch (error) {
    const errCode = (error as NodeJS.ErrnoException).code;
    node.error = errCode === 'EACCES' ? 'Permission denied' : `Cannot read directory: ${errCode || error}`;
  }

  // Filter results based on search if specified
  if (options.search && node.children) {
    node.children = node.children.filter(child => shouldIncludeNode(child, true));
  }

  return node;
}

async function createFileNode(
  filePath: string,
  stats: Stats,
  options: TraverseOptions
): Promise<TreeNode> {
  const name = path.basename(filePath);

  // Initialize performance tracker if requested
  const tracker = options.show_performance ? new PerformanceTracker() : null;

  const fileStats = await (tracker ?
    timeOperation(() => getFileStats(filePath, stats), tracker, 'fileRead') :
    getFileStats(filePath, stats)
  );

  // Set file info for performance calculations
  if (tracker) {
    tracker.setFileInfo(fileStats.size, fileStats.lines);
  }

  const node: TreeNode = {
    name,
    type: 'file',
    path: filePath,
    size: fileStats.size,
    lines: fileStats.lines
  };

  // Add git status if available
  if (options.show_git_status) {
    const resolvedPath = path.resolve(filePath);
    const gitStatus = options.gitStatusMap.get(resolvedPath);
    if (gitStatus) {
      node.gitStatus = gitStatus;
    }
  }

  // Add preview if requested
  if (options.preview_lines > 0) {
    try {
      node.preview = await (tracker ?
        timeOperation(() => getFilePreview(filePath, options.preview_lines), tracker, 'preview') :
        getFilePreview(filePath, options.preview_lines)
      );
    } catch (error) {
      node.preview = [`Error reading file: ${error}`];
    }
  }

  // Extract symbols if requested and file is a code file
  if (options.show_symbols && isCodeFile(filePath)) {
    try {
      let symbols = await (tracker ?
        timeOperation(() => extractSymbols(filePath), tracker, 'symbolExtraction') :
        extractSymbols(filePath)
      );

      // Filter to only exported symbols if requested
      if (options.symbols_only_exported) {
        symbols = symbols.filter(s => s.exported);
      }

      // Apply symbol limit
      if (symbols.length > options.max_symbols) {
        symbols = symbols.slice(0, options.max_symbols);
      }

      node.symbols = symbols;
    } catch (error) {
      // Silently skip symbol extraction errors
    }
  }

  // Extract imports if requested
  if (options.show_imports && isCodeFile(filePath)) {
    try {
      node.imports = await extractImports(filePath);
    } catch (error) {
      // Silently skip import extraction errors
    }
  }

  // Add dependency graph information if available
  if (options.show_dependency_graph && options.dependencyGraph && isCodeFile(filePath)) {
    const relativePath = path.relative(process.cwd(), filePath);
    const depNode = options.dependencyGraph.nodes.get(relativePath);
    
    if (depNode) {
      node.exports = depNode.exports;
      node.dependencies = depNode.imports;
      node.dependents = depNode.dependents;
    }
  }

  // Perform search if requested
  if (options.search) {
    const { type, term } = parseSearchTerm(options.search);
    const matches: SearchMatch[] = [];
    
    // Search in file name and content
    const fileMatches = await (tracker ?
      timeOperation(() => searchInFile(filePath, term, type), tracker, 'search') :
      searchInFile(filePath, term, type)
    );
    matches.push(...fileMatches);
    
    // Search in symbols
    if (node.symbols) {
      const symbolMatches = searchInSymbols(node.symbols, term, type);
      matches.push(...symbolMatches);
    }
    
    // Search in imports
    if (node.imports) {
      const importMatches = searchInImports(node.imports, term, type);
      matches.push(...importMatches);
    }
    
    if (matches.length > 0) {
      node.searchMatches = matches;
    }
  }

  // Finalize performance metrics if tracking
  if (tracker) {
    const symbolCount = node.symbols ? node.symbols.length : 0;
    const importCount = node.imports ? node.imports.length : 0;
    const nestingDepth = estimateNestingDepth(node.symbols || []);
    
    node.performance = tracker.finish(symbolCount, importCount, nestingDepth);
  }

  return node;
}

async function getFileStats(filePath: string, stats: Stats): Promise<FileStats> {
  let lines = 0;

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    lines = content.split('\n').length;
  } catch {
    // Binary file or read error
  }

  return {
    size: stats.size,
    lines,
    mtime: stats.mtime
  };
}

function shouldSkip(name: string, fullPath: string, skipPatterns: string[]): boolean {
  return skipPatterns.some(pattern => {
    if (pattern.includes('*')) {
      return minimatch(name, pattern);
    }
    return name === pattern || fullPath.includes(`/${pattern}/`);
  });
}

function isCodeFile(filePath: string): boolean {
  const codeExtensions = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.go', '.rs', '.rb', '.php', '.cs', '.swift',
    '.kt', '.scala', '.r', '.m', '.mm', '.vue',
    '.svelte', '.lua', '.dart', '.elm', '.clj'
  ];
  
  const ext = path.extname(filePath).toLowerCase();
  return codeExtensions.includes(ext);
}

async function extractImports(filePath: string): Promise<string[]> {
  // Basic import extraction for now
  // TODO: Use proper AST parsing for accurate results
  const content = await fs.readFile(filePath, 'utf-8');
  const imports: string[] = [];
  
  // Match various import patterns
  const importRegexes = [
    /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  
  for (const regex of importRegexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }
  
  return [...new Set(imports)]; // Remove duplicates
}

async function getGitStatus(rootPath: string): Promise<Map<string, GitStatusInfo>> {
  const statusMap = new Map<string, GitStatusInfo>();
  
  try {
    // Find the git root directory
    const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel', { cwd: rootPath });
    const gitRootPath = gitRoot.trim();
    
    // Get git status in porcelain format from git root
    const { stdout } = await execAsync('git status --porcelain=v1', { cwd: gitRootPath });
    
    if (!stdout.trim()) {
      return statusMap; // No changes
    }
    
    const lines = stdout.trim().split('\n');
    
    for (const line of lines) {
      if (line.length < 3) continue;
      
      const indexStatus = line[0];
      const workingTreeStatus = line[1];
      const filePath = line.substring(3);
      
      // Parse the status
      let status: GitStatus;
      let staged = false;
      let workingTree = false;
      
      // Determine primary status
      if (indexStatus !== ' ' && indexStatus !== '?') {
        staged = true;
        status = parseGitStatusChar(indexStatus);
      } else if (workingTreeStatus !== ' ' && workingTreeStatus !== '?') {
        workingTree = true;
        status = parseGitStatusChar(workingTreeStatus);
      } else if (indexStatus === '?' && workingTreeStatus === '?') {
        status = GitStatus.Untracked;
        workingTree = true;
      } else {
        continue; // Skip unrecognized status
      }
      
      // Convert relative path from git root to absolute for consistent lookup
      const absolutePath = path.resolve(gitRootPath, filePath);
      
      
      statusMap.set(absolutePath, {
        status,
        staged,
        workingTree
      });
    }
  } catch (error) {
    // Not a git repository or git command failed
    // Return empty map - no git status available
  }
  
  return statusMap;
}

function parseGitStatusChar(char: string): GitStatus {
  switch (char) {
    case 'M': return GitStatus.Modified;
    case 'A': return GitStatus.Added;
    case 'D': return GitStatus.Deleted;
    case 'R': return GitStatus.Renamed;
    case 'C': return GitStatus.Copied;
    case 'U': return GitStatus.Updated;
    case 'T': return GitStatus.TypeChanged;
    case '?': return GitStatus.Untracked;
    case '!': return GitStatus.Ignored;
    default: return GitStatus.Modified; // Default fallback
  }
}

function parseSearchTerm(search: string): { type: string; term: string } {
  // Handle special search prefixes
  if (search.startsWith('function:')) {
    return { type: 'symbol', term: search.substring(9) };
  }
  if (search.startsWith('content:')) {
    return { type: 'content', term: search.substring(8) };
  }
  if (search.startsWith('import:')) {
    return { type: 'import', term: search.substring(7) };
  }
  if (search.startsWith('regex:')) {
    return { type: 'regex', term: search.substring(6) };
  }
  
  // Default to filename search
  return { type: 'filename', term: search };
}

async function searchInFile(filePath: string, searchTerm: string, searchType: string): Promise<SearchMatch[]> {
  const matches: SearchMatch[] = [];
  const fileName = path.basename(filePath);
  
  // Search in filename
  if (searchType === 'filename' && fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
    matches.push({
      type: SearchMatchType.FileName,
      text: fileName,
      context: `File name contains "${searchTerm}"`
    });
  }
  
  try {
    // Search in file content for content searches
    if (searchType === 'content' || searchType === 'regex') {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let isMatch = false;
        
        if (searchType === 'content') {
          isMatch = line.toLowerCase().includes(searchTerm.toLowerCase());
        } else if (searchType === 'regex') {
          try {
            const regex = new RegExp(searchTerm, 'i');
            isMatch = regex.test(line);
          } catch (e) {
            // Invalid regex, skip
            continue;
          }
        }
        
        if (isMatch) {
          matches.push({
            type: SearchMatchType.FileContent,
            text: line.trim(),
            line: i + 1,
            context: `Line ${i + 1}: ${line.trim()}`
          });
        }
      }
    }
  } catch (error) {
    // File reading error, skip content search
  }
  
  return matches;
}

function searchInSymbols(symbols: Symbol[], searchTerm: string, searchType: string): SearchMatch[] {
  const matches: SearchMatch[] = [];

  if (searchType === 'symbol' || searchType === 'filename') {
    for (const symbol of symbols) {
      if (symbol.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        matches.push({
          type: SearchMatchType.SymbolName,
          text: symbol.name,
          line: symbol.line,
          context: `${symbol.kind}: ${symbol.name}${symbol.exported ? ' (exported)' : ''}`
        });
      }
    }
  }

  return matches;
}

function searchInImports(imports: string[], searchTerm: string, searchType: string): SearchMatch[] {
  const matches: SearchMatch[] = [];
  
  if (searchType === 'import' || searchType === 'content') {
    for (const importPath of imports) {
      if (importPath.toLowerCase().includes(searchTerm.toLowerCase())) {
        matches.push({
          type: SearchMatchType.ImportPath,
          text: importPath,
          context: `Import: ${importPath}`
        });
      }
    }
  }
  
  return matches;
}

function shouldIncludeNode(node: TreeNode, hasSearch: boolean): boolean {
  if (!hasSearch) return true;
  
  // Include if this node has matches
  if (node.searchMatches && node.searchMatches.length > 0) {
    return true;
  }
  
  // Include if any children have matches (for directories)
  if (node.children) {
    return node.children.some(child => shouldIncludeNode(child, true));
  }
  
  return false;
}

function estimateNestingDepth(symbols: Symbol[]): number {
  // Simple heuristic: count class, function, and method symbols to estimate complexity
  // In a real implementation, this would parse the AST to get actual nesting depth
  let depth = 0;
  let classCount = 0;
  let functionCount = 0;

  for (const symbol of symbols) {
    if (symbol.kind === 'class' || symbol.kind === 'interface') {
      classCount++;
    } else if (symbol.kind === 'function' || symbol.kind === 'method') {
      functionCount++;
    }
  }

  // Estimate depth based on symbol distribution
  // Classes typically add 1 level, nested functions add more
  depth = classCount + Math.floor(functionCount / 3);
  return Math.min(depth, 10); // Cap at 10 for reasonable scoring
}