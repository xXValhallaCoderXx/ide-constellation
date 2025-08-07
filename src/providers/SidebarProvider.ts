import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kiro-constellation.mapView';

    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {
        console.log('🚀 KIRO-CONSTELLATION: SidebarProvider constructor called');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('🚀 KIRO-CONSTELLATION: SidebarProvider resolveWebviewView called');
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'sidebar'),
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        try {
            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
            console.log('🚀 KIRO-CONSTELLATION: Webview HTML content set successfully');
        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error setting webview HTML:', error);
        }

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                try {
                    console.log('🚀 KIRO-CONSTELLATION: Received message type:', message.type);
                    switch (message.type) {
                        case 'showMap':
                            console.log('🚀 KIRO-CONSTELLATION: Sidebar requested to show map');
                            vscode.commands.executeCommand('kiro-constellation.showMap');
                            break;
                        case 'log':
                            console.log('🚀 KIRO-CONSTELLATION: Sidebar log:', message.data);
                            break;
                        default:
                            console.log('🚀 KIRO-CONSTELLATION: Unknown message type:', message.type);
                    }
                } catch (error) {
                    console.error('🚀 KIRO-CONSTELLATION: Error handling webview message:', error);
                }
            },
            undefined,
            []
        );
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        console.log('🚀 KIRO-CONSTELLATION: Generating HTML for webview');

        // Get resource URIs
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'sidebar', 'styles.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'sidebar', 'main.js'));

        console.log('🚀 KIRO-CONSTELLATION: Styles URI:', stylesUri.toString());
        console.log('🚀 KIRO-CONSTELLATION: Script URI:', scriptUri.toString());

        // For now, let's use the fallback HTML to avoid file reading issues
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kiro Constellation</title>
            <link href="${stylesUri}" rel="stylesheet">
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🌟 Kiro Constellation</h2>
                    <p>Architecture Visualization</p>
                </div>
                
                <div class="actions">
                    <button id="showMapBtn" class="primary-btn">
                        📊 Show Architecture Map
                    </button>
                    
                    <button id="refreshBtn" class="secondary-btn">
                        🔄 Refresh
                    </button>
                </div>
                
                <div class="info-section">
                    <h3>📋 Quick Actions</h3>
                    <ul class="action-list">
                        <li>• View current architecture</li>
                        <li>• Analyze dependencies</li>
                        <li>• Generate reports</li>
                    </ul>
                </div>
                
                <div class="stats-section">
                    <h3>📈 Project Stats</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Components</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-number">0</span>
                            <span class="stat-label">Connections</span>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <small>Ready to visualize your architecture</small>
                </div>
            </div>
            
            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
}
