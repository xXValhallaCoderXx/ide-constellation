/**
 * Dependency Analysis Engine
 * 
 * This module provides a robust, standalone analysis engine that integrates
 * dependency-cruiser to generate structured JSON representations of file
 * dependency graphs within a workspace.
 */

import { cruise } from 'dependency-cruiser';
import * as fs from 'fs';
import * as path from 'path';

// Logger for debugging purposes
class AnalyzerLogger {
  private static instance: AnalyzerLogger;
  
  static getInstance(): AnalyzerLogger {
    if (!AnalyzerLogger.instance) {
      AnalyzerLogger.instance = new AnalyzerLogger();
    }
    return AnalyzerLogger.instance;
  }
  
  error(message: string, error?: Error, context?: any): void {
    const timestamp: string = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level: 'ERROR',
      message,
      error: error?.message,
      stack: error?.stack,
      context
    };
    
    // In a VS Code extension context, this would use the output channel
    // For now, we'll use console.error for debugging
    console.error('[Dependency Analyzer]', JSON.stringify(logEntry, null, 2));
  }
  
  warn(message: string, context?: any): void {
    const timestamp: string = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level: 'WARN',
      message,
      context
    };
    
    console.warn('[Dependency Analyzer]', JSON.stringify(logEntry, null, 2));
  }
  
  info(message: string, context?: any): void {
    const timestamp: string = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level: 'INFO',
      message,
      context
    };
    
    console.info('[Dependency Analyzer]', JSON.stringify(logEntry, null, 2));
  }
}

// Core data model interfaces
export interface DependencyGraph {
  modules: DependencyModule[];
  summary: {
    totalDependencies: number;
    violations: Violation[];
    error?: string;
  };
}

export interface DependencyModule {
  source: string;
  dependencies: Dependency[];
  dependents: string[];
}

export interface Dependency {
  resolved: string;
  coreModule: boolean;
  followable: boolean;
  dynamic: boolean;
}

export interface Violation {
  from: string;
  to: string;
  rule: {
    severity: string;
    name: string;
  };
}

// Error handling interfaces
export interface AnalysisError {
  type: 'syntax' | 'filesystem' | 'library' | 'configuration';
  message: string;
  workspacePath: string;
  timestamp: string;
}

// Validation result interface
interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

// Logger entry interface for structured logging
interface LogEntry {
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  error?: string;
  stack?: string;
  context?: any;
}

// Dependency-cruiser configuration interface
interface CruiseOptions {
  outputType: 'json';
  includeOnly?: string;
  exclude?: string | string[];
  doNotFollow?: string | string[];
  focus?: string;
  maxDepth?: number;
  moduleSystems?: any[];
  tsPreCompilationDeps?: boolean;
  preserveSymlinks?: boolean;
  combinedDependencies?: boolean;
}

// Empty dependency graph structure for fallback scenarios
export interface EmptyDependencyGraph extends DependencyGraph {
  modules: [];
  summary: {
    error: string;
    totalDependencies: 0;
    violations: [];
  };
}

/**
 * Creates a fallback empty dependency graph with error information
 * 
 * @param errorMessage - The error message to include
 * @param errorType - The type of error that occurred
 * @param workspacePath - The workspace path that caused the error
 * @returns EmptyDependencyGraph - A safe fallback graph structure
 */
function createFallbackGraph(errorMessage: string, errorType: AnalysisError['type'], workspacePath: string): EmptyDependencyGraph {
  const logger = AnalyzerLogger.getInstance();
  
  // Log the error for debugging purposes
  logger.error(`Dependency analysis failed: ${errorMessage}`, undefined, {
    errorType,
    workspacePath,
    timestamp: new Date().toISOString()
  });
  
  return {
    modules: [],
    summary: {
      error: errorMessage,
      totalDependencies: 0,
      violations: []
    }
  };
}

/**
 * Recursively searches for analyzable files in a directory
 * 
 * @param dirPath - Directory path to search
 * @param maxDepth - Maximum depth to search (default: 3)
 * @param currentDepth - Current search depth (internal use)
 * @returns boolean - True if analyzable files are found
 */
