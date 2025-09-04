import {
    IConstellationGraph,
    ImpactAnalysisResult,
    IPathResolution,
    IAnalysisMetadata,
    ImpactAnalysisErrorResponse,
    ImpactAnalysisErrorCode
} from '../types/graph.types';
import * as path from 'path';
import { GraphService } from './graph.service';
import { resolveFuzzyPath, normalizePath, isPathWithinWorkspace } from '../utils/path.utils';
import { ErrorHandler, PerformanceMonitor, GracefulDegradation } from '../utils/error-handling.utils';

/**
 * Service for analyzing the impact of changes to files in the codebase.
 * Provides static methods for dependency analysis and impact assessment with
 * comprehensive error handling and graceful degradation.
 */
export class ImpactAnalyzerService {
    /**
     * Result object for fuzzy node resolution.
     */
    static findNodeFuzzy(
        graph: IConstellationGraph,
        inputPath: string,
        workspaceRoot: string
    ): { node: { id: string; path: string; label: string } | null; reason: string } {
        if (!graph || !graph.nodes) {
            return { node: null, reason: 'Graph unavailable' };
        }
        if (!inputPath || typeof inputPath !== 'string') {
            return { node: null, reason: 'No path provided' };
        }

        const raw = inputPath.trim();
        const normalizedInput = normalizePath(raw.replace(/\\/g, '/'));

        // Strategy 1: Exact match on workspace-relative id
        const exact = graph.nodes.find(n => n.id === normalizedInput);
        if (exact) {
            return { node: exact, reason: 'Exact ID match' };
        }

        // Strategy 2: Absolute path match (normalize both sides)
        const absInput = normalizePath(path.isAbsolute(raw) ? raw : path.join(workspaceRoot, raw));
        const absolute = graph.nodes.find(n => normalizePath(n.path) === absInput);
        if (absolute) {
            return { node: absolute, reason: 'Exact absolute path match' };
        }

        // Prepare collections for suffix/filename strategies
        const bySuffix = graph.nodes.filter(n => n.id.endsWith(normalizedInput));
        if (bySuffix.length === 1) {
            return { node: bySuffix[0], reason: 'Unique suffix match' };
        }
        if (bySuffix.length > 1) {
            return { node: null, reason: `Ambiguous suffix: matched ${bySuffix.length} files` };
        }

        const filename = normalizedInput.split('/').pop() || normalizedInput;
        const byFilename = graph.nodes.filter(n => n.label === filename);
        if (byFilename.length === 1) {
            return { node: byFilename[0], reason: 'Unique filename match' };
        }
        if (byFilename.length > 1) {
            return { node: null, reason: `Ambiguous filename: found ${byFilename.length} files named '${filename}'` };
        }

        return { node: null, reason: 'File not found' };
    }

