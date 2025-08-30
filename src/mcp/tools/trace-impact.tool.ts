/**
 * Trace Impact MCP Tool
 * 
 * Analyzes the blast radius and downstream impact of code changes by traversing
 * dependency graphs and providing both AI-consumable analysis and visual animations.
 */

import { ImpactAnalyzer } from '../../services/impact-analyzer/impact-analyzer.service';
import { GraphService } from '../../services/graph.service';
import { DualToolResponse, VisualInstruction } from '../../types/visual-instruction.types';
import {
    TraceImpactInput,
    ImpactAnalysis,
    ChangeType,
    ImpactLevel,
    IMPACT_LEVEL_COLORS,
    DEFAULT_CONFIG
} from '../../services/impact-analyzer/impact-types';
import {
    ImpactAnimationInstruction,
    AnimatedNode,
    DEFAULT_ANIMATION_CONFIG,
    ANIMATION_TIMING
} from '../../types/impact-animation.types';
import { resolveWorkspacePath } from '../../utils/path.utils';
import * as path from 'path';

/**
 * Output structure for the trace impact tool
 */
export interface TraceImpactOutput {
    /** Markdown formatted summary for AI consumption */
    summary: string;
    /** Calculated risk score (0-10) */
    riskScore: number;
    /** List of all impacted files */
    impactedFiles: Array<{
        nodeId: string;
        path: string;
        impactLevel: ImpactLevel;
        distance: number;
        reason: string;
    }>;
    /** Generated recommendations */
    recommendations: string[];
    /** Analysis metadata */
    metadata: {
        timestamp: string;
        analysisTimeMs: number;
        totalFiles: number;
        criticalFiles: number;
        highRiskFiles: number;
        circularDependencies: number;
    };
}

/**
 * Dual-response structure for trace impact tool
 */
export interface TraceImpactResponse extends DualToolResponse<TraceImpactOutput> {
    dataForAI: TraceImpactOutput;
    visualInstruction: ImpactAnimationInstruction;
}

/**
 * Execute trace impact analysis with dual-view response structure
 * @param workspaceRoot Path to workspace root directory
 * @param input Impact analysis parameters
 * @param extensionContext VS Code extension context (optional)
 * @returns Promise resolving to dual-view trace impact response
 */
