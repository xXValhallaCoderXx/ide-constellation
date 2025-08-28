import * as vscode from 'vscode';
// Removed MCPServer dependency; webview status is synthesized
import { WebviewToExtensionMessage, ExtensionToWebviewMessage, GraphResponseMessage, GraphErrorMessage, EditorOpenMessage, HealthRequestMessage, HealthResponseMessage, HealthErrorMessage, HealthLoadingMessage, HealthShowHeatmapMessage, HealthFocusNodeMessage, HealthRefreshMessage, PanelOpenMessage, ProjectScanMessage } from '../types/messages.types';
import { GraphService } from '../services/graph.service';
import { HealthAnalyzer } from '../services/health-analyzer.service';
import { HealthDashboardProvider } from './providers/health-dashboard.provider';
import { resolveWorkspacePath } from 'src/utils/path.utils';
import { PanelRegistry } from '../services/panel-registry.service';

export class WebviewManager {
  private currentPanel: vscode.WebviewPanel | undefined = undefined;
  private healthDashboardProvider: HealthDashboardProvider | undefined = undefined;
  private output?: vscode.OutputChannel;
  private context: vscode.ExtensionContext | undefined = undefined;
  private panelRegistry: PanelRegistry | undefined = undefined;
  private visualInstructionDebounceTimer: NodeJS.Timeout | null = null;
  private pendingVisualInstruction: any | null = null;
  private static readonly VISUAL_INSTRUCTION_SIZE_LIMIT = 1_048_576; // 1MB
  private static readonly VISUAL_INSTRUCTION_DEBOUNCE_MS = 100; // 100ms debounce

  constructor(_mcpServer: unknown | null, output?: vscode.OutputChannel) {
    this.output = output;
  }

  /**
   * Initialize the WebviewManager with extension context
   */
  public initialize(context: vscode.ExtensionContext): void {
    this.context = context;
    this.healthDashboardProvider = new HealthDashboardProvider(context, this.output);

    // Set webview manager reference for cross-panel communication
    if (this.healthDashboardProvider && typeof this.healthDashboardProvider.setWebviewManager === 'function') {
      this.healthDashboardProvider.setWebviewManager(this);
    }
  }
  public setPanelRegistry(registry: PanelRegistry): void {
    this.panelRegistry = registry;
  }