function hasAnalyzableFiles(dirPath: string, maxDepth: number = 3, currentDepth: number = 0): boolean {
  const logger: AnalyzerLogger = AnalyzerLogger.getInstance();
  
  try {
    // Prevent infinite recursion and limit search depth for performance
    if (currentDepth >= maxDepth) {
      return false;
    }
    
    const entries: fs.Dirent[] = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath: string = path.join(dirPath, entry.name);
      
      if (entry.isFile()) {
        // Check if file has analyzable extension
        const analyzableExtensions: string[] = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
        const hasAnalyzableExtension: boolean = analyzableExtensions.some(ext => entry.name.endsWith(ext));
        
        if (hasAnalyzableExtension) {
          logger.info('Found analyzable file', { filePath: fullPath, fileName: entry.name });
          return true;
        }
      } else if (entry.isDirectory()) {
        // Skip common directories that shouldn't be analyzed
        const skipDirectories: string[] = ['node_modules', 'dist', 'build', '.git', '.vscode', 'coverage', '.nyc_output'];
        const shouldSkip: boolean = skipDirectories.includes(entry.name) || entry.name.startsWith('.');
        
        if (!shouldSkip) {
          // Recursively search subdirectories
          const hasFiles: boolean = hasAnalyzableFiles(fullPath, maxDepth, currentDepth + 1);
          if (hasFiles) {
            return true;
          }
        }
      }
    }
    
    return false;
    
  } catch (error) {
    logger.error('Error searching for analyzable files', 
      error instanceof Error ? error : new Error(String(error)), 
      { dirPath, currentDepth }
    );
    return false;
  }
}

/**
 * Validates workspace path and checks if it exists, is accessible, and contains analyzable files
 * 
 * @param workspacePath - Path to validate
 * @returns ValidationResult - Validation result with optional error message
 */
