<p align="center">
  <img src="vte_github.png" alt="Visual Tree Explorer Logo" width="200">
</p>

# Visual Tree Explorer (VTE)

An MCP server for efficient codebase exploration. Provides file tree visualization, symbol extraction, and dependency analysis in a single tool call.

## Why VTE?

Traditional codebase exploration requires multiple tool calls:
```
find . -name "*.ts"           # Find files
grep -r "function" src/       # Search content
cat src/index.ts              # Read file
# ... repeat for each file
```

VTE consolidates this into **one call** that returns a complete picture:
- File tree with sizes and line counts
- Code previews (configurable lines)
- AST-parsed symbols (functions, classes, interfaces)
- Import/export relationships
- Dependency graph with circular dependency detection

This reduces context usage and provides richer information than sequential grep/cat commands.

## How It Works

1. **Tree Traversal**: Recursively walks the directory with configurable depth and skip patterns
2. **Symbol Extraction**: Uses TypeScript compiler API for accurate AST parsing (not regex)
3. **Dependency Analysis**: Builds import/export graph, detects circular dependencies, calculates module cohesion
4. **Formatted Output**: Returns structured ASCII tree or JSON

### Symbol Extraction

VTE uses the TypeScript compiler API to parse code, providing:
- 100% accurate symbol detection (vs ~70% with regex)
- Proper handling of complex syntax (destructuring, re-exports)
- Export detection with `✓ exported` markers
- Only top-level symbols (no noise from local variables)

### Dependency Graph

When enabled, analyzes the entire codebase to provide:
- Import/export relationships per file
- Circular dependency detection with full paths
- Module clusters by directory
- Most-connected file identification

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | string | required | Directory to explore |
| `depth` | number | 2 | Traversal depth (max: 10) |
| `preview_lines` | number | 5 | Lines to preview per file (max: 50) |
| `show_symbols` | boolean | true | Extract code symbols via AST |
| `symbols_only_exported` | boolean | false | Only show exported symbols |
| `max_symbols` | number | 20 | Max symbols per file (max: 50) |
| `show_imports` | boolean | false | Show import statements |
| `show_dependency_graph` | boolean | false | Full dependency analysis |
| `show_git_status` | boolean | false | Git status indicators |
| `show_performance` | boolean | false | Timing/memory metrics |
| `search` | string | - | Search filter (see below) |
| `filter` | string | - | Glob pattern for files |
| `max_files` | number | 100 | Max files per directory (max: 500) |
| `icon_theme` | string | 'emoji' | Theme: emoji, minimal, nerd-fonts, ascii, corporate |
| `format` | string | 'tree' | Output: tree or json |

### Search Prefixes

- `function:name` - Find functions/methods
- `content:text` - Search file contents
- `import:package` - Find import statements
- `regex:pattern` - Regex matching

## Default Skip Patterns

Automatically skips: `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `coverage`, `.cache`, `*.log`, `.DS_Store`, `tmp`, `temp`, `__pycache__`, `.nyc_output`, `.turbo`, `.vercel`, `.netlify`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `*.d.ts`

## Example Output

```
└── 📁 src (13 files)
    ├── 📝 explorer.ts (704 lines, 20.0KB)
    │   ├── 👁️ Preview:
    │   │   1: import { promises as fs, Stats } from 'fs';
    │   │   2: import path from 'path';
    │   ├── 🔷 Symbols:
    │   │   ├── validatePath (function)
    │   │   ├── exploreTree (function) ✓ exported
    │   │   ├── traverseDirectory (function)
    ├── 📝 types.ts (326 lines, 9.7KB)
    │   ├── 🔷 Symbols:
    │   │   ├── ExploreTreeParams (interface) ✓ exported
    │   │   ├── TreeNode (interface) ✓ exported
    │   │   ├── VALIDATION_LIMITS (const) ✓ exported
```

With `show_dependency_graph: true`:
```
🕸️  37 files, 142 deps

🌟 Most Connected: src/explorer.ts

📦 2 module clusters
   src: 13 files (85% cohesion)

⚠️  1 circular dependency
   src/a.ts → src/b.ts → src/a.ts
```

## Recent Updates (v1.1)

- **MCP SDK 1.23.0** - Updated from 0.5.0
- **Symbol filtering** - Only top-level symbols extracted (no local variables)
- **Input validation** - Bounded parameters prevent excessive output
- **Path security** - Validates paths, prevents traversal attacks and symlink escapes
- **Output limits** - `max_symbols`, `symbols_only_exported` parameters for lean output

### v1.1 Symbol Reduction

The symbol extraction was rewritten to only capture top-level declarations, dramatically reducing output noise:

| File | v1.0 Symbols | v1.1 Symbols | Reduction |
|------|--------------|--------------|-----------|
| dependency-graph.ts | 77 | 2 | 97% |
| explorer.ts | 95 | 19 | 80% |
| ast-symbols.ts | 36 | 3 | 92% |
| dependency-formatter.ts | 48 | 10 | 79% |
| formatter.ts | 48 | 9 | 81% |

**Why this matters**: v1.0 extracted every `const`, `let`, and variable inside functions - noise that consumed context tokens without providing architectural insight. v1.1 extracts only what matters: exported functions, classes, interfaces, and top-level declarations.

**Result**: ~80% smaller output with the same useful information.

## Architecture

```
src/
├── index.ts           # MCP server entry point
├── explorer.ts        # Main orchestrator with path validation
├── ast-symbols.ts     # TypeScript compiler API symbol extraction
├── symbols.ts         # Symbol extraction dispatcher
├── dependency-graph.ts # Import/export analysis
├── formatter.ts       # ASCII tree formatting
├── types.ts           # TypeScript interfaces
└── ...
```

## Build

```bash
npm install && npm run build
```

---
