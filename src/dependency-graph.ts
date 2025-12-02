import { promises as fs, statSync } from 'fs';
import path from 'path';
import * as ts from 'typescript';
import { 
  DependencyGraph, 
  DependencyNode, 
  DependencyEdge, 
  DependencyInfo, 
  DependencyType,
  CircularDependency, 
  ModuleCluster, 
  DependencyStats
} from './types.js';

export class DependencyAnalyzer {
  private rootPath: string;
  private graph: DependencyGraph;
  private fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
    this.graph = {
      nodes: new Map(),
      edges: [],
      clusters: [],
      circularDependencies: [],
      stats: {
        totalFiles: 0,
        totalDependencies: 0,
        externalDependencies: 0,
        circularDependencies: 0,
        maxDepth: 0,
        avgDependenciesPerFile: 0,
        mostConnectedFile: '',
        leastConnectedFiles: []
      }
    };
  }

  async analyzeDependencies(targetPath: string): Promise<DependencyGraph> {
    // Reset graph for new analysis
    this.graph.nodes.clear();
    this.graph.edges = [];
    this.graph.clusters = [];
    this.graph.circularDependencies = [];

    const files = await this.collectFiles(targetPath);
    
    // First pass: Parse all files and extract imports/exports
    for (const filePath of files) {
      await this.parseFile(filePath);
    }

    // Second pass: Resolve dependencies and build graph
    await this.buildDependencyGraph();

    // Third pass: Detect circular dependencies
    this.detectCircularDependencies();

    // Fourth pass: Calculate clusters
    this.calculateClusters();

    // Final pass: Calculate statistics
    this.calculateStats();

    return this.graph;
  }

  private async collectFiles(targetPath: string): Promise<string[]> {
    const files: string[] = [];
    const analyzer = this;
    
    async function traverse(dirPath: string) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await traverse(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (analyzer.fileExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    const stats = await fs.stat(targetPath);
    if (stats.isFile()) {
      files.push(targetPath);
    } else {
      await traverse(targetPath);
    }

    return files;
  }

  private async parseFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const relativePath = path.relative(this.rootPath, filePath);
      
      // Extract imports and exports using both AST and regex
      const dependencies = await this.extractDependencies(content, filePath);
      const exports = await this.extractExports(content, filePath);

      // Create dependency node
      const node: DependencyNode = {
        path: relativePath,
        name: path.basename(filePath),
        type: 'file',
        exports,
        imports: dependencies,
        dependents: [],
        cluster: undefined
      };

      this.graph.nodes.set(relativePath, node);
    } catch {
      // Silently skip files that fail to parse
    }
  }

  private async extractDependencies(content: string, filePath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const ext = path.extname(filePath);

    // Use TypeScript AST for .ts/.tsx files
    if (ext === '.ts' || ext === '.tsx') {
      try {
        const sourceFile = ts.createSourceFile(
          filePath,
          content,
          ts.ScriptTarget.Latest,
          true
        );

        this.visitImportNodes(sourceFile, dependencies, filePath);
      } catch (error) {
        // Fall back to regex if AST parsing fails
      }
    }

    // Fall back to regex parsing for all files or as backup
    this.extractDependenciesWithRegex(content, dependencies, filePath);

    return dependencies;
  }

  private visitImportNodes(node: ts.Node, dependencies: DependencyInfo[], filePath: string): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;
        const imported = this.extractImportedNames(node);
        const isTypeOnly = node.importClause?.isTypeOnly || false;

        dependencies.push({
          path: importPath,
          resolvedPath: this.resolveImportPath(importPath, filePath),
          type: isTypeOnly ? DependencyType.TypeOnly : DependencyType.Import,
          imported,
          isExternal: this.isExternalDependency(importPath)
        });
      }
    } else if (ts.isCallExpression(node)) {
      // Handle require() and dynamic import()
      if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg)) {
          dependencies.push({
            path: arg.text,
            resolvedPath: this.resolveImportPath(arg.text, filePath),
            type: DependencyType.Require,
            isExternal: this.isExternalDependency(arg.text)
          });
        }
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'import') {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg)) {
          dependencies.push({
            path: arg.text,
            resolvedPath: this.resolveImportPath(arg.text, filePath),
            type: DependencyType.DynamicImport,
            isExternal: this.isExternalDependency(arg.text)
          });
        }
      }
    }

    ts.forEachChild(node, (child) => this.visitImportNodes(child, dependencies, filePath));
  }

  private extractImportedNames(importDeclaration: ts.ImportDeclaration): string[] {
    const imported: string[] = [];
    const importClause = importDeclaration.importClause;

    if (importClause) {
      // Default import
      if (importClause.name) {
        imported.push(importClause.name.text);
      }

      // Named imports
      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          for (const element of importClause.namedBindings.elements) {
            imported.push(element.name.text);
          }
        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
          // Namespace import (import * as foo)
          imported.push(`* as ${importClause.namedBindings.name.text}`);
        }
      }
    }

    return imported;
  }

  private extractDependenciesWithRegex(content: string, dependencies: DependencyInfo[], filePath: string): void {
    // ES6 imports
    const importRegex = /import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{\s*([^}]+)\s*\})?(?:\s*,\s*)?(?:\*\s+as\s+(\w+))?)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const [, defaultImport, namedImports, namespaceImport, importPath] = match;
      const imported: string[] = [];

      if (defaultImport) imported.push(defaultImport);
      if (namedImports) imported.push(...namedImports.split(',').map(s => s.trim()));
      if (namespaceImport) imported.push(`* as ${namespaceImport}`);

      dependencies.push({
        path: importPath,
        resolvedPath: this.resolveImportPath(importPath, filePath),
        type: DependencyType.Import,
        imported: imported.length > 0 ? imported : undefined,
        isExternal: this.isExternalDependency(importPath)
      });
    }

    // CommonJS require
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      dependencies.push({
        path: importPath,
        resolvedPath: this.resolveImportPath(importPath, filePath),
        type: DependencyType.Require,
        isExternal: this.isExternalDependency(importPath)
      });
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      dependencies.push({
        path: importPath,
        resolvedPath: this.resolveImportPath(importPath, filePath),
        type: DependencyType.DynamicImport,
        isExternal: this.isExternalDependency(importPath)
      });
    }
  }

  private async extractExports(content: string, filePath: string): Promise<string[]> {
    const exports: string[] = [];
    const ext = path.extname(filePath);

    // Use AST for TypeScript files
    if (ext === '.ts' || ext === '.tsx') {
      try {
        const sourceFile = ts.createSourceFile(
          filePath,
          content,
          ts.ScriptTarget.Latest,
          true
        );

        this.visitExportNodes(sourceFile, exports);
        return exports;
      } catch (error) {
        // Fall back to regex
      }
    }

    // Regex fallback
    this.extractExportsWithRegex(content, exports);
    return exports;
  }

  private visitExportNodes(node: ts.Node, exports: string[]): void {
    if (ts.isExportDeclaration(node)) {
      // export { ... } or export { ... } from '...'
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exports.push(element.name.text);
        }
      }
    } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || 
               ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ||
               ts.isVariableStatement(node) || ts.isEnumDeclaration(node)) {
      
      // Check if it has export modifier
      if (ts.canHaveModifiers(node) && 
          ts.getModifiers(node)?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.push(node.name.text);
        } else if (ts.isClassDeclaration(node) && node.name) {
          exports.push(node.name.text);
        } else if (ts.isInterfaceDeclaration(node)) {
          exports.push(node.name.text);
        } else if (ts.isTypeAliasDeclaration(node)) {
          exports.push(node.name.text);
        } else if (ts.isEnumDeclaration(node)) {
          exports.push(node.name.text);
        } else if (ts.isVariableStatement(node)) {
          // Handle variable declarations
          for (const declaration of node.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              exports.push(declaration.name.text);
            }
          }
        }
      }
    }

    ts.forEachChild(node, (child) => this.visitExportNodes(child, exports));
  }

  private extractExportsWithRegex(content: string, exports: string[]): void {
    // Named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // Export statements
    const exportStatementRegex = /export\s+\{\s*([^}]+)\s*\}/g;
    while ((match = exportStatementRegex.exec(content)) !== null) {
      const exportedNames = match[1].split(',').map(name => name.trim().split(' as ')[0]);
      exports.push(...exportedNames);
    }

    // Default export with name
    const defaultExportRegex = /export\s+default\s+(?:function\s+(\w+)|class\s+(\w+)|(\w+))/g;
    while ((match = defaultExportRegex.exec(content)) !== null) {
      const name = match[1] || match[2] || match[3];
      if (name) {
        exports.push(`default (${name})`);
      }
    }
  }

  private resolveImportPath(importPath: string, fromFile: string): string | undefined {
    // Skip external packages
    if (this.isExternalDependency(importPath)) {
      return undefined;
    }

    const fromDir = path.dirname(fromFile);
    
    try {
      // Handle relative paths
      if (importPath.startsWith('.')) {
        const resolved = path.resolve(fromDir, importPath);
        
        // Try different extensions
        for (const ext of this.fileExtensions) {
          const withExt = resolved + ext;
          try {
            if (statSync(withExt).isFile()) {
              return path.relative(this.rootPath, withExt);
            }
          } catch {}
          
          // Try index files
          const indexPath = path.join(resolved, 'index' + ext);
          try {
            if (statSync(indexPath).isFile()) {
              return path.relative(this.rootPath, indexPath);
            }
          } catch {}
        }
      }
      
      // Handle absolute imports (from src root, etc.)
      // This would need project-specific configuration
      
    } catch (error) {
      // Resolution failed
    }

    return undefined;
  }

  private isExternalDependency(importPath: string): boolean {
    // External if it doesn't start with . or /
    return !importPath.startsWith('.') && !importPath.startsWith('/');
  }

  private async buildDependencyGraph(): Promise<void> {
    // Build edges and populate dependents
    for (const [filePath, node] of this.graph.nodes) {
      for (const dep of node.imports) {
        if (dep.resolvedPath && this.graph.nodes.has(dep.resolvedPath)) {
          // Add edge
          const edge: DependencyEdge = {
            from: filePath,
            to: dep.resolvedPath,
            type: dep.type,
            weight: 1,
            imported: dep.imported
          };
          
          this.graph.edges.push(edge);
          
          // Add to dependents
          const targetNode = this.graph.nodes.get(dep.resolvedPath);
          if (targetNode) {
            targetNode.dependents.push(filePath);
          }
        }
      }
    }
  }

  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [filePath] of this.graph.nodes) {
      if (!visited.has(filePath)) {
        this.dfsForCycles(filePath, visited, recursionStack, []);
      }
    }
  }

  private dfsForCycles(
    current: string, 
    visited: Set<string>, 
    recursionStack: Set<string>, 
    path: string[]
  ): void {
    visited.add(current);
    recursionStack.add(current);
    path.push(current);

    const node = this.graph.nodes.get(current);
    if (node) {
      for (const dep of node.imports) {
        if (dep.resolvedPath && this.graph.nodes.has(dep.resolvedPath)) {
          const target = dep.resolvedPath;
          
          if (recursionStack.has(target)) {
            // Found a cycle
            const cycleStart = path.indexOf(target);
            const cycle = [...path.slice(cycleStart), target];
            
            this.graph.circularDependencies.push({
              cycle,
              length: cycle.length - 1,
              type: cycle.length === 2 ? 'direct' : 'indirect'
            });
          } else if (!visited.has(target)) {
            this.dfsForCycles(target, visited, recursionStack, path);
          }
        }
      }
    }

    recursionStack.delete(current);
    path.pop();
  }

  private calculateClusters(): void {
    // Simple clustering based on directory structure
    const clusters = new Map<string, ModuleCluster>();

    for (const [filePath] of this.graph.nodes) {
      const dir = path.dirname(filePath);
      const dirName = dir === '.' ? 'root' : dir.split('/')[0];
      
      if (!clusters.has(dirName)) {
        clusters.set(dirName, {
          id: dirName,
          name: dirName,
          files: [],
          internalDependencies: 0,
          externalDependencies: 0,
          cohesion: 0
        });
      }
      
      const cluster = clusters.get(dirName)!;
      cluster.files.push(filePath);
      
      // Update node cluster
      const node = this.graph.nodes.get(filePath);
      if (node) {
        node.cluster = dirName;
      }
    }

    // Calculate cluster metrics
    for (const cluster of clusters.values()) {
      let internal = 0;
      let external = 0;

      for (const filePath of cluster.files) {
        const node = this.graph.nodes.get(filePath);
        if (node) {
          for (const dep of node.imports) {
            if (dep.resolvedPath) {
              const depNode = this.graph.nodes.get(dep.resolvedPath);
              if (depNode?.cluster === cluster.id) {
                internal++;
              } else {
                external++;
              }
            }
          }
        }
      }

      cluster.internalDependencies = internal;
      cluster.externalDependencies = external;
      cluster.cohesion = internal + external > 0 ? internal / (internal + external) : 0;
    }

    this.graph.clusters = Array.from(clusters.values());
  }

  private calculateStats(): void {
    const totalFiles = this.graph.nodes.size;
    const totalDeps = this.graph.edges.length;
    const externalDeps = this.graph.edges.filter(e => {
      const fromNode = this.graph.nodes.get(e.from);
      return fromNode?.imports.some(imp => imp.isExternal) || false;
    }).length;

    let maxConnections = 0;
    let mostConnectedFile = '';
    const leastConnected: string[] = [];

    for (const [filePath, node] of this.graph.nodes) {
      const connections = node.imports.length + node.dependents.length;
      
      if (connections > maxConnections) {
        maxConnections = connections;
        mostConnectedFile = filePath;
      }
      
      if (connections === 0) {
        leastConnected.push(filePath);
      }
    }

    this.graph.stats = {
      totalFiles,
      totalDependencies: totalDeps,
      externalDependencies: externalDeps,
      circularDependencies: this.graph.circularDependencies.length,
      maxDepth: this.calculateMaxDepth(),
      avgDependenciesPerFile: totalFiles > 0 ? totalDeps / totalFiles : 0,
      mostConnectedFile,
      leastConnectedFiles: leastConnected
    };
  }

  private calculateMaxDepth(): number {
    let maxDepth = 0;

    const calculateDepth = (filePath: string, visited: Set<string>): number => {
      if (visited.has(filePath)) return 0; // Avoid cycles
      
      visited.add(filePath);
      const node = this.graph.nodes.get(filePath);
      if (!node) return 0;

      let maxChildDepth = 0;
      for (const dep of node.imports) {
        if (dep.resolvedPath && this.graph.nodes.has(dep.resolvedPath)) {
          const childDepth = calculateDepth(dep.resolvedPath, new Set(visited));
          maxChildDepth = Math.max(maxChildDepth, childDepth);
        }
      }

      visited.delete(filePath);
      return 1 + maxChildDepth;
    };

    for (const [filePath] of this.graph.nodes) {
      const depth = calculateDepth(filePath, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }
}

export async function analyzeDependencies(rootPath: string): Promise<DependencyGraph> {
  const analyzer = new DependencyAnalyzer(rootPath);
  return analyzer.analyzeDependencies(rootPath);
}