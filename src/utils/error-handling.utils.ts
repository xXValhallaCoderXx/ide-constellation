/**
 * Error handling utilities for health analysis services
 * 
 * Provides centralized error handling, logging, and graceful degradation
 * utilities for the risk analysis engine components.
 */

export interface ErrorContext {
  service: string;
  operation: string;
  filePath?: string;
  additionalInfo?: Record<string, any>;
}

export interface ErrorHandlingOptions {
  logLevel: 'error' | 'warn' | 'info';
  includeStack: boolean;
  fallbackValue?: any;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Enhanced error handler with context and fallback support
 */
export class ErrorHandler {
  
  /**
   * Handle errors with context and optional fallback
   * @param error The error that occurred
   * @param context Context information about where the error occurred
   * @param options Error handling options
   * @returns Fallback value if provided, otherwise re-throws
   */
  static handle<T>(
    error: unknown, 
    context: ErrorContext, 
    options: Partial<ErrorHandlingOptions> = {}
  ): T {
    const opts: ErrorHandlingOptions = {
      logLevel: 'error',
      includeStack: false,
      retryCount: 0,
      retryDelay: 1000,
      ...options
    };

    const errorMessage = error instanceof Error ? error.message : String(error);
    const logMessage = this.formatErrorMessage(errorMessage, context);

    // Log the error based on level
    switch (opts.logLevel) {
      case 'error':
        console.error(logMessage);
        if (opts.includeStack && error instanceof Error) {
          console.error(error.stack);
        }
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.log(logMessage);
        break;
    }

    // Return fallback value if provided
    if (opts.fallbackValue !== undefined) {
      return opts.fallbackValue as T;
    }

    // Re-throw the error if no fallback
    throw error;
  }

  /**
   * Handle file system errors with specific fallbacks
   * @param error File system error
   * @param filePath Path to the file that caused the error
   * @param fallbackValue Value to return on error
   * @returns Fallback value
   */
  static handleFileSystemError<T>(
    error: unknown, 
    filePath: string, 
    fallbackValue: T
  ): T {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide specific guidance for common file system errors
    if (errorMessage.includes('ENOENT')) {
      console.warn(`[FileSystem] File not found: ${filePath}`);
    } else if (errorMessage.includes('EACCES') || errorMessage.includes('EPERM')) {
      console.warn(`[FileSystem] Permission denied accessing: ${filePath}`);
      console.warn('[FileSystem] Check file permissions and ensure the file is not locked');
    } else if (errorMessage.includes('EMFILE') || errorMessage.includes('ENFILE')) {
      console.warn(`[FileSystem] Too many open files. Consider reducing batch size.`);
    } else {
      console.warn(`[FileSystem] Error accessing ${filePath}: ${errorMessage}`);
    }

    return fallbackValue;
  }

  /**
   * Handle git command errors with specific fallbacks
   * @param error Git command error
   * @param command Git command that failed
   * @param fallbackValue Value to return on error
   * @returns Fallback value
   */
  static handleGitError<T>(
    error: unknown, 
    command: string, 
    fallbackValue: T
  ): T {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide specific guidance for common git errors
    if (errorMessage.includes('not a git repository')) {
      console.info('[Git] Not a git repository - using file system fallback');
    } else if (errorMessage.includes('timeout')) {
      console.warn('[Git] Command timed out - consider reducing analysis scope');
    } else if (errorMessage.includes('ENOENT')) {
      console.warn('[Git] Git command not found - ensure git is installed and in PATH');
    } else if (errorMessage.includes('fatal: bad revision')) {
      console.warn('[Git] Invalid git revision - repository may be corrupted');
    } else {
      console.warn(`[Git] Command failed (${command}): ${errorMessage}`);
    }

    return fallbackValue;
  }

  /**
   * Handle memory-related errors during batch processing
   * @param error Memory or processing error
   * @param batchInfo Information about the current batch
   * @returns Suggested recovery action
   */
  static handleBatchProcessingError(
    error: unknown, 
    batchInfo: { batchIndex: number; batchSize: number; totalBatches: number }
  ): 'continue' | 'reduce_batch_size' | 'abort' {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('out of memory') || errorMessage.includes('ENOMEM')) {
      console.error(`[BatchProcessor] Out of memory in batch ${batchInfo.batchIndex + 1}/${batchInfo.totalBatches}`);
      console.error('[BatchProcessor] Consider reducing batch size or increasing available memory');
      return 'reduce_batch_size';
    } else if (errorMessage.includes('timeout')) {
      console.warn(`[BatchProcessor] Timeout in batch ${batchInfo.batchIndex + 1}/${batchInfo.totalBatches}`);
      console.warn('[BatchProcessor] Continuing with next batch');
      return 'continue';
    } else {
      console.error(`[BatchProcessor] Batch ${batchInfo.batchIndex + 1} failed: ${errorMessage}`);
      return 'continue';
    }
  }

