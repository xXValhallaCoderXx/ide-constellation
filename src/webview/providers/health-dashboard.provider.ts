import * as vscode from 'vscode';
import { HealthAnalysis } from '../../types/health-analysis.types';
import { HealthAnalyzer } from '../../services/health-analyzer.service';
import { GraphService } from '../../services/graph.service';
import { exportToJSON, exportToCSV } from '../../services/health/health.services';
import { resolveWorkspacePath } from 'src/utils/path.utils';

/**
 * Health Dashboard Webview Provider
 * 
 * Manages the health dashboard webview panel lifecycle and provides
 * message routing between the extension and the health dashboard UI.
 */
export class HealthDashboardProvider {
  private panel: vscode.WebviewPanel | undefined = undefined;
  private context: vscode.ExtensionContext;
  private output?: vscode.OutputChannel;
  private currentAnalysis: HealthAnalysis | null = null;
  private webviewManager?: any; // Reference to main webview manager for cross-panel communication

  constructor(context: vscode.ExtensionContext, output?: vscode.OutputChannel) {
    this.context = context;
    this.output = output;
  }

  /**
   * Set the webview manager reference for cross-panel communication
   */
  public setWebviewManager(webviewManager: any): void {
    this.webviewManager = webviewManager;
  }

  /**
   * Create or show the health dashboard panel
   */
  public createOrShowPanel(): void {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Creating or showing health dashboard panel...`);

    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (this.panel) {
      this.panel.reveal(columnToShowIn);
      return;
    }

    // Create a new panel
    this.panel = vscode.window.createWebviewPanel(
      "healthDashboard",
      "Health Dashboard",
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, "dist"),
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "src",
            "webview",
            "styles"
          ),
          // Unified app style directories (FR2/FR20)
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "src",
            "webview",
            "ui",
            "dashboard-health",
            "styles"
          ),
          vscode.Uri.joinPath(
            this.context.extensionUri,
            "src",
            "webview",
            "ui",
            "graph-constellation",
            "styles"
          ),
        ],
      }
    );

    // Set the webview's initial HTML content
    this.panel.webview.html = this.getWebviewContent();
    this.output?.appendLine(`[${timestamp}] Health dashboard HTML set.`);

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        this.output?.appendLine(`[${timestamp}] Health dashboard message received: ${JSON.stringify(message)}`);
        await this.handleWebviewMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Reset when the current panel is closed
    this.panel.onDidDispose(
      () => {
        this.output?.appendLine(`[${timestamp}] Health dashboard panel disposed.`);
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );

    // If we have current analysis, send it to the new panel
    if (this.currentAnalysis) {
      setTimeout(() => {
        this.sendAnalysisToPanel(this.currentAnalysis!);
      }, 100);
    }
  }

  /**
   * Display health analysis in the dashboard
   */
  public async displayAnalysis(analysis: HealthAnalysis): Promise<void> {
    this.currentAnalysis = analysis;

    // Ensure panel is open
    this.createOrShowPanel();

    // Send analysis data to panel
    this.sendAnalysisToPanel(analysis);
  }

  /**
   * Send analysis data to the webview panel
   */
  private sendAnalysisToPanel(analysis: HealthAnalysis): void {
    if (!this.panel) {
      return;
    }

    const message = {
      command: 'health:response',
      data: {
        analysis,
        timestamp: new Date().toISOString()
      }
    };

    this.panel.webview.postMessage(message);
    this.output?.appendLine(`[${new Date().toISOString()}] Sent health analysis to dashboard: ${analysis.totalFiles} files, score ${analysis.healthScore}`);
  }

  /**
   * Handle messages from the health dashboard webview
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    const timestamp = new Date().toISOString();

    switch (message.command) {
      case 'health:request':
        await this.handleHealthRequest(message.data?.forceRefresh || false);
        break;
      case 'health:refresh':
        await this.handleHealthRequest(true);
        break;
      case 'health:export':
        await this.handleHealthExport(message.data?.format === 'csv' ? 'csv' : 'json');
        break;
      case 'health:showHeatmap':
        await this.handleShowHeatmap(message.data);
        break;
      case 'health:focusNode':
        await this.handleFocusNode(message.data);
        break;
      case 'editor:open':
        await this.handleEditorOpen(message.data);
        break;
      default:
        this.output?.appendLine(`[${timestamp}] Unknown health dashboard message: ${message.command}`);
    }
  }

  /**
   * Handle health export request: save currentAnalysis as JSON/CSV
   */
  private async handleHealthExport(format: 'json' | 'csv'): Promise<void> {
    const timestamp = new Date().toISOString();
    if (!this.currentAnalysis) {
      this.output?.appendLine(`[${timestamp}] [WARN] Export requested with no analysis available`);
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'health:export:result',
          data: { success: false, format, error: 'No analysis available to export' }
        });
      }
      return;
    }
    try {
      const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
      const fileName = `health-analysis-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
      const target = await vscode.window.showSaveDialog({
        defaultUri: defaultUri ? vscode.Uri.joinPath(defaultUri, fileName) : undefined,
        filters: { Data: [format] },
        saveLabel: 'Save Health Analysis'
      });
      if (!target) {
        // User cancelled
        return;
      }
      const content = format === 'csv' ? exportToCSV(this.currentAnalysis) : exportToJSON(this.currentAnalysis);
      const enc = new TextEncoder();
      await vscode.workspace.fs.writeFile(target, enc.encode(content));
      this.output?.appendLine(`[${timestamp}] Exported health analysis to ${target.toString()}`);
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'health:export:result',
          data: { success: true, format, uri: target.toString() }
        });
      }
      vscode.window.showInformationMessage(`Health analysis exported: ${target.fsPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.output?.appendLine(`[${timestamp}] [ERROR] Export failed: ${msg}`);
      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'health:export:result',
          data: { success: false, format, error: msg }
        });
      }
      vscode.window.showErrorMessage(`Export failed: ${msg}`);
    }
  }

  /**
   * Handle health analysis request
   */
  private async handleHealthRequest(forceRefresh: boolean): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Health analysis request (forceRefresh: ${forceRefresh})`);

    try {
      // Send loading message
      if (this.panel) {
        this.panel.webview.postMessage({ command: 'health:loading' });
      }

      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      // Get or load graph data
      const graphService = GraphService.getInstance();
      let graph = graphService.getGraph();

      if (!graph || forceRefresh) {
        this.output?.appendLine(`[${timestamp}] Loading fresh graph data for health analysis`);
        graph = await graphService.loadGraph(workspaceRoot, '.');
      }

      // Perform health analysis
      const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
      const analysis = await healthAnalyzer.analyzeCodebase(graph);

      // Store and send analysis
      this.currentAnalysis = analysis;
      this.sendAnalysisToPanel(analysis);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Health analysis error: ${errorMessage}`);

      if (this.panel) {
        this.panel.webview.postMessage({
          command: 'health:error',
          data: {
            error: errorMessage,
            timestamp
          }
        });
      }
    }
  }

  /**
   * Handle show heatmap request - delegate to main webview
   */
  private async handleShowHeatmap(data: any): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Show heatmap request from dashboard`);

    if (this.webviewManager && this.currentAnalysis) {
      // Use the webview manager's cross-panel navigation
      await this.webviewManager.navigateFromDashboardToGraph(
        this.currentAnalysis.riskScores,
        data.centerNode
      );
    } else {
      // Fallback: just open the graph panel; heatmap application requires manager context
      vscode.commands.executeCommand('constellation.showGraph');
    }
  }

  /**
   * Handle focus node request - delegate to main webview
   */
  private async handleFocusNode(data: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const { nodeId } = data;
    this.output?.appendLine(`[${timestamp}] Focus node request from dashboard: ${nodeId}`);

    if (this.webviewManager && this.currentAnalysis) {
      // Use the webview manager's cross-panel navigation
      await this.webviewManager.navigateFromDashboardToGraph(
        this.currentAnalysis.riskScores,
        nodeId
      );
    } else {
      // Fallback to opening the file directly
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot && nodeId) {
        try {
          const { abs, within } = resolveWorkspacePath(workspaceRoot, nodeId);
          const uri = vscode.Uri.file(abs);
          if (!within) {
            const msg = `Security: Cannot open outside workspace: ${nodeId}`;
            this.output?.appendLine(`[${timestamp}] ${msg}`);
            vscode.window.showWarningMessage(msg);
            return;
          }
          try {
            await vscode.workspace.fs.stat(uri);
          } catch {
            const friendly = `Cannot open "${nodeId}" — not found in workspace. It may be a module specifier or external dependency.`;
            this.output?.appendLine(`[${timestamp}] Focus open failed (ENOENT): ${nodeId} -> ${abs}`);
            vscode.window.showWarningMessage(friendly);
            return;
          }
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: true });
        } catch (error) {
          const emsg = error instanceof Error ? error.message : String(error);
          this.output?.appendLine(`[${timestamp}] Failed to open file for focus: ${nodeId} (${emsg})`);
          vscode.window.showErrorMessage(`Failed to open file: ${nodeId}`);
        }
      }
    }
  }

  /**
   * Handle editor open request
   */
  private async handleEditorOpen(data: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const { fileId, openMode } = data;
    this.output?.appendLine(`[${timestamp}] Editor open request from dashboard: ${fileId} (${openMode})`);

    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot || !fileId) {
        return;
      }

      // Resolve and validate file path (security + existence)
      const { abs, within } = resolveWorkspacePath(workspaceRoot, fileId);
      const fileUri = vscode.Uri.file(abs);
      if (!within) {
        vscode.window.showErrorMessage(`Security: Cannot open file outside workspace: ${fileId}`);
        this.output?.appendLine(`[${timestamp}] Security: rejected path outside workspace: ${fileId} -> ${abs}`);
        return;
      }
      try {
        await vscode.workspace.fs.stat(fileUri);
      } catch {
        // Provide helpful guidance for module-like identifiers (e.g., "react-dom/client")
        const friendly = `File not found in workspace: ${fileId}. It may refer to a module specifier or a generated/ignored file.`;
        vscode.window.showWarningMessage(friendly);
        this.output?.appendLine(`[${timestamp}] editor:open ENOENT ${fileId} -> ${abs}`);
        return;
      }

      // Open the file
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const viewColumn = openMode === 'split' ? vscode.ViewColumn.Beside : undefined;
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn });

      this.output?.appendLine(`[${timestamp}] File opened successfully: ${fileId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.output?.appendLine(`[${timestamp}] Failed to open file ${fileId}: ${errorMessage}`);
      vscode.window.showErrorMessage(`Failed to open file: ${fileId}`);
    }
  }

  /**
   * Get the webview HTML content
   */
  private getWebviewContent(): string {
    const webview = this.panel?.webview!;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;

    // Get URIs for resources
    const healthIndexUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'health-webview.js')
    );

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'styles', 'main.css')
    );
    // Merge plan: curated dashboard stylesheet
    const dashboardCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'dashboard-health', 'styles', 'health-dashboard.css')
    );
    // Merge plan: shared graph UI styles used by dashboard (toasts, loader, contextual help)
    const toastCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'graph-constellation', 'styles', 'toast-notification.css')
    );
    const loadingCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'graph-constellation', 'styles', 'loading-indicator.css')
    );
    const helpCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'graph-constellation', 'styles', 'contextual-help.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Health Dashboard</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};" />
    <link href="${cssUri}" rel="stylesheet">
    ${dashboardCssUri ? `<link href="${dashboardCssUri}" rel="stylesheet">` : ''}
    ${toastCssUri ? `<link href="${toastCssUri}" rel="stylesheet">` : ''}
    ${loadingCssUri ? `<link href="${loadingCssUri}" rel="stylesheet">` : ''}
    ${helpCssUri ? `<link href="${helpCssUri}" rel="stylesheet">` : ''}
    <style>
        body { 
            font-family: var(--vscode-font-family); 
            font-size: var(--vscode-font-size); 
            color: var(--vscode-foreground); 
            background-color: var(--vscode-editor-background); 
            margin: 0; 
            padding: 0; 
        }
        #root { 
            min-height: 100vh; 
        }
        .fallback-message { 
            padding: 20px; 
            text-align: center; 
            color: var(--vscode-descriptionForeground); 
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="fallback-message">
            <h1>Health Dashboard</h1>
            <p>Loading health analysis...</p>
        </div>
    </div>

    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
        
        // Fallback content if webview script fails to load
        setTimeout(() => {
            const root = document.getElementById('root');
            if (root && root.innerHTML.includes('Loading health analysis...')) {
                root.innerHTML = \`
                    <div style="padding: 20px; font-family: var(--vscode-font-family);">
                        <h1>Health Dashboard</h1>
                        <div style="margin: 20px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background-color: var(--vscode-panel-background);">
                            <p>Health dashboard is loading...</p>
                            <button onclick="window.vscode.postMessage({command: 'health:request'})" style="background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 2px; cursor: pointer;">
                                Request Health Analysis
                            </button>
                        </div>
                    </div>
                \`;
            }
        }, 2000);
    </script>
    ${healthIndexUri ? `<script src="${healthIndexUri}" nonce="${nonce}"></script>` : ''}
</body>
</html>`;
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Dispose of the provider and clean up resources
   */
  public dispose(): void {
    try {
      if (this.panel) {
        this.panel.dispose();
        this.panel = undefined;
      }
    } catch (error) {
      this.output?.appendLine(`[${new Date().toISOString()}] Error disposing health dashboard panel: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Clear analysis data and references
      this.currentAnalysis = null;
      this.webviewManager = undefined;
    } catch (error) {
      this.output?.appendLine(`[${new Date().toISOString()}] Error cleaning up health dashboard resources: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current panel (for external access)
   */
  public getPanel(): vscode.WebviewPanel | undefined {
    return this.panel;
  }

  /**
   * Check if the panel is currently visible
   */
  public isVisible(): boolean {
    return this.panel?.visible || false;
  }
}