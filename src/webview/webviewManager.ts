import * as vscode from 'vscode';
import { MCPServer } from '../server/mcpServer';
import { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../types/messages';

export class WebviewManager {
  private currentPanel: vscode.WebviewPanel | undefined = undefined;
  private mcpServer: MCPServer | null = null;

  constructor(mcpServer: MCPServer | null) {
    this.mcpServer = mcpServer;
  }

  createOrShowPanel(context: vscode.ExtensionContext): void {
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
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')]
      }
    );

    // Set the webview's initial html content
    this.currentPanel.webview.html = this.getWebviewContent(context);

    // Handle messages from the webview
    this.currentPanel.webview.onDidReceiveMessage(
      async (message) => {
        await this.handleWebviewMessage(message);
      },
      undefined,
      context.subscriptions
    );

    // Reset when the current panel is closed
    this.currentPanel.onDidDispose(
      () => {
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
      default:
        console.warn('Unknown webview message command:', message.command);
    }
  }

  private async handleStatusCheck(): Promise<void> {
    if (this.mcpServer) {
      try {
        const status = await this.mcpServer.getStatus();
        const statusMessage: ExtensionToWebviewMessage = {
          command: 'statusUpdate',
          data: {
            status: status.status,
            timestamp: status.timestamp,
            port: status.port,
            error: status.error
          }
        };
        this.currentPanel?.webview.postMessage(statusMessage);

        // Also send server info
        const serverInfoMessage: ExtensionToWebviewMessage = {
          command: 'serverInfo',
          data: {
            isRunning: this.mcpServer.isRunning(),
            port: this.mcpServer.getPort()
          }
        };
        this.currentPanel?.webview.postMessage(serverInfoMessage);
      } catch (error) {
        const errorMessage: ExtensionToWebviewMessage = {
          command: 'statusUpdate',
          data: {
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };
        this.currentPanel?.webview.postMessage(errorMessage);
      }
    } else {
      const errorMessage: ExtensionToWebviewMessage = {
        command: 'statusUpdate',
        data: {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: 'MCP Server not initialized'
        }
      };
      this.currentPanel?.webview.postMessage(errorMessage);
    }
  }

  private getWebviewContent(context: vscode.ExtensionContext): string {
    const webviewUri = this.currentPanel?.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
    );

    const cssUri = this.currentPanel?.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles', 'main.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiro Constellation</title>
    <link href="${cssUri}" rel="stylesheet">
    <style>
        /* Fallback styles in case CSS file doesn't load */
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
            <h1>Kiro Constellation POC</h1>
            <p>Loading...</p>
        </div>
    </div>

    <script>
        // Make VS Code API available globally
        window.vscode = acquireVsCodeApi();
        
        // Fallback functionality if Preact doesn't load
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
                        if (data.timestamp) {
                            statusText += \` (Last checked: \${new Date(data.timestamp).toLocaleTimeString()})\`;
                        }
                        if (data.port) {
                            statusText += \` - Port: \${data.port}\`;
                        }
                        if (data.error) {
                            statusText += \` - Error: \${data.error}\`;
                        }
                        statusElement.textContent = statusText;
                        checkButton.disabled = false;
                    }
                });
            }
        }, 2000);
    </script>
    ${webviewUri ? `<script src="${webviewUri}"></script>` : ''}
</body>
</html>`;
  }

  dispose(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = undefined;
    }
  }

  updateMCPServer(mcpServer: MCPServer | null): void {
    this.mcpServer = mcpServer;
  }
}