  /**
   * Retry operation with exponential backoff
   * @param operation Function to retry
   * @param maxRetries Maximum number of retries
   * @param baseDelay Base delay in milliseconds
   * @returns Promise resolving to operation result
   */
  static async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          break;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Format error message with context
   * @param errorMessage Original error message
   * @param context Error context
   * @returns Formatted error message
   */
  private static formatErrorMessage(errorMessage: string, context: ErrorContext): string {
    const parts = [`[${context.service}]`];
    
    if (context.operation) {
      parts.push(`${context.operation} failed`);
    }
    
    if (context.filePath) {
      parts.push(`for ${context.filePath}`);
    }
    
    parts.push(`- ${errorMessage}`);
    
    if (context.additionalInfo) {
      const infoString = Object.entries(context.additionalInfo)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`(${infoString})`);
    }
    
    return parts.join(' ');
  }
}

/**
 * Graceful degradation utilities
 */
export class GracefulDegradation {
  
  /**
   * Create minimal file metrics when analysis fails
   * @param nodeId Node identifier
   * @param filePath File path
   * @returns Minimal file metrics
   */
  static createMinimalFileMetrics(nodeId: string, filePath: string) {
    return {
      nodeId,
      path: filePath,
      complexity: { linesOfCode: 0, fileSize: 0 },
      churn: { 
        commitCount: 0, 
        uniqueAuthors: 0, 
        lastModified: new Date(0), 
        daysSinceLastChange: 999 
      },
      dependencies: 0
    };
  }

  /**
   * Create fallback health analysis when full analysis fails
   * @param totalFiles Number of files that were attempted
   * @returns Basic health analysis
   */
  static createFallbackHealthAnalysis(totalFiles: number) {
    return {
      timestamp: new Date().toISOString(),
      totalFiles,
      healthScore: 50, // Neutral score when we can't analyze
      riskScores: [],
      distribution: { low: 0, medium: 0, high: 0, critical: 0 },
      topRisks: [],
      recommendations: [
        '⚠️ Health analysis was unable to complete due to errors.',
        '🔧 Check file permissions and ensure git is available.',
        '📊 Try analyzing a smaller subset of files first.'
      ]
    };
  }

  /**
   * Check system resources and suggest optimizations
   * @returns Resource optimization suggestions
   */
  static checkSystemResources(): {
    memoryUsage: NodeJS.MemoryUsage;
    suggestions: string[];
  } {
    const memoryUsage = process.memoryUsage();
    const suggestions: string[] = [];
    
    // Check memory usage (in MB)
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    
    if (heapUsedMB > 100) {
      suggestions.push('High memory usage detected. Consider reducing batch size.');
    }
    
    if (heapTotalMB > 200) {
      suggestions.push('Large heap size. Consider running garbage collection between batches.');
    }
    
    const memoryUtilization = heapUsedMB / heapTotalMB;
    if (memoryUtilization > 0.8) {
      suggestions.push('Memory utilization is high. Consider clearing caches or reducing concurrent operations.');
    }
    
    return { memoryUsage, suggestions };
  }
}

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();
  
  /**
   * Start timing an operation
   * @param operationId Unique identifier for the operation
   */
  static startTimer(operationId: string): void {
    this.timers.set(operationId, Date.now());
  }
  
  /**
   * End timing and log duration
   * @param operationId Operation identifier
   * @param logThreshold Only log if duration exceeds threshold (ms)
   * @returns Duration in milliseconds
   */
  static endTimer(operationId: string, logThreshold: number = 1000): number {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] No start time found for operation: ${operationId}`);
      return 0;
    }
    
    const duration = Date.now() - startTime;
    this.timers.delete(operationId);
    
    if (duration > logThreshold) {
      console.log(`[PerformanceMonitor] ${operationId} took ${duration}ms`);
    }
    
    return duration;
  }
  
  /**
   * Monitor memory usage during operation
   * @param operationId Operation identifier
   * @returns Current memory usage
   */
  static checkMemory(operationId: string): NodeJS.MemoryUsage {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    console.log(`[PerformanceMonitor] ${operationId} - Memory: ${heapUsedMB}MB`);
    
    return memoryUsage;
  }
}