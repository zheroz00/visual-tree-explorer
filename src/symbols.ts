import { promises as fs } from 'fs';
import path from 'path';
import { Symbol, SymbolKind } from './types.js';
import { extractASTSymbols, shouldUseAST } from './ast-symbols.js';

// Language-specific symbol patterns
const SYMBOL_PATTERNS: Record<string, Array<{
  pattern: RegExp;
  kind: SymbolKind;
  nameIndex: number;
  exportIndex?: number;
}>> = {
  typescript: [
    // Exported functions
    { pattern: /export\s+(async\s+)?function\s+(\w+)/g, kind: SymbolKind.Function, nameIndex: 2, exportIndex: 0 },
    // Non-exported functions
    { pattern: /^(?!export)(async\s+)?function\s+(\w+)/gm, kind: SymbolKind.Function, nameIndex: 2 },
    // Arrow functions
    { pattern: /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g, kind: SymbolKind.Function, nameIndex: 1 },
    // Classes
    { pattern: /(?:export\s+)?class\s+(\w+)/g, kind: SymbolKind.Class, nameIndex: 1 },
    // Interfaces
    { pattern: /(?:export\s+)?interface\s+(\w+)/g, kind: SymbolKind.Interface, nameIndex: 1 },
    // Type aliases
    { pattern: /(?:export\s+)?type\s+(\w+)\s*=/g, kind: SymbolKind.Type, nameIndex: 1 },
    // Enums
    { pattern: /(?:export\s+)?enum\s+(\w+)/g, kind: SymbolKind.Enum, nameIndex: 1 },
    // Constants
    { pattern: /(?:export\s+)?const\s+(\w+)\s*(?::|=)/g, kind: SymbolKind.Const, nameIndex: 1 },
    // React components (function components)
    { pattern: /(?:export\s+)?(?:function|const)\s+(\w+)\s*(?::\s*React\.FC|:\s*FC|.*?return\s+(?:<|\(?\s*<))/g, kind: SymbolKind.Component, nameIndex: 1 }
  ],
  javascript: [
    // Similar patterns but without type annotations
    { pattern: /export\s+(async\s+)?function\s+(\w+)/g, kind: SymbolKind.Function, nameIndex: 2, exportIndex: 0 },
    { pattern: /^(?!export)(async\s+)?function\s+(\w+)/gm, kind: SymbolKind.Function, nameIndex: 2 },
    { pattern: /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g, kind: SymbolKind.Function, nameIndex: 1 },
    { pattern: /(?:export\s+)?class\s+(\w+)/g, kind: SymbolKind.Class, nameIndex: 1 },
    { pattern: /(?:export\s+)?const\s+(\w+)\s*=/g, kind: SymbolKind.Const, nameIndex: 1 },
    // React components
    { pattern: /(?:export\s+)?(?:function|const)\s+(\w+)\s*\([^)]*\)\s*\{[\s\S]*?return\s+(?:<|\(?\s*<)/g, kind: SymbolKind.Component, nameIndex: 1 }
  ],
  python: [
    { pattern: /^class\s+(\w+)/gm, kind: SymbolKind.Class, nameIndex: 1 },
    { pattern: /^def\s+(\w+)/gm, kind: SymbolKind.Function, nameIndex: 1 },
    { pattern: /^async\s+def\s+(\w+)/gm, kind: SymbolKind.Function, nameIndex: 1 },
    { pattern: /^(\w+)\s*=\s*(?:lambda|.*?def)/gm, kind: SymbolKind.Function, nameIndex: 1 }
  ]
};

export async function extractSymbols(filePath: string): Promise<Symbol[]> {
  // Try AST extraction first for TypeScript/JavaScript files
  if (shouldUseAST(filePath)) {
    try {
      const astSymbols = await extractASTSymbols(filePath);
      if (astSymbols.length > 0) {
        // AST extraction successful, return results
        return astSymbols.sort((a, b) => (a.line || 0) - (b.line || 0));
      }
    } catch (error) {
      // AST extraction failed, fall back to regex
      console.error(`AST extraction failed for ${filePath}, falling back to regex:`, error);
    }
  }
  
  // Fallback to regex-based extraction
  return extractSymbolsWithRegex(filePath);
}

async function extractSymbolsWithRegex(filePath: string): Promise<Symbol[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  const language = getLanguage(ext);
  
  if (!language) {
    return [];
  }
  
  const patterns = SYMBOL_PATTERNS[language] || [];
  const symbols: Symbol[] = [];
  const lines = content.split('\n');
  
  for (const { pattern, kind, nameIndex, exportIndex } of patterns) {
    // Reset regex state
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[nameIndex];
      if (!name) continue;
      
      // Skip if already found (avoid duplicates)
      if (symbols.some(s => s.name === name)) continue;
      
      // Determine if exported
      const exported = exportIndex !== undefined ? match[0].includes('export') : false;
      
      // Find line number
      const position = match.index;
      const line = getLineNumber(content, position);
      
      symbols.push({
        name,
        kind,
        exported,
        line
      });
    }
  }
  
  // Sort by line number
  return symbols.sort((a, b) => (a.line || 0) - (b.line || 0));
}

function getLanguage(ext: string): string | null {
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp'
  };
  
  return languageMap[ext] || null;
}

function getLineNumber(content: string, position: number): number {
  const substring = content.substring(0, position);
  return substring.split('\n').length;
}

// Helper to detect React components more accurately
export function isReactComponent(name: string, content: string): boolean {
  // Check if it's PascalCase
  if (!/^[A-Z]/.test(name)) return false;
  
  // Look for JSX return statements or React imports
  const componentRegex = new RegExp(`(function|const)\\s+${name}[\\s\\S]*?return\\s*[(<]`, 'g');
  return componentRegex.test(content) || content.includes(`<${name}`);
}