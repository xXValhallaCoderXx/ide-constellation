/**
 * Health Report MCP Tool
 * 
 * Implements dual-view health reporting that combines analytical insights (dashboard)
 * with visual intelligence (heatmap overlay). Returns structured data for both
 * AI reasoning and visual instruction routing.
 */

import { HealthAnalyzer } from '../../services/health-analyzer.service';
import { GraphService } from '../../services/graph.service';
import { DualToolResponse, VisualInstruction } from '../../types/visual-instruction.types';
import { HealthAnalysis, RiskScore } from '../../types/health-analysis.types';
import * as path from 'path';

/**
 * Enhanced risk score with visualization data for heatmap overlay
 */
export interface HeatmapNode {
  nodeId: string;
  score: number;
  color: string;
  metrics: {
    complexity: number;
    churn: number;
    dependencies: number;
    category: string;
  };
}

/**
 * Dual-view health report response structure
 */
export interface HealthReportResponse extends DualToolResponse<HealthAnalysis> {
  dataForAI: HealthAnalysis;
  visualInstruction: VisualInstruction & {
    action: 'applyHealthAnalysis';
    payload: {
      type: 'dual-view';
      dashboard: {
        show: boolean;
        data: HealthAnalysis;
        focusFile?: string;
      };
      graph: {
        show: boolean;
        heatmapData: HeatmapNode[];
        centerNode?: string;
        animationConfig: {
          duration: number;
          easing: string;
        };
      };
    };
  };
}

/**
 * Execute health report analysis with dual-view response structure
 * @param workspaceRoot Path to workspace root directory
 * @param forceRefresh Whether to force fresh analysis (bypass cache)
 * @param extensionContext VS Code extension context (optional)
 * @returns Promise resolving to dual-view health report response
 */
export async function executeHealthReport(
  workspaceRoot: string,
  forceRefresh: boolean = false,
  extensionContext?: any
): Promise<HealthReportResponse> {
  console.error('[HealthReport] Starting health report analysis');
  console.error(`[HealthReport] Workspace: ${workspaceRoot}`);
  console.error(`[HealthReport] Force refresh: ${forceRefresh}`);

  try {
    // Validate workspace root
    if (!workspaceRoot || typeof workspaceRoot !== 'string') {
      throw new Error('Invalid workspace root provided');
    }

    const fs = require('fs');
    if (!fs.existsSync(workspaceRoot)) {
      throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
    }

    // Ensure we have graph data available
    const graphService = GraphService.getInstance();
    let graph = graphService.getGraph();

    // If no graph is available or force refresh is requested, load fresh data
    if (!graph || forceRefresh) {
      console.error('[HealthReport] Loading fresh graph data');
      graph = await graphService.loadGraph(workspaceRoot, '.', extensionContext);
      
      if (!graph) {
        throw new Error('Failed to load graph data. Please ensure the project has been scanned.');
      }
    }

    console.error(`[HealthReport] Graph loaded: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

    // Initialize health analyzer and perform analysis
    const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
    const analysis = await healthAnalyzer.analyzeCodebase(graph);

    console.error(`[HealthReport] Analysis complete: ${analysis.totalFiles} files, health score ${analysis.healthScore}`);

    // Transform risk scores to heatmap data
    const heatmapData = transformToHeatmapData(analysis.riskScores);

    // Create dual-view response structure
    const response: HealthReportResponse = {
      dataForAI: analysis,
      visualInstruction: {
        action: 'applyHealthAnalysis',
        correlationId: `health-report-${Date.now()}`,
        ts: Date.now(),
        payload: {
          type: 'dual-view',
          dashboard: {
            show: true,
            data: analysis,
            focusFile: analysis.topRisks.length > 0 ? analysis.topRisks[0].nodeId : undefined
          },
          graph: {
            show: true,
            heatmapData,
            centerNode: analysis.topRisks.length > 0 ? analysis.topRisks[0].nodeId : undefined,
            animationConfig: {
              duration: 300,
              easing: 'ease-out'
            }
          }
        }
      }
    };

    console.error(`[HealthReport] Generated dual-view response with ${heatmapData.length} heatmap nodes`);
    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[HealthReport] Error during analysis:', errorMessage);

    // Provide user-friendly error messages
    let userFriendlyMessage = errorMessage;
    if (errorMessage.includes('No workspace folder open')) {
      userFriendlyMessage = 'Please open a workspace folder in VS Code to generate a health report.';
    } else if (errorMessage.includes('Failed to load graph data')) {
      userFriendlyMessage = 'Unable to analyze project structure. Please scan the project first using the "Scan Project" command.';
    } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
      userFriendlyMessage = 'Permission denied accessing project files. Please check file permissions.';
    }

    throw new Error(`Health report failed: ${userFriendlyMessage}`);
  }
}

/**
 * Transform risk scores to heatmap visualization data
 * @param riskScores Array of risk scores from health analysis
 * @returns Array of heatmap nodes for graph overlay
 */
function transformToHeatmapData(riskScores: RiskScore[]): HeatmapNode[] {
  return riskScores.map(risk => ({
    nodeId: risk.nodeId,
    score: risk.score,
    color: risk.color,
    metrics: {
      complexity: risk.metrics.complexity.cyclomaticComplexity || 0,
      churn: risk.metrics.churn.commitCount,
      dependencies: risk.metrics.dependencies,
      category: risk.category
    }
  }));
}

/**
 * Generate summary text for AI consumption
 * @param analysis Health analysis results
 * @returns Formatted summary string
 */
export function generateHealthSummary(analysis: HealthAnalysis): string {
  const { healthScore, totalFiles, distribution, topRisks } = analysis;
  
  const summary = [
    `# Codebase Health Report`,
    ``,
    `**Overall Health Score: ${healthScore}/100**`,
    ``,
    `Analyzed ${totalFiles} files with the following risk distribution:`,
    `- 🟢 Low Risk: ${distribution.low} files (${Math.round((distribution.low / totalFiles) * 100)}%)`,
    `- 🟡 Medium Risk: ${distribution.medium} files (${Math.round((distribution.medium / totalFiles) * 100)}%)`,
    `- 🟠 High Risk: ${distribution.high} files (${Math.round((distribution.high / totalFiles) * 100)}%)`,
    `- 🔴 Critical Risk: ${distribution.critical} files (${Math.round((distribution.critical / totalFiles) * 100)}%)`,
    ``,
    `## Top Risk Files:`,
    ...topRisks.slice(0, 3).map((risk, index) => 
      `${index + 1}. **${path.basename(risk.metrics.path)}** (${Math.round(risk.score * 100)}% risk)`
    ),
    ``,
    `## Key Recommendations:`,
    ...analysis.recommendations.slice(0, 3).map(rec => `- ${rec}`),
    ``,
    `Use the dashboard view to explore detailed metrics and the graph heatmap to visualize risk patterns across your codebase.`
  ].join('\n');

  return summary;
}