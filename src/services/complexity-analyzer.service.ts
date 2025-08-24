import * as fs from 'fs';
import * as path from 'path';
import { ComplexityMetrics } from '../types/health-analysis.types';
import { MetricsCache } from './metrics-cache.service';

/**
 * Service for analyzing code complexity metrics
 * 
 * Provides file-level complexity analysis including lines of code,
 * cyclomatic complexity, and file size metrics. Supports TypeScript,
 * JavaScript, and fallback analysis for other file types.
 */
export class ComplexityAnalyzer {
  private cache: MetricsCache;

  constructor(cache: MetricsCache) {
    this.cache = cache;
  }

  /**
   * Analyze complexity metrics for a single file
   * @param filePath Path to the file to analyze
   * @returns Promise resolving to complexity metrics
   */
  async analyzeFile(filePath: string): Promise<ComplexityMetrics> {
    // Check cache first
    const cached = this.cache.getComplexityMetrics<ComplexityMetrics>(filePath);
    if (cached) {
      return cached;
    }

    try {
      // Read file content and stats
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();

      let metrics: ComplexityMetrics;

      // Analyze based on file type
      switch (fileExtension) {
        case '.ts':
        case '.tsx':
          metrics = this.analyzeTypeScript(content, stats.size);
          break;
        case '.js':
        case '.jsx':
        case '.mjs':
        case '.cjs':
          metrics = this.analyzeJavaScript(content, stats.size);
          break;
        default:
          metrics = this.analyzeFallback(content, stats.size);
          break;
      }

      // Cache the results
      this.cache.setComplexityMetrics(filePath, metrics);
      
      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[ComplexityAnalyzer] Failed to analyze ${filePath}: ${errorMessage}`);
      
      // Return minimal metrics on error
      return {
        linesOfCode: 0,
        fileSize: 0,
        cyclomaticComplexity: 0
      };
    }
  }

  /**
   * Analyze TypeScript files with enhanced complexity detection
   * @param content File content as string
   * @param fileSize File size in bytes
   * @returns Complexity metrics
   */
  private analyzeTypeScript(content: string, fileSize: number): ComplexityMetrics {
    const linesOfCode = this.countLinesOfCode(content);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);

    return {
      linesOfCode,
      cyclomaticComplexity,
      fileSize
    };
  }

  /**
   * Analyze JavaScript files with complexity detection
   * @param content File content as string
   * @param fileSize File size in bytes
   * @returns Complexity metrics
   */
  private analyzeJavaScript(content: string, fileSize: number): ComplexityMetrics {
    const linesOfCode = this.countLinesOfCode(content);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);

    return {
      linesOfCode,
      cyclomaticComplexity,
      fileSize
    };
  }

  /**
   * Fallback analysis for unsupported file types
   * @param content File content as string
   * @param fileSize File size in bytes
   * @returns Basic complexity metrics
   */
  private analyzeFallback(content: string, fileSize: number): ComplexityMetrics {
    const linesOfCode = this.countLinesOfCode(content);

    return {
      linesOfCode,
      fileSize
      // No cyclomatic complexity for unsupported types
    };
  }

  /**
   * Count lines of code excluding comments and blank lines
   * @param content File content as string
   * @returns Number of lines of code
   */
  private countLinesOfCode(content: string): number {
    const lines = content.split('\n');
    let linesOfCode = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (trimmedLine.length === 0) {
        continue;
      }
      
      // Skip single-line comments
      if (trimmedLine.startsWith('//') || 
          trimmedLine.startsWith('#') || 
          trimmedLine.startsWith('*') ||
          trimmedLine.startsWith('/*') ||
          trimmedLine.startsWith('*/')) {
        continue;
      }
      
      // Skip lines that are only braces or semicolons
      if (/^[{};\s]*$/.test(trimmedLine)) {
        continue;
      }
      
      linesOfCode++;
    }

    return linesOfCode;
  }

  /**
   * Calculate basic cyclomatic complexity
   * @param content File content as string
   * @returns Cyclomatic complexity score
   */
  private calculateCyclomaticComplexity(content: string): number {
    // Start with base complexity of 1
    let complexity = 1;
    
    // Patterns that increase complexity
    const complexityPatterns = [
      // Conditional statements
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\?\s*.*\s*:/g, // Ternary operator
      
      // Loops
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bdo\s*{/g,
      /\bfor\s+\w+\s+in\s+/g, // for...in
      /\bfor\s+\w+\s+of\s+/g, // for...of
      
      // Switch cases
      /\bcase\s+/g,
      
      // Exception handling
      /\bcatch\s*\(/g,
      /\bfinally\s*{/g,
      
      // Logical operators (each && or || adds complexity)
      /&&/g,
      /\|\|/g,
      
      // Function expressions and arrow functions
      /=>\s*{/g,
      /\bfunction\s*\(/g,
      
      // Return statements (multiple returns increase complexity)
      /\breturn\b/g
    ];

    // Count occurrences of complexity-increasing patterns
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        // Different weights for different patterns
        if (pattern.source.includes('return')) {
          // Multiple returns add less complexity than conditionals
          complexity += Math.max(0, matches.length - 1) * 0.5;
        } else if (pattern.source.includes('&&') || pattern.source.includes('||')) {
          // Logical operators add moderate complexity
          complexity += matches.length * 0.5;
        } else {
          // Most patterns add full complexity
          complexity += matches.length;
        }
      }
    }

    return Math.round(complexity);
  }

  /**
   * Analyze multiple files in batch for better performance
   * @param filePaths Array of file paths to analyze
   * @returns Promise resolving to array of complexity metrics
   */
  async analyzeFiles(filePaths: string[]): Promise<ComplexityMetrics[]> {
    const BATCH_SIZE = 10;
    const results: ComplexityMetrics[] = [];
    
    // Process files in batches to avoid overwhelming the system
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(filePath => this.analyzeFile(filePath))
      );
      
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Get complexity statistics for a set of files
   * @param filePaths Array of file paths to analyze
   * @returns Promise resolving to complexity statistics
   */
  async getComplexityStats(filePaths: string[]): Promise<{
    totalFiles: number;
    totalLinesOfCode: number;
    averageComplexity: number;
    maxComplexity: number;
    filesWithHighComplexity: number;
  }> {
    const metrics = await this.analyzeFiles(filePaths);
    
    const totalLinesOfCode = metrics.reduce((sum, m) => sum + m.linesOfCode, 0);
    const complexities = metrics
      .map(m => m.cyclomaticComplexity || 0)
      .filter(c => c > 0);
    
    const averageComplexity = complexities.length > 0 
      ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length 
      : 0;
    
    const maxComplexity = complexities.length > 0 
      ? Math.max(...complexities) 
      : 0;
    
    // Files with complexity > 10 are considered high complexity
    const filesWithHighComplexity = complexities.filter(c => c > 10).length;
    
    return {
      totalFiles: metrics.length,
      totalLinesOfCode,
      averageComplexity: Math.round(averageComplexity * 100) / 100,
      maxComplexity,
      filesWithHighComplexity
    };
  }

  /**
   * Clear complexity cache for specific file or all files
   * @param filePath Optional specific file path to clear
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      const key = MetricsCache.getComplexityKey(filePath);
      this.cache.delete(key);
    } else {
      // Clear all complexity-related cache entries
      // This is a simplified approach - in a real implementation,
      // we might want to track complexity keys separately
      this.cache.clear();
    }
  }
}