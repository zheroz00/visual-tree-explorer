import { 
  PerformanceMetrics, 
  TimingInfo, 
  OperationBreakdown, 
  MemoryUsage, 
  FilePerformanceInfo, 
  FileComplexity 
} from './types.js';

/**
 * Utility class for tracking performance metrics during file processing
 */
export class PerformanceTracker {
  private startTime: number;
  private breakdown: OperationBreakdown = {};
  private memoryStart: number;
  private peakMemory: number;
  private fileSize: number = 0;
  private lineCount: number = 0;

  constructor() {
    this.startTime = performance.now();
    this.memoryStart = this.getMemoryUsage();
    this.peakMemory = this.memoryStart;
  }

  /**
   * Start timing a specific operation
   */
  startOperation(operation: keyof OperationBreakdown): void {
    this.breakdown[operation] = {
      startTime: performance.now(),
      endTime: 0,
      duration: 0
    };
  }

  /**
   * End timing a specific operation
   */
  endOperation(operation: keyof OperationBreakdown): void {
    const timing = this.breakdown[operation];
    if (timing) {
      timing.endTime = performance.now();
      timing.duration = timing.endTime - timing.startTime;
    }
    
    // Update peak memory usage
    const currentMemory = this.getMemoryUsage();
    if (currentMemory > this.peakMemory) {
      this.peakMemory = currentMemory;
    }
  }

  /**
   * Set file information for performance calculations
   */
  setFileInfo(size: number, lines: number): void {
    this.fileSize = size;
    this.lineCount = lines;
  }

  /**
   * Calculate complexity score based on various factors
   */
  calculateComplexity(symbolCount: number, importCount: number, nestingDepth: number): FileComplexity {
    // Weighted complexity calculation (0-100 scale)
    const sizeScore = Math.min((this.fileSize / 10000) * 20, 30); // 0-30 for size
    const symbolScore = Math.min((symbolCount / 50) * 25, 25);    // 0-25 for symbols
    const importScore = Math.min((importCount / 20) * 20, 20);    // 0-20 for imports
    const nestingScore = Math.min((nestingDepth / 10) * 25, 25);  // 0-25 for nesting
    
    const totalScore = sizeScore + symbolScore + importScore + nestingScore;
    
    return {
      score: Math.round(totalScore),
      factors: {
        symbolCount,
        importCount,
        fileSize: Math.round(sizeScore),
        nestingDepth: Math.round(nestingScore)
      }
    };
  }

  /**
   * Generate final performance metrics
   */
  finish(symbolCount: number = 0, importCount: number = 0, nestingDepth: number = 0): PerformanceMetrics {
    const endTime = performance.now();
    const totalDuration = endTime - this.startTime;
    const memoryEnd = this.getMemoryUsage();

    const total: TimingInfo = {
      startTime: this.startTime,
      endTime,
      duration: totalDuration
    };

    const memory: MemoryUsage = {
      beforeOperation: this.memoryStart,
      afterOperation: memoryEnd,
      peakUsage: this.peakMemory,
      delta: memoryEnd - this.memoryStart
    };

    const complexity = this.calculateComplexity(symbolCount, importCount, nestingDepth);

    const fileInfo: FilePerformanceInfo = {
      fileSize: this.fileSize,
      lineCount: this.lineCount,
      bytesPerMs: totalDuration > 0 ? this.fileSize / totalDuration : 0,
      linesPerMs: totalDuration > 0 ? this.lineCount / totalDuration : 0,
      complexity
    };

    return {
      total,
      breakdown: this.breakdown,
      memory,
      fileInfo
    };
  }

  /**
   * Get current memory usage in MB
   * Uses process.memoryUsage() if available, otherwise returns 0
   */
  private getMemoryUsage(): number {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100; // MB with 2 decimal places
      }
    } catch (error) {
      // Fallback for environments where process.memoryUsage is not available
    }
    return 0;
  }
}

/**
 * Utility function to time an async operation
 */
export async function timeOperation<T>(
  operation: () => Promise<T>,
  tracker: PerformanceTracker,
  operationName: keyof OperationBreakdown
): Promise<T> {
  tracker.startOperation(operationName);
  try {
    const result = await operation();
    tracker.endOperation(operationName);
    return result;
  } catch (error) {
    tracker.endOperation(operationName);
    throw error;
  }
}

/**
 * Utility function to time a synchronous operation
 */
export function timeSync<T>(
  operation: () => T,
  tracker: PerformanceTracker,
  operationName: keyof OperationBreakdown
): T {
  tracker.startOperation(operationName);
  try {
    const result = operation();
    tracker.endOperation(operationName);
    return result;
  } catch (error) {
    tracker.endOperation(operationName);
    throw error;
  }
}

/**
 * Format performance metrics for display
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics): string[] {
  const lines: string[] = [];
  
  // Total time
  lines.push(`⏱️  Total: ${metrics.total.duration.toFixed(2)}ms`);
  
  // Breakdown
  if (Object.keys(metrics.breakdown).length > 0) {
    lines.push(`⚡ Breakdown:`);
    for (const [operation, timing] of Object.entries(metrics.breakdown)) {
      if (timing && timing.duration > 0) {
        lines.push(`   ${getOperationIcon(operation)} ${operation}: ${timing.duration.toFixed(2)}ms`);
      }
    }
  }
  
  // Memory
  if (metrics.memory.delta !== 0) {
    const sign = metrics.memory.delta > 0 ? '+' : '';
    lines.push(`💾 Memory: ${sign}${metrics.memory.delta.toFixed(2)}MB (peak: ${metrics.memory.peakUsage.toFixed(2)}MB)`);
  }
  
  // Throughput
  if (metrics.fileInfo.bytesPerMs > 0) {
    lines.push(`🚀 Throughput: ${metrics.fileInfo.bytesPerMs.toFixed(0)} bytes/ms, ${metrics.fileInfo.linesPerMs.toFixed(1)} lines/ms`);
  }
  
  // Complexity
  const complexity = metrics.fileInfo.complexity;
  if (complexity.score > 0) {
    const complexityIcon = getComplexityIcon(complexity.score);
    lines.push(`${complexityIcon} Complexity: ${complexity.score}/100 (${complexity.factors.symbolCount} symbols, ${complexity.factors.importCount} imports)`);
  }
  
  return lines;
}

function getOperationIcon(operation: string): string {
  const icons: { [key: string]: string } = {
    fileRead: '📖',
    preview: '👁️',
    symbolExtraction: '🔷',
    dependencyAnalysis: '🕸️',
    gitStatus: '🔄',
    search: '🔍'
  };
  return icons[operation] || '⚙️';
}

function getComplexityIcon(score: number): string {
  if (score < 20) return '🟢'; // Low complexity
  if (score < 50) return '🟡'; // Medium complexity
  if (score < 80) return '🟠'; // High complexity
  return '🔴'; // Very high complexity
}