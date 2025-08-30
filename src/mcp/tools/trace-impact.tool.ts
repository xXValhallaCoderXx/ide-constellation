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
    ImpactedFile,
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

    const startTime = Date.now();

    try {
        // Early parameter validation
        if (!workspaceRoot || typeof workspaceRoot !== 'string') {
            throw new Error('Invalid workspace root provided - must be a non-empty string');
        }

        if (!input) {
            throw new Error('Input parameters are required');
        }

        // Validate workspace root exists and is accessible
        const fs = require('fs');
        try {
            if (!fs.existsSync(workspaceRoot)) {
                throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
            }

            // Check if workspace is readable
            fs.accessSync(workspaceRoot, fs.constants.R_OK);
        } catch (error) {
            if (error instanceof Error && error.message.includes('does not exist')) {
                throw error;
            }
            throw new Error(`Cannot access workspace root: ${workspaceRoot}. ${error instanceof Error ? error.message : String(error)}`);
        }

        // Validate and secure input parameters with comprehensive checks
        let validatedInput: TraceImpactInput;
        try {
            validatedInput = validateAndSecureInput(input, workspaceRoot);
        } catch (error) {
            throw new Error(`Input validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Ensure we have graph data available with timeout protection
        const graphService = GraphService.getInstance();
        let graph = graphService.getGraph();

        // If no graph is available, load fresh data with timeout
        if (!graph) {
            console.error('[TraceImpact] Loading fresh graph data');

            try {
                // Add timeout protection for graph loading (30 seconds)
                const graphLoadPromise = graphService.loadGraph(workspaceRoot, '.', extensionContext);
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Graph loading timed out after 30 seconds')), 30000);
                });

                graph = await Promise.race([graphLoadPromise, timeoutPromise]) as any;

                if (!graph) {
                    throw new Error('Failed to load graph data. Please ensure the project has been scanned.');
                }
            } catch (error) {
                if (error instanceof Error && error.message.includes('timed out')) {
                    throw new Error('Graph loading timed out. The project may be too large or the system may be under heavy load.');
                }
                throw new Error(`Failed to load graph data: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Validate graph data integrity
        if (!graph.nodes || !Array.isArray(graph.nodes)) {
            throw new Error('Invalid graph data: nodes array is missing or invalid');
        }

        if (!graph.edges || !Array.isArray(graph.edges)) {
            throw new Error('Invalid graph data: edges array is missing or invalid');
        }

        if (graph.nodes.length === 0) {
            throw new Error('Graph contains no nodes. Please scan the project first.');
        }

        console.error(`[TraceImpact] Graph loaded: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

        // Initialize impact analyzer and perform analysis with timeout protection
        let analysis: ImpactAnalysis;
        try {
            const impactAnalyzer = new ImpactAnalyzer(graphService);

            // Add timeout protection for impact analysis (60 seconds)
            const analysisPromise = impactAnalyzer.analyzeImpact(validatedInput);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Impact analysis timed out after 60 seconds')), 60000);
            });

            analysis = await Promise.race([analysisPromise, timeoutPromise]) as ImpactAnalysis;

            if (!analysis) {
                throw new Error('Impact analysis returned no results');
            }
        } catch (error) {
            if (error instanceof Error && error.message.includes('timed out')) {
                throw new Error('Impact analysis timed out. The dependency graph may be too complex or contain cycles.');
            }
            throw new Error(`Impact analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Validate analysis results
        if (!analysis.impactedFiles || !Array.isArray(analysis.impactedFiles)) {
            throw new Error('Invalid analysis results: impacted files array is missing');
        }

        if (typeof analysis.riskScore !== 'number' || isNaN(analysis.riskScore)) {
            throw new Error('Invalid analysis results: risk score is not a valid number');
        }

        console.error(`[TraceImpact] Analysis complete: ${analysis.impactedFiles.length} files impacted, risk score ${analysis.riskScore}`);

        // Generate AI-consumable summary with error handling
        let summary: string;
        try {
            summary = generateImpactSummary(analysis);
            if (!summary || typeof summary !== 'string') {
                throw new Error('Summary generation returned invalid result');
            }
        } catch (error) {
            console.error('[TraceImpact] Summary generation failed:', error);
            summary = `# Impact Analysis Failed\n\nError generating summary: ${error instanceof Error ? error.message : String(error)}`;
        }

        // Create output data structure with validation
        let outputData: TraceImpactOutput;
        try {
            // Validate and sanitize impacted files data
            const sanitizedImpactedFiles = analysis.impactedFiles.map((file, index) => {
                if (!file || typeof file !== 'object') {
                    throw new Error(`Invalid impacted file at index ${index}: not an object`);
                }

                if (!file.nodeId || typeof file.nodeId !== 'string') {
                    throw new Error(`Invalid impacted file at index ${index}: missing or invalid nodeId`);
                }

                if (!file.path || typeof file.path !== 'string') {
                    throw new Error(`Invalid impacted file at index ${index}: missing or invalid path`);
                }

                return {
                    nodeId: file.nodeId,
                    path: file.path,
                    impactLevel: file.impactLevel || ImpactLevel.LOW,
                    distance: typeof file.distance === 'number' ? file.distance : 0,
                    reason: file.reason || 'Unknown impact reason'
                };
            });

            // Validate recommendations array
            const sanitizedRecommendations = Array.isArray(analysis.recommendations)
                ? analysis.recommendations.filter(rec => typeof rec === 'string' && rec.trim().length > 0)
                : [];

            // Calculate metadata with safe operations
            const totalFiles = sanitizedImpactedFiles.length;
            const criticalFiles = sanitizedImpactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL).length;
            const highRiskFiles = sanitizedImpactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH).length;
            const circularDeps = Array.isArray(analysis.circularDependencies) ? analysis.circularDependencies.length : 0;

            outputData = {
                summary,
                riskScore: Math.max(0, Math.min(10, analysis.riskScore)), // Clamp to 0-10 range
                impactedFiles: sanitizedImpactedFiles,
                recommendations: sanitizedRecommendations,
                metadata: {
                    timestamp: analysis.metadata?.timestamp || new Date().toISOString(),
                    analysisTimeMs: Date.now() - startTime,
                    totalFiles,
                    criticalFiles,
                    highRiskFiles,
                    circularDependencies: circularDeps
                }
            };
        } catch (error) {
            throw new Error(`Failed to create output data structure: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Generate visual instruction for animation with error handling
        let visualInstruction: ImpactAnimationInstruction;
        try {
            console.log('[TraceImpact] Generating visual instruction for target:', validatedInput.target);
            visualInstruction = generateVisualInstruction(analysis, validatedInput);
            if (!visualInstruction || typeof visualInstruction !== 'object') {
                throw new Error('Visual instruction generation returned invalid result');
            }
            console.log('[TraceImpact] Visual instruction generated successfully:', visualInstruction.correlationId);
        } catch (error) {
            console.error('[TraceImpact] Visual instruction generation failed:', error);
            // Create fallback visual instruction
            visualInstruction = {
                action: 'applyImpactAnimation',
                correlationId: `impact-fallback-${Date.now()}`,
                ts: Date.now(),
                payload: {
                    targetNode: validatedInput.target,
                    impactedNodes: [],
                    riskScore: analysis.riskScore || 0,
                    changeType: validatedInput.changeType,
                    summary: {
                        totalFiles: 0,
                        criticalFiles: 0,
                        highRiskFiles: 0,
                        mediumRiskFiles: 0,
                        lowRiskFiles: 0
                    },
                    animationConfig: DEFAULT_ANIMATION_CONFIG
                }
            };
        }

        // Create dual-view response structure with final validation
        let response: TraceImpactResponse;
        try {
            response = {
                dataForAI: outputData,
                visualInstruction
            };

            // Final validation of response structure
            if (!response.dataForAI || !response.visualInstruction) {
                throw new Error('Response structure is incomplete');
            }

            console.log('[TraceImpact] Response created with visual instruction:', {
                correlationId: visualInstruction.correlationId,
                action: visualInstruction.action,
                targetNode: visualInstruction.payload.targetNode,
                impactedNodesCount: visualInstruction.payload.impactedNodes.length
            });
        } catch (error) {
            throw new Error(`Failed to create response structure: ${error instanceof Error ? error.message : String(error)}`);
        }

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
 * Validate and secure input parameters with comprehensive security checks
 * @param input Raw input parameters
 * @param workspaceRoot Workspace root for path validation
 * @returns Validated and secured input
 */
function validateAndSecureInput(input: TraceImpactInput, workspaceRoot: string): TraceImpactInput {
    // Validate input object exists
    if (!input || typeof input !== 'object') {
        throw new Error('Input parameters are required and must be an object');
    }

    // Validate target file path
    if (!input.target || typeof input.target !== 'string') {
        throw new Error('Target file path is required and must be a string');
    }

    // Sanitize target path - remove null bytes and normalize
    const sanitizedTarget = input.target.replace(/\0/g, '').trim();
    if (sanitizedTarget.length === 0) {
        throw new Error('Target file path cannot be empty');
    }

    // Check for path traversal attempts
    if (sanitizedTarget.includes('..') || sanitizedTarget.includes('~')) {
        throw new Error('Path traversal attempts are not allowed in target path');
    }

    // Validate path length (prevent extremely long paths)
    if (sanitizedTarget.length > 1000) {
        throw new Error('Target file path is too long (maximum 1000 characters)');
    }

    // Secure path validation using existing utility
    let resolvedPath;
    try {
        const pathResult = resolveWorkspacePath(workspaceRoot, sanitizedTarget);
        resolvedPath = pathResult;

        if (!pathResult.within) {
            throw new Error(`Target file must be within workspace bounds: ${sanitizedTarget}`);
        }
    } catch (error) {
        throw new Error(`Invalid target path: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check if target file exists (optional - warn but don't fail)
    const fs = require('fs');
    try {
        if (!fs.existsSync(resolvedPath.abs)) {
            console.warn(`[TraceImpact] Warning: Target file does not exist: ${sanitizedTarget}`);
        }
    } catch (error) {
        console.warn(`[TraceImpact] Warning: Could not check target file existence: ${error}`);
    }

    // Validate change type with strict enum checking
    if (!input.changeType || typeof input.changeType !== 'string') {
        throw new Error('Change type is required and must be a string');
    }

    const validChangeTypes = Object.values(ChangeType) as string[];
    if (!validChangeTypes.includes(input.changeType)) {
        throw new Error(`Invalid change type: ${input.changeType}. Must be one of: ${validChangeTypes.join(', ')}`);
    }

    // Validate and clamp depth with strict bounds checking
    let depth = input.depth;

    // Handle undefined/null depth
    if (depth === undefined || depth === null) {
        depth = DEFAULT_CONFIG.maxDepth;
    }

    // Validate depth is a number
    if (typeof depth !== 'number' || isNaN(depth) || !isFinite(depth)) {
        throw new Error('Depth must be a valid finite number');
    }

    // Clamp depth to safe bounds
    if (depth < 1) {
        console.warn(`[TraceImpact] Depth ${depth} is too low, using minimum of 1`);
        depth = 1;
    }

    if (depth > 5) {
        console.warn(`[TraceImpact] Depth ${depth} is too high, clamping to maximum of 5`);
        depth = 5;
    }

    // Ensure depth is an integer
    depth = Math.floor(depth);

    // Additional security checks for workspace root
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
        throw new Error('Workspace root is required and must be a string');
    }

    if (!fs.existsSync(workspaceRoot)) {
        throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
    }

    // Check workspace root is a directory
    const workspaceStats = fs.statSync(workspaceRoot);
    if (!workspaceStats.isDirectory()) {
        throw new Error(`Workspace root is not a directory: ${workspaceRoot}`);
    }

    console.log(`[TraceImpact] Input validation successful: target=${sanitizedTarget}, changeType=${input.changeType}, depth=${depth}`);

    return {
        target: sanitizedTarget,
        changeType: input.changeType as ChangeType,
        depth
    };
}

/**
 * Generate comprehensive markdown summary for AI consumption with enhanced formatting
 * @param analysis Impact analysis results
 * @returns Formatted markdown summary with actionable insights
 */
function generateImpactSummary(analysis: ImpactAnalysis): string {
    const { target, changeType, impactedFiles, riskScore, recommendations, circularDependencies, metadata } = analysis;

    // Count files by impact level
    const criticalFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL);
    const highFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH);
    const mediumFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.MEDIUM);
    const lowFiles = impactedFiles.filter(f => f.impactLevel === ImpactLevel.LOW);

    // Determine risk level and styling
    const riskInfo = getRiskLevelInfo(riskScore);

    // Calculate impact statistics
    const totalImpacted = impactedFiles.length;
    const impactPercentage = totalImpacted > 0 ? Math.round((criticalFiles.length + highFiles.length) / totalImpacted * 100) : 0;

    // Generate file type analysis
    const fileTypeAnalysis = analyzeFileTypes(impactedFiles);

    // Create summary sections
    const summaryParts = [
        // Header with key metrics
        `# 🎯 Impact Analysis: ${path.basename(target)}`,
        ``,
        `**📋 Summary:** ${changeType.charAt(0).toUpperCase() + changeType.slice(1)} operation affecting **${totalImpacted} files** with **${riskInfo.level}** risk level`,
        ``,
        `## 📊 Risk Assessment`,
        ``,
        `${riskInfo.emoji} **Risk Score: ${riskScore}/10 (${riskInfo.level})**`,
        `- **High-Risk Files:** ${criticalFiles.length + highFiles.length}/${totalImpacted} (${impactPercentage}%)`,
        `- **Analysis Time:** ${metadata?.analysisTimeMs || 0}ms`,
        `- **Traversal Depth:** ${metadata?.depth || 'Unknown'}`,
        ``,

        // Critical impact section (most important)
        criticalFiles.length > 0 ? [
            `## 🔴 Critical Impact (Immediate Breakage)`,
            ``,
            `These files will **break immediately** when you make this change:`,
            ``,
            ...criticalFiles.slice(0, 8).map(file =>
                `- **${path.basename(file.path)}** ${getFileTypeIcon(file.path)}`
            ),
            criticalFiles.length > 8 ? `- *... and ${criticalFiles.length - 8} more critical files*` : '',
            ``,
            `🚨 **Action Required:** These files must be updated before deployment.`,
            ``
        ].join('\n') : '',

        // High impact section
        highFiles.length > 0 ? [
            `## 🟠 High Impact (Likely Affected)`,
            ``,
            `These files are **very likely** to be affected:`,
            ``,
            ...highFiles.slice(0, 6).map(file =>
                `- **${path.basename(file.path)}** ${getFileTypeIcon(file.path)} - ${file.reason}`
            ),
            highFiles.length > 6 ? `- *... and ${highFiles.length - 6} more high-impact files*` : '',
            ``
        ].join('\n') : '',

        // Medium and low impact summary
        (mediumFiles.length > 0 || lowFiles.length > 0) ? [
            `## 📈 Additional Impact`,
            ``,
            mediumFiles.length > 0 ? `🟡 **Medium Impact:** ${mediumFiles.length} files may need attention` : '',
            lowFiles.length > 0 ? `🟢 **Low Impact:** ${lowFiles.length} files with minimal risk` : '',
            ``
        ].filter(line => line !== '').join('\n') : '',

        // File type breakdown
        fileTypeAnalysis.length > 0 ? [
            `## 📁 File Type Breakdown`,
            ``,
            ...fileTypeAnalysis.map(type => `- **${type.extension}:** ${type.count} files (${type.riskLevel})`),
            ``
        ].join('\n') : '',

        // Circular dependencies warning
        circularDependencies.length > 0 ? [
            `## 🔄 Circular Dependencies Alert`,
            ``,
            `⚠️ **${circularDependencies.length} circular dependency chains detected!**`,
            ``,
            `This significantly increases risk. Consider refactoring to break these cycles:`,
            ...circularDependencies.slice(0, 3).map(cycle =>
                `- ${cycle.slice(0, 3).map(node => path.basename(node)).join(' → ')}${cycle.length > 3 ? ' → ...' : ''}`
            ),
            circularDependencies.length > 3 ? `- *... and ${circularDependencies.length - 3} more cycles*` : '',
            ``
        ].join('\n') : '',

        // Recommendations section
        recommendations.length > 0 ? [
            `## 🛡️ Recommended Safeguards`,
            ``,
            ...recommendations.slice(0, 8).map(rec => formatRecommendation(rec)),
            ``
        ].join('\n') : '',

        // Pro tips and insights
        [
            `## 💡 Expert Insights`,
            ``,
            `**${getProTip(riskScore, changeType, criticalFiles.length)}**`,
            ``,
            ...getAdditionalInsights(analysis),
            ``
        ].join('\n'),

        // Quick action checklist
        [
            `## ✅ Pre-Deployment Checklist`,
            ``,
            `- [ ] Review all ${criticalFiles.length} critical files`,
            `- [ ] Update imports and references`,
            `- [ ] Run comprehensive test suite`,
            criticalFiles.length > 0 ? `- [ ] Test critical functionality thoroughly` : '',
            riskScore >= 7 ? `- [ ] Consider feature flags or gradual rollout` : '',
            circularDependencies.length > 0 ? `- [ ] Address circular dependencies` : '',
            `- [ ] Monitor deployment closely`,
            ``
        ].filter(line => line !== '').join('\n')
    ];

    return summaryParts.filter(part => part.trim() !== '').join('\n');
}

