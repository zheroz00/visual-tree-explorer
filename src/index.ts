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
  description: 'Explore a directory tree with file previews and symbol extraction',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The directory path to explore'
      },
      depth: {
        type: 'number',
        description: 'How deep to traverse the tree (default: 2, max: 10)',
        default: 2
      },
      preview_lines: {
        type: 'number',
        description: 'Number of lines to preview per file (default: 5, max: 50)',
        default: 5
      },
      show_symbols: {
        type: 'boolean',
        description: 'Extract and show symbols from code files (default: true)',
        default: true
      },
      symbols_only_exported: {
        type: 'boolean',
        description: 'Only show exported symbols, reducing output size (default: false)',
        default: false
      },
      max_symbols: {
        type: 'number',
        description: 'Maximum symbols to show per file (default: 20, max: 50)',
        default: 20
      },
      filter: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts")'
      },
      show_imports: {
        type: 'boolean',
        description: 'Show import statements (default: false)',
        default: false
      },
      show_git_status: {
        type: 'boolean',
        description: 'Show git status indicators (default: false)',
        default: false
      },
      show_dependency_graph: {
        type: 'boolean',
        description: 'Show dependency graph analysis with imports/exports/dependents (default: false)',
        default: false
      },
      show_performance: {
        type: 'boolean',
        description: 'Show performance metrics per file (default: false)',
        default: false
      },
      icon_theme: {
        type: 'string',
        enum: ['emoji', 'minimal', 'nerd-fonts', 'ascii', 'corporate'],
        description: 'Icon theme to use (default: emoji)',
        default: 'emoji'
      },
      custom_icons: {
        type: 'object',
        description: 'Custom icon overrides (object with icon names as keys)'
      },
      search: {
        type: 'string',
        description: 'Search term to filter results. Supports prefixes: function:, content:, import:, regex:'
      },
      max_files: {
        type: 'number',
        description: 'Maximum files to show per directory (default: 100, max: 500)',
        default: 100
      },
      skip_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to skip (default includes node_modules, .git, dist, etc.)'
      },
      format: {
        type: 'string',
        enum: ['tree', 'json'],
        description: 'Output format (default: tree)',
        default: 'tree'
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