export async function executeTraceImpact(
    workspaceRoot: string,
    input: TraceImpactInput,
    extensionContext?: any
): Promise<TraceImpactResponse> {
    console.error('[TraceImpact] Starting impact analysis');
    console.error(`[TraceImpact] Workspace: ${workspaceRoot}`);
    console.error(`[TraceImpact] Target: ${input.target}, Change: ${input.changeType}, Depth: ${input.depth || DEFAULT_CONFIG.maxDepth}`);

    try {
        // Validate workspace root
        if (!workspaceRoot || typeof workspaceRoot !== 'string') {
            throw new Error('Invalid workspace root provided');
        }

        const fs = require('fs');
        if (!fs.existsSync(workspaceRoot)) {
            throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
        }

        // Validate and secure input parameters
        const validatedInput = validateAndSecureInput(input, workspaceRoot);

        // Ensure we have graph data available
        const graphService = GraphService.getInstance();
        let graph = graphService.getGraph();

        // If no graph is available, load fresh data
        if (!graph) {
            console.error('[TraceImpact] Loading fresh graph data');
            graph = await graphService.loadGraph(workspaceRoot, '.', extensionContext);

            if (!graph) {
                throw new Error('Failed to load graph data. Please ensure the project has been scanned.');
            }
        }

        console.error(`[TraceImpact] Graph loaded: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

        // Initialize impact analyzer and perform analysis
        const impactAnalyzer = new ImpactAnalyzer(graphService);
        const analysis = await impactAnalyzer.analyzeImpact(validatedInput);

        console.error(`[TraceImpact] Analysis complete: ${analysis.impactedFiles.length} files impacted, risk score ${analysis.riskScore}`);

        // Generate AI-consumable summary
        const summary = generateImpactSummary(analysis);

        // Create output data structure
        const outputData: TraceImpactOutput = {
            summary,
            riskScore: analysis.riskScore,
            impactedFiles: analysis.impactedFiles.map(file => ({
                nodeId: file.nodeId,
                path: file.path,
                impactLevel: file.impactLevel,
                distance: file.distance,
                reason: file.reason
            })),
            recommendations: analysis.recommendations,
            metadata: {
                timestamp: analysis.metadata.timestamp,
                analysisTimeMs: analysis.metadata.analysisTimeMs,
                totalFiles: analysis.impactedFiles.length,
                criticalFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL).length,
                highRiskFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH).length,
                circularDependencies: analysis.circularDependencies.length
            }
        };

        // Generate visual instruction for animation
        const visualInstruction = generateVisualInstruction(analysis, validatedInput);

        // Create dual-view response structure
        const response: TraceImpactResponse = {
            dataForAI: outputData,
            visualInstruction
        };

        console.error(`[TraceImpact] Generated dual-view response with ${analysis.impactedFiles.length} impacted files`);
        return response;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[TraceImpact] Error during analysis:', errorMessage);

        // Provide user-friendly error messages
        let userFriendlyMessage = errorMessage;
        if (errorMessage.includes('No workspace folder open')) {
            userFriendlyMessage = 'Please open a workspace folder in VS Code to analyze impact.';
        } else if (errorMessage.includes('Failed to load graph data')) {
            userFriendlyMessage = 'Unable to analyze project structure. Please scan the project first using the "Scan Project" command.';
        } else if (errorMessage.includes('Target file not found')) {
            userFriendlyMessage = 'The specified file was not found in the project dependency graph.';
        } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
            userFriendlyMessage = 'Permission denied accessing project files. Please check file permissions.';
        }

        throw new Error(`Impact analysis failed: ${userFriendlyMessage}`);
    }
}

/**
 * Validate and secure input parameters
 * @param input Raw input parameters
 * @param workspaceRoot Workspace root for path validation
 * @returns Validated and secured input
 */
function validateAndSecureInput(input: TraceImpactInput, workspaceRoot: string): TraceImpactInput {
    // Validate target file path
    if (!input.target || typeof input.target !== 'string') {
        throw new Error('Target file path is required and must be a string');
    }

    // Secure path validation using existing utility
    const { abs: absolutePath, within: withinWorkspace } = resolveWorkspacePath(workspaceRoot, input.target);

    if (!withinWorkspace) {
        throw new Error(`Target file must be within workspace bounds: ${input.target}`);
    }

    // Validate change type
    if (!Object.values(ChangeType).includes(input.changeType)) {
        throw new Error(`Invalid change type: ${input.changeType}. Must be one of: ${Object.values(ChangeType).join(', ')}`);
    }

    // Validate and clamp depth
    let depth = input.depth || DEFAULT_CONFIG.maxDepth;
    if (typeof depth !== 'number' || depth < 1) {
        depth = DEFAULT_CONFIG.maxDepth;
    }
    depth = Math.min(depth, 5); // Hard limit of 5

    return {
        target: input.target,
        changeType: input.changeType,
        depth
    };
}

/**
 * Generate markdown summary for AI consumption
 * @param analysis Impact analysis results
 * @returns Formatted markdown summary
 */
function generateImpactSummary(analysis: ImpactAnalysis): string {
    const { target, changeType, impactedFiles, riskScore, recommendations, circularDependencies } = analysis;

    // Count files by impact level
    const criticalFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL);
    const highFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH);
    const mediumFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.MEDIUM);
    const lowFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.LOW);

    // Determine risk level for display
    let riskLevel = 'LOW';
    let riskEmoji = '🟢';
    if (riskScore >= 7) {
        riskLevel = 'CRITICAL';
        riskEmoji = '🔴';
    } else if (riskScore >= 5) {
        riskLevel = 'HIGH';
        riskEmoji = '🟠';
    } else if (riskScore >= 3) {
        riskLevel = 'MEDIUM';
        riskEmoji = '🟡';
    }

    const summary = [
        `🎯 **Impact Analysis for: ${path.basename(target)}**`,
        `**Change Type:** ${changeType.charAt(0).toUpperCase() + changeType.slice(1)}`,
        ``,
        `${riskEmoji} **CRITICAL IMPACT** (Breaks immediately):`,
        ...criticalFiles.slice(0, 5).map(file =>
            `- ${path.basename(file.path)} - ${file.reason}`
        ),
        criticalFiles.length > 5 ? `- ... and ${criticalFiles.length - 5} more files` : '',
        ``,
        `⚠️ **HIGH IMPACT** (Likely affected):`,
        ...highFiles.slice(0, 3).map(file =>
            `- ${path.basename(file.path)} - ${file.reason}`
        ),
        highFiles.length > 3 ? `- ... and ${highFiles.length - 3} more files` : '',
        ``,
        mediumFiles.length > 0 ? `🟡 **MEDIUM IMPACT:** ${mediumFiles.length} files may be affected` : '',
        lowFiles.length > 0 ? `🟢 **LOW IMPACT:** ${lowFiles.length} files unlikely to be affected` : '',
        ``,
        `📊 **Risk Score: ${riskScore}/10 (${riskLevel})**`,
        ``,
        circularDependencies.length > 0 ? `🔄 **Circular Dependencies Detected:** ${circularDependencies.length} chains` : '',
        ``,
        `🛡️ **Recommended Safeguards:**`,
        ...recommendations.slice(0, 5).map(rec => `${rec.startsWith('🚩') || rec.startsWith('⚠️') || rec.startsWith('🧪') || rec.startsWith('📦') || rec.startsWith('🔄') || rec.startsWith('🎯') || rec.startsWith('🔐') || rec.startsWith('💾') || rec.startsWith('🌐') || rec.startsWith('⚙️') || rec.startsWith('🎨') || rec.startsWith('🚨') || rec.startsWith('📋') || rec.startsWith('⚡') || rec.startsWith('📚') ? '' : '- '}${rec}`),
        ``,
        `💡 **Pro Tip:** ${getProTip(riskScore, changeType, criticalFiles.length)}`
    ].filter(line => line !== '').join('\n');

    return summary;
}

/**
 * Generate contextual pro tip based on analysis results
 * @param riskScore Calculated risk score
 * @param changeType Type of change being made
 * @param criticalFileCount Number of critical files
 * @returns Contextual pro tip
 */
function getProTip(riskScore: number, changeType: ChangeType, criticalFileCount: number): string {
    if (riskScore >= 8) {
        return 'This is a high-risk change. Consider implementing it in phases with feature flags.';
    }

    if (changeType === ChangeType.DELETE && criticalFileCount > 0) {
        return 'Deleting files with dependencies requires careful coordination. Deprecate first, then remove.';
    }

    if (changeType === ChangeType.REFACTOR && criticalFileCount > 5) {
        return 'Large refactoring detected. Consider using the Strangler Fig pattern for gradual migration.';
    }

    if (riskScore >= 5) {
        return 'Deploy during low-traffic hours and monitor key metrics closely.';
    }

    return 'Impact looks manageable. Standard testing and deployment practices should suffice.';
}

/**
 * Generate visual instruction for impact animation
 * @param analysis Impact analysis results
 * @param input Original input parameters
 * @returns Visual instruction for graph animation
 */
function generateVisualInstruction(analysis: ImpactAnalysis, input: TraceImpactInput): ImpactAnimationInstruction {
    // Create animated nodes with proper timing and colors
    const animatedNodes: AnimatedNode[] = analysis.impactedFiles
        .slice(0, ANIMATION_TIMING.MAX_ANIMATED_NODES) // Limit for performance
        .map(file => ({
            nodeId: file.nodeId,
            impactLevel: file.impactLevel,
            distance: file.distance,
            delay: file.distance * ANIMATION_TIMING.BASE_STAGGER_DELAY,
            color: file.color,
            nodeDuration: ANIMATION_TIMING.PULSE_DURATION,
            shouldPulse: file.impactLevel === ImpactLevel.CRITICAL || file.impactLevel === ImpactLevel.HIGH
        }));

    // Count files by impact level for summary
    const criticalCount = analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL).length;
    const highCount = analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH).length;
    const mediumCount = analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.MEDIUM).length;
    const lowCount = analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.LOW).length;

    return {
        action: 'applyImpactAnimation',
        correlationId: `impact-analysis-${Date.now()}`,
        ts: Date.now(),
        payload: {
            targetNode: analysis.target,
            impactedNodes: animatedNodes,
            animationConfig: {
                ...DEFAULT_ANIMATION_CONFIG,
                duration: Math.min(1500, 500 + (animatedNodes.length * 10)) // Scale with impact size
            },
            riskScore: analysis.riskScore,
            changeType: analysis.changeType,
            summary: {
                totalFiles: analysis.impactedFiles.length,
                criticalFiles: criticalCount,
                highRiskFiles: highCount,
                mediumRiskFiles: mediumCount,
                lowRiskFiles: lowCount
            }
        }
    };
}