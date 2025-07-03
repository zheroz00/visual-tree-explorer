import { DependencyGraph, DependencyNode, CircularDependency, ModuleCluster } from './types.js';

export function formatDependencyGraph(graph: DependencyGraph): string {
  const lines: string[] = [];
  
  // Header
  lines.push('🕸️  DEPENDENCY GRAPH ANALYSIS');
  lines.push('═'.repeat(50));
  lines.push('');

  // Statistics overview
  lines.push(formatStats(graph));
  lines.push('');

  // Circular dependencies (if any)
  if (graph.circularDependencies.length > 0) {
    lines.push(formatCircularDependencies(graph.circularDependencies));
    lines.push('');
  }

  // Module clusters
  if (graph.clusters.length > 1) {
    lines.push(formatClusters(graph.clusters));
    lines.push('');
  }

  // Main dependency tree
  lines.push(formatDependencyTree(graph));

  return lines.join('\n');
}

function formatStats(graph: DependencyGraph): string {
  const stats = graph.stats;
  const lines: string[] = [];
  
  lines.push('📊 PROJECT STATISTICS');
  lines.push('─'.repeat(30));
  lines.push(`📁 Total Files: ${stats.totalFiles}`);
  lines.push(`🔗 Total Dependencies: ${stats.totalDependencies}`);
  lines.push(`📦 External Packages: ${stats.externalDependencies}`);
  lines.push(`🔄 Circular Dependencies: ${stats.circularDependencies > 0 ? `⚠️  ${stats.circularDependencies}` : '✅ None'}`);
  lines.push(`📏 Max Depth: ${stats.maxDepth} levels`);
  lines.push(`📊 Avg Dependencies/File: ${stats.avgDependenciesPerFile.toFixed(1)}`);
  
  if (stats.mostConnectedFile) {
    lines.push(`🌟 Most Connected: ${stats.mostConnectedFile}`);
  }
  
  if (stats.leastConnectedFiles.length > 0) {
    const count = stats.leastConnectedFiles.length;
    lines.push(`🍃 Isolated Files: ${count} (no dependencies)`);
  }

  return lines.join('\n');
}

