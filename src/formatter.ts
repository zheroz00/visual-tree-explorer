import { TreeNode, Symbol, SymbolKind } from './types.js';

const TREE_CHARS = {
  VERTICAL: '│',
  HORIZONTAL: '─',
  BRANCH: '├',
  LAST_BRANCH: '└',
  INDENT: '  '
};

const ICONS = {
  FOLDER: '📁',
  FILE: '📄',
  CODE: '📝',
  SYMBOLS: '🔷',
  IMPORTS: '🔗',
  PREVIEW: '👁️',
  ERROR: '❌',
  TRUNCATED: '...'
};

export function formatTree(node: TreeNode, indent: string = '', isLast: boolean = true): string {
  const lines: string[] = [];
  
  // Format current node
  lines.push(formatNode(node, indent, isLast));
  
  // Add preview if present
  if (node.preview && node.preview.length > 0) {
    const previewIndent = indent + (isLast ? '    ' : '│   ');
    lines.push(`${previewIndent}${TREE_CHARS.BRANCH}── ${ICONS.PREVIEW} Preview:`);
    for (const line of node.preview) {
      lines.push(`${previewIndent}${TREE_CHARS.VERTICAL}   ${line}`);
    }
  }
  
  // Add symbols if present
  if (node.symbols && node.symbols.length > 0) {
    const symbolIndent = indent + (isLast ? '    ' : '│   ');
    lines.push(`${symbolIndent}${TREE_CHARS.BRANCH}── ${ICONS.SYMBOLS} Symbols:`);
    for (const symbol of node.symbols) {
      const exportMark = symbol.exported ? '✓ exported' : '';
      lines.push(`${symbolIndent}${TREE_CHARS.VERTICAL}   ${TREE_CHARS.BRANCH}── ${symbol.name} (${symbol.kind}) ${exportMark}`);
    }
  }
  
  // Add imports if present
  if (node.imports && node.imports.length > 0) {
    const importIndent = indent + (isLast ? '    ' : '│   ');
    lines.push(`${importIndent}${TREE_CHARS.BRANCH}── ${ICONS.IMPORTS} Imports: ${node.imports.join(', ')}`);
  }
  
  // Process children
  if (node.children && node.children.length > 0) {
    const childIndent = indent + (isLast ? '    ' : '│   ');
    node.children.forEach((child, index) => {
      const isLastChild = index === node.children!.length - 1;
      lines.push(formatTree(child, childIndent, isLastChild));
    });
  }
  
  return lines.join('\n');
}

function formatNode(node: TreeNode, indent: string, isLast: boolean): string {
  const branch = isLast ? TREE_CHARS.LAST_BRANCH : TREE_CHARS.BRANCH;
  const icon = node.type === 'directory' ? ICONS.FOLDER : getFileIcon(node.name);
  const sizeInfo = formatSizeInfo(node);
  const errorInfo = node.error ? ` ${ICONS.ERROR} ${node.error}` : '';
  
  return `${indent}${branch}── ${icon} ${node.name}${sizeInfo}${errorInfo}`;
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php'];
  if (ext && codeExtensions.includes(ext)) {
    return ICONS.CODE;
  }
  
  return ICONS.FILE;
}

function formatSizeInfo(node: TreeNode): string {
  if (node.type === 'directory') {
    if (node.children && node.children.length === 1 && node.children[0].name.startsWith('...')) {
      return ` (${node.children[0].name})`;
    }
    const fileCount = node.children?.filter(c => c.type === 'file').length || 0;
    if (fileCount > 0) {
      return ` (${fileCount} files)`;
    }
    return '';
  }
  
  const parts: string[] = [];
  
  if (node.lines !== undefined && node.lines > 0) {
    parts.push(`${node.lines.toLocaleString()} lines`);
  }
  
  if (node.size !== undefined) {
    parts.push(formatFileSize(node.size));
  }
  
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

// Alternative JSON format for programmatic use
export function formatTreeJson(node: TreeNode): object {
  const result: any = {
    name: node.name,
    type: node.type,
    path: node.path
  };
  
  if (node.size !== undefined) result.size = node.size;
  if (node.lines !== undefined) result.lines = node.lines;
  if (node.preview) result.preview = node.preview;
  if (node.symbols) {
    result.symbols = node.symbols.map(s => ({
      name: s.name,
      kind: s.kind,
      exported: s.exported,
      line: s.line
    }));
  }
  if (node.imports) result.imports = node.imports;
  if (node.error) result.error = node.error;
  
  if (node.children) {
    result.children = node.children.map(child => formatTreeJson(child));
  }
  
  return result;
}