function validateWorkspacePath(workspacePath: string): ValidationResult {
  const logger: AnalyzerLogger = AnalyzerLogger.getInstance();
  
  try {
    // Check if path is provided
    if (!workspacePath || typeof workspacePath !== 'string') {
      return { isValid: false, errorMessage: 'Workspace path is required and must be a string' };
    }
    
    // Trim whitespace and normalize path
    const normalizedPath: string = workspacePath.trim();
    if (normalizedPath.length === 0) {
      return { isValid: false, errorMessage: 'Workspace path cannot be empty' };
    }
    
    // Check if path exists
    if (!fs.existsSync(normalizedPath)) {
      return { isValid: false, errorMessage: `Workspace path does not exist: ${normalizedPath}` };
    }
    
    // Check if it's a directory
    const stats: fs.Stats = fs.statSync(normalizedPath);
    if (!stats.isDirectory()) {
      return { isValid: false, errorMessage: `Workspace path is not a directory: ${normalizedPath}` };
    }
    
    // Check if we can read the directory
    try {
      fs.accessSync(normalizedPath, fs.constants.R_OK);
    } catch (accessError) {
      return { 
        isValid: false, 
        errorMessage: `Cannot read workspace directory: ${accessError instanceof Error ? accessError.message : 'Permission denied'}` 
      };
    }
    
    // Check if workspace contains analyzable files
    const hasFiles: boolean = hasAnalyzableFiles(normalizedPath);
    if (!hasFiles) {
      logger.warn('No analyzable files found in workspace', { workspacePath: normalizedPath });
      return { 
        isValid: false, 
        errorMessage: `Workspace does not contain any analyzable files (JavaScript/TypeScript): ${normalizedPath}` 
      };
    }
    
    logger.info('Workspace path validation successful', { 
      workspacePath: normalizedPath,
      hasAnalyzableFiles: true 
    });
    return { isValid: true };
    
  } catch (error) {
    const errorMessage: string = `Cannot access workspace path: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error('Workspace path validation failed', error instanceof Error ? error : new Error(String(error)), { workspacePath });
    return { isValid: false, errorMessage };
  }
}

/**
 * Main analysis function that generates a dependency graph for the given workspace
 * 
 * @param workspacePath - Absolute path to the workspace root directory
 * @returns Promise<DependencyGraph> - Structured JSON object representing the file dependency graph
 * 
 * This function integrates with dependency-cruiser to analyze file dependencies
 * and provides comprehensive error handling to ensure the extension remains stable
 * even when encountering problematic code or directories.
 */
export async function generateDependencyGraph(workspacePath: string): Promise<DependencyGraph> {
  const logger: AnalyzerLogger = AnalyzerLogger.getInstance();
  
  try {
    logger.info('Starting dependency analysis', { workspacePath });
    
    // Comprehensive workspace path validation
    const validation: ValidationResult = validateWorkspacePath(workspacePath);
    if (!validation.isValid) {
      return createFallbackGraph(
        validation.errorMessage || 'Invalid workspace path',
        'filesystem',
        workspacePath
      );
    }

    // Use normalized path for analysis
    const normalizedWorkspacePath: string = path.resolve(workspacePath.trim());

    // Configure dependency-cruiser with optimized settings for VS Code workspace structure
    const cruiseOptions: CruiseOptions = {
      outputType: 'json',
      
      // Include only JavaScript/TypeScript files with comprehensive pattern matching
      includeOnly: '\\.(js|mjs|cjs|jsx|ts|tsx)$',
      
      // Exclude patterns optimized for typical project structures
      exclude: [
        // Package manager directories
        'node_modules',
        'bower_components',
        'jspm_packages',
        
        // Build and distribution directories
        'dist',
        'build',
        'out',
        'lib',
        'target',
        'bin',
        
        // Version control and IDE directories
        '\\.git',
        '\\.svn',
        '\\.hg',
        '\\.vscode',
        '\\.idea',
        
        // Test coverage and temporary directories
        'coverage',
        '\\.nyc_output',
        '\\.tmp',
        'tmp',
        'temp',
        
        // Cache directories
        '\\.cache',
        '\\.parcel-cache',
        '\\.next',
        '\\.nuxt',
        
        // Log files and OS-specific files
        '\\.(log|logs)$',
        '\\.DS_Store$',
        'Thumbs\\.db$',
        
        // Common config and documentation files that don't contain dependencies
        '\\.md$',
        '\\.txt$',
        '\\.json$',
        '\\.yml$',
        '\\.yaml$',
        '\\.xml$',
        '\\.toml$',
        '\\.ini$'
      ],
      
      // Do not follow these patterns to improve performance
      doNotFollow: [
        'node_modules',
        'bower_components',
        'jspm_packages',
        '\\.d\\.ts$'  // TypeScript declaration files
      ],
      
      // Limit analysis depth for performance optimization
      maxDepth: 10,
      
      // Support multiple module systems commonly used in VS Code workspaces
      moduleSystems: ['amd', 'cjs', 'es6', 'tsd'] as any,
      
      // Enable TypeScript pre-compilation dependency detection
      tsPreCompilationDeps: true,
      
      // Preserve symlinks for monorepo support
      preserveSymlinks: false,
      
      // Combine dependencies for cleaner output
      combinedDependencies: false
    };

    logger.info('Configured dependency-cruiser options', { cruiseOptions });

    try {
      // Wrap dependency-cruiser call in comprehensive try-catch
      let cruiseResult: any;
      try {
        // Use relative path pattern for dependency-cruiser when working with absolute paths
        // dependency-cruiser works better when analyzing from within the target directory
        const originalCwd = process.cwd();
        process.chdir(normalizedWorkspacePath);
        
        try {
          cruiseResult = await cruise(['.'], cruiseOptions);
          logger.info('Dependency-cruiser analysis completed successfully');
        } finally {
          // Always restore working directory
          process.chdir(originalCwd);
        }
      } catch (cruiseError) {
        // Handle dependency-cruiser specific errors
        logger.error('Dependency-cruiser execution failed', 
          cruiseError instanceof Error ? cruiseError : new Error(String(cruiseError)),
          { workspacePath: normalizedWorkspacePath, cruiseOptions }
        );
        
        return createFallbackGraph(
          `Dependency analysis library error: ${cruiseError instanceof Error ? cruiseError.message : 'Unknown library error'}`,
          'library',
          normalizedWorkspacePath
        );
      }

      // Validate cruise result structure
      if (!cruiseResult || typeof cruiseResult !== 'object') {
        logger.error('Invalid cruise result structure', undefined, { 
          cruiseResult: typeof cruiseResult,
          workspacePath: normalizedWorkspacePath 
        });
        
        return createFallbackGraph(
          'Invalid analysis result from dependency-cruiser',
          'library',
          normalizedWorkspacePath
        );
      }

      // Parse the output if it's a JSON string
      let parsedOutput: any;
      try {
        if (typeof cruiseResult.output === 'string') {
          parsedOutput = JSON.parse(cruiseResult.output);
        } else {
          parsedOutput = cruiseResult.output;
        }
      } catch (parseError) {
        logger.error('Failed to parse dependency-cruiser output', 
          parseError instanceof Error ? parseError : new Error(String(parseError)),
          { workspacePath: normalizedWorkspacePath }
        );
        
        return createFallbackGraph(
          `Failed to parse analysis results: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`,
          'library',
          normalizedWorkspacePath
        );
      }

      // Validate parsed output structure
      if (!parsedOutput || typeof parsedOutput !== 'object') {
        logger.error('Invalid parsed output structure', undefined, { 
          parsedOutput: typeof parsedOutput,
          workspacePath: normalizedWorkspacePath 
        });
        
        return createFallbackGraph(
          'Invalid parsed analysis result structure',
          'library',
          normalizedWorkspacePath
        );
      }

      try {
        // Transform dependency-cruiser output to our DependencyGraph format
        const dependencyGraph: DependencyGraph = {
          modules: parsedOutput.modules?.map((module: any) => ({
            source: module.source || '',
            dependencies: module.dependencies?.map((dep: any) => ({
              resolved: dep.resolved || '',
              coreModule: Boolean(dep.coreModule),
              followable: Boolean(dep.followable),
              dynamic: Boolean(dep.dynamic)
            })) || [],
            dependents: Array.isArray(module.dependents) ? module.dependents : []
          })) || [],
          summary: {
            totalDependencies: parsedOutput.summary?.totalCruised || 0,
            violations: parsedOutput.summary?.violations?.map((violation: any) => ({
              from: violation.from || '',
              to: violation.to || '',
              rule: {
                severity: violation.rule?.severity || 'unknown',
                name: violation.rule?.name || 'unknown'
              }
            })) || []
          }
        };

        logger.info('Successfully transformed dependency graph', {
          moduleCount: dependencyGraph.modules.length,
          totalDependencies: dependencyGraph.summary.totalDependencies,
          violationCount: dependencyGraph.summary.violations.length
        });

        return dependencyGraph;
        
      } catch (transformError) {
        // Handle errors during result transformation
        logger.error('Failed to transform dependency-cruiser output', 
          transformError instanceof Error ? transformError : new Error(String(transformError)),
          { workspacePath: normalizedWorkspacePath, resultStructure: Object.keys(parsedOutput) }
        );
        
        return createFallbackGraph(
          `Failed to process analysis results: ${transformError instanceof Error ? transformError.message : 'Unknown transformation error'}`,
          'library',
          normalizedWorkspacePath
        );
      }

    } catch (analysisError) {
      // Handle errors related to analysis operations
      logger.error('Analysis operation failed', 
        analysisError instanceof Error ? analysisError : new Error(String(analysisError)),
        { workspacePath: normalizedWorkspacePath }
      );
      
      return createFallbackGraph(
        `Analysis error: ${analysisError instanceof Error ? analysisError.message : 'Unknown analysis error'}`,
        'library',
        normalizedWorkspacePath
      );
    }

  } catch (unexpectedError) {
    // Catch any unexpected errors to ensure function never throws
    logger.error('Unexpected error during dependency analysis', 
      unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError)),
      { workspacePath }
    );
    
    return createFallbackGraph(
      `Unexpected analysis error: ${unexpectedError instanceof Error ? unexpectedError.message : 'Unknown error'}`,
      'configuration',
      workspacePath
    );
  }
}