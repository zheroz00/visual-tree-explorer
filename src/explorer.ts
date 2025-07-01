import { promises as fs } from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { ExploreTreeParams, TreeNode, FileStats, DEFAULT_SKIP_PATTERNS } from './types.js';
import { getFilePreview } from './preview.js';
import { extractSymbols } from './symbols.js';

export async function exploreTree(params: ExploreTreeParams): Promise<TreeNode> {
  const {
    path: rootPath,
    depth = 2,
    preview_lines = 5,
    show_symbols = true,
    filter = undefined,
    show_imports = false,
    max_files = 100,
    skip_patterns = DEFAULT_SKIP_PATTERNS
  } = params;

  return traverseDirectory(rootPath, {
    depth,
    preview_lines,
    show_symbols,
    filter: filter || '',
    show_imports,
    max_files,
    skip_patterns,
    currentDepth: 0
  });
}

interface TraverseOptions {
  depth: number;
  preview_lines: number;
  show_symbols: boolean;
  filter: string;
  show_imports: boolean;
  max_files: number;
  skip_patterns: string[];
  currentDepth: number;
}

async function traverseDirectory(
  dirPath: string,
  options: TraverseOptions
): Promise<TreeNode> {
  const stats = await fs.stat(dirPath);
  const name = path.basename(dirPath);

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
    const entries = await fs.readdir(dirPath);
    node.children = [{
      name: `... ${entries.length} items`,
      type: 'file',
      path: ''
    }];
    return node;
  }

  // Read directory contents
  try {
    const entries = await fs.readdir(dirPath);
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

      try {
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
    node.error = `Failed to read directory: ${error}`;
  }

  return node;
}

async function createFileNode(
  filePath: string,
  stats: any,
  options: TraverseOptions
): Promise<TreeNode> {
  const name = path.basename(filePath);
  const fileStats = await getFileStats(filePath, stats);
  
  const node: TreeNode = {
    name,
    type: 'file',
    path: filePath,
    size: fileStats.size,
    lines: fileStats.lines
  };

  // Add preview if requested
  if (options.preview_lines > 0) {
    try {
      node.preview = await getFilePreview(filePath, options.preview_lines);
    } catch (error) {
      node.preview = [`Error reading file: ${error}`];
    }
  }

  // Extract symbols if requested and file is a code file
  if (options.show_symbols && isCodeFile(filePath)) {
    try {
      node.symbols = await extractSymbols(filePath);
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

  return node;
}

async function getFileStats(filePath: string, stats: any): Promise<FileStats> {
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