/**
 * Get risk level information with emoji and styling
 * @param riskScore Calculated risk score
 * @returns Risk level information object
 */
function getRiskLevelInfo(riskScore: number): { level: string; emoji: string; color: string } {
    if (riskScore >= 8) {
        return { level: 'CRITICAL', emoji: '🔴', color: '#dc2626' };
    } else if (riskScore >= 6) {
        return { level: 'HIGH', emoji: '🟠', color: '#ea580c' };
    } else if (riskScore >= 4) {
        return { level: 'MEDIUM', emoji: '🟡', color: '#ca8a04' };
    } else if (riskScore >= 2) {
        return { level: 'LOW', emoji: '🟢', color: '#16a34a' };
    } else {
        return { level: 'MINIMAL', emoji: '🔵', color: '#2563eb' };
    }
}

/**
 * Get file type icon based on file extension
 * @param filePath File path to analyze
 * @returns Appropriate emoji icon
 */
function getFileTypeIcon(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const iconMap: { [key: string]: string } = {
        '.ts': '📘', '.tsx': '📘', '.js': '📙', '.jsx': '📙',
        '.vue': '💚', '.svelte': '🧡', '.py': '🐍', '.java': '☕',
        '.css': '🎨', '.scss': '🎨', '.less': '🎨', '.html': '🌐',
        '.json': '📋', '.xml': '📄', '.md': '📝', '.txt': '📄',
        '.sql': '🗄️', '.php': '🐘', '.rb': '💎', '.go': '🐹',
        '.rs': '🦀', '.cpp': '⚙️', '.c': '⚙️', '.cs': '🔷',
        '.swift': '🍎', '.kt': '🟢', '.dart': '🎯'
    };
    return iconMap[ext] || '📄';
}