function formatCircularDependencies(cycles: CircularDependency[]): string {
  const lines: string[] = [];
  
  lines.push('🔄 CIRCULAR DEPENDENCIES');
  lines.push('─'.repeat(30));
  
  if (cycles.length === 0) {
    lines.push('✅ No circular dependencies detected');
    return lines.join('\n');
  }

  cycles.forEach((cycle, index) => {
    const typeIcon = cycle.type === 'direct' ? '🔴' : '🟡';
    lines.push(`${typeIcon} Cycle ${index + 1} (${cycle.length} files):`);
    
    for (let i = 0; i < cycle.cycle.length - 1; i++) {
      const current = cycle.cycle[i];
      const next = cycle.cycle[i + 1];
      const isLast = i === cycle.cycle.length - 2;
      
      lines.push(`   📄 ${current}`);
      lines.push(`   ${isLast ? '   └─ 🔄' : '   ├─ ➡️'} ${isLast ? 'cycles back to' : 'imports'}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

function formatClusters(clusters: ModuleCluster[]): string {
  const lines: string[] = [];
  
  lines.push('🗂️  MODULE CLUSTERS');
  lines.push('─'.repeat(30));
  
  clusters
    .sort((a, b) => b.cohesion - a.cohesion)
    .forEach(cluster => {
      const cohesionIcon = cluster.cohesion > 0.7 ? '🟢' : cluster.cohesion > 0.4 ? '🟡' : '🔴';
      const cohesionPercent = (cluster.cohesion * 100).toFixed(0);
      
      lines.push(`${cohesionIcon} ${cluster.name} (${cluster.files.length} files, ${cohesionPercent}% cohesion)`);
      lines.push(`   📥 Internal: ${cluster.internalDependencies} deps`);
      lines.push(`   📤 External: ${cluster.externalDependencies} deps`);
      
      // Show some sample files
      const sampleFiles = cluster.files.slice(0, 3);
      sampleFiles.forEach(file => {
        lines.push(`   ├─ 📄 ${file}`);
      });
      
      if (cluster.files.length > 3) {
        lines.push(`   └─ ... and ${cluster.files.length - 3} more`);
      }
      
      lines.push('');
    });

  return lines.join('\n');
}

function formatDependencyTree(graph: DependencyGraph): string {
  const lines: string[] = [];
  
  lines.push('🌳 DEPENDENCY TREE');
  lines.push('─'.repeat(30));

  // Find root nodes (files with no internal dependents)
  const rootNodes: string[] = [];
  const hasInternalDependents = new Set<string>();

  // Mark files that have internal dependents
  for (const [filePath, node] of graph.nodes) {
    for (const dependent of node.dependents) {
      if (graph.nodes.has(dependent)) {
        hasInternalDependents.add(filePath);
      }
    }
  }

  // Root nodes are those without internal dependents
  for (const [filePath] of graph.nodes) {
    if (!hasInternalDependents.has(filePath)) {
      rootNodes.push(filePath);
    }
  }

  // If no clear roots (probably cycles), show all files
  const nodesToShow = rootNodes.length > 0 ? rootNodes : Array.from(graph.nodes.keys());

  // Sort for consistent output
  nodesToShow.sort();

  // Show each tree
  const visited = new Set<string>();
  nodesToShow.forEach((rootNode, index) => {
    if (!visited.has(rootNode)) {
      const isLast = index === nodesToShow.length - 1;
      lines.push(...formatNodeTree(graph, rootNode, '', isLast, visited, new Set()));
    }
  });

  return lines.join('\n');
}

function formatNodeTree(
  graph: DependencyGraph,
  filePath: string,
  prefix: string,
  isLast: boolean,
  globalVisited: Set<string>,
  cycleDetection: Set<string>
): string[] {
  const lines: string[] = [];
  const node = graph.nodes.get(filePath);
  
  if (!node || cycleDetection.has(filePath)) {
    return lines;
  }

  globalVisited.add(filePath);
  cycleDetection.add(filePath);

  // Current node
  const branch = isLast ? '└─' : '├─';
  const nodeIcon = getNodeIcon(node);
  const exportsInfo = node.exports.length > 0 ? ` (exports: ${node.exports.slice(0, 3).join(', ')}${node.exports.length > 3 ? '...' : ''})` : '';
  
  lines.push(`${prefix}${branch} ${nodeIcon} ${node.name}${exportsInfo}`);

  // Dependencies
  const internalDeps = node.imports.filter(dep => 
    dep.resolvedPath && graph.nodes.has(dep.resolvedPath)
  );

  if (internalDeps.length > 0) {
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    
    internalDeps.forEach((dep, index) => {
      const depNode = graph.nodes.get(dep.resolvedPath!);
      if (depNode) {
        const isLastDep = index === internalDeps.length - 1;
        const depBranch = isLastDep ? '└─' : '├─';
        const depIcon = getDependencyIcon(dep.type);
        const importedInfo = dep.imported ? ` {${dep.imported.slice(0, 2).join(', ')}${dep.imported.length > 2 ? '...' : ''}}` : '';
        
        lines.push(`${nextPrefix}${depBranch} ${depIcon} ${depNode.name}${importedInfo}`);
        
        // Recursively show dependencies (but avoid infinite recursion)
        if (!globalVisited.has(dep.resolvedPath!)) {
          const childPrefix = nextPrefix + (isLastDep ? '    ' : '│   ');
          lines.push(...formatNodeTree(graph, dep.resolvedPath!, childPrefix, true, globalVisited, new Set(cycleDetection)));
        } else if (cycleDetection.has(dep.resolvedPath!)) {
          // Show cycle indicator
          lines.push(`${nextPrefix}${isLastDep ? '    ' : '│   '}└─ 🔄 (circular)`);
        }
      }
    });
  }

  cycleDetection.delete(filePath);
  return lines;
}

function getNodeIcon(node: DependencyNode): string {
  const ext = node.name.split('.').pop();
  
  switch (ext) {
    case 'tsx':
    case 'jsx':
      return '⚛️ ';
    case 'ts':
      return '🔷';
    case 'js':
      return '🟨';
    case 'json':
      return '📋';
    case 'css':
    case 'scss':
      return '🎨';
    default:
      return '📄';
  }
}

function getDependencyIcon(type: string): string {
  switch (type) {
    case 'import':
      return '📥';
    case 'require':
      return '📦';
    case 'dynamic':
      return '⚡';
    case 'type':
      return '🔷';
    default:
      return '🔗';
  }
}

export function formatDependencyGraphJson(graph: DependencyGraph): string {
  // Convert Map to object for JSON serialization
  const serializable = {
    nodes: Object.fromEntries(graph.nodes),
    edges: graph.edges,
    clusters: graph.clusters,
    circularDependencies: graph.circularDependencies,
    stats: graph.stats
  };
  
  return JSON.stringify(serializable, null, 2);
}

export function formatCompactDependencyGraph(graph: DependencyGraph): string {
  const lines: string[] = [];
  
  // Compact header
  lines.push(`🕸️  ${graph.stats.totalFiles} files, ${graph.stats.totalDependencies} deps`);
  
  // Show only problematic areas
  if (graph.circularDependencies.length > 0) {
    lines.push(`🔴 ${graph.circularDependencies.length} circular dependencies`);
  }
  
  // Show most connected files
  const sortedNodes = Array.from(graph.nodes.entries())
    .map(([path, node]) => ({
      path,
      connections: node.imports.length + node.dependents.length
    }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5);

  if (sortedNodes.length > 0) {
    lines.push('');
    lines.push('🌟 Most Connected Files:');
    sortedNodes.forEach(({ path, connections }) => {
      lines.push(`   ${connections}x ${path}`);
    });
  }

  return lines.join('\n');
}