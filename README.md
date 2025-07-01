# Visual Tree Explorer MCP Server

A Model Context Protocol (MCP) server that provides rich file tree exploration with code previews and symbol extraction.

## Features

- 🌳 **Visual Tree Structure** - ASCII art representation of directory structure
- 👁️ **File Previews** - See the first N lines of any file
- 🔷 **Symbol Extraction** - Extract functions, classes, interfaces from code files
- 🔗 **Import Analysis** - View import statements and dependencies
- 🎯 **Smart Filtering** - Filter files by glob patterns
- ⚡ **Performance** - Stream large files, skip binary files automatically
- 📊 **Multiple Formats** - Tree view or JSON output

## Installation

```bash
cd mcp-servers/visual-tree-explorer
npm install
npm run build
```

## Usage with Claude

Add to your Claude MCP configuration:

```json
{
  "mcpServers": {
    "visual-tree-explorer": {
      "command": "node",
      "args": ["/path/to/yourProject/mcp-servers/visual-tree-explorer/dist/index.js"]
    }
  }
}
```

## Tool Usage

### Basic Directory Exploration
```typescript
explore_tree({
  path: "src/components",
  depth: 2
})
```

### Deep Symbol Analysis
```typescript
explore_tree({
  path: "src",
  depth: 3,
  show_symbols: true,
  show_imports: true,
  filter: "*.ts"
})
```

### Minimal Preview
```typescript
explore_tree({
  path: ".",
  preview_lines: 0,  // No preview
  show_symbols: false,
  depth: 4
})
```

### JSON Output
```typescript
explore_tree({
  path: "src",
  format: "json"
})
```

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| path | string | required | Directory to explore |
| depth | number | 2 | How deep to traverse |
| preview_lines | number | 5 | Lines to preview per file |
| show_symbols | boolean | true | Extract code symbols |
| filter | string | - | Glob pattern filter |
| show_imports | boolean | false | Show import statements |
| max_files | number | 100 | Max files per directory |
| skip_patterns | string[] | [node_modules, .git, etc.] | Patterns to skip |
| format | 'tree' \| 'json' | 'tree' | Output format |

## Example Output

```
src/components/
├── 📁 pipeline/ (6 files)
│   ├── 📝 LeadPipeline.tsx (245 lines, 8.5KB)
│   │   ├── 👁️ Preview:
│   │   │   1: import React, { useState } from 'react';
│   │   │   2: import { DndProvider } from 'react-dnd';
│   │   │   3: import { HTML5Backend } from 'react-dnd-html5-backend';
│   │   │   4: 
│   │   │   5: export function LeadPipeline() {
│   │   ├── 🔷 Symbols:
│   │   │   ├── LeadPipeline (function) ✓ exported
│   │   │   ├── handleDrop (function)
│   │   │   └── handleDragStart (function)
│   │   └── 🔗 Imports: react, react-dnd, react-dnd-html5-backend
│   └── 📝 types.ts (45 lines, 1.2KB)
│       ├── 🔷 Symbols:
│       │   ├── Lead (interface) ✓ exported
│       │   └── PipelineStage (type) ✓ exported
└── 📝 Dashboard.tsx (312 lines, 10.8KB)
    └── 🔷 Symbols:
        └── Dashboard (component) ✓ exported
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## Future Enhancements

- [ ] AST-based symbol extraction for better accuracy
- [ ] Git status integration
- [ ] File change detection
- [ ] Search within tree
- [ ] Dependency graph visualization
- [ ] Performance metrics per file
- [ ] Custom icon themes