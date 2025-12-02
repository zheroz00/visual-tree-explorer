#!/usr/bin/env node

import { createServer } from 'http';
import { parse } from 'url';
import { exploreTree } from './explorer.js';
import { formatTree, formatTreeJson } from './formatter.js';
import { ExploreTreeParams } from './types.js';

// Extended params for CLI/HTTP that includes format
interface ExploreTreeParamsWithFormat extends ExploreTreeParams {
  format?: 'tree' | 'json';
}

// Parse command line arguments
function parseArgs(args: string[]): { mode: 'cli' | 'server'; params: Partial<ExploreTreeParamsWithFormat>; port?: number } {
  const result: { mode: 'cli' | 'server'; params: Partial<ExploreTreeParamsWithFormat>; port?: number } = { mode: 'cli', params: {} };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--server') {
      result.mode = 'server';
    } else if (arg === '--port' && args[i + 1]) {
      result.port = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--path' && args[i + 1]) {
      result.params.path = args[i + 1];
      i++;
    } else if (arg === '--depth' && args[i + 1]) {
      result.params.depth = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--preview-lines' && args[i + 1]) {
      result.params.preview_lines = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--show-symbols') {
      result.params.show_symbols = true;
    } else if (arg === '--no-symbols') {
      result.params.show_symbols = false;
    } else if (arg === '--max-symbols' && args[i + 1]) {
      result.params.max_symbols = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--symbols-only-exported') {
      result.params.symbols_only_exported = true;
    } else if (arg === '--show-imports') {
      result.params.show_imports = true;
    } else if (arg === '--show-git-status') {
      result.params.show_git_status = true;
    } else if (arg === '--show-dependency-graph') {
      result.params.show_dependency_graph = true;
    } else if (arg === '--show-performance') {
      result.params.show_performance = true;
    } else if (arg === '--icon-theme' && args[i + 1]) {
      result.params.icon_theme = args[i + 1] as ExploreTreeParams['icon_theme'];
      i++;
    } else if (arg === '--filter' && args[i + 1]) {
      result.params.filter = args[i + 1];
      i++;
    } else if (arg === '--search' && args[i + 1]) {
      result.params.search = args[i + 1];
      i++;
    } else if (arg === '--format' && args[i + 1]) {
      result.params.format = args[i + 1] as 'tree' | 'json';
      i++;
    } else if (arg === '--max-files' && args[i + 1]) {
      result.params.max_files = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--skip-patterns' && args[i + 1]) {
      result.params.skip_patterns = args[i + 1].split(',');
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  
  return result;
}

function printHelp() {
  console.log(`
Visual Tree Explorer CLI & Server

Usage:
  visual-tree [options]

Modes:
  --server              Run as HTTP server (default port: 8080)
  --port <port>         Specify server port (with --server)
  
CLI Options:
  --path <path>         Directory to explore (required in CLI mode)
  --depth <n>           Traverse depth (default: 2)
  --preview-lines <n>   Lines to preview per file (default: 5)
  --show-symbols        Extract code symbols (default: true)
  --no-symbols          Disable symbol extraction
  --max-symbols <n>     Max symbols per file (default: 20)
  --symbols-only-exported  Only show exported symbols
  --show-imports        Show import statements
  --show-git-status     Show git status indicators
  --show-dependency-graph Show dependency analysis
  --show-performance    Show performance metrics
  --icon-theme <theme>  Icon theme: emoji|minimal|nerd-fonts|ascii|corporate
  --filter <pattern>    Glob pattern to filter files
  --search <term>       Search term (supports prefixes: function:, content:, import:, regex:)
  --format <fmt>        Output format: tree|json (default: tree)
  --max-files <n>       Max files per directory (default: 100)
  --skip-patterns <patterns> Comma-separated patterns to skip
  --help, -h           Show this help

Examples:
  # CLI mode - one-shot execution
  visual-tree --path ./src --depth 3 --show-symbols
  
  # Server mode - runs HTTP server
  visual-tree --server --port 8080
  
  # Then access via HTTP:
  curl "http://localhost:8080/explore?path=src&depth=2&show_symbols=true"
`);
}

// CLI mode - execute and exit
async function runCli(params: ExploreTreeParamsWithFormat) {
  try {
    if (!params.path) {
      console.error('Error: --path is required in CLI mode');
      printHelp();
      process.exit(1);
    }
    
    const tree = await exploreTree(params);
    const output = params.format === 'json' 
      ? JSON.stringify(formatTreeJson(tree), null, 2)
      : formatTree(tree, '', true, params.icon_theme, params.custom_icons);
    
    console.log(output);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// HTTP server mode
async function runServer(port: number = 8080) {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }
    
    if (pathname === '/explore' && req.method === 'GET') {
      try {
        const query = parsedUrl.query;
        const params: ExploreTreeParamsWithFormat = {
          path: query.path as string,
          depth: query.depth ? parseInt(query.depth as string) : 2,
          preview_lines: query.preview_lines ? parseInt(query.preview_lines as string) : 5,
          show_symbols: query.show_symbols !== 'false',
          max_symbols: query.max_symbols ? parseInt(query.max_symbols as string) : undefined,
          symbols_only_exported: query.symbols_only_exported === 'true',
          show_imports: query.show_imports === 'true',
          show_git_status: query.show_git_status === 'true',
          show_dependency_graph: query.show_dependency_graph === 'true',
          show_performance: query.show_performance === 'true',
          icon_theme: (query.icon_theme as string) as ExploreTreeParams['icon_theme'] || 'emoji',
          filter: query.filter as string,
          search: query.search as string,
          max_files: query.max_files ? parseInt(query.max_files as string) : 100,
          skip_patterns: query.skip_patterns ? (query.skip_patterns as string).split(',') : undefined,
          format: (query.format as 'tree' | 'json') || 'tree'
        };
        
        if (!params.path) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'path parameter is required' }));
          return;
        }
        
        const tree = await exploreTree(params);
        
        if (params.format === 'json' || query.format === 'json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            data: formatTreeJson(tree)
          }));
        } else {
          const output = formatTree(tree, '', true, params.icon_theme, params.custom_icons);
          res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(output);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          error: errorMessage 
        }));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found\n\nAvailable endpoints:\n- GET /explore?path=<path>\n- GET /health');
    }
  });
  
  server.listen(port, () => {
    console.log(`Visual Tree Explorer HTTP server running on http://localhost:${port}`);
    console.log(`\nExample usage:`);
    console.log(`  curl "http://localhost:${port}/explore?path=src&depth=2&show_symbols=true"`);
    console.log(`  curl "http://localhost:${port}/explore?path=src&format=json"`);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    server.close(() => {
      process.exit(0);
    });
  });
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const { mode, params, port } = parseArgs(args);
  
  if (mode === 'server') {
    await runServer(port);
  } else {
    await runCli(params as ExploreTreeParamsWithFormat);
  }
}

// Run the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});