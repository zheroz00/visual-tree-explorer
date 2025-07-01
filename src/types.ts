export interface ExploreTreeParams {
  path: string;              // Starting directory
  depth?: number;            // How deep to traverse (default: 2)
  preview_lines?: number;    // Lines to preview per file (default: 5)
  show_symbols?: boolean;    // Include symbol extraction (default: true)
  filter?: string;           // Glob pattern to filter files
  show_imports?: boolean;    // Show import analysis (default: false)
  max_files?: number;        // Limit files shown per directory
  skip_patterns?: string[];  // Patterns to skip (node_modules, etc.)
}

export interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  lines?: number;
  preview?: string[];
  symbols?: Symbol[];
  imports?: string[];
  children?: TreeNode[];
  error?: string;
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  line?: number;
}

export enum SymbolKind {
  Function = 'function',
  Class = 'class',
  Interface = 'interface',
  Type = 'type',
  Const = 'const',
  Variable = 'variable',
  Method = 'method',
  Property = 'property',
  Enum = 'enum',
  Component = 'component'  // For React components
}

export interface FileStats {
  size: number;
  lines: number;
  mtime: Date;
}

// Default patterns to skip
export const DEFAULT_SKIP_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.cache',
  '*.log',
  '.DS_Store',
  'tmp',
  'temp'
];