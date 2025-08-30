/**
 * Impact Analyzer Service
 * 
 * Analyzes the blast radius and downstream impact of code changes by traversing
 * dependency graphs and calculating risk scores with actionable recommendations.
 */

import { GraphService } from '../graph.service';
import { IConstellationGraph } from '../../types/graph.types';
import {
    TraceImpactInput,
    ImpactAnalysis,
    ImpactedFile,
    ImpactLevel,
    ChangeType,
    TraversalResult,
    ImpactAnalysisConfig,
    RiskScoreFactors,
    DEFAULT_CONFIG,
    CHANGE_TYPE_MULTIPLIERS,
    IMPACT_LEVEL_COLORS
} from './impact-types';
import * as path from 'path';

/**
 * Cache entry for impact analysis results
 */
interface CacheEntry {
    result: ImpactAnalysis;
    timestamp: number;
    inputHash: string;
}

/**
 * Service for analyzing the impact of code changes on dependent files
 */
export class ImpactAnalyzer {
    private graphService: GraphService;
    private config: ImpactAnalysisConfig;
    private cache: Map<string, CacheEntry> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private readonly MAX_CACHE_SIZE = 100;

    constructor(graphService?: GraphService, config?: Partial<ImpactAnalysisConfig>) {
        this.graphService = graphService || GraphService.getInstance();
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Periodic cache cleanup
        setInterval(() => this.cleanupCache(), 60000); // Every minute
    }