  createOrShowPanel(): void {
    if (!this.context) {
      this.output?.appendLine(`[${new Date().toISOString()}] [ERROR] WebviewManager not initialized with context`);
      return;
    }
    this.output?.appendLine(`[${new Date().toISOString()}] Creating or showing webview panel...`);
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (this.currentPanel) {
      this.currentPanel.reveal(columnToShowIn);
      return;
    }

    // Otherwise, create a new panel
    this.currentPanel = vscode.window.createWebviewPanel(
      'kiroConstellation',
      'Kiro Constellation',
      columnToShowIn || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'styles'),
          // Include unified UI style directories so @import references resolve (FR20 / Section 15.1)
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'dashboard-health', 'styles'),
          vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'ui', 'graph-constellation', 'styles')
        ]
      }
    );

    // Set the webview's initial html content
    this.currentPanel.webview.html = this.getWebviewContent();
    this.output?.appendLine(`[${new Date().toISOString()}] Webview HTML set.`);

    // Handle messages from the webview
    this.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        this.output?.appendLine(`[${new Date().toISOString()}] Webview message received: ${JSON.stringify(message)}`);
        await this.handleWebviewMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Reset when the current panel is closed
    this.currentPanel.onDidDispose(
      () => {
        this.output?.appendLine(`[${new Date().toISOString()}] Webview panel disposed.`);
        this.currentPanel = undefined;
      },
      null,
      this.context.subscriptions
    );
  }

  private async handleWebviewMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.command) {
      case 'checkStatus':
        await this.handleStatusCheck();
        break;
      case 'graph:request':
        await this.handleGraphRequest();
        break;
      case 'editor:open':
        await this.handleEditorOpen(message as EditorOpenMessage);
        break;
      case 'health:request':
        await this.handleHealthRequest(message as HealthRequestMessage);
        break;
      case 'health:showHeatmap':
        await this.handleHealthShowHeatmap(message as HealthShowHeatmapMessage);
        break;
      case 'health:focusNode':
        await this.handleHealthFocusNode(message as HealthFocusNodeMessage);
        break;
      case 'health:refresh':
        await this.handleHealthRefresh(message as HealthRefreshMessage);
        break;
      case 'panel:open': {
        const m = message as PanelOpenMessage;
        const origin = m.data?.origin || 'sidebar:unknown';
        const key = m.data?.panel;
        this.output?.appendLine(`[${new Date().toISOString()}] panel:open request key=${key} origin=${origin}`);
        if (this.panelRegistry) {
          this.panelRegistry.open(key, origin);
        } else {
          // Minimal fallback without registry
          if (key === 'dependencyGraph') { this.createOrShowPanel(); }
          else if (key === 'healthDashboard') { this.createOrShowHealthDashboard(); }
          else { this.output?.appendLine(`[${new Date().toISOString()}] [WARN] Unknown panel key: ${key}`); }
        }
        break;
      }
      case 'project:scan': {
        const m = message as ProjectScanMessage;
        const origin = m.data?.origin || 'sidebar:unknown';
        this.output?.appendLine(`[${new Date().toISOString()}] project:scan request origin=${origin}`);
        try {
          await vscode.commands.executeCommand('constellation.scanProject');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.output?.appendLine(`[${new Date().toISOString()}] [ERROR] project:scan failed: ${msg}`);
        }
        break;
      }
      case 'visualInstruction':
        await this.handleVisualInstruction(message as any);
        break;
      default:
        console.warn('Unknown webview message command:', (message as any).command);
    }
  }

  /**
   * Handle editor:open message (FR2/FR3/FR16). Full security validation & split handling added in later subtasks.
   */
  private async handleEditorOpen(message: EditorOpenMessage): Promise<void> {
    const { fileId, openMode } = message.data || {};
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] editor:open request ${fileId} (${openMode})`);
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !fileId) {
      return;
    }

    try {
      const resolved = await this.resolveWorkspaceFile(workspaceRoot, fileId);
      if (!resolved.withinWorkspace) {
        vscode.window.showErrorMessage(`Blocked attempt to open outside workspace: ${fileId}`);
        this.output?.appendLine(`[${timestamp}] Security: rejected path outside workspace: ${fileId}`);
        return;
      }
      if (!resolved.exists) {
        vscode.window.showErrorMessage(`File not found: ${fileId}`);
        this.output?.appendLine(`[${timestamp}] editor:open file missing ${fileId}`);
        return;
      }
      const doc = await vscode.workspace.openTextDocument(resolved.uri);
      const viewColumn = openMode === 'split' ? vscode.ViewColumn.Beside : undefined;
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn });
      this.output?.appendLine(`[${timestamp}] editor:open success ${fileId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to open file: ${fileId}`);
      this.output?.appendLine(`[${timestamp}] editor:open failed for ${fileId}: ${msg}`);
    }
  }

  /**
   * Resolve a workspace-relative file path and perform security + existence checks (FR3, FR15)
   */
  private async resolveWorkspaceFile(workspaceRoot: string, fileId: string): Promise<{ uri: vscode.Uri; exists: boolean; withinWorkspace: boolean }> {
    // FR3 / FR13: Path traversal & workspace containment guard centralization
    const { abs, within } = resolveWorkspacePath(workspaceRoot, fileId);
    const uri = vscode.Uri.file(abs);
    let exists = false;
    if (within) {
      try { await vscode.workspace.fs.stat(uri); exists = true; } catch { exists = false; }
    }
    return { uri, exists, withinWorkspace: within };
  }

  private async handleStatusCheck(): Promise<void> {
    // Synthesize a simple status for MCP-provider mode
    const statusMessage: ExtensionToWebviewMessage = {
      command: 'statusUpdate',
      data: {
        status: 'ok',
        timestamp: new Date().toISOString()
      }
    };
    // Task 10.1: Guard postMessage
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage(statusMessage);
    }
    this.output?.appendLine(`[${new Date().toISOString()}] Sent statusUpdate to webview: ${JSON.stringify(statusMessage.data)}`);

    const serverInfoMessage: ExtensionToWebviewMessage = {
      command: 'serverInfo',
      data: {
        isRunning: true
      }
    };
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage(serverInfoMessage);
    }
    this.output?.appendLine(`[${new Date().toISOString()}] Sent serverInfo to webview: ${JSON.stringify(serverInfoMessage.data)}`);
  }

  private async handleGraphRequest(): Promise<void> {
    this.output?.appendLine(`[${new Date().toISOString()}] Handling graph request...`);

    try {
      const graphService = GraphService.getInstance();

      // Get current workspace root
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      // Try to get existing graph or load new one
      let graph = graphService.getGraph();
      if (!graph) {
        this.output?.appendLine(`[${new Date().toISOString()}] Loading graph data...`);
        graph = await graphService.loadGraph(workspaceRoot, '.');
      }

      const response: GraphResponseMessage = {
        command: 'graph:response',
        data: {
          graph,
          timestamp: new Date().toISOString()
        }
      };

      if (this.currentPanel) {
        this.currentPanel.webview.postMessage(response);
      }
      this.output?.appendLine(`[${new Date().toISOString()}] Sent graph data to webview: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${new Date().toISOString()}] Graph request error: ${errorMessage}`);

      const errorResponse: GraphErrorMessage = {
        command: 'graph:error',
        data: {
          error: errorMessage,
          timestamp: new Date().toISOString()
        }
      };

      if (this.currentPanel) {
        this.currentPanel.webview.postMessage(errorResponse);
      }
    }
  }

  private getWebviewContent(): string {
    if (!this.context) {
      return "<!DOCTYPE html><html><body><p>Context not initialized</p></body></html>";
    }
    const webview = this.currentPanel?.webview!;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js")
    );

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "styles",
        "main.css"
      )
    );

    // Add component-specific CSS files
    const richTooltipCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "graph-constellation",
        "styles",
        "rich-tooltip.css"
      )
    );

    const toastNotificationCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "graph-constellation",
        "styles",
        "toast-notification.css"
      )
    );

    const loadingIndicatorCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "graph-constellation",
        "styles",
        "loading-indicator.css"
      )
    );

    const contextualHelpCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "graph-constellation",
        "styles",
        "contextual-help.css"
      )
    );

    const heatmapLegendCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.context.extensionUri,
        "src",
        "webview",
        "ui",
        "graph-constellation",
        "styles",
        "heatmap-legend.css"
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiro Constellation</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};" />
    <link href="${cssUri}" rel="stylesheet">
    <link href="${richTooltipCssUri}" rel="stylesheet">
    <link href="${toastNotificationCssUri}" rel="stylesheet">
    <link href="${loadingIndicatorCssUri}" rel="stylesheet">
    <link href="${contextualHelpCssUri}" rel="stylesheet">
    <link href="${heatmapLegendCssUri}" rel="stylesheet">
    <style>
        body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background-color: var(--vscode-editor-background); margin: 0; padding: 0; }
        #root { min-height: 100vh; }
        .fallback-message { padding: 20px; text-align: center; color: var(--vscode-descriptionForeground); }
    </style>
</head>
<body>
    <div id="root">
        <div class="fallback-message">
            <h1>Kiro Constellation POC</h1>
            <p>Loading...</p>
        </div>
    </div>

    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
        setTimeout(() => {
            const root = document.getElementById('root');
            if (root && root.innerHTML.includes('Loading...')) {
                root.innerHTML = \`
                    <div style="padding: 20px; font-family: var(--vscode-font-family);">
                        <h1>Kiro Constellation POC</h1>
                        <div style="margin: 20px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background-color: var(--vscode-panel-background);">
                            <div id="status" style="margin-bottom: 10px; padding: 8px; background-color: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 2px;">Status: Unknown</div>
                            <button id="checkButton" style="background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; border-radius: 2px; cursor: pointer;">Check Server Status</button>
                        </div>
                    </div>
                \`;
                const statusElement = document.getElementById('status');
                const checkButton = document.getElementById('checkButton');
                checkButton.addEventListener('click', () => {
                    checkButton.disabled = true;
                    statusElement.textContent = 'Status: Checking...';
                    window.vscode.postMessage({ command: 'checkStatus' });
                });
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'statusUpdate') {
                        const data = message.data;
                        let statusText = \`Status: \${data.status}\`;
                        if (data.timestamp) { statusText += \` (Last checked: \${new Date(data.timestamp).toLocaleTimeString()})\`; }
                        if (data.error) { statusText += \` - Error: \${data.error}\`; }
                        statusElement.textContent = statusText;
                        checkButton.disabled = false;
                    }
                });
            }
        }, 2000);
    </script>
    ${
      webviewUri ? `<script src="${webviewUri}" nonce="${nonce}"></script>` : ""
    }
</body>
</html>`;
  }

  /**
   * Handle health analysis request
   */
  private async handleHealthRequest(message: HealthRequestMessage): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Health analysis request received`);

    // Send loading message
    const loadingMessage: HealthLoadingMessage = {
      command: 'health:loading'
    };
    if (this.currentPanel) {
      this.currentPanel.webview.postMessage(loadingMessage);
    }

    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        throw new Error('No workspace folder found');
      }

      // Get or load graph data
      const graphService = GraphService.getInstance();
      let graph = graphService.getGraph();

      if (!graph || message.data?.forceRefresh) {
        this.output?.appendLine(`[${timestamp}] Loading fresh graph data for health analysis`);
        graph = await graphService.loadGraph(workspaceRoot, '.');
      }

      // Perform health analysis
      const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
      const analysis = await healthAnalyzer.analyzeCodebase(graph);

      const response: HealthResponseMessage = {
        command: 'health:response',
        data: {
          analysis,
          timestamp
        }
      };

      if (this.currentPanel) {
        this.currentPanel.webview.postMessage(response);
      }
      this.output?.appendLine(`[${timestamp}] Health analysis completed: ${analysis.totalFiles} files, score ${analysis.healthScore}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Health analysis error: ${errorMessage}`);

      const errorResponse: HealthErrorMessage = {
        command: 'health:error',
        data: {
          error: errorMessage,
          timestamp
        }
      };

      if (this.currentPanel) {
        this.currentPanel.webview.postMessage(errorResponse);
      }
    }
  }

  /**
   * Handle show heatmap on graph request
   */
  private async handleHealthShowHeatmap(message: HealthShowHeatmapMessage): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Show heatmap request received`);

    try {
      // Transform health analysis to heatmap data
      const { analysis, centerNode } = message.data;

      // Use the new cross-panel navigation method
      await this.navigateFromDashboardToGraph(analysis.riskScores, centerNode);

      this.output?.appendLine(`[${timestamp}] Heatmap navigation completed`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Show heatmap error: ${errorMessage}`);
    }
  }

  /**
   * Handle focus node in graph request
   */
  private async handleHealthFocusNode(message: HealthFocusNodeMessage): Promise<void> {
    const timestamp = new Date().toISOString();
    const { nodeId } = message.data;
    this.output?.appendLine(`[${timestamp}] Focus node request: ${nodeId}`);

    try {
      // Send highlight message to graph
      const highlightMessage = {
        command: 'graph:highlightNode',
        data: {
          fileId: nodeId
        }
      };

      if (this.currentPanel) {
        this.currentPanel.webview.postMessage(highlightMessage);
      }

      this.output?.appendLine(`[${timestamp}] Node focused: ${nodeId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Focus node error: ${errorMessage}`);
    }
  }

  /**
   * Handle refresh health analysis request
   */
  private async handleHealthRefresh(message: HealthRefreshMessage): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Health refresh request received`);

    // Treat as a force refresh health request
    await this.handleHealthRequest({
      command: 'health:request',
      data: { forceRefresh: true }
    });
  }

  /**
   * Handle visual instruction from MCP provider with debouncing and size guards
   */
  private async handleVisualInstruction(message: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const instruction = message.data;

    if (!instruction || !instruction.action) {
      this.output?.appendLine(`[${timestamp}] Invalid visual instruction received: missing action`);
      return;
    }

    // Size guard check
    try {
      const size = Buffer.byteLength(JSON.stringify(instruction), 'utf8');
      if (size > WebviewManager.VISUAL_INSTRUCTION_SIZE_LIMIT) {
        this.output?.appendLine(`[${timestamp}] Visual instruction too large (${size} bytes), skipping`);
        return;
      }
    } catch (error) {
      this.output?.appendLine(`[${timestamp}] Failed to measure instruction size, allowing processing`);
    }

    this.output?.appendLine(`[${timestamp}] Visual instruction received: ${instruction.action} (correlation: ${instruction.correlationId || 'none'})`);

    // Debounced processing
    this.pendingVisualInstruction = instruction;

    if (this.visualInstructionDebounceTimer) {
      clearTimeout(this.visualInstructionDebounceTimer);
    }

    this.visualInstructionDebounceTimer = setTimeout(async () => {
      const toProcess = this.pendingVisualInstruction;
      this.pendingVisualInstruction = null;
      this.visualInstructionDebounceTimer = null;

      if (!toProcess) {
        return;
      }

      try {
        await this.processVisualInstruction(toProcess);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.output?.appendLine(`[${new Date().toISOString()}] Visual instruction processing error: ${errorMessage}`);
      }
    }, WebviewManager.VISUAL_INSTRUCTION_DEBOUNCE_MS);
  }

  /**
   * Process visual instruction after debouncing
   */
  private async processVisualInstruction(instruction: any): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      switch (instruction.action) {
        case 'applyHealthAnalysis':
          await this.handleApplyHealthAnalysis(instruction);
          break;
        default:
          this.output?.appendLine(`[${timestamp}] Unknown visual instruction action: ${instruction.action}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Visual instruction processing error: ${errorMessage}`);

      // Implement fallback strategy
      await this.handleVisualInstructionFallback(instruction, errorMessage);
    }
  }

  /**
   * Handle fallback strategies for visual instruction failures
   */
  private async handleVisualInstructionFallback(instruction: any, error: string): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Attempting visual instruction fallback for action: ${instruction.action}`);

    try {
      switch (instruction.action) {
        case 'applyHealthAnalysis':
          // Fallback: show dashboard only
          this.createOrShowHealthDashboard();
          this.output?.appendLine(`[${timestamp}] Fallback successful: health dashboard shown`);
          break;
        default:
          this.output?.appendLine(`[${timestamp}] No fallback available for action: ${instruction.action}`);
      }
    } catch (fallbackError) {
      this.output?.appendLine(`[${timestamp}] Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
    }
  }

  /**
   * Handle applyHealthAnalysis visual instruction
   */
  private async handleApplyHealthAnalysis(instruction: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const { payload } = instruction;

    this.output?.appendLine(`[${timestamp}] Applying health analysis visual instruction`);

    try {
      // Handle dual-view payload structure from health report tool
      if (payload.type === 'dual-view') {
        const { dashboard, graph } = payload;

        // Show dashboard if requested
        if (dashboard?.show && dashboard?.data) {
          this.output?.appendLine(`[${timestamp}] Showing health dashboard`);
          this.createOrShowHealthDashboard();
          await this.displayHealthAnalysis(dashboard.data);

          // Focus on specific file if provided
          if (dashboard.focusFile && this.healthDashboardProvider) {
            const panel = this.healthDashboardProvider.getPanel();
            if (panel) {
              panel.webview.postMessage({
                command: 'dashboard:highlightRisk',
                data: { nodeId: dashboard.focusFile }
              });
            }
          }
        }

        // Show graph with heatmap if requested
        if (graph?.show && graph?.heatmapData) {
          this.output?.appendLine(`[${timestamp}] Applying heatmap to graph`);

          try {
            if (this.context) {
              this.createOrShowPanel();
            }

            // Apply heatmap with animation config
            if (this.currentPanel) {
              const heatmapMessage = {
                command: 'graph:applyHeatmap',
                data: {
                  heatmapData: graph.heatmapData,
                  centerNode: graph.centerNode,
                  animationConfig: graph.animationConfig || { duration: 300, easing: 'ease-out' },
                  distribution: dashboard?.data?.distribution,
                  totalFiles: dashboard?.data?.totalFiles
                }
              };

              this.currentPanel.webview.postMessage(heatmapMessage);

              // Focus on center node if provided
              if (graph.centerNode) {
                this.currentPanel.webview.postMessage({
                  command: 'graph:highlightNode',
                  data: { fileId: graph.centerNode }
                });
              }
            } else {
              throw new Error('Graph panel not available');
            }
          } catch (graphError) {
            this.output?.appendLine(`[${timestamp}] Graph rendering failed, falling back to dashboard-only mode: ${graphError instanceof Error ? graphError.message : String(graphError)}`);

            // Fallback: ensure dashboard is shown even if graph fails
            if (dashboard?.show && dashboard?.data) {
              this.createOrShowHealthDashboard();
              await this.displayHealthAnalysis(dashboard.data);

              // Send error notification to dashboard
              if (this.healthDashboardProvider) {
                const panel = this.healthDashboardProvider.getPanel();
                if (panel) {
                  panel.webview.postMessage({
                    command: 'dashboard:notification',
                    data: {
                      type: 'warning',
                      message: 'Graph visualization failed. Showing dashboard-only view.'
                    }
                  });
                }
              }
            }
          }
        }

        this.output?.appendLine(`[${timestamp}] Dual-view health analysis applied successfully`);

      } else {
        // Fallback for legacy payload structure
        const { analysis, displayMode } = payload;

        if (!analysis) {
          this.output?.appendLine(`[${timestamp}] No analysis data in visual instruction payload`);
          return;
        }

        const mode = displayMode || 'dashboard';

        switch (mode) {
          case 'dashboard':
            this.createOrShowHealthDashboard();
            await this.displayHealthAnalysis(analysis);
            break;

          case 'graph':
            if (this.context) {
              this.createOrShowPanel();
            }
            await this.navigateFromDashboardToGraph(analysis.riskScores);
            break;

          case 'both':
            this.createOrShowHealthDashboard();
            await this.displayHealthAnalysis(analysis);

            if (this.context) {
              this.createOrShowPanel();
            }
            await this.navigateFromDashboardToGraph(analysis.riskScores);
            break;

          default:
            this.output?.appendLine(`[${timestamp}] Unknown display mode: ${mode}, defaulting to dashboard`);
            this.createOrShowHealthDashboard();
            await this.displayHealthAnalysis(analysis);
        }

        this.output?.appendLine(`[${timestamp}] Health analysis visual instruction applied successfully (mode: ${mode})`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Failed to apply health analysis: ${errorMessage}`);

      // Fallback: try to show dashboard only
      try {
        this.createOrShowHealthDashboard();
        this.output?.appendLine(`[${timestamp}] Fallback to dashboard-only mode successful`);
      } catch (fallbackError) {
        this.output?.appendLine(`[${timestamp}] Fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }
  }

  /**
   * Create or show the health dashboard panel
   */
  public createOrShowHealthDashboard(): void {
    if (!this.healthDashboardProvider) {
      this.output?.appendLine(`[${new Date().toISOString()}] Health dashboard provider not initialized`);
      return;
    }
    this.healthDashboardProvider.createOrShowPanel();
  }

  /**
   * Display health analysis in the dashboard
   */
  public async displayHealthAnalysis(analysis: any): Promise<void> {
    if (!this.healthDashboardProvider) {
      this.output?.appendLine(`[${new Date().toISOString()}] Health dashboard provider not initialized`);
      return;
    }
    await this.healthDashboardProvider.displayAnalysis(analysis);
  }

  /**
   * Get the health dashboard provider
   */
  public getHealthDashboardProvider(): HealthDashboardProvider | undefined {
    return this.healthDashboardProvider;
  }

  /**
   * Handle cross-panel navigation from health dashboard to graph
   */
  public async navigateFromDashboardToGraph(riskScores: any[], focusNodeId?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Navigating from dashboard to graph with ${riskScores.length} risk scores`);

    try {
      // Ensure main graph panel is open
      if (!this.currentPanel && this.context) {
        this.createOrShowPanel();
      }

      // Transform risk scores to heatmap data
      const heatmapData = riskScores.map(risk => ({
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

      // Send heatmap data to graph
      if (this.currentPanel) {
        this.currentPanel.webview.postMessage({
          command: 'graph:applyHeatmap',
          data: {
            heatmapData,
            centerNode: focusNodeId,
            distribution: {
              low: riskScores.filter(r => r.category === 'low').length,
              medium: riskScores.filter(r => r.category === 'medium').length,
              high: riskScores.filter(r => r.category === 'high').length,
              critical: riskScores.filter(r => r.category === 'critical').length
            },
            totalFiles: riskScores.length
          }
        });

        // Focus on specific node if provided
        if (focusNodeId) {
          this.currentPanel.webview.postMessage({
            command: 'graph:highlightNode',
            data: { fileId: focusNodeId }
          });
        }
      }

      this.output?.appendLine(`[${timestamp}] Heatmap applied to graph with ${heatmapData.length} nodes`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Navigation from dashboard to graph failed: ${errorMessage}`);
    }
  }

  /**
   * Handle cross-panel navigation from graph to dashboard
   */
  public async navigateFromGraphToDashboard(nodeId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    this.output?.appendLine(`[${timestamp}] Navigating from graph to dashboard for node: ${nodeId}`);

    try {
      // Ensure health dashboard is open
      this.createOrShowHealthDashboard();

      // Send highlight message to dashboard
      if (this.healthDashboardProvider) {
        const panel = this.healthDashboardProvider.getPanel();
        if (panel) {
          panel.webview.postMessage({
            command: 'dashboard:highlightRisk',
            data: { nodeId }
          });
        }
      }

      this.output?.appendLine(`[${timestamp}] Dashboard highlight sent for node: ${nodeId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.output?.appendLine(`[${timestamp}] Navigation from graph to dashboard failed: ${errorMessage}`);
    }
  }

  dispose(): void {
    try {
      // Clean up main panel
      if (this.currentPanel) {
        this.currentPanel.dispose();
        this.currentPanel = undefined;
      }
    } catch (error) {
      this.output?.appendLine(`[${new Date().toISOString()}] Error disposing main panel: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Clean up health dashboard provider
      if (this.healthDashboardProvider) {
        this.healthDashboardProvider.dispose();
        this.healthDashboardProvider = undefined;
      }
    } catch (error) {
      this.output?.appendLine(`[${new Date().toISOString()}] Error disposing health dashboard provider: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      // Clean up timers and pending operations
      if (this.visualInstructionDebounceTimer) {
        clearTimeout(this.visualInstructionDebounceTimer);
        this.visualInstructionDebounceTimer = null;
      }
      this.pendingVisualInstruction = null;
    } catch (error) {
      this.output?.appendLine(`[${new Date().toISOString()}] Error cleaning up timers: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Clear context reference
    this.context = undefined;
  }

  updateMCPServer(_mcpServer: unknown | null): void {
    // no-op in MCP provider mode
  }

  private getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}