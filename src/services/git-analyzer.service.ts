import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ChurnMetrics } from '../types/health-analysis.types';
import { MetricsCache } from './metrics-cache.service';

const execAsync = promisify(exec);

/**
 * Service for analyzing git repository history and file churn patterns
 * 
 * Provides analysis of commit frequency, author diversity, and change patterns
 * for individual files. Includes graceful fallback for repositories without
 * git history or when git commands fail.
 */
export class GitAnalyzer {
  private cache: MetricsCache;
  private workspaceRoot: string;

  constructor(cache: MetricsCache, workspaceRoot: string) {
    this.cache = cache;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Get comprehensive churn metrics for a file
   * @param filePath Path to the file relative to workspace root
   * @param days Number of days to analyze (default: 30)
   * @returns Promise resolving to churn metrics
   */
  async getFileChurn(filePath: string, days: number = 30): Promise<ChurnMetrics> {
    // Check cache first
    const cached = this.cache.getChurnMetrics<ChurnMetrics>(filePath, days);
    if (cached) {
      return cached;
    }

    try {
      // Get all churn data in parallel for better performance
      const [commitCount, uniqueAuthors, lastModified, daysSinceLastChange] = await Promise.all([
        this.getCommitCount(filePath, days),
        this.getUniqueAuthorsCount(filePath, days),
        this.getLastModifiedDate(filePath),
        this.getDaysSinceLastChange(filePath)
      ]);

      const metrics: ChurnMetrics = {
        commitCount,
        uniqueAuthors,
        lastModified,
        daysSinceLastChange
      };

      // Cache the results
      this.cache.setChurnMetrics(filePath, metrics, days);
      
      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[GitAnalyzer] Git analysis failed for ${filePath}: ${errorMessage}`);
      
      // Fallback to file system metadata
      return this.createFallbackChurnMetrics(filePath);
    }
  }

  /**
   * Get list of unique authors who modified a file
   * @param filePath Path to the file relative to workspace root
   * @param days Number of days to analyze (default: 30)
   * @returns Promise resolving to array of author names
   */
  async getFileAuthors(filePath: string, days: number = 30): Promise<string[]> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const gitCommand = [
        'git log',
        `--since="${sinceDate.toISOString()}"`,
        '--format="%an"',
        '--follow',
        '--',
        `"${filePath}"`
      ].join(' ');

      const output = await this.execGitCommand(gitCommand);
      const authors = output
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(author => author.replace(/"/g, '')) // Remove quotes
        .filter((author, index, array) => array.indexOf(author) === index); // Unique authors

      return authors;
    } catch (error) {
      console.warn(`[GitAnalyzer] Failed to get authors for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get commit count for a file in the specified time period
   * @param filePath Path to the file relative to workspace root
   * @param days Number of days to analyze
   * @returns Promise resolving to commit count
   */
  private async getCommitCount(filePath: string, days: number): Promise<number> {
    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      
      const gitCommand = [
        'git log',
        `--since="${sinceDate.toISOString()}"`,
        '--oneline',
        '--follow',
        '--',
        `"${filePath}"`
      ].join(' ');

      const output = await this.execGitCommand(gitCommand);
      const lines = output.trim().split('\n').filter(Boolean);
      
      return lines.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get number of unique authors who modified a file
   * @param filePath Path to the file relative to workspace root
   * @param days Number of days to analyze
   * @returns Promise resolving to unique author count
   */
  private async getUniqueAuthorsCount(filePath: string, days: number): Promise<number> {
    try {
      const authors = await this.getFileAuthors(filePath, days);
      return authors.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get the last modified date of a file from git history
   * @param filePath Path to the file relative to workspace root
   * @returns Promise resolving to last modified date
   */
  private async getLastModifiedDate(filePath: string): Promise<Date> {
    try {
      const gitCommand = [
        'git log',
        '-1',
        '--format="%ci"',
        '--follow',
        '--',
        `"${filePath}"`
      ].join(' ');

      const output = await this.execGitCommand(gitCommand);
      const dateString = output.trim().replace(/"/g, '');
      
      if (dateString) {
        return new Date(dateString);
      }
    } catch (error) {
      // Fallback to file system modification time
    }
    
    // Fallback to file system stats
    try {
      const fullPath = path.join(this.workspaceRoot, filePath);
      const stats = fs.statSync(fullPath);
      return stats.mtime;
    } catch (error) {
      return new Date(0); // Epoch time as ultimate fallback
    }
  }

  /**
   * Get number of days since the file was last changed
   * @param filePath Path to the file relative to workspace root
   * @returns Promise resolving to days since last change
   */
  private async getDaysSinceLastChange(filePath: string): Promise<number> {
    try {
      const lastModified = await this.getLastModifiedDate(filePath);
      const now = new Date();
      const diffMs = now.getTime() - lastModified.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      return Math.max(0, diffDays);
    } catch (error) {
      return 999; // Large number to indicate unknown/very old
    }
  }

  /**
   * Execute git command with proper error handling
   * @param command Git command to execute
   * @returns Promise resolving to command output
   */
  private async execGitCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workspaceRoot,
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      if (stderr && !stderr.includes('warning:')) {
        console.warn(`[GitAnalyzer] Git command warning: ${stderr}`);
      }

      return stdout;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('not a git repository')) {
        throw new Error('Not a git repository');
      } else if (errorMessage.includes('timeout')) {
        throw new Error('Git command timed out');
      } else if (errorMessage.includes('ENOENT')) {
        throw new Error('Git command not found - ensure git is installed');
      }
      
      throw error;
    }
  }

  /**
   * Create fallback churn metrics when git analysis fails
   * @param filePath Path to the file relative to workspace root
   * @returns Fallback churn metrics based on file system
   */
  private createFallbackChurnMetrics(filePath: string): ChurnMetrics {
    try {
      const fullPath = path.join(this.workspaceRoot, filePath);
      const stats = fs.statSync(fullPath);
      const daysSinceLastChange = Math.floor(
        (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        commitCount: 0,
        uniqueAuthors: 0,
        lastModified: stats.mtime,
        daysSinceLastChange: Math.max(0, daysSinceLastChange)
      };
    } catch (error) {
      console.warn(`[GitAnalyzer] Failed to create fallback metrics for ${filePath}:`, error);
      
      // Ultimate fallback
      return {
        commitCount: 0,
        uniqueAuthors: 0,
        lastModified: new Date(0),
        daysSinceLastChange: 999
      };
    }
  }

  /**
   * Analyze multiple files in batch for better performance
   * @param filePaths Array of file paths to analyze
   * @param days Number of days to analyze (default: 30)
   * @returns Promise resolving to array of churn metrics
   */
  async analyzeFiles(filePaths: string[], days: number = 30): Promise<ChurnMetrics[]> {
    const BATCH_SIZE = 5; // Smaller batch size for git operations
    const results: ChurnMetrics[] = [];
    
    // Process files in smaller batches to avoid overwhelming git
    for (let i = 0; i < filePaths.length; i += BATCH_SIZE) {
      const batch = filePaths.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(filePath => this.getFileChurn(filePath, days))
      );
      
      results.push(...batchResults);
      
      // Small delay between batches to be gentle on git
      if (i + BATCH_SIZE < filePaths.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Get repository-wide churn statistics
   * @param filePaths Array of file paths to analyze
   * @param days Number of days to analyze (default: 30)
   * @returns Promise resolving to churn statistics
   */
  async getChurnStats(filePaths: string[], days: number = 30): Promise<{
    totalFiles: number;
    filesWithCommits: number;
    totalCommits: number;
    averageCommitsPerFile: number;
    mostActiveFile: { path: string; commits: number } | null;
    uniqueAuthors: number;
    averageDaysSinceChange: number;
  }> {
    const metrics = await this.analyzeFiles(filePaths, days);
    
    const filesWithCommits = metrics.filter(m => m.commitCount > 0).length;
    const totalCommits = metrics.reduce((sum, m) => sum + m.commitCount, 0);
    const averageCommitsPerFile = filesWithCommits > 0 ? totalCommits / filesWithCommits : 0;
    
    // Find most active file
    let mostActiveFile: { path: string; commits: number } | null = null;
    let maxCommits = 0;
    
    for (let i = 0; i < metrics.length; i++) {
      if (metrics[i].commitCount > maxCommits) {
        maxCommits = metrics[i].commitCount;
        mostActiveFile = {
          path: filePaths[i],
          commits: maxCommits
        };
      }
    }
    
    // Count unique authors across all files
    const allAuthors = new Set<string>();
    for (const filePath of filePaths) {
      try {
        const authors = await this.getFileAuthors(filePath, days);
        authors.forEach(author => allAuthors.add(author));
      } catch (error) {
        // Continue with other files
      }
    }
    
    const averageDaysSinceChange = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.daysSinceLastChange, 0) / metrics.length
      : 0;
    
    return {
      totalFiles: metrics.length,
      filesWithCommits,
      totalCommits,
      averageCommitsPerFile: Math.round(averageCommitsPerFile * 100) / 100,
      mostActiveFile,
      uniqueAuthors: allAuthors.size,
      averageDaysSinceChange: Math.round(averageDaysSinceChange * 100) / 100
    };
  }

  /**
   * Check if the workspace is a git repository
   * @returns Promise resolving to true if git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.execGitCommand('git rev-parse --git-dir');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear churn cache for specific file or all files
   * @param filePath Optional specific file path to clear
   * @param days Optional days parameter for specific cache entry
   */
  clearCache(filePath?: string, days?: number): void {
    if (filePath) {
      const key = MetricsCache.getChurnKey(filePath, days || 30);
      this.cache.delete(key);
    } else {
      // Clear all churn-related cache entries
      // This is a simplified approach - in a real implementation,
      // we might want to track churn keys separately
      this.cache.clear();
    }
  }
}