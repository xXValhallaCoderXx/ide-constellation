import * as vscode from 'vscode';
import { HealthAnalysis, RiskScore } from '../types/health-analysis.types';

/**
 * Service for displaying and formatting health analysis results
 * 
 * Provides various output formats including HTML webview, console output,
 * and structured logging for health analysis results.
 */
export class HealthDisplayService {

  /**
   * Display health analysis results in a VS Code webview panel
   * @param analysis Health analysis results
   * @param context VS Code extension context
   * @returns Created webview panel
   */
  static displayInWebview(analysis: HealthAnalysis, context?: vscode.ExtensionContext): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'healthAnalysis',
      'Codebase Health Analysis',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: context ? [context.extensionUri] : undefined
      }
    );

    panel.webview.html = this.generateHealthAnalysisHTML(analysis);
    
    // Handle webview messages for interactivity
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'openFile':
            this.openFileInEditor(message.filePath);
            break;
          case 'refreshAnalysis':
            // Could trigger a new analysis here
            vscode.commands.executeCommand('constellation.analyzeHealth');
            break;
        }
      }
    );

    return panel;
  }

  /**
   * Log health analysis results to console with structured formatting
   * @param analysis Health analysis results
   * @param outputChannel Optional VS Code output channel
   */
  static logAnalysisResults(analysis: HealthAnalysis, outputChannel?: vscode.OutputChannel): void {
    const log = (message: string) => {
      console.log(message);
      if (outputChannel) {
        outputChannel.appendLine(message);
      }
    };

    log('='.repeat(60));
    log('CODEBASE HEALTH ANALYSIS RESULTS');
    log('='.repeat(60));
    log(`Timestamp: ${new Date(analysis.timestamp).toLocaleString()}`);
    log(`Total Files Analyzed: ${analysis.totalFiles}`);
    log(`Overall Health Score: ${analysis.healthScore}/100`);
    log('');

    // Risk distribution
    log('RISK DISTRIBUTION:');
    log(`  Critical: ${analysis.distribution.critical} files (${Math.round((analysis.distribution.critical / analysis.totalFiles) * 100)}%)`);
    log(`  High:     ${analysis.distribution.high} files (${Math.round((analysis.distribution.high / analysis.totalFiles) * 100)}%)`);
    log(`  Medium:   ${analysis.distribution.medium} files (${Math.round((analysis.distribution.medium / analysis.totalFiles) * 100)}%)`);
    log(`  Low:      ${analysis.distribution.low} files (${Math.round((analysis.distribution.low / analysis.totalFiles) * 100)}%)`);
    log('');

    // Top risk files
    if (analysis.topRisks.length > 0) {
      log('TOP RISK FILES:');
      analysis.topRisks.forEach((risk, index) => {
        log(`  ${index + 1}. ${risk.metrics.path} (${risk.category.toUpperCase()}, ${risk.percentile}th percentile)`);
        log(`     Complexity: ${risk.metrics.complexity.cyclomaticComplexity || 'N/A'}, Churn: ${risk.metrics.churn.commitCount} commits, Dependencies: ${risk.metrics.dependencies}`);
      });
      log('');
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      log('RECOMMENDATIONS:');
      analysis.recommendations.forEach((rec, index) => {
        // Remove emoji and markdown formatting for console output
        const cleanRec = rec.replace(/[📊🚨⚠️🔧📝🔄📏✨💚🧮🏛️🚀📚📈🎉🎯📋🐌📅🔄✅]/g, '').replace(/\*\*(.*?)\*\*/g, '$1');
        log(`  ${index + 1}. ${cleanRec}`);
      });
      log('');
    }

    log('='.repeat(60));
  }

  /**
   * Generate detailed metrics report for debugging and validation
   * @param analysis Health analysis results
   * @returns Formatted metrics report string
   */
  static generateMetricsReport(analysis: HealthAnalysis): string {
    const lines: string[] = [];
    
    lines.push('DETAILED METRICS REPORT');
    lines.push('='.repeat(50));
    lines.push(`Analysis Timestamp: ${analysis.timestamp}`);
    lines.push(`Total Files: ${analysis.totalFiles}`);
    lines.push(`Health Score: ${analysis.healthScore}/100`);
    lines.push('');

    // Statistics
    const avgComplexity = this.calculateAverageComplexity(analysis.riskScores);
    const avgChurn = this.calculateAverageChurn(analysis.riskScores);
    const avgDependencies = this.calculateAverageDependencies(analysis.riskScores);
    
    lines.push('AVERAGE METRICS:');
    lines.push(`  Cyclomatic Complexity: ${avgComplexity.toFixed(2)}`);
    lines.push(`  Churn (commits/30d): ${avgChurn.toFixed(2)}`);
    lines.push(`  Dependencies: ${avgDependencies.toFixed(2)}`);
    lines.push('');

    // File details (top 10 by risk)
    const topFiles = [...analysis.riskScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    lines.push('TOP 10 FILES BY RISK:');
    lines.push('Rank | File | Risk | Complexity | Churn | Deps | LOC');
    lines.push('-'.repeat(80));
    
    topFiles.forEach((risk, index) => {
      const fileName = risk.metrics.path.split('/').pop() || risk.metrics.path;
      const truncatedName = fileName.length > 25 ? fileName.substring(0, 22) + '...' : fileName;
      lines.push(
        `${(index + 1).toString().padStart(4)} | ` +
        `${truncatedName.padEnd(25)} | ` +
        `${risk.percentile.toString().padStart(3)} | ` +
        `${(risk.metrics.complexity.cyclomaticComplexity || 0).toString().padStart(10)} | ` +
        `${risk.metrics.churn.commitCount.toString().padStart(5)} | ` +
        `${risk.metrics.dependencies.toString().padStart(4)} | ` +
        `${risk.metrics.complexity.linesOfCode.toString().padStart(3)}`
      );
    });

    return lines.join('\n');
  }

  /**
   * Create a summary notification message
   * @param analysis Health analysis results
   * @returns Summary message string
   */
  static createSummaryMessage(analysis: HealthAnalysis): string {
    const criticalCount = analysis.distribution.critical;
    const highCount = analysis.distribution.high;
    
    if (criticalCount > 0) {
      return `Health analysis complete! Score: ${analysis.healthScore}/100. ⚠️ ${criticalCount} critical risk files need immediate attention.`;
    } else if (highCount > 0) {
      return `Health analysis complete! Score: ${analysis.healthScore}/100. 📊 ${highCount} high risk files should be prioritized.`;
    } else if (analysis.healthScore > 85) {
      return `Health analysis complete! Score: ${analysis.healthScore}/100. ✨ Excellent codebase health!`;
    } else {
      return `Health analysis complete! Score: ${analysis.healthScore}/100. Check the analysis panel for recommendations.`;
    }
  }

  /**
   * Export analysis results to JSON format
   * @param analysis Health analysis results
   * @returns JSON string
   */
  static exportToJSON(analysis: HealthAnalysis): string {
    return JSON.stringify(analysis, null, 2);
  }

  /**
   * Export analysis results to CSV format
   * @param analysis Health analysis results
   * @returns CSV string
   */
  static exportToCSV(analysis: HealthAnalysis): string {
    const headers = [
      'File Path',
      'Risk Category',
      'Risk Score',
      'Risk Percentile',
      'Lines of Code',
      'Cyclomatic Complexity',
      'Commit Count',
      'Unique Authors',
      'Days Since Change',
      'Dependencies'
    ];

    const rows = analysis.riskScores.map(risk => [
      risk.metrics.path,
      risk.category,
      risk.score.toFixed(3),
      risk.percentile.toString(),
      risk.metrics.complexity.linesOfCode.toString(),
      (risk.metrics.complexity.cyclomaticComplexity || 0).toString(),
      risk.metrics.churn.commitCount.toString(),
      risk.metrics.churn.uniqueAuthors.toString(),
      risk.metrics.churn.daysSinceLastChange.toString(),
      risk.metrics.dependencies.toString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Generate HTML content for health analysis webview
   * @param analysis Health analysis results
   * @returns HTML string
   */
  private static generateHealthAnalysisHTML(analysis: HealthAnalysis): string {
    const { healthScore, totalFiles, distribution, topRisks, recommendations } = analysis;
    
    // Calculate percentages
    const criticalPercent = Math.round((distribution.critical / totalFiles) * 100);
    const highPercent = Math.round((distribution.high / totalFiles) * 100);
    const mediumPercent = Math.round((distribution.medium / totalFiles) * 100);
    const lowPercent = Math.round((distribution.low / totalFiles) * 100);
    
    // Determine health status
    let healthStatus = 'Excellent';
    let healthColor = '#22c55e';
    if (healthScore < 50) {
      healthStatus = 'Critical';
      healthColor = '#ef4444';
    } else if (healthScore < 70) {
      healthStatus = 'Needs Attention';
      healthColor = '#f97316';
    } else if (healthScore < 85) {
      healthStatus = 'Good';
      healthColor = '#eab308';
    }
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codebase Health Analysis</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .health-score {
            font-size: 3em;
            font-weight: bold;
            color: ${healthColor};
            margin: 10px 0;
        }
        .health-status {
            font-size: 1.2em;
            color: ${healthColor};
            margin-bottom: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .stat-card {
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .critical { color: #ef4444; }
        .high { color: #f97316; }
        .medium { color: #eab308; }
        .low { color: #22c55e; }
        .section {
            margin: 30px 0;
            padding: 20px;
            border-radius: 8px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .section h2 {
            margin-top: 0;
            color: var(--vscode-editor-foreground);
            border-bottom: 2px solid var(--vscode-textSeparator-foreground);
            padding-bottom: 10px;
        }
        .risk-file {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            border-radius: 4px;
            background-color: var(--vscode-list-hoverBackground);
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .risk-file:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
        .file-path {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        .risk-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }
        .recommendation {
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
            background-color: var(--vscode-list-hoverBackground);
            border-left: 4px solid var(--vscode-textLink-foreground);
        }
        .timestamp {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-top: 30px;
        }
        .actions {
            text-align: center;
            margin: 20px 0;
        }
        .action-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            margin: 0 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .action-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Codebase Health Analysis</h1>
        <div class="health-score">${healthScore}/100</div>
        <div class="health-status">${healthStatus}</div>
        <div>Analyzed ${totalFiles} files</div>
    </div>

    <div class="actions">
        <button class="action-button" onclick="refreshAnalysis()">🔄 Refresh Analysis</button>
        <button class="action-button" onclick="exportResults()">📊 Export Results</button>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-number critical">${distribution.critical}</div>
            <div class="stat-label">Critical Risk (${criticalPercent}%)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number high">${distribution.high}</div>
            <div class="stat-label">High Risk (${highPercent}%)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number medium">${distribution.medium}</div>
            <div class="stat-label">Medium Risk (${mediumPercent}%)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number low">${distribution.low}</div>
            <div class="stat-label">Low Risk (${lowPercent}%)</div>
        </div>
    </div>

    ${topRisks.length > 0 ? `
    <div class="section">
        <h2>🚨 Top Risk Files</h2>
        ${topRisks.map((risk: RiskScore) => `
            <div class="risk-file" onclick="openFile('${risk.metrics.path}')">
                <span class="file-path">${risk.metrics.path}</span>
                <span class="risk-badge ${risk.category}">${risk.category}</span>
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="section">
        <h2>💡 Recommendations</h2>
        ${recommendations.map((rec: string) => `
            <div class="recommendation">${rec}</div>
        `).join('')}
    </div>

    <div class="timestamp">
        Analysis completed at ${new Date(analysis.timestamp).toLocaleString()}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function openFile(filePath) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath
            });
        }
        
        function refreshAnalysis() {
            vscode.postMessage({
                command: 'refreshAnalysis'
            });
        }
        
        function exportResults() {
            // Could implement export functionality here
            vscode.postMessage({
                command: 'exportResults'
            });
        }
    </script>
</body>
</html>`;
  }

  /**
   * Open a file in the VS Code editor
   * @param filePath Path to the file to open
   */
  private static async openFileInEditor(filePath: string): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        return;
      }

      const fullPath = require('path').resolve(workspaceRoot, filePath);
      const document = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      console.warn(`Failed to open file: ${filePath}`, error);
    }
  }

  /**
   * Calculate average complexity across all files
   * @param riskScores Array of risk scores
   * @returns Average complexity
   */
  private static calculateAverageComplexity(riskScores: RiskScore[]): number {
    const complexities = riskScores
      .map(score => score.metrics.complexity.cyclomaticComplexity || 0)
      .filter(complexity => complexity > 0);

    return complexities.length > 0 
      ? complexities.reduce((sum, complexity) => sum + complexity, 0) / complexities.length 
      : 0;
  }

  /**
   * Calculate average churn across all files
   * @param riskScores Array of risk scores
   * @returns Average churn
   */
  private static calculateAverageChurn(riskScores: RiskScore[]): number {
    const churns = riskScores.map(score => score.metrics.churn.commitCount);
    return churns.length > 0 
      ? churns.reduce((sum, churn) => sum + churn, 0) / churns.length 
      : 0;
  }

  /**
   * Calculate average dependencies across all files
   * @param riskScores Array of risk scores
   * @returns Average dependencies
   */
  private static calculateAverageDependencies(riskScores: RiskScore[]): number {
    const dependencies = riskScores.map(score => score.metrics.dependencies);
    return dependencies.length > 0 
      ? dependencies.reduce((sum, deps) => sum + deps, 0) / dependencies.length 
      : 0;
  }
}