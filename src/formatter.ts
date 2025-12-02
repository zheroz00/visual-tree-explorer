import { TreeNode, Symbol, SymbolKind, GitStatus, GitStatusInfo, SearchMatch, SearchMatchType, DependencyInfo, DependencyGraph, DependencyGraphSummary, IconThemeName, IconSet } from './types.js';
import { formatDependencyGraph, formatCompactDependencyGraph } from './dependency-formatter.js';
import { formatPerformanceMetrics } from './performance.js';
import { getIconTheme } from './icon-themes.js';

export function formatTree(
  node: TreeNode,
  indent: string = '',
  isLast: boolean = true,
  iconTheme: IconThemeName | 'custom' = 'emoji',
  customIcons?: Partial<IconSet>
): string {
  const icons = iconTheme === 'custom'
    ? getIconTheme('emoji', customIcons)
    : getIconTheme(iconTheme, customIcons);

  const lines: string[] = [];

  // Check if this node has dependency graph metadata (proper way)
  if (node.metadata?.dependencyGraph) {
    lines.push(formatCompactDependencyGraph(node.metadata.dependencyGraph));
    lines.push('');
    lines.push('═'.repeat(50));
    lines.push('📁 FILE TREE WITH DEPENDENCIES');
    lines.push('═'.repeat(50));
  }
  
  // Format current node
  lines.push(formatNode(node, indent, isLast, icons));
  
  // Add preview if present
  if (node.preview && node.preview.length > 0) {
    const previewIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${previewIndent}${icons.branch} ${icons.preview} Preview:`);
    for (const line of node.preview) {
      lines.push(`${previewIndent}${icons.vertical}   ${line}`);
    }
  }
  
  // Add symbols if present
  if (node.symbols && node.symbols.length > 0) {
    const symbolIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${symbolIndent}${icons.branch} ${icons.symbols} Symbols:`);
    for (const symbol of node.symbols) {
      const exportMark = symbol.exported ? '✓ exported' : '';
      lines.push(`${symbolIndent}${icons.vertical}   ${icons.branch} ${symbol.name} (${symbol.kind}) ${exportMark}`);
    }
  }
  
  // Add imports if present
  if (node.imports && node.imports.length > 0) {
    const importIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${importIndent}${icons.branch} ${icons.imports} Imports: ${node.imports.join(', ')}`);
  }

  // Add dependency graph information if present
  if (node.exports && node.exports.length > 0) {
    const exportIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${exportIndent}${icons.branch} ${icons.exports} Exports: ${node.exports.join(', ')}`);
  }

  if (node.dependencies && node.dependencies.length > 0) {
    const depIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${depIndent}${icons.branch} ${icons.dependencies} Dependencies:`);
    for (const dep of node.dependencies.slice(0, 5)) { // Show max 5 dependencies
      const depType = getDependencyTypeIcon(dep.type, icons);
      const imported = dep.imported ? ` {${dep.imported.slice(0, 2).join(', ')}${dep.imported.length > 2 ? '...' : ''}}` : '';
      lines.push(`${depIndent}${icons.vertical}   ${icons.branch} ${depType} ${dep.path}${imported}`);
    }
    if (node.dependencies.length > 5) {
      lines.push(`${depIndent}${icons.vertical}   ${icons.lastBranch} ... and ${node.dependencies.length - 5} more`);
    }
  }

  if (node.dependents && node.dependents.length > 0) {
    const dependentIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    const dependentList = node.dependents.slice(0, 3).join(', ');
    const moreCount = node.dependents.length > 3 ? ` +${node.dependents.length - 3} more` : '';
    lines.push(`${dependentIndent}${icons.branch} ${icons.dependents} Used by: ${dependentList}${moreCount}`);
  }
  
  // Add search matches if present
  if (node.searchMatches && node.searchMatches.length > 0) {
    const searchIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${searchIndent}${icons.branch} ${icons.search} Search Matches:`);
    for (const match of node.searchMatches) {
      const matchIcon = getSearchMatchIcon(match.type, icons);
      const contextInfo = match.line ? ` (line ${match.line})` : '';
      lines.push(`${searchIndent}${icons.vertical}   ${icons.branch} ${matchIcon} ${match.context}${contextInfo}`);
    }
  }
  
  // Add performance metrics if present
  if (node.performance) {
    const perfIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    lines.push(`${perfIndent}${icons.branch} ${icons.performance} Performance:`);
    const perfLines = formatPerformanceMetrics(node.performance);
    for (const perfLine of perfLines) {
      lines.push(`${perfIndent}${icons.vertical}   ${perfLine}`);
    }
  }
  
  // Process children
  if (node.children && node.children.length > 0) {
    const childIndent = indent + (isLast ? '    ' : icons.vertical + '   ');
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      lines.push(formatTree(child, childIndent, isLastChild, iconTheme, customIcons));
    });
  }
  
  return lines.join('\n');
}

