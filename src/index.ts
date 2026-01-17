#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { exploreTree } from './explorer.js';
import { formatTree, formatTreeJson } from './formatter.js';
import { ExploreTreeParams } from './types.js';

// Tool definition
const EXPLORE_TREE_TOOL = {
  name: 'explore_tree',
  description: `Explore directory trees with file previews and optional code symbol extraction.
Replaces multiple Glob/Grep/LS/Read calls with a single efficient operation.

WHEN TO USE:
- Initial codebase exploration ("what's in src/")
- Finding files by pattern ("all .tsx components")
- Understanding project structure before making changes
- Locating functions/classes across files (with show_symbols)

COMMON PATTERNS:
1. Quick overview: { path: "/project/src", depth: 2 }
2. Find components: { path: "/project/src", filter: "*.tsx", depth: 3 }
3. Find a function: { path: "/project/src", show_symbols: true, search: "function:handleSubmit" }
4. Shallow scan: { path: "/project", depth: 1 } - just top-level structure

TOKEN OPTIMIZATION:
- Default settings are optimized for low token output
- show_symbols: false by default - enable only when you need function/class names
- Use filter to limit to relevant file types (e.g., "*.{ts,tsx}" for TypeScript)
- Use depth: 1 for large directories, then drill into specific subdirs
- Binary files (.png, .mp3, etc.) are auto-detected and show "[Binary file: .ext]" instead of content

WHEN NOT TO USE:
- Reading a specific known file → use Read tool
- Searching for text content across files → use Grep tool
- You already know the exact file path → use Read tool directly`,
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory path to explore (required)'
      },
      depth: {
        type: 'number',
        description: 'Tree depth: 1=shallow overview, 2=default, 3+=deep dive. Max 10. Start shallow for large dirs.',
        default: 2
      },
      filter: {
        type: 'string',
        description: 'Glob pattern to filter files. Examples: "*.ts", "*.{ts,tsx}", "test-*.js", "**/*.spec.ts"'
      },
      show_symbols: {
        type: 'boolean',
        description: 'Extract functions/classes/interfaces from code files. OFF by default to save tokens. Enable when you need to find specific functions or understand file APIs.',
        default: false
      },
      search: {
        type: 'string',
        description: 'Filter results by search term. Prefixes: "function:name" (find function), "content:text" (in file content), "import:module" (find imports), "regex:pattern"'
      },
      preview_lines: {
        type: 'number',
        description: 'Lines of file content to preview (default: 5, max: 50). Set to 0 to disable previews.',
        default: 5
      },
      symbols_only_exported: {
        type: 'boolean',
        description: 'When show_symbols is true, only show exported symbols (reduces noise)',
        default: false
      },
      max_symbols: {
        type: 'number',
        description: 'Max symbols per file when show_symbols is true (default: 20, max: 50)',
        default: 20
      },
      show_imports: {
        type: 'boolean',
        description: 'Show import statements in each file (default: false)',
        default: false
      },
      show_git_status: {
        type: 'boolean',
        description: 'Show git modified/staged indicators (default: false)',
        default: false
      },
      show_dependency_graph: {
        type: 'boolean',
        description: 'Show which files import/export what and who depends on them (default: false)',
        default: false
      },
      show_performance: {
        type: 'boolean',
        description: 'Show file complexity metrics (default: false)',
        default: false
      },
      max_files: {
        type: 'number',
        description: 'Max files per directory (default: 100, max: 500). Increase for large flat directories.',
        default: 100
      },
      skip_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional patterns to skip. Default already skips: node_modules, .git, dist, build, coverage, __pycache__'
      },
      format: {
        type: 'string',
        enum: ['tree', 'json'],
        description: 'Output format: "tree" (visual, default) or "json" (structured)',
        default: 'tree'
      },
      icon_theme: {
        type: 'string',
        enum: ['emoji', 'minimal', 'nerd-fonts', 'ascii', 'corporate'],
        description: 'Visual theme for icons (default: emoji)',
        default: 'emoji'
      },
      custom_icons: {
        type: 'object',
        description: 'Override specific icons (advanced usage)'
      }
    },
    required: ['path']
  }
};

// Create MCP server
const server = new Server(
  {
    name: 'visual-tree-explorer',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [EXPLORE_TREE_TOOL]
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'explore_tree') {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const args = request.params.arguments as unknown as ExploreTreeParams & { format?: string };
  
  try {
    // Validate path
    if (!args.path) {
      throw new Error('Path is required');
    }

    // Execute tree exploration
    const tree = await exploreTree(args);
    
    // Format output based on requested format
    const output = args.format === 'json' 
      ? JSON.stringify(formatTreeJson(tree), null, 2)
      : formatTree(tree, '', true, args.icon_theme, args.custom_icons);
    
    return {
      content: [
        {
          type: 'text',
          text: output
        }
      ]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error exploring tree: ${errorMessage}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr to avoid interfering with MCP communication
  console.error('Visual Tree Explorer MCP server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});