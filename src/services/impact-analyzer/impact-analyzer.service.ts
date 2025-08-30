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
 * Service for analyzing the impact of code changes on dependent files
 */
export class ImpactAnalyzer {
    private graphService: GraphService;
    private config: ImpactAnalysisConfig;

    constructor(graphService?: GraphService, config?: Partial<ImpactAnalysisConfig>) {
        this.graphService = graphService || GraphService.getInstance();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Analyze the impact of a proposed change to a target file
     * @param input Impact analysis parameters
     * @returns Complete impact analysis with risk score and recommendations
     */
    public async analyzeImpact(input: TraceImpactInput): Promise<ImpactAnalysis> {
        const startTime = Date.now();

        try {
            // Validate input parameters
            this.validateInput(input);

            // Ensure we have graph data
            const graph = this.graphService.getGraph();
            if (!graph) {
                throw new Error('No graph data available. Please scan the project first.');
            }

            // Normalize target path and verify it exists in graph
            const normalizedTarget = this.normalizeFilePath(input.target);
            if (!this.nodeExistsInGraph(normalizedTarget, graph)) {
                throw new Error(`Target file not found in dependency graph: ${input.target}`);
            }

            // Perform dependency traversal
            const depth = Math.min(input.depth || DEFAULT_CONFIG.maxDepth, 5);
            const traversalResult = this.traverseDependencies(normalizedTarget, depth);

            // Convert traversal results to impacted files
            const impactedFiles = this.createImpactedFiles(
                normalizedTarget,
                traversalResult,
                graph,
                input.changeType
            );

            // Calculate risk score
            const riskScore = this.calculateRiskScore(impactedFiles, input.changeType);

            // Generate recommendations
            const recommendations = this.generateRecommendations(
                impactedFiles,
                riskScore,
                traversalResult.circularPaths
            );

            const analysisTimeMs = Date.now() - startTime;

            return {
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
        const discoveredNodes = new Set<string>();
        const nodeDistances = new Map<string, number>();
        const circularPaths: string[][] = [];
        const visited = new Set<string>();
        const currentPath: string[] = [];

        // Recursive traversal function
        const traverse = (nodeId: string, distance: number): void => {
            // Check limits
            if (distance > maxDepth || discoveredNodes.size >= this.config.maxNodes) {
                return;
            }

            // Check for circular dependency
            if (currentPath.includes(nodeId)) {
                const cycleStart = currentPath.indexOf(nodeId);
                const cycle = [...currentPath.slice(cycleStart), nodeId];
                circularPaths.push(cycle);
                return;
            }

            // Add to discovered nodes
            discoveredNodes.add(nodeId);
            nodeDistances.set(nodeId, distance);
            currentPath.push(nodeId);

            // Get dependents (files that import this node)
            const dependents = this.graphService.getDependentsOf(nodeId);

            for (const dependent of dependents) {
                if (!visited.has(dependent)) {
                    traverse(dependent, distance + 1);
                }
            }

            // Remove from current path (backtrack)
            currentPath.pop();
            visited.add(nodeId);
        };

        // Start traversal from target node
        traverse(targetNode, 0);

        return {
            discoveredNodes,
            nodeDistances,
            circularPaths,
            truncated: discoveredNodes.size >= this.config.maxNodes
        };
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
}