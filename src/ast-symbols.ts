import { promises as fs } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { Symbol, SymbolKind } from './types.js';

interface ASTSymbol {
  name: string;
  kind: SymbolKind;
  exported: boolean;
  line: number;
  generics?: string;
  jsxProps?: string;
}

export async function extractASTSymbols(filePath: string): Promise<Symbol[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    
    // Determine script kind based on file extension
    let scriptKind: ts.ScriptKind;
    switch (ext) {
      case '.tsx':
        scriptKind = ts.ScriptKind.TSX;
        break;
      case '.jsx':
        scriptKind = ts.ScriptKind.JSX;
        break;
      case '.ts':
        scriptKind = ts.ScriptKind.TS;
        break;
      case '.js':
        scriptKind = ts.ScriptKind.JS;
        break;
      default:
        // Fallback to regex extraction for non-TS/JS files
        return [];
    }
    
    // Create source file with TypeScript compiler
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );
    
    const symbols: ASTSymbol[] = [];
    const sourceLines = content.split('\n');
    
    // Walk the AST and extract symbols - ONLY top-level declarations
    // This prevents extracting every const/let inside function bodies
    function visitTopLevel(node: ts.Node) {
      // Check for exports at module level
      const isExported = hasExportModifier(node);

      switch (node.kind) {
        case ts.SyntaxKind.FunctionDeclaration:
          handleFunctionDeclaration(node as ts.FunctionDeclaration, isExported);
          break;

        case ts.SyntaxKind.ClassDeclaration:
          handleClassDeclaration(node as ts.ClassDeclaration, isExported);
          break;

        case ts.SyntaxKind.InterfaceDeclaration:
          handleInterfaceDeclaration(node as ts.InterfaceDeclaration, isExported);
          break;

        case ts.SyntaxKind.TypeAliasDeclaration:
          handleTypeAliasDeclaration(node as ts.TypeAliasDeclaration, isExported);
          break;

        case ts.SyntaxKind.EnumDeclaration:
          handleEnumDeclaration(node as ts.EnumDeclaration, isExported);
          break;

        case ts.SyntaxKind.VariableStatement:
          handleVariableStatement(node as ts.VariableStatement, isExported);
          break;

        case ts.SyntaxKind.ExportAssignment:
          handleExportAssignment(node as ts.ExportAssignment);
          break;

        case ts.SyntaxKind.ExportDeclaration:
          // Handle re-exports like: export { Component } from './component'
          break;
      }

      // DO NOT recurse into child nodes - we only want top-level symbols
      // This prevents extracting variables from inside functions/classes
    }
    
    function hasExportModifier(node: ts.Node): boolean {
      return ts.canHaveModifiers(node) && 
             ts.getModifiers(node)?.some((mod: ts.Modifier) => mod.kind === ts.SyntaxKind.ExportKeyword) || false;
    }
    
    function getLineNumber(node: ts.Node): number {
      const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      return pos.line + 1; // Convert to 1-based line numbers
    }
    
    function handleFunctionDeclaration(node: ts.FunctionDeclaration, isExported: boolean) {
      if (node.name) {
        const generics = node.typeParameters ? 
          `<${node.typeParameters.map(tp => tp.name.text).join(', ')}>` : undefined;
          
        symbols.push({
          name: node.name.text,
          kind: SymbolKind.Function,
          exported: isExported,
          line: getLineNumber(node),
          generics
        });
      }
    }
    
    function handleClassDeclaration(node: ts.ClassDeclaration, isExported: boolean) {
      if (node.name) {
        const generics = node.typeParameters ? 
          `<${node.typeParameters.map(tp => tp.name.text).join(', ')}>` : undefined;
          
        symbols.push({
          name: node.name.text,
          kind: SymbolKind.Class,
          exported: isExported,
          line: getLineNumber(node),
          generics
        });
      }
    }
    
    function handleInterfaceDeclaration(node: ts.InterfaceDeclaration, isExported: boolean) {
      const generics = node.typeParameters ? 
        `<${node.typeParameters.map(tp => tp.name.text).join(', ')}>` : undefined;
        
      symbols.push({
        name: node.name.text,
        kind: SymbolKind.Interface,
        exported: isExported,
        line: getLineNumber(node),
        generics
      });
    }
    
    function handleTypeAliasDeclaration(node: ts.TypeAliasDeclaration, isExported: boolean) {
      const generics = node.typeParameters ? 
        `<${node.typeParameters.map(tp => tp.name.text).join(', ')}>` : undefined;
        
      symbols.push({
        name: node.name.text,
        kind: SymbolKind.Type,
        exported: isExported,
        line: getLineNumber(node),
        generics
      });
    }
    
    function handleEnumDeclaration(node: ts.EnumDeclaration, isExported: boolean) {
      symbols.push({
        name: node.name.text,
        kind: SymbolKind.Enum,
        exported: isExported,
        line: getLineNumber(node)
      });
    }
    
    function handleVariableStatement(node: ts.VariableStatement, isExported: boolean) {
      // Handle const, let, var declarations
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const name = declaration.name.text;
          let symbolKind = SymbolKind.Variable;
          
          // Determine if this is a function, component, or constant
          if (declaration.initializer) {
            if (ts.isArrowFunction(declaration.initializer) || 
                ts.isFunctionExpression(declaration.initializer)) {
              symbolKind = SymbolKind.Function;
              
              // Check if it's a React component
              if (isReactComponent(declaration.initializer, name)) {
                symbolKind = SymbolKind.Component;
              }
            } else if (node.declarationList.flags & ts.NodeFlags.Const) {
              symbolKind = SymbolKind.Const;
              
              // Special case: React components assigned as const
              if (isReactComponentFromInitializer(declaration.initializer, name)) {
                symbolKind = SymbolKind.Component;
              }
            }
          }
          
          symbols.push({
            name,
            kind: symbolKind,
            exported: isExported,
            line: getLineNumber(node)
          });
        }
      }
    }
    
    function handleExportAssignment(node: ts.ExportAssignment) {
      // Handle default exports like: export default MyComponent
      if (node.expression && ts.isIdentifier(node.expression)) {
        symbols.push({
          name: node.expression.text,
          kind: SymbolKind.Function, // Could be component or function
          exported: true,
          line: getLineNumber(node)
        });
      }
    }
    
    function isReactComponent(node: ts.ArrowFunction | ts.FunctionExpression, name: string): boolean {
      // Heuristics for React component detection:
      // 1. Name starts with uppercase
      // 2. Returns JSX (has JSX elements in body)
      if (!isCapitalized(name)) return false;
      
      // Check if function body contains JSX
      return containsJSX(node);
    }
    
    function isReactComponentFromInitializer(initializer: ts.Expression, name: string): boolean {
      if (!isCapitalized(name)) return false;
      
      // Check for common React patterns:
      // const Component = memo(...), forwardRef(...), etc.
      if (ts.isCallExpression(initializer)) {
        const expression = initializer.expression;
        if (ts.isIdentifier(expression)) {
          const callName = expression.text;
          if (['memo', 'forwardRef', 'lazy', 'createContext'].includes(callName)) {
            return true;
          }
        }
      }
      
      return false;
    }
    
    function isCapitalized(name: string): boolean {
      return name.length > 0 && name[0] === name[0].toUpperCase();
    }
    
    function containsJSX(node: ts.Node): boolean {
      let hasJSX = false;
      
      function checkForJSX(n: ts.Node) {
        if (ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isJsxSelfClosingElement(n)) {
          hasJSX = true;
          return;
        }
        ts.forEachChild(n, checkForJSX);
      }
      
      checkForJSX(node);
      return hasJSX;
    }
    
    // Start the AST traversal - only visit direct children of source file (top-level)
    for (const statement of sourceFile.statements) {
      visitTopLevel(statement);
    }
    
    // Convert to our Symbol interface format
    return symbols.map(sym => ({
      name: sym.name,
      kind: sym.kind,
      exported: sym.exported,
      line: sym.line
    }));
    
  } catch (error) {
    // If AST parsing fails, return empty array
    // The fallback regex extraction can still be used
    return [];
  }
}

// Helper function to check if a file should use AST extraction
export function shouldUseAST(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
}