    /**
     * Analyze the impact of changes to a specific file with enhanced error handling.
     * 
     * @param graph - The constellation graph to analyze
     * @param filePath - Path to the file being analyzed
     * @param workspaceRoot - Workspace root for path resolution
     * @param changeType - Optional type of change being made
     * @returns Promise resolving to impact analysis result or error response
     */
    static async analyze(
        graph: IConstellationGraph,
        filePath: string,
        workspaceRoot: string,
        changeType?: string
    ): Promise<ImpactAnalysisResult | ImpactAnalysisErrorResponse> {
        const operationId = `impact-analysis-${Date.now()}`;
        PerformanceMonitor.startTimer(operationId);

        try {
            // Input validation with enhanced error handling
            const validationResult = this.validateInputs(graph, filePath, workspaceRoot);
            if (validationResult !== null) {
                return validationResult;
            }

            // Security validation - check for path traversal attempts
            const securityResult = this.validateSecurity(filePath, workspaceRoot);
            if (securityResult !== null) {
                return securityResult;
            }

            // Monitor memory usage for large graphs
            const memoryCheck = GracefulDegradation.checkSystemResources();
            if (memoryCheck.suggestions.length > 0) {
                console.warn('[ImpactAnalyzer] System resource warnings:', memoryCheck.suggestions);
            }

            // Set timeout for analysis to prevent hanging
            const analysisPromise = this.performAnalysisWithTimeout(
                graph,
                filePath,
                workspaceRoot,
                changeType,
                30000 // 30 second timeout
            );

            const result = await analysisPromise;

            // Log performance metrics
            const analysisTimeMs = PerformanceMonitor.endTimer(operationId, 1000);

            // Add performance metadata to result
            if ('metadata' in result) {
                result.metadata.analysisTimeMs = analysisTimeMs;
            }

            return result;

        } catch (error) {
            PerformanceMonitor.endTimer(operationId);

            return ErrorHandler.handle<ImpactAnalysisErrorResponse>(
                error,
                {
                    service: 'ImpactAnalyzer',
                    operation: 'analyze',
                    filePath,
                    additionalInfo: { workspaceRoot, changeType }
                },
                {
                    logLevel: 'error',
                    includeStack: true,
                    fallbackValue: this.createErrorResponse(
                        'ANALYSIS_TIMEOUT',
                        `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
                        { originalPath: filePath, workspaceRoot, graphAvailable: !!graph }
                    )
                }
            );
        }
    }

    /**
     * Validate inputs with comprehensive error checking
     */
    private static validateInputs(
        graph: IConstellationGraph,
        filePath: string,
        workspaceRoot: string
    ): ImpactAnalysisErrorResponse | null {
        // Graph validation
        if (!graph) {
            return this.createErrorResponse(
                'GRAPH_UNAVAILABLE',
                'Graph data is not available',
                { originalPath: filePath, workspaceRoot, graphAvailable: false },
                [],
                ['Ensure the project has been scanned', 'Try refreshing the graph data']
            );
        }

        if (!graph.nodes || !Array.isArray(graph.nodes)) {
            return this.createErrorResponse(
                'GRAPH_UNAVAILABLE',
                'Graph nodes data is invalid or missing',
                { originalPath: filePath, workspaceRoot, graphAvailable: false },
                [],
                ['Check if the project scan completed successfully', 'Try rescanning the project']
            );
        }

        if (!graph.edges || !Array.isArray(graph.edges)) {
            return this.createErrorResponse(
                'GRAPH_UNAVAILABLE',
                'Graph edges data is invalid or missing',
                { originalPath: filePath, workspaceRoot, graphAvailable: false },
                [],
                ['Check if the project scan completed successfully', 'Try rescanning the project']
            );
        }

        // File path validation
        if (!filePath || typeof filePath !== 'string') {
            return this.createErrorResponse(
                'INVALID_PATH',
                'File path is required and must be a string',
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                [],
                ['Provide a valid file path', 'Check the file path format']
            );
        }

        if (filePath.trim().length === 0) {
            return this.createErrorResponse(
                'INVALID_PATH',
                'File path cannot be empty',
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                [],
                ['Provide a non-empty file path']
            );
        }

        // Workspace root validation
        if (!workspaceRoot || typeof workspaceRoot !== 'string') {
            return this.createErrorResponse(
                'INVALID_PATH',
                'Workspace root is required and must be a string',
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                [],
                ['Ensure workspace root is properly configured']
            );
        }

        return null;
    }

    /**
     * Validate security constraints
     */
    private static validateSecurity(
        filePath: string,
        workspaceRoot: string
    ): ImpactAnalysisErrorResponse | null {
        // Check for obvious path traversal attempts
        const normalizedPath = normalizePath(filePath);

        if (normalizedPath.includes('..') || normalizedPath.includes('~')) {
            return this.createErrorResponse(
                'PATH_SECURITY',
                'Path contains potentially unsafe characters',
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                [],
                ['Use relative paths within the workspace', 'Avoid path traversal characters like ".."']
            );
        }

        // Additional security checks could be added here
        // For example, checking against a blacklist of sensitive paths

        return null;
    }

    /**
     * Perform analysis with timeout protection
     */
    private static async performAnalysisWithTimeout(
        graph: IConstellationGraph,
        filePath: string,
        workspaceRoot: string,
        changeType?: string,
        timeoutMs: number = 30000
    ): Promise<ImpactAnalysisResult | ImpactAnalysisErrorResponse> {
        return new Promise(async (resolve, reject) => {
            // Set up timeout
            const timeoutHandle = setTimeout(() => {
                reject(new Error(`Analysis timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            try {
                const result = await this.performCoreAnalysis(graph, filePath, workspaceRoot, changeType);
                clearTimeout(timeoutHandle);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutHandle);
                reject(error);
            }
        });
    }

    /**
     * Core analysis logic separated for timeout handling
     */
    private static async performCoreAnalysis(
        graph: IConstellationGraph,
        filePath: string,
        workspaceRoot: string,
        changeType?: string
    ): Promise<ImpactAnalysisResult | ImpactAnalysisErrorResponse> {
        const startTime = Date.now();

        // Get all available paths from the graph
        const availablePaths = graph.nodes.map(node => node.id);

        // Resolve the file path with fuzzy matching
        const pathResolution = this.resolveFilePath(filePath, availablePaths, workspaceRoot);

        // Check if path is within workspace bounds
        if (!pathResolution.withinWorkspace) {
            return this.createErrorResponse(
                'WORKSPACE_BOUNDARY_VIOLATION',
                'File path is outside workspace boundaries',
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                pathResolution.suggestions?.map(s => s.path),
                ['Use a path within the workspace boundaries', 'Check the workspace root configuration']
            );
        }

        // Check if we found a valid file
        if (!pathResolution.resolvedPath) {
            return this.createErrorResponse(
                'FILE_NOT_FOUND',
                `File not found: ${filePath}`,
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                pathResolution.suggestions?.map(s => s.path),
                [
                    'Check the file path for typos',
                    'Ensure the file exists in the workspace',
                    'Try using one of the suggested paths if available',
                    'Rescan the project if the file was recently added'
                ]
            );
        }

        const targetFileId = pathResolution.resolvedPath;

        try {
            // Extract dependencies and dependents with error handling
            const dependencies = this.extractDependencies(graph, targetFileId);
            const dependents = this.extractDependents(graph, targetFileId);

            // Create filtered impact graph
            const impactGraph = this.createImpactGraph(graph, targetFileId, dependencies, dependents);

            // Generate human-readable summary
            const impactSummary = this.generateImpactSummary(
                targetFileId,
                dependencies,
                dependents,
                changeType
            );

            // Create analysis metadata
            const analysisTimeMs = Date.now() - startTime;
            const metadata: IAnalysisMetadata = {
                timestamp: new Date().toISOString(),
                analysisTimeMs,
                graphNodeCount: graph.nodes.length,
                cacheUsed: true, // Assuming graph comes from cache in most cases
                changeType
            };

            // Convert path resolution to the expected format
            const formattedPathResolution: IPathResolution = {
                originalPath: pathResolution.originalPath,
                resolvedPath: pathResolution.resolvedPath,
                fuzzyMatched: pathResolution.fuzzyMatched,
                matchConfidence: pathResolution.matchConfidence,
                suggestions: pathResolution.suggestions
            };

            return {
                impactSummary,
                dependents,
                dependencies,
                impactGraph,
                pathResolution: formattedPathResolution,
                metadata
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Handle specific error types
            if (errorMessage.includes('GraphService')) {
                return this.createErrorResponse(
                    'GRAPH_UNAVAILABLE',
                    'Failed to access graph service for dependency lookup',
                    { originalPath: filePath, workspaceRoot, graphAvailable: true },
                    [],
                    ['Check if the graph service is properly initialized', 'Try rescanning the project']
                );
            }

            return this.createErrorResponse(
                'ANALYSIS_TIMEOUT',
                `Analysis failed: ${errorMessage}`,
                { originalPath: filePath, workspaceRoot, graphAvailable: true },
                [],
                ['Try analyzing a smaller file', 'Check system resources', 'Restart the analysis']
            );
        }
    }

    /**
     * Extract files that the target file depends on with error handling.
     */
    private static extractDependencies(graph: IConstellationGraph, targetFileId: string): string[] {
        try {
            return graph.edges
                .filter(edge => edge.source === targetFileId)
                .map(edge => edge.target);
        } catch (error) {
            console.warn(`[ImpactAnalyzer] Failed to extract dependencies for ${targetFileId}:`, error);
            return [];
        }
    }

    /**
     * Extract files that depend on the target file using GraphService reverse index with error handling.
     */
    private static extractDependents(graph: IConstellationGraph, targetFileId: string): string[] {
        try {
            const graphService = GraphService.getInstance();
            return graphService.getDependentsOf(targetFileId);
        } catch (error) {
            console.warn(`[ImpactAnalyzer] Failed to extract dependents for ${targetFileId}:`, error);
            // Fallback: manually search through edges
            try {
                return graph.edges
                    .filter(edge => edge.target === targetFileId)
                    .map(edge => edge.source);
            } catch (fallbackError) {
                console.warn(`[ImpactAnalyzer] Fallback dependency extraction also failed:`, fallbackError);
                return [];
            }
        }
    }

    /**
     * Create a filtered graph containing only the target file and its direct connections with error handling.
     */
    private static createImpactGraph(
        graph: IConstellationGraph,
        targetFileId: string,
        dependencies: string[],
        dependents: string[]
    ): IConstellationGraph {
        try {
            // Collect all relevant node IDs
            const relevantNodeIds = new Set([targetFileId, ...dependencies, ...dependents]);

            // Filter nodes
            const filteredNodes = graph.nodes.filter(node => relevantNodeIds.has(node.id));

            // Filter edges to only include connections involving the target file
            const filteredEdges = graph.edges.filter(edge =>
                (edge.source === targetFileId && relevantNodeIds.has(edge.target)) ||
                (edge.target === targetFileId && relevantNodeIds.has(edge.source))
            );

            return {
                nodes: filteredNodes,
                edges: filteredEdges,
                metadata: {
                    ...graph.metadata,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.warn(`[ImpactAnalyzer] Failed to create impact graph for ${targetFileId}:`, error);
            // Return minimal graph with just the target node
            const targetNode = graph.nodes.find(node => node.id === targetFileId);
            return {
                nodes: targetNode ? [targetNode] : [],
                edges: [],
                metadata: {
                    ...graph.metadata,
                    timestamp: new Date().toISOString()
                }
            };
        }
    }

    /**
     * Generate human-readable impact summary with enhanced messaging.
     */
    private static generateImpactSummary(
        targetFileId: string,
        dependencies: string[],
        dependents: string[],
        changeType?: string
    ): string {
        const fileName = targetFileId.split('/').pop() || targetFileId;
        const changeDescription = changeType ? ` (${changeType})` : '';

        let summary = `Impact analysis for ${fileName}${changeDescription}:\n\n`;

        // Dependencies section
        if (dependencies.length === 0) {
            summary += '• This file has no dependencies on other files in the codebase.\n';
        } else if (dependencies.length === 1) {
            summary += `• This file depends on 1 other file: ${dependencies[0].split('/').pop()}\n`;
        } else {
            summary += `• This file depends on ${dependencies.length} other files.\n`;
            if (dependencies.length <= 5) {
                summary += `  Dependencies: ${dependencies.map(d => d.split('/').pop()).join(', ')}\n`;
            }
        }

        // Dependents section
        if (dependents.length === 0) {
            summary += '• No other files depend on this file - changes should have minimal impact.\n';
        } else if (dependents.length === 1) {
            summary += `• 1 file depends on this file: ${dependents[0].split('/').pop()}\n`;
            summary += '• Changes may affect this dependent file.\n';
        } else {
            summary += `• ${dependents.length} files depend on this file.\n`;
            if (dependents.length <= 5) {
                summary += `  Dependents: ${dependents.map(d => d.split('/').pop()).join(', ')}\n`;
            }
            summary += '• Changes may have significant impact across the codebase.\n';
        }

        // Risk assessment with enhanced messaging
        if (dependents.length === 0) {
            summary += '\n🟢 Low risk: No downstream dependencies detected.';
            if (changeType === 'delete') {
                summary += ' File can be safely removed.';
            }
        } else if (dependents.length <= 3) {
            summary += '\n🟡 Medium risk: Limited downstream dependencies.';
            if (changeType === 'refactor') {
                summary += ' Ensure interface compatibility is maintained.';
            }
        } else {
            summary += '\n🔴 High risk: Many files depend on this file.';
            if (changeType === 'modify interface') {
                summary += ' Breaking changes will affect multiple files.';
            }
        }

        // Add change-specific recommendations
        if (changeType) {
            summary += this.getChangeTypeRecommendations(changeType, dependents.length);
        }

        return summary;
    }

    /**
     * Get recommendations based on change type and impact scope
     */
    private static getChangeTypeRecommendations(changeType: string, dependentCount: number): string {
        const lowerChangeType = changeType.toLowerCase();
        let recommendations = '\n\nRecommendations:\n';

        if (lowerChangeType.includes('delete')) {
            if (dependentCount > 0) {
                recommendations += '• Update or remove all dependent files before deletion\n';
                recommendations += '• Consider deprecation period for public APIs\n';
            } else {
                recommendations += '• Safe to delete - no dependencies found\n';
            }
        } else if (lowerChangeType.includes('refactor')) {
            recommendations += '• Test all dependent files after refactoring\n';
            recommendations += '• Consider backward compatibility if this is a public interface\n';
            if (dependentCount > 5) {
                recommendations += '• Consider phased refactoring approach for large impact\n';
            }
        } else if (lowerChangeType.includes('interface') || lowerChangeType.includes('api')) {
            recommendations += '• Review all dependent files for compatibility\n';
            recommendations += '• Update type definitions and documentation\n';
            recommendations += '• Consider versioning strategy for breaking changes\n';
        } else {
            recommendations += '• Test affected dependent files\n';
            recommendations += '• Review for potential breaking changes\n';
        }

        return recommendations;
    }

    /**
     * Resolve file path with fuzzy matching support and enhanced error handling.
     */
    private static resolveFilePath(
        filePath: string,
        availablePaths: string[],
        workspaceRoot: string
    ): {
        originalPath: string;
        resolvedPath: string | null;
        fuzzyMatched: boolean;
        matchConfidence?: number;
        suggestions?: Array<{ path: string; confidence: number; reason: 'similar_name' | 'partial_path' | 'same_extension' }>;
        withinWorkspace: boolean;
    } {
        try {
            return resolveFuzzyPath(filePath, availablePaths, workspaceRoot);
        } catch (error) {
            console.warn(`[ImpactAnalyzer] Path resolution failed for ${filePath}:`, error);
            // Return fallback result
            return {
                originalPath: filePath,
                resolvedPath: null,
                fuzzyMatched: false,
                suggestions: [],
                withinWorkspace: isPathWithinWorkspace(workspaceRoot, filePath)
            };
        }
    }

    /**
     * Create standardized error response with enhanced context.
     */
    private static createErrorResponse(
        errorCode: ImpactAnalysisErrorCode,
        error: string,
        context?: {
            originalPath?: string;
            workspaceRoot?: string;
            graphAvailable?: boolean;
        },
        suggestions?: string[],
        recoveryActions?: string[]
    ): ImpactAnalysisErrorResponse {
        return {
            error,
            errorCode,
            suggestions,
            recoveryActions,
            context
        };
    }
}