function formatNode(node: TreeNode, indent: string, isLast: boolean, icons: IconSet): string {
  const branch = isLast ? icons.lastBranch : icons.branch;
  const icon = node.type === 'directory' ? icons.folder : getFileIcon(node.name, icons);
  const sizeInfo = formatSizeInfo(node);
  const gitStatusInfo = formatGitStatus(node.gitStatus, icons);
  const errorInfo = node.error ? ` ${icons.error} ${node.error}` : '';
  
  return `${indent}${branch} ${icon} ${node.name}${sizeInfo}${gitStatusInfo}${errorInfo}`;
}

function getFileIcon(filename: string, icons: IconSet): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'];
  if (ext && codeExtensions.includes(ext)) {
    return icons.code;
  }
  
  return icons.file;
}

function formatSizeInfo(node: TreeNode): string {
  if (node.type === 'directory') {
    if (node.children && node.children.length === 1 && node.children[0].name.startsWith('...')) {
      return ` (${node.children[0].name})`;
    }
    const fileCount = node.children?.length || 0;
    return fileCount > 0 ? ` (${fileCount} files)` : '';
  }
  
  if (node.size !== undefined && node.lines !== undefined) {
    const parts = [
      `${node.lines} lines`,
      formatFileSize(node.size)
    ];
    return ` (${parts.join(', ')})`;
  }
  
  return '';
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

export function formatTreeJson(node: TreeNode): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: node.name,
    type: node.type,
    path: node.path
  };
  
  if (node.size !== undefined) result.size = node.size;
  if (node.lines !== undefined) result.lines = node.lines;
  if (node.preview) result.preview = node.preview;
  if (node.symbols) result.symbols = node.symbols;
  if (node.imports) result.imports = node.imports;
  if (node.exports) result.exports = node.exports;
  if (node.dependencies) result.dependencies = node.dependencies;
  if (node.dependents) result.dependents = node.dependents;
  if (node.gitStatus) result.gitStatus = node.gitStatus;
  if (node.searchMatches) result.searchMatches = node.searchMatches;
  if (node.performance) result.performance = node.performance;
  if (node.error) result.error = node.error;
  if (node.children) {
    result.children = node.children.map(formatTreeJson);
  }
  
  return result;
}

function formatGitStatus(gitStatus?: GitStatusInfo, icons?: IconSet): string {
  if (!gitStatus || !icons) return '';
  
  const statusEmojis: Record<GitStatus, string> = {
    [GitStatus.Modified]: icons.gitModified,
    [GitStatus.Added]: icons.gitAdded,
    [GitStatus.Deleted]: icons.gitDeleted,
    [GitStatus.Renamed]: icons.gitRenamed,
    [GitStatus.Copied]: icons.gitRenamed,
    [GitStatus.Untracked]: icons.gitUntracked,
    [GitStatus.Ignored]: icons.gitUntracked,
    [GitStatus.Updated]: icons.gitModified,
    [GitStatus.TypeChanged]: icons.gitModified
  };
  
  const emoji = statusEmojis[gitStatus.status];
  const statusChar = gitStatus.status === GitStatus.Untracked ? '??' : gitStatus.status;
  
  let indicator = ` ${emoji}`;
  if (gitStatus.staged || gitStatus.workingTree) {
    indicator += ` ${statusChar}`;
  }
  
  return indicator;
}

function getSearchMatchIcon(type: SearchMatchType, icons: IconSet): string {
  const matchIcons: Record<SearchMatchType, string> = {
    [SearchMatchType.FileName]: icons.searchFile,
    [SearchMatchType.SymbolName]: icons.searchSymbol,
    [SearchMatchType.FileContent]: icons.searchContent,
    [SearchMatchType.ImportPath]: icons.searchImport
  };
  
  return matchIcons[type] || icons.search;
}

function getDependencyTypeIcon(type: string, icons: IconSet): string {
  const typeIcons: Record<string, string> = {
    'import': icons.depImport,
    'require': icons.depRequire,
    'dynamic': icons.depDynamic,
    'type': icons.depType
  };
  
  return typeIcons[type] || icons.depImport;
}