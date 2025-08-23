import * as vscode from 'vscode';
// Removed MCPServer dependency; webview status is synthesized
import { WebviewToExtensionMessage, ExtensionToWebviewMessage, GraphResponseMessage, GraphErrorMessage } from '../types/messages.types';
import { GraphService } from '../services/graph.service';

export class WebviewManager {
  private currentPanel: vscode.WebviewPanel | undefined = undefined;
  private output?: vscode.OutputChannel;

  constructor(_mcpServer: unknown | null, output?: vscode.OutputChannel) {
    this.output = output;
  }

  createOrShowPanel(context: vscode.ExtensionContext): void {
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
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles')
        ]
      }
    );

    // Set the webview's initial html content
  this.currentPanel.webview.html = this.getWebviewContent(context);
  this.output?.appendLine(`[${new Date().toISOString()}] Webview HTML set.`);

    // Handle messages from the webview
    this.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
    this.output?.appendLine(`[${new Date().toISOString()}] Webview message received: ${JSON.stringify(message)}`);
        await this.handleWebviewMessage(message);
      },
      undefined,
      context.subscriptions
    );

    // Reset when the current panel is closed
    this.currentPanel.onDidDispose(
      () => {
  this.output?.appendLine(`[${new Date().toISOString()}] Webview panel disposed.`);
        this.currentPanel = undefined;
      },
      null,
      context.subscriptions
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
      default:
        console.warn('Unknown webview message command:', (message as any).command);
    }
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
    this.currentPanel?.webview.postMessage(statusMessage);
    this.output?.appendLine(`[${new Date().toISOString()}] Sent statusUpdate to webview: ${JSON.stringify(statusMessage.data)}`);

    const serverInfoMessage: ExtensionToWebviewMessage = {
      command: 'serverInfo',
      data: {
        isRunning: true
      }
    };
    this.currentPanel?.webview.postMessage(serverInfoMessage);
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

      this.currentPanel?.webview.postMessage(response);
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

      this.currentPanel?.webview.postMessage(errorResponse);
    }
  }

  private getWebviewContent(context: vscode.ExtensionContext): string {
    const webview = this.currentPanel?.webview!;
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const webviewUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
    );

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles', 'main.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiro Constellation</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};" />
    <link href="${cssUri}" rel="stylesheet">
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
    ${webviewUri ? `<script src="${webviewUri}" nonce="${nonce}"></script>` : ''}
</body>
</html>`;
  }

  dispose(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = undefined;
    }
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