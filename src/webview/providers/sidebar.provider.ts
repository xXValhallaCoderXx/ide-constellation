import * as vscode from 'vscode';

// Replace narrow interface with a discriminated union for sidebar → extension messages
type SidebarToExtensionMessage =
  | { command: 'showGraph' }
  | { command: 'panel:open'; data: { panel: 'dependencyGraph' | 'healthDashboard'; origin?: string } }
  | { command: 'project:scan'; data?: { origin?: string } };



export class ConstellationSidebarProvider implements vscode.WebviewViewProvider {
  constructor(private context: vscode.ExtensionContext) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,

  ): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'sidebar', 'styles')
      ]
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message: SidebarToExtensionMessage) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async handleMessage(message: SidebarToExtensionMessage): Promise<void> {
    switch (message.command) {
      case 'showGraph':
        try {
          await vscode.commands.executeCommand('constellation.showGraph');
        } catch (error) {
          console.error('Failed to execute showGraph command:', error);
          vscode.window.showErrorMessage('Failed to open Codebase Map');
        }
        break;
      case 'panel:open': {
        const key = message.data?.panel;
        try {
          if (key === 'dependencyGraph') {
            await vscode.commands.executeCommand('constellation.showGraph');
          } else if (key === 'healthDashboard') {
            await vscode.commands.executeCommand('constellation.healthDashboard');
          } else {
            console.warn('Unknown panel key from sidebar:', key);
          }
        } catch (err) {
          console.error('Failed to open panel:', err);
        }
        break;
      }
      case 'project:scan':
        try {
          await vscode.commands.executeCommand('constellation.scanProject');
        } catch (error) {
          console.error('Failed to scan project:', error);
          vscode.window.showErrorMessage('Scan Project failed');
        }
        break;
      default:
        console.warn('Unknown sidebar message received from webview');
    }
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const sidebarUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'sidebar.js')
    );

    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'sidebar', 'styles', 'sidebar.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kiro Constellation Sidebar</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; font-src ${cspSource};" />
    <link href="${cssUri}" rel="stylesheet">
    <style>
        body { 
          font-family: var(--vscode-font-family); 
          font-size: var(--vscode-font-size); 
          color: var(--vscode-foreground); 
          background-color: var(--vscode-sideBar-background); 
          margin: 0; 
          padding: 16px; 
        }
        #root { 
          width: 100%; 
        }
        .fallback-message { 
          text-align: center; 
          color: var(--vscode-descriptionForeground); 
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="fallback-message">
            <h2>Kiro Constellation</h2>
            <p>Loading...</p>
        </div>
    </div>

    <script nonce="${nonce}">
        window.vscode = acquireVsCodeApi();
        
        // Fallback if Preact bundle doesn't load
        setTimeout(() => {
            const root = document.getElementById('root');
            if (root && root.innerHTML.includes('Loading...')) {
                root.innerHTML = \`
                    <div>
                        <h2 style="margin-top: 0; color: var(--vscode-foreground);">Kiro Constellation</h2>
                        <button 
                            id="showMapButton" 
                            style="
                                background-color: var(--vscode-button-background); 
                                color: var(--vscode-button-foreground); 
                                border: none; 
                                padding: 8px 16px; 
                                border-radius: 2px; 
                                cursor: pointer;
                                width: 100%;
                                margin-top: 8px;
                            "
                        >
                            Show Codebase Map
                        </button>
                    </div>
                \`;
                
                const button = document.getElementById('showMapButton');
                if (button) {
                    button.addEventListener('click', () => {
                        window.vscode.postMessage({ command: 'showGraph' });
                    });
                }
            }
        }, 2000);
    </script>
    <script src="${sidebarUri}" nonce="${nonce}"></script>
</body>
</html>`;
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