/**
 * Analyze file types in impacted files
 * @param impactedFiles List of impacted files
 * @returns File type analysis
 */
function analyzeFileTypes(impactedFiles: ImpactedFile[]): Array<{ extension: string; count: number; riskLevel: string }> {
    const typeMap = new Map<string, { count: number; criticalCount: number; highCount: number }>();

    for (const file of impactedFiles) {
        const ext = path.extname(file.path).toLowerCase() || 'no extension';
        const current = typeMap.get(ext) || { count: 0, criticalCount: 0, highCount: 0 };

        current.count++;
        if (file.impactLevel === ImpactLevel.CRITICAL) current.criticalCount++;
        if (file.impactLevel === ImpactLevel.HIGH) current.highCount++;

        typeMap.set(ext, current);
    }

    return Array.from(typeMap.entries())
        .map(([ext, data]) => {
            let riskLevel = 'Low Risk';
            if (data.criticalCount > 0) riskLevel = 'Critical Risk';
            else if (data.highCount > 0) riskLevel = 'High Risk';
            else if (data.count > 5) riskLevel = 'Medium Risk';

            return {
                extension: ext === 'no extension' ? 'No Extension' : ext,
                count: data.count,
                riskLevel
            };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 8); // Limit to top 8 file types
}

/**
 * Format recommendation with proper emoji and structure
 * @param recommendation Raw recommendation text
 * @returns Formatted recommendation
 */
function formatRecommendation(recommendation: string): string {
    // If already has emoji, return as-is
    if (/^[🚩⚠️🧪📦🔄🎯🔐💾🌐⚙️🎨🚨📋⚡📚✅🔍🛠️💡🎭🔧]/.test(recommendation)) {
        return recommendation;
    }

    // Add appropriate emoji based on content
    if (recommendation.toLowerCase().includes('test')) return `🧪 ${recommendation}`;
    if (recommendation.toLowerCase().includes('backup')) return `💾 ${recommendation}`;
    if (recommendation.toLowerCase().includes('review')) return `🔍 ${recommendation}`;
    if (recommendation.toLowerCase().includes('monitor')) return `📊 ${recommendation}`;
    if (recommendation.toLowerCase().includes('deploy')) return `🚀 ${recommendation}`;

    return `📋 ${recommendation}`;
}

/**
 * Generate additional insights based on analysis
 * @param analysis Complete impact analysis
 * @returns Array of additional insights
 */
function getAdditionalInsights(analysis: ImpactAnalysis): string[] {
    const insights: string[] = [];
    const { impactedFiles, riskScore, changeType, circularDependencies } = analysis;

    // Complexity insight
    if (impactedFiles.length > 20) {
        insights.push(`🔍 **Complex Change:** This affects ${impactedFiles.length} files across your codebase.`);
    }

    // Change type specific insights
    if (changeType === ChangeType.DELETE) {
        insights.push(`🗑️ **Deletion Impact:** Removing files requires updating all dependent imports.`);
    } else if (changeType === ChangeType.REFACTOR) {
        insights.push(`🔄 **Refactoring Scope:** Consider using automated refactoring tools for consistency.`);
    } else if (changeType === ChangeType.MODIFY) {
        insights.push(`✏️ **Modification Impact:** Focus testing on changed functionality and its dependents.`);
    }

    // Circular dependency insight
    if (circularDependencies.length > 0) {
        insights.push(`🔄 **Architecture Note:** Circular dependencies indicate potential design improvements.`);
    }

    // Risk-based insights
    if (riskScore >= 7) {
        insights.push(`⚡ **High Stakes:** Consider implementing this change during maintenance windows.`);
    } else if (riskScore <= 2) {
        insights.push(`✨ **Low Risk:** This change should be safe to deploy with standard practices.`);
    }

    return insights;
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
 * Generate enhanced visual instruction for impact animation with optimized timing and effects
 * @param analysis Impact analysis results
 * @param input Original input parameters
 * @returns Visual instruction for graph animation with correlation tracking
 */
function generateVisualInstruction(analysis: ImpactAnalysis, input: TraceImpactInput): ImpactAnimationInstruction {
    const correlationId = `impact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Sort impacted files by priority for animation
    const sortedFiles = [...analysis.impactedFiles].sort((a, b) => {
        // Sort by impact level first, then by distance
        const levelPriority = {
            [ImpactLevel.CRITICAL]: 4,
            [ImpactLevel.HIGH]: 3,
            [ImpactLevel.MEDIUM]: 2,
            [ImpactLevel.LOW]: 1
        };

        const aPriority = levelPriority[a.impactLevel] || 0;
        const bPriority = levelPriority[b.impactLevel] || 0;

        if (aPriority !== bPriority) {
            return bPriority - aPriority; // Higher priority first
        }

        return a.distance - b.distance; // Closer files first within same priority
    });

    // Create animated nodes with enhanced timing and visual effects
    const animatedNodes: AnimatedNode[] = sortedFiles
        .slice(0, ANIMATION_TIMING.MAX_ANIMATED_NODES) // Performance limit
        .map((file, index) => {
            // Calculate sophisticated delay based on distance and priority
            const baseDelay = file.distance * ANIMATION_TIMING.BASE_STAGGER_DELAY;
            const priorityDelay = index * 50; // Additional stagger for visual clarity
            const totalDelay = Math.min(baseDelay + priorityDelay, 3000); // Cap at 3 seconds

            // Determine animation intensity based on impact level
            const animationIntensity = getAnimationIntensity(file.impactLevel);

            // Calculate node-specific duration
            const nodeDuration = animationIntensity.duration;

            return {
                nodeId: file.nodeId,
                impactLevel: file.impactLevel,
                distance: file.distance,
                delay: totalDelay,
                color: file.color || IMPACT_LEVEL_COLORS[file.impactLevel],
                nodeDuration,
                shouldPulse: animationIntensity.shouldPulse,
                // Additional animation properties
                pulseIntensity: animationIntensity.pulseIntensity,
                glowRadius: animationIntensity.glowRadius,
                animationEasing: animationIntensity.easing
            };
        });

    // Count files by impact level for comprehensive summary
    const impactSummary = {
        totalFiles: analysis.impactedFiles.length,
        criticalFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.CRITICAL).length,
        highRiskFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.HIGH).length,
        mediumRiskFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.MEDIUM).length,
        lowRiskFiles: analysis.impactedFiles.filter(f => f.impactLevel === ImpactLevel.LOW).length,
        animatedFiles: animatedNodes.length,
        truncated: analysis.impactedFiles.length > ANIMATION_TIMING.MAX_ANIMATED_NODES
    };

    // Calculate optimal animation configuration
    const animationConfig = calculateOptimalAnimationConfig(
        animatedNodes.length,
        analysis.riskScore,
        input.changeType
    );

    // Generate distance-based ripple configuration
    const rippleConfig = generateRippleConfiguration(animatedNodes);

    return {
        action: 'applyImpactAnimation',
        correlationId,
        ts: Date.now(),
        payload: {
            targetNode: analysis.target,
            impactedNodes: animatedNodes,
            animationConfig: {
                ...animationConfig,
                ripples: rippleConfig,
                metadata: {
                    analysisId: correlationId,
                    changeType: input.changeType,
                    riskScore: analysis.riskScore,
                    timestamp: analysis.metadata?.timestamp || new Date().toISOString()
                }
            },
            riskScore: analysis.riskScore,
            changeType: input.changeType,
            summary: impactSummary
        }
    };
}

/**
 * Get animation intensity settings based on impact level
 * @param impactLevel Impact level of the file
 * @returns Animation intensity configuration
 */
function getAnimationIntensity(impactLevel: ImpactLevel): {
    duration: number;
    shouldPulse: boolean;
    pulseIntensity: number;
    glowRadius: number;
    easing: string;
} {
    switch (impactLevel) {
        case ImpactLevel.CRITICAL:
            return {
                duration: ANIMATION_TIMING.PULSE_DURATION * 1.5,
                shouldPulse: true,
                pulseIntensity: 1.0,
                glowRadius: 12,
                easing: 'ease-out'
            };
        case ImpactLevel.HIGH:
            return {
                duration: ANIMATION_TIMING.PULSE_DURATION * 1.2,
                shouldPulse: true,
                pulseIntensity: 0.8,
                glowRadius: 8,
                easing: 'ease-out'
            };
        case ImpactLevel.MEDIUM:
            return {
                duration: ANIMATION_TIMING.PULSE_DURATION,
                shouldPulse: false,
                pulseIntensity: 0.5,
                glowRadius: 4,
                easing: 'ease-in-out'
            };
        case ImpactLevel.LOW:
        default:
            return {
                duration: ANIMATION_TIMING.PULSE_DURATION * 0.8,
                shouldPulse: false,
                pulseIntensity: 0.3,
                glowRadius: 2,
                easing: 'ease-in'
            };
    }
}

/**
 * Calculate optimal animation configuration based on analysis results
 * @param nodeCount Number of nodes to animate
 * @param riskScore Risk score of the change
 * @param changeType Type of change being made
 * @returns Optimized animation configuration
 */
function calculateOptimalAnimationConfig(
    nodeCount: number,
    riskScore: number,
    changeType: ChangeType
): any {
    const baseConfig = { ...DEFAULT_ANIMATION_CONFIG };

    // Adjust timing based on node count
    if (nodeCount > 50) {
        baseConfig.staggerDelay = Math.max(50, baseConfig.staggerDelay * 0.7); // Faster for many nodes
    } else if (nodeCount < 10) {
        baseConfig.staggerDelay = baseConfig.staggerDelay * 1.3; // Slower for few nodes
    }

    // Adjust intensity based on risk score
    if (riskScore >= 7) {
        baseConfig.showRipples = true;
        baseConfig.pulseNodes = true;
        baseConfig.duration = Math.min(baseConfig.duration * 1.2, 2000);
    } else if (riskScore <= 3) {
        baseConfig.showRipples = false;
        baseConfig.duration = baseConfig.duration * 0.8;
    }

    // Change type specific adjustments
    if (changeType === ChangeType.DELETE) {
        baseConfig.easing = 'ease-in'; // More dramatic for deletions
    } else if (changeType === ChangeType.REFACTOR) {
        baseConfig.showRipples = true; // Show connections for refactoring
    }

    return baseConfig;
}

/**
 * Generate ripple configuration based on node distances
 * @param animatedNodes Nodes to be animated
 * @returns Ripple configuration for animation
 */
function generateRippleConfiguration(animatedNodes: AnimatedNode[]): any {
    const distances = [...new Set(animatedNodes.map(n => n.distance))].sort((a, b) => a - b);

    return {
        enabled: distances.length > 1,
        waves: distances.slice(0, 5).map((distance, index) => ({
            distance,
            delay: distance * 100,
            radius: 30 + (distance * 20),
            opacity: Math.max(0.2, 0.8 - (distance * 0.15)),
            color: getDistanceColor(distance),
            duration: 800 + (distance * 100)
        }))
    };
}

/**
 * Get color for distance-based effects
 * @param distance Distance from target node
 * @returns Color string for the distance
 */
function getDistanceColor(distance: number): string {
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
    return colors[Math.min(distance - 1, colors.length - 1)] || colors[colors.length - 1];
}

/**
 * Determine the dominant impact level from impacted files
 * @param impactedFiles List of impacted files
 * @returns Dominant impact level
 */
function getDominantImpactLevel(impactedFiles: ImpactedFile[]): ImpactLevel {
    const counts = {
        [ImpactLevel.CRITICAL]: 0,
        [ImpactLevel.HIGH]: 0,
        [ImpactLevel.MEDIUM]: 0,
        [ImpactLevel.LOW]: 0
    };

    for (const file of impactedFiles) {
        counts[file.impactLevel as ImpactLevel]++;
    }

    // Return the level with the most files, prioritizing higher levels in ties
    if (counts[ImpactLevel.CRITICAL] > 0) return ImpactLevel.CRITICAL;
    if (counts[ImpactLevel.HIGH] >= counts[ImpactLevel.MEDIUM] && counts[ImpactLevel.HIGH] >= counts[ImpactLevel.LOW]) return ImpactLevel.HIGH;
    if (counts[ImpactLevel.MEDIUM] >= counts[ImpactLevel.LOW]) return ImpactLevel.MEDIUM;
    return ImpactLevel.LOW;
}