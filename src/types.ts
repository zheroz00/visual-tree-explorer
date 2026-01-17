export interface ExploreTreeParams {
  path: string;              // Starting directory
  depth?: number;            // How deep to traverse (default: 2, max: 10)
  preview_lines?: number;    // Lines to preview per file (default: 5, max: 50)
  show_symbols?: boolean;    // Include symbol extraction (default: false, opt-in to reduce tokens)
  symbols_only_exported?: boolean; // Only show exported symbols (default: false)
  max_symbols?: number;      // Max symbols per file (default: 20, max: 50)
  filter?: string;           // Glob pattern to filter files
  show_imports?: boolean;    // Show import analysis (default: false)
  show_git_status?: boolean; // Show git status indicators (default: false)
  search?: string;           // Search term to filter results
  show_dependency_graph?: boolean; // Show dependency graph analysis (default: false)
  show_performance?: boolean; // Show performance metrics per file (default: false)
  icon_theme?: IconThemeName | 'custom'; // Icon theme to use (default: 'emoji')
  custom_icons?: Partial<IconSet>; // Custom icon overrides
  max_files?: number;        // Limit files shown per directory (default: 100)
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
  exports?: string[];
  dependencies?: DependencyInfo[];
  dependents?: string[];  // Files that depend on this file
  gitStatus?: GitStatusInfo;
  searchMatches?: SearchMatch[];
  performance?: PerformanceMetrics;
  children?: TreeNode[];
  error?: string;
  metadata?: TreeMetadata;  // Additional metadata (dependency graph, etc.)
}

// Metadata for the tree root node
export interface TreeMetadata {
  dependencyGraph?: DependencyGraphSummary;
  analysisTime?: number;  // Total analysis time in ms
  totalFiles?: number;
  totalDirectories?: number;
}

// Serializable summary of dependency graph (not the full Map-based graph)
export interface DependencyGraphSummary {
  stats: DependencyStats;
  circularDependencies: CircularDependency[];
  clusters: ModuleCluster[];
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

export enum SearchMatchType {
  FileName = 'filename',
  SymbolName = 'symbol',
  FileContent = 'content',
  ImportPath = 'import'
}

export interface SearchMatch {
  type: SearchMatchType;
  text: string;
  line?: number;
  context?: string;
}

export enum GitStatus {
  Modified = 'M',      // Modified
  Added = 'A',         // Added to index
  Deleted = 'D',       // Deleted
  Renamed = 'R',       // Renamed
  Copied = 'C',        // Copied
  Untracked = '??',    // Untracked
  Ignored = '!!',      // Ignored
  Updated = 'U',       // Updated but unmerged
  TypeChanged = 'T'    // File type changed
}

export interface GitStatusInfo {
  status: GitStatus;
  staged: boolean;     // Whether the change is staged
  workingTree: boolean; // Whether there are working tree changes
}

// Default patterns to skip
export const DEFAULT_SKIP_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.cache',
  '*.log',
  '.DS_Store',
  'tmp',
  'temp',
  '__pycache__',
  '.nyc_output',
  '.turbo',
  '.vercel',
  '.netlify',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '*.d.ts'  // TypeScript declaration files (usually generated)
];

// Validation limits to prevent excessive output
export const VALIDATION_LIMITS = {
  maxDepth: 10,
  maxPreviewLines: 50,
  maxSymbolsPerFile: 50,
  maxFilesPerDirectory: 500,
  defaultDepth: 2,
  defaultPreviewLines: 5,
  defaultMaxSymbols: 20,
  defaultMaxFiles: 100
};

// Dependency Graph Types
export interface DependencyInfo {
  path: string;           // Import path as written in code
  resolvedPath?: string;  // Actual file path if resolved
  type: DependencyType;   // Type of dependency
  imported?: string[];    // Specific items imported (named imports)
  isExternal: boolean;    // Whether it's external (npm package) or internal
}

export enum DependencyType {
  Import = 'import',           // ES6 import
  Require = 'require',         // CommonJS require
  DynamicImport = 'dynamic',   // Dynamic import()
  TypeOnly = 'type'            // TypeScript type-only import
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;  // File path -> Node info
  edges: DependencyEdge[];             // Dependency relationships
  clusters: ModuleCluster[];           // Grouped related modules
  circularDependencies: CircularDependency[];
  stats: DependencyStats;
}

export interface DependencyNode {
  path: string;                   // File path
  name: string;                   // File name
  type: 'file' | 'external';     // Internal file or external package
  exports: string[];              // Exported symbols
  imports: DependencyInfo[];      // Import dependencies
  dependents: string[];           // Files that depend on this
  cluster?: string;               // Module cluster ID
}

export interface DependencyEdge {
  from: string;        // Source file path
  to: string;          // Target file path
  type: DependencyType;
  weight: number;      // Number of imports between files
  imported?: string[]; // Specific symbols imported
}

export interface CircularDependency {
  cycle: string[];     // Array of file paths in the cycle
  length: number;      // Number of files in cycle
  type: 'direct' | 'indirect';
}

export interface ModuleCluster {
  id: string;                    // Cluster identifier
  name: string;                  // Human readable name
  files: string[];               // Files in this cluster
  internalDependencies: number;  // Dependencies within cluster
  externalDependencies: number;  // Dependencies outside cluster
  cohesion: number;              // 0-1 score of how related files are
}

export interface DependencyStats {
  totalFiles: number;
  totalDependencies: number;
  externalDependencies: number;
  circularDependencies: number;
  maxDepth: number;              // Longest dependency chain
  avgDependenciesPerFile: number;
  mostConnectedFile: string;     // File with most connections
  leastConnectedFiles: string[]; // Files with no dependencies
}

// Performance Metrics Types
export interface PerformanceMetrics {
  total: TimingInfo;             // Total time to process this file
  breakdown: OperationBreakdown; // Time breakdown by operation
  memory: MemoryUsage;           // Memory usage during processing
  fileInfo: FilePerformanceInfo; // File-specific performance characteristics
}

export interface TimingInfo {
  startTime: number;    // Performance.now() when operation started
  endTime: number;      // Performance.now() when operation ended
  duration: number;     // Duration in milliseconds
}

export interface OperationBreakdown {
  fileRead?: TimingInfo;        // Time to read file from disk
  preview?: TimingInfo;         // Time to generate preview
  symbolExtraction?: TimingInfo; // Time for AST parsing and symbol extraction
  dependencyAnalysis?: TimingInfo; // Time for dependency analysis
  gitStatus?: TimingInfo;       // Time to get git status
  search?: TimingInfo;          // Time for search operations
}

export interface MemoryUsage {
  beforeOperation: number;  // Memory usage before processing (MB)
  afterOperation: number;   // Memory usage after processing (MB)
  peakUsage: number;        // Peak memory usage during operation (MB)
  delta: number;            // Memory delta for this operation (MB)
}

export interface FilePerformanceInfo {
  fileSize: number;         // File size in bytes
  lineCount: number;        // Number of lines in file
  bytesPerMs: number;       // Processing throughput (bytes/ms)
  linesPerMs: number;       // Processing throughput (lines/ms)
  complexity: FileComplexity; // Estimated file complexity
}

export interface FileComplexity {
  score: number;            // Complexity score (0-100)
  factors: {
    symbolCount: number;    // Number of symbols found
    importCount: number;    // Number of imports
    fileSize: number;       // Contribution from file size
    nestingDepth: number;   // AST nesting depth
  };
}

// Icon Theme Types
export type IconThemeName = 'emoji' | 'minimal' | 'nerd-fonts' | 'ascii' | 'corporate';

export interface IconSet {
  // File and folder icons
  folder: string;
  file: string;
  code: string;
  
  // Tree structure
  branch: string;
  lastBranch: string;
  vertical: string;
  
  // Feature icons
  symbols: string;
  imports: string;
  exports: string;
  dependencies: string;
  dependents: string;
  preview: string;
  search: string;
  performance: string;
  
  // Git status
  gitModified: string;
  gitAdded: string;
  gitDeleted: string;
  gitUntracked: string;
  gitRenamed: string;
  
  // Performance indicators
  perfFast: string;      // Low complexity
  perfMedium: string;    // Medium complexity
  perfSlow: string;      // High complexity
  perfCritical: string;  // Very high complexity
  
  // Search match types
  searchFile: string;
  searchSymbol: string;
  searchContent: string;
  searchImport: string;
  
  // Dependency types
  depImport: string;
  depRequire: string;
  depDynamic: string;
  depType: string;
  
  // Status indicators
  error: string;
  truncated: string;
  loading: string;
}

export interface IconTheme {
  name: IconThemeName;
  displayName: string;
  description: string;
  icons: IconSet;
}