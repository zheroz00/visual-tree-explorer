# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code Exploration

**Always use the Visual Tree Explorer MCP tool (`mcp__vte__explore_tree`) for codebase exploration instead of multiple Grep/Glob calls.**

VTE provides in a single call:
- File tree with sizes and line counts
- AST-parsed symbols (functions, classes, interfaces)
- Dependency analysis and circular dependency detection
- Search with `function:`, `content:`, `import:` prefixes

Use traditional Grep/Glob only for very specific text searches not covered by VTE.

**When you start a session in this repo, say "VTE mode enabled" to confirm you've read these instructions.**

## Build & Run Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run dev          # Watch mode development
npm start            # Run MCP server (for Claude Code integration)
npm run server       # Start HTTP server on port 8080
npm run cli -- --path src --depth 2  # CLI one-shot execution
```

## Architecture Overview

Visual Tree Explorer (VTE) is an MCP server that provides rich file tree exploration with code analysis capabilities. It operates in three modes:

1. **MCP Mode** (`src/index.ts`) - Standard MCP server for Claude Code integration via stdio transport
2. **HTTP Server Mode** (`src/cli-server.ts --server`) - RESTful API at `/explore` and `/health`
3. **CLI Mode** (`src/cli-server.ts`) - One-shot command-line execution

### Core Module Structure

```
src/
├── index.ts           # MCP server entry point, tool definition
├── cli-server.ts      # HTTP/CLI entry point with argument parsing
├── explorer.ts        # Main orchestrator: traverseDirectory, createFileNode
├── types.ts           # All TypeScript interfaces and enums
├── formatter.ts       # ASCII tree output formatting with icon themes
├── symbols.ts         # Symbol extraction dispatcher (AST or regex fallback)
├── ast-symbols.ts     # TypeScript compiler API for accurate symbol extraction
├── dependency-graph.ts # DependencyAnalyzer class for import/export analysis
├── dependency-formatter.ts # Dependency graph visualization
├── performance.ts     # PerformanceTracker for timing/memory metrics
├── preview.ts         # File preview generation
└── icon-themes.ts     # 5 built-in icon themes (emoji, minimal, nerd-fonts, ascii, corporate)
```

### Data Flow

1. `exploreTree()` in `explorer.ts` orchestrates the full analysis
2. `traverseDirectory()` recursively builds `TreeNode` objects
3. `createFileNode()` enriches files with preview, symbols, git status, dependencies, and performance metrics
4. `formatTree()` in `formatter.ts` converts `TreeNode` to ASCII output

### Key Types (`types.ts`)

- `ExploreTreeParams` - Input parameters for exploration
- `TreeNode` - Core tree structure with optional symbols, imports, exports, dependencies, performance
- `DependencyGraph` - Full dependency analysis with nodes, edges, clusters, circular dependencies
- `PerformanceMetrics` - Timing, memory, complexity data per file
- `IconSet` / `IconThemeName` - Theme configuration

### Symbol Extraction Strategy

`symbols.ts` attempts AST-based extraction first via TypeScript compiler API (`ast-symbols.ts`), falling back to regex patterns for non-TS files or on error. Supports TypeScript, JavaScript, and Python.

### Dependency Analysis

`DependencyAnalyzer` class performs multi-pass analysis:
1. Collect all source files
2. Parse imports/exports using TypeScript AST + regex fallback
3. Build dependency graph with edges
4. Detect circular dependencies via DFS
5. Calculate module clusters by directory
6. Compute statistics (most connected file, max depth, etc.)