    /**
     * Analyze the impact of a proposed change to a target file
     * @param input Impact analysis parameters
     * @returns Complete impact analysis with risk score and recommendations
     */
    public async analyzeImpact(input: TraceImpactInput): Promise<ImpactAnalysis> {
        const startTime = Date.now();

        try {
            // Validate input parameters with detailed error messages
            this.validateInput(input);

            // Check cache first
            const cacheKey = this.generateCacheKey(input);
            const cachedResult = this.getCachedResult(cacheKey);
            if (cachedResult) {
                console.log(`[ImpactAnalyzer] Cache hit for ${input.target} (${Date.now() - startTime}ms)`);
                return cachedResult;
            }

            // Ensure we have graph data with comprehensive checks
            let graph: IConstellationGraph;
            try {
                const graphData = this.graphService.getGraph();
                if (!graphData) {
                    throw new Error('No graph data available. Please scan the project first.');
                }
                graph = graphData;
            } catch (error) {
                throw new Error(`Failed to retrieve graph data: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Validate graph data integrity
            if (!this.validateGraphIntegrity(graph)) {
                throw new Error('Graph data is corrupted or incomplete. Please rescan the project.');
            }

            // Check for empty graph
            if (graph.nodes.length === 0) {
                throw new Error('Graph contains no nodes. The project may be empty or not properly scanned.');
            }

            // Normalize target path and verify it exists in graph
            let normalizedTarget: string;
            try {
                normalizedTarget = this.normalizeFilePath(input.target);
            } catch (error) {
                throw new Error(`Failed to normalize target path: ${error instanceof Error ? error.message : String(error)}`);
            }

            if (!this.nodeExistsInGraph(normalizedTarget, graph)) {
                // Provide helpful suggestions for missing files
                const suggestions = this.findSimilarNodes(normalizedTarget, graph);
                const suggestionText = suggestions.length > 0
                    ? ` Did you mean one of: ${suggestions.slice(0, 3).join(', ')}?`
                    : ' Make sure the file path is correct and the project has been scanned.';
                throw new Error(`Target file not found in dependency graph: ${input.target}.${suggestionText}`);
            }

            // Perform dependency traversal with timeout and error handling
            const depth = Math.min(input.depth || DEFAULT_CONFIG.maxDepth, 5);
            let traversalResult: TraversalResult;

            try {
                // Add timeout protection for large graphs
                const traversalPromise = this.traverseDependencies(normalizedTarget, depth);
                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Dependency traversal timed out')), 30000);
                });

                traversalResult = await Promise.race([traversalPromise, timeoutPromise]);

                if (!traversalResult) {
                    throw new Error('Traversal returned no results');
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes('timed out')) {
                    throw new Error('Dependency traversal timed out. The graph may be too large or contain complex cycles.');
                }
                throw new Error(`Dependency traversal failed: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Validate traversal results
            if (!traversalResult.discoveredNodes || traversalResult.discoveredNodes.size === 0) {
                throw new Error('Invalid traversal results: discovered nodes set is missing or empty');
            }

            // Convert traversal results to impacted files with error handling
            let impactedFiles: ImpactedFile[];
            try {
                impactedFiles = this.createImpactedFiles(
                    normalizedTarget,
                    traversalResult,
                    graph,
                    input.changeType
                );

                if (!Array.isArray(impactedFiles)) {
                    throw new Error('Failed to create impacted files array');
                }
            } catch (error) {
                throw new Error(`Failed to process impacted files: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Calculate risk score with validation
            let riskScore: number;
            try {
                riskScore = this.calculateRiskScore(impactedFiles, input.changeType);

                if (typeof riskScore !== 'number' || isNaN(riskScore)) {
                    throw new Error('Risk score calculation returned invalid result');
                }

                // Clamp risk score to valid range
                riskScore = Math.max(0, Math.min(10, riskScore));
            } catch (error) {
                console.warn('[ImpactAnalyzer] Risk score calculation failed, using fallback:', error);
                riskScore = this.calculateFallbackRiskScore(impactedFiles);
            }

            // Generate recommendations with error handling
            let recommendations: string[];
            try {
                recommendations = this.generateRecommendations(
                    impactedFiles,
                    riskScore,
                    traversalResult.circularPaths
                );

                if (!Array.isArray(recommendations)) {
                    throw new Error('Recommendations generation returned invalid result');
                }
            } catch (error) {
                console.warn('[ImpactAnalyzer] Recommendations generation failed, using fallback:', error);
                recommendations = this.generateFallbackRecommendations(riskScore);
            }

            const analysisTimeMs = Date.now() - startTime;

            const result: ImpactAnalysis = {
                target: normalizedTarget,
                changeType: input.changeType,
                impactedFiles,
                riskScore,
                circularDependencies: traversalResult.circularPaths,
                recommendations,
                metadata: {
                    timestamp: new Date().toISOString(),
                    depth,
                    analysisTimeMs
                }
            };

            // Cache the result for future use
            this.cacheResult(cacheKey, result);

            console.log(`[ImpactAnalyzer] Analysis completed and cached: ${impactedFiles.length} files, ${analysisTimeMs}ms`);
            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[ImpactAnalyzer] Analysis failed:', errorMessage);
            throw new Error(`Impact analysis failed: ${errorMessage}`);
        }
    }

    /**
     * Traverse dependencies starting from target node
     * @param targetNode Starting node for traversal
     * @param maxDepth Maximum depth to traverse
     * @returns Traversal results with discovered nodes and circular dependencies
     */
    private traverseDependencies(targetNode: string, maxDepth: number): TraversalResult {
        const startTime = Date.now();
        const discoveredNodes = new Set<string>();
        const nodeDistances = new Map<string, number>();
        const circularPaths: string[][] = [];
        const visited = new Set<string>();
        const currentPath: string[] = [];
        let operationCount = 0;

        // Performance limits with adaptive scaling
        const maxOperations = Math.min(10000, this.config.maxNodes * 10);
        const maxCircularPaths = 50; // Limit circular path tracking
        const performanceCheckInterval = 1000; // Check performance every N operations
        let lastPerformanceCheck = startTime;

        // Validate inputs
        if (!targetNode || typeof targetNode !== 'string') {
            throw new Error('Invalid target node for traversal');
        }

        if (typeof maxDepth !== 'number' || maxDepth < 0) {
            throw new Error('Invalid max depth for traversal');
        }

        // Recursive traversal function with enhanced error handling
        const traverse = (nodeId: string, distance: number): void => {
            try {
                // Increment operation counter and check limits
                operationCount++;

                // Periodic performance checks
                if (operationCount % performanceCheckInterval === 0) {
                    const currentTime = Date.now();
                    const elapsedTime = currentTime - startTime;
                    const timeSinceLastCheck = currentTime - lastPerformanceCheck;

                    // Check for timeout (prevent hanging on large graphs)
                    if (elapsedTime > 25000) { // 25 second timeout
                        console.warn(`[ImpactAnalyzer] Traversal timeout reached after ${elapsedTime}ms, stopping early`);
                        return;
                    }

                    // Check if performance is degrading (too slow)
                    const operationsPerSecond = performanceCheckInterval / (timeSinceLastCheck / 1000);
                    if (operationsPerSecond < 100 && elapsedTime > 5000) { // Less than 100 ops/sec after 5 seconds
                        console.warn(`[ImpactAnalyzer] Performance degraded (${operationsPerSecond.toFixed(1)} ops/sec), stopping early`);
                        return;
                    }

                    lastPerformanceCheck = currentTime;
                }

                // Check operation limit (prevent infinite loops)
                if (operationCount > maxOperations) {
                    console.warn(`[ImpactAnalyzer] Maximum operations (${maxOperations}) reached, stopping traversal`);
                    return;
                }

                // Early termination for very large impact sets
                if (discoveredNodes.size >= this.config.maxNodes) {
                    console.warn(`[ImpactAnalyzer] Maximum nodes (${this.config.maxNodes}) reached, stopping traversal`);
                    return;
                }

                // Check depth and node count limits
                if (distance > maxDepth || discoveredNodes.size >= this.config.maxNodes) {
                    return;
                }

                // Validate node ID
                if (!nodeId || typeof nodeId !== 'string') {
                    console.warn('[ImpactAnalyzer] Invalid node ID encountered during traversal:', nodeId);
                    return;
                }

                // Check for circular dependency
                if (currentPath.includes(nodeId)) {
                    const cycleStart = currentPath.indexOf(nodeId);
                    const cycle = [...currentPath.slice(cycleStart), nodeId];

                    // Limit circular path tracking to prevent memory issues
                    if (circularPaths.length < maxCircularPaths) {
                        circularPaths.push(cycle);
                    } else if (circularPaths.length === maxCircularPaths) {
                        console.warn(`[ImpactAnalyzer] Maximum circular paths (${maxCircularPaths}) reached, stopping circular path tracking`);
                    }
                    return;
                }

                // Add to discovered nodes
                discoveredNodes.add(nodeId);
                nodeDistances.set(nodeId, distance);
                currentPath.push(nodeId);

                // Get dependents with error handling
                let dependents: string[] = [];
                try {
                    dependents = this.graphService.getDependentsOf(nodeId);

                    // Validate dependents array
                    if (!Array.isArray(dependents)) {
                        console.warn('[ImpactAnalyzer] Invalid dependents array for node:', nodeId);
                        dependents = [];
                    }
                } catch (error) {
                    console.warn('[ImpactAnalyzer] Failed to get dependents for node:', nodeId, error);
                    dependents = [];
                }

                // Traverse dependents with validation
                for (const dependent of dependents) {
                    if (dependent && typeof dependent === 'string' && !visited.has(dependent)) {
                        traverse(dependent, distance + 1);
                    }
                }

                // Remove from current path (backtrack)
                currentPath.pop();
                visited.add(nodeId);

            } catch (error) {
                console.warn('[ImpactAnalyzer] Error during node traversal:', nodeId, error);
                // Continue traversal despite individual node errors
                if (currentPath.length > 0) {
                    currentPath.pop();
                }
            }
        };

        try {
            // Start traversal from target node
            traverse(targetNode, 0);

            // Validate results
            if (discoveredNodes.size === 0) {
                console.warn('[ImpactAnalyzer] No nodes discovered during traversal');
            }

            const result: TraversalResult = {
                discoveredNodes,
                nodeDistances,
                circularPaths,
                truncated: discoveredNodes.size >= this.config.maxNodes || operationCount >= maxOperations
            };

            console.log(`[ImpactAnalyzer] Traversal completed: ${discoveredNodes.size} nodes, ${circularPaths.length} cycles, ${Date.now() - startTime}ms`);

            return result;

        } catch (error) {
            console.error('[ImpactAnalyzer] Traversal failed:', error);

        // Return partial results if available
            return {
                discoveredNodes,
                nodeDistances,
                circularPaths,
                truncated: true
            };
        }
    }

    /**
     * Convert traversal results to impacted file objects
     * @param targetNode The target file being changed
     * @param traversalResult Results from dependency traversal
     * @param graph Graph data for file information
     * @param changeType Type of change being made
     * @returns Array of impacted files with impact levels
     */
    private createImpactedFiles(
        targetNode: string,
        traversalResult: TraversalResult,
        graph: IConstellationGraph,
        changeType: ChangeType
    ): ImpactedFile[] {
        const impactedFiles: ImpactedFile[] = [];

        for (const nodeId of traversalResult.discoveredNodes) {
            // Skip the target node itself
            if (nodeId === targetNode) {
                continue;
            }

            const distance = traversalResult.nodeDistances.get(nodeId) || 0;
            const impactLevel = this.determineImpactLevel(distance);
            const node = graph.nodes.find(n => n.id === nodeId);

            if (!node) {
                console.warn(`[ImpactAnalyzer] Node not found in graph: ${nodeId}`);
                continue;
            }

            impactedFiles.push({
                nodeId,
                path: node.path,
                impactLevel,
                distance,
                reason: this.generateImpactReason(distance, changeType, impactLevel),
                color: IMPACT_LEVEL_COLORS[impactLevel]
            });
        }

        // Sort by impact level (critical first) then by distance
        return impactedFiles.sort((a, b) => {
            const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            const levelDiff = levelOrder[a.impactLevel] - levelOrder[b.impactLevel];
            return levelDiff !== 0 ? levelDiff : a.distance - b.distance;
        });
    }

    /**
     * Determine impact level based on distance from target
     * @param distance Number of hops from target file
     * @returns Impact level classification
     */
    private determineImpactLevel(distance: number): ImpactLevel {
        switch (distance) {
            case 1:
                return ImpactLevel.CRITICAL;
            case 2:
                return ImpactLevel.HIGH;
            case 3:
                return ImpactLevel.MEDIUM;
            default:
                return ImpactLevel.LOW;
        }
    }

    /**
     * Generate human-readable reason for why a file is impacted
     * @param distance Distance from target file
     * @param changeType Type of change being made
     * @param impactLevel Calculated impact level
     * @returns Human-readable impact reason
     */
    private generateImpactReason(
        distance: number,
        changeType: ChangeType,
        impactLevel: ImpactLevel
    ): string {
        const changeVerb = this.getChangeVerb(changeType);

        switch (impactLevel) {
            case ImpactLevel.CRITICAL:
                return `Directly imports the ${changeVerb} file - will break immediately`;
            case ImpactLevel.HIGH:
                return `Depends on files that import the ${changeVerb} file - likely affected`;
            case ImpactLevel.MEDIUM:
                return `Indirectly depends on the ${changeVerb} file - may be affected`;
            case ImpactLevel.LOW:
                return `Distant dependency on the ${changeVerb} file - unlikely to be affected`;
            default:
                return `Connected to the ${changeVerb} file through dependency chain`;
        }
    }

    /**
     * Get appropriate verb for change type
     * @param changeType Type of change
     * @returns Human-readable verb
     */
    private getChangeVerb(changeType: ChangeType): string {
        switch (changeType) {
            case ChangeType.DELETE:
                return 'deleted';
            case ChangeType.REFACTOR:
                return 'refactored';
            case ChangeType.MODIFY:
                return 'modified';
            case ChangeType.ADD_FEATURE:
                return 'enhanced';
            default:
                return 'changed';
        }
    }

    /**
     * Validate input parameters
     * @param input Input parameters to validate
     * @throws Error if validation fails
     */
    private validateInput(input: TraceImpactInput): void {
        if (!input.target || typeof input.target !== 'string') {
            throw new Error('Target file path is required and must be a string');
        }

        if (!Object.values(ChangeType).includes(input.changeType)) {
            throw new Error(`Invalid change type: ${input.changeType}. Must be one of: ${Object.values(ChangeType).join(', ')}`);
        }

        if (input.depth !== undefined) {
            if (typeof input.depth !== 'number' || input.depth < 1 || input.depth > 5) {
                throw new Error('Depth must be a number between 1 and 5');
            }
        }
    }

    /**
     * Normalize file path for consistent comparison
     * @param filePath File path to normalize
     * @returns Normalized file path
     */
    private normalizeFilePath(filePath: string): string {
        // Remove leading slash and normalize path separators
        return filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    }

    /**
     * Check if a node exists in the graph
     * @param nodeId Node ID to check
     * @param graph Graph to search
     * @returns True if node exists
     */
    private nodeExistsInGraph(nodeId: string, graph: IConstellationGraph): boolean {
        return graph.nodes.some(node => node.id === nodeId);
    }

    /**
     * Calculate risk score based on impacted files and change type
     * @param impactedFiles List of impacted files
     * @param changeType Type of change being made
     * @returns Risk score from 0-10
     */
    private calculateRiskScore(impactedFiles: ImpactedFile[], changeType: ChangeType): number {
        const factors = this.calculateRiskFactors(impactedFiles, changeType);

        // Calculate base score using weighted impact levels
        const baseScore = (
            (factors.directImpacts * 100) +
            (factors.secondaryImpacts * 50) +
            (factors.tertiaryImpacts * 25) +
            (factors.circularDeps * 200) // Circular deps are very risky
        );

        // Apply change type multiplier
        const adjustedScore = baseScore * factors.changeTypeMultiplier;

        // Normalize to 0-10 scale with logarithmic scaling for better distribution
        const normalizedScore = this.normalizeRiskScore(adjustedScore);

        return Math.round(normalizedScore * 10) / 10; // Round to 1 decimal place
    }

    /**
     * Calculate detailed risk factors from impacted files
     * @param impactedFiles List of impacted files
     * @param changeType Type of change being made
     * @returns Detailed risk factors
     */
    private calculateRiskFactors(impactedFiles: ImpactedFile[], changeType: ChangeType): RiskScoreFactors {
        const factors: RiskScoreFactors = {
            directImpacts: 0,
            secondaryImpacts: 0,
            tertiaryImpacts: 0,
            circularDeps: 0,
            changeTypeMultiplier: CHANGE_TYPE_MULTIPLIERS[changeType]
        };

        // Count impacts by level
        for (const file of impactedFiles) {
            switch (file.impactLevel) {
                case ImpactLevel.CRITICAL:
                    factors.directImpacts++;
                    break;
                case ImpactLevel.HIGH:
                    factors.secondaryImpacts++;
                    break;
                case ImpactLevel.MEDIUM:
                case ImpactLevel.LOW:
                    factors.tertiaryImpacts++;
                    break;
            }
        }

        return factors;
    }

    /**
     * Normalize risk score to 0-10 scale with logarithmic scaling
     * @param rawScore Raw calculated score
     * @returns Normalized score between 0-10
     */
    private normalizeRiskScore(rawScore: number): number {
        if (rawScore <= 0) return 0;
        if (rawScore >= 1000) return 10;

        // Use logarithmic scaling for better distribution
        // This prevents very small changes from getting 0 and very large changes from maxing out
        const logScore = Math.log10(rawScore + 1) / Math.log10(1001); // +1 to handle 0, 1001 for max

        return Math.min(10, Math.max(0, logScore * 10));
    }

    /**
     * Generate actionable recommendations based on analysis results
     * @param impactedFiles List of impacted files
     * @param riskScore Calculated risk score
     * @param circularPaths Detected circular dependencies
     * @returns Array of recommendation strings
     */
    private generateRecommendations(
        impactedFiles: ImpactedFile[],
        riskScore: number,
        circularPaths: string[][]
    ): string[] {
        const recommendations: string[] = [];

        // Risk-based recommendations using thresholds from types
        if (riskScore >= 7) {
            recommendations.push('🚩 Consider feature flag deployment to enable safe rollback');
            recommendations.push('⏰ Schedule deployment during low-traffic window');
        }

        if (riskScore >= 5) {
            recommendations.push('🧪 Write integration tests first to catch breaking changes');
        }

        // File count and impact level recommendations
        const criticalFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL);
        const highImpactFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH);

        if (criticalFiles.length > 10) {
            recommendations.push('📦 Consider breaking this change into smaller, incremental changes');
        }

        if (criticalFiles.length > 0) {
            recommendations.push(`⚠️ ${criticalFiles.length} files will break immediately - review carefully`);
        }

        // Circular dependency recommendations
        if (circularPaths.length > 0) {
            recommendations.push('🔄 Resolve circular dependencies before refactoring to prevent cascading issues');
            if (circularPaths.length > 1) {
                recommendations.push(`📊 ${circularPaths.length} circular dependency chains detected`);
            }
        }

        // Test coverage recommendations with prioritization
        const topRiskFiles = [...criticalFiles, ...highImpactFiles]
            .slice(0, 3)
            .sort((a, b) => a.distance - b.distance); // Prioritize by proximity

        if (topRiskFiles.length > 0) {
            const fileNames = topRiskFiles.map(f => path.basename(f.path)).join(', ');
            recommendations.push(`🎯 Priority test coverage needed: ${fileNames}`);
        }

        // Domain-specific recommendations based on file patterns
        const domainRecommendations = this.generateDomainSpecificRecommendations(impactedFiles);
        recommendations.push(...domainRecommendations);

        // Change type specific recommendations
        const changeTypeRecommendations = this.generateChangeTypeRecommendations(impactedFiles, riskScore);
        recommendations.push(...changeTypeRecommendations);

        return recommendations;
    }

    /**
     * Generate domain-specific recommendations based on affected file patterns
     * @param impactedFiles List of impacted files
     * @returns Array of domain-specific recommendations
     */
    private generateDomainSpecificRecommendations(impactedFiles: ImpactedFile[]): string[] {
        const recommendations: string[] = [];
        const filePaths = impactedFiles.map(f => f.path.toLowerCase());

        // Authentication/Security related
        if (filePaths.some(p => p.includes('auth') || p.includes('security') || p.includes('login'))) {
            recommendations.push('🔐 Authentication system affected - verify security implications');
        }

        // Database/Data layer
        if (filePaths.some(p => p.includes('database') || p.includes('model') || p.includes('repository'))) {
            recommendations.push('💾 Data layer affected - consider database migration needs');
        }

        // API/External interfaces
        if (filePaths.some(p => p.includes('api') || p.includes('controller') || p.includes('endpoint'))) {
            recommendations.push('🌐 API endpoints affected - check backward compatibility');
        }

        // Configuration/Environment
        if (filePaths.some(p => p.includes('config') || p.includes('env') || p.includes('setting'))) {
            recommendations.push('⚙️ Configuration files affected - verify environment consistency');
        }

        // UI/Frontend components
        if (filePaths.some(p => p.includes('component') || p.includes('view') || p.includes('ui'))) {
            recommendations.push('🎨 UI components affected - test user-facing functionality');
        }

        return recommendations;
    }

    /**
     * Generate recommendations specific to the type of change being made
     * @param impactedFiles List of impacted files
     * @param riskScore Calculated risk score
     * @returns Array of change-type specific recommendations
     */
    private generateChangeTypeRecommendations(impactedFiles: ImpactedFile[], riskScore: number): string[] {
        const recommendations: string[] = [];

        // High-risk change recommendations
        if (riskScore >= 8) {
            recommendations.push('🚨 High-risk change detected - consider pair programming');
            recommendations.push('📋 Create detailed rollback plan before deployment');
        }

        // Performance considerations for large impact sets
        if (impactedFiles.length > 50) {
            recommendations.push('⚡ Large impact set - monitor performance after deployment');
        }

        // Documentation recommendations
        if (riskScore >= 6) {
            recommendations.push('📚 Update documentation for affected components');
        }

        return recommendations;
    }

    /**
     * Validate graph data integrity
     * @param graph Graph data to validate
     * @returns True if graph is valid, false otherwise
     */
    private validateGraphIntegrity(graph: IConstellationGraph): boolean {
        try {
            // Check basic structure
            if (!graph || typeof graph !== 'object') {
                return false;
            }

            // Check nodes array
            if (!Array.isArray(graph.nodes)) {
                return false;
            }

            // Check edges array
            if (!Array.isArray(graph.edges)) {
                return false;
            }

            // Validate node structure (sample check)
            if (graph.nodes.length > 0) {
                const sampleNode = graph.nodes[0];
                if (!sampleNode.id || typeof sampleNode.id !== 'string') {
                    return false;
                }
            }

            // Validate edge structure (sample check)
            if (graph.edges.length > 0) {
                const sampleEdge = graph.edges[0];
                if (!sampleEdge.source || !sampleEdge.target) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn('[ImpactAnalyzer] Graph validation failed:', error);
            return false;
        }
    }

    /**
     * Find similar node names for helpful error messages
     * @param targetPath Target path that wasn't found
     * @param graph Graph to search in
     * @returns Array of similar node paths
     */
    private findSimilarNodes(targetPath: string, graph: IConstellationGraph): string[] {
        try {
            const targetBasename = path.basename(targetPath).toLowerCase();
            const targetDir = path.dirname(targetPath).toLowerCase();

            const similarities = graph.nodes
                .map(node => {
                    const nodeBasename = path.basename(node.id).toLowerCase();
                    const nodeDir = path.dirname(node.id).toLowerCase();

                    let score = 0;

                    // Exact basename match
                    if (nodeBasename === targetBasename) {
                        score += 10;
                    }

                    // Partial basename match
                    if (nodeBasename.includes(targetBasename) || targetBasename.includes(nodeBasename)) {
                        score += 5;
                    }

                    // Directory similarity
                    if (nodeDir === targetDir) {
                        score += 3;
                    }

                    return { node: node.id, score };
                })
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(item => item.node);

            return similarities;
        } catch (error) {
            console.warn('[ImpactAnalyzer] Failed to find similar nodes:', error);
            return [];
        }
    }

    /**
     * Calculate fallback risk score when normal calculation fails
     * @param impactedFiles List of impacted files
     * @returns Fallback risk score
     */
    private calculateFallbackRiskScore(impactedFiles: ImpactedFile[]): number {
        try {
            if (!Array.isArray(impactedFiles) || impactedFiles.length === 0) {
                return 0;
            }

            // Simple fallback: base score on number of impacted files
            const fileCount = impactedFiles.length;

            if (fileCount >= 50) return 9;
            if (fileCount >= 20) return 7;
            if (fileCount >= 10) return 5;
            if (fileCount >= 5) return 3;
            if (fileCount >= 1) return 1;

            return 0;
        } catch (error) {
            console.warn('[ImpactAnalyzer] Fallback risk score calculation failed:', error);
            return 5; // Default medium risk
        }
    }

    /**
     * Generate fallback recommendations when normal generation fails
     * @param riskScore Current risk score
     * @returns Array of fallback recommendations
     */
    private generateFallbackRecommendations(riskScore: number): string[] {
        try {
            const recommendations: string[] = [];

            if (riskScore >= 7) {
                recommendations.push('⚠️ HIGH RISK: Thoroughly test all functionality before deploying');
                recommendations.push('🧪 Run comprehensive test suite including integration tests');
                recommendations.push('👥 Consider peer review and additional code review');
            } else if (riskScore >= 4) {
                recommendations.push('⚡ MEDIUM RISK: Test related functionality carefully');
                recommendations.push('🧪 Run unit tests for affected components');
            } else {
                recommendations.push('✅ LOW RISK: Standard testing should be sufficient');
            }

            recommendations.push('📋 Review change impact before committing');

            return recommendations;
        } catch (error) {
            console.warn('[ImpactAnalyzer] Fallback recommendations generation failed:', error);
            return ['📋 Please review your changes carefully before committing'];
        }
    }

    /**
     * Generate cache key for input parameters
     * @param input Impact analysis input
     * @returns Cache key string
     */
    private generateCacheKey(input: TraceImpactInput): string {
        const graphVersion = this.graphService.getGraph()?.nodes.length || 0;
        const inputString = JSON.stringify({
            target: input.target,
            changeType: input.changeType,
            depth: input.depth,
            graphVersion // Include graph version to invalidate cache when graph changes
        });

        // Simple hash function for cache key
        let hash = 0;
        for (let i = 0; i < inputString.length; i++) {
            const char = inputString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return `impact_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Get cached result if available and not expired
     * @param cacheKey Cache key to lookup
     * @returns Cached result or null
     */
    private getCachedResult(cacheKey: string): ImpactAnalysis | null {
        const entry = this.cache.get(cacheKey);
        if (!entry) {
            return null;
        }

        // Check if cache entry is expired
        if (Date.now() - entry.timestamp > this.CACHE_TTL) {
            this.cache.delete(cacheKey);
            return null;
        }

        // Return a deep copy to prevent mutation
        return JSON.parse(JSON.stringify(entry.result));
    }

    /**
     * Cache analysis result
     * @param cacheKey Cache key
     * @param result Analysis result to cache
     */
    private cacheResult(cacheKey: string, result: ImpactAnalysis): void {
        try {
            // Enforce cache size limit
            if (this.cache.size >= this.MAX_CACHE_SIZE) {
                // Remove oldest entries (simple LRU)
                const oldestKey = this.cache.keys().next().value;
                if (oldestKey) {
                    this.cache.delete(oldestKey);
                }
            }

            // Store cache entry
            this.cache.set(cacheKey, {
                result: JSON.parse(JSON.stringify(result)), // Deep copy
                timestamp: Date.now(),
                inputHash: cacheKey
            });

            console.log(`[ImpactAnalyzer] Cached result for key: ${cacheKey} (cache size: ${this.cache.size})`);
        } catch (error) {
            console.warn('[ImpactAnalyzer] Failed to cache result:', error);
        }
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        let removedCount = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.CACHE_TTL) {
                this.cache.delete(key);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            console.log(`[ImpactAnalyzer] Cache cleanup: removed ${removedCount} expired entries`);
        }
    }

    /**
     * Clear all cached results (useful for testing or when graph changes significantly)
     */
    public clearCache(): void {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`[ImpactAnalyzer] Cache cleared: removed ${size} entries`);
    }

    /**
     * Get cache statistics for monitoring
     * @returns Cache statistics
     */
    public getCacheStats(): { size: number; maxSize: number; ttl: number } {
        return {
            size: this.cache.size,
            maxSize: this.MAX_CACHE_SIZE,
            ttl: this.CACHE_TTL
        };
    }
}