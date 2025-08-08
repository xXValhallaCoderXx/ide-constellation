import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { DependencyGraph } from '../../analyzer';
import { GraphUpdateMessage, GraphStatusMessage } from '../shared/types';

/**
 * Manages the webview panel for the Kiro Constellation architecture map
 */
export class WebviewManager {
    private static readonly viewType = 'architectureMap';
    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.extensionUri = context.extensionUri;
    }

    /**
     * Creates a new webview panel or shows the existing one
     */
    public createOrShowPanel(): void {
        try {
            const column = vscode.ViewColumn.One;

            // If we already have a panel, show it
            if (this.panel) {
                this.panel.reveal(column);
                console.log('🚀 KIRO-CONSTELLATION: Existing webview panel revealed');
                return;
            }

            // Create a new panel
            this.panel = vscode.window.createWebviewPanel(
                WebviewManager.viewType,
                'Kiro Constellation: Architecture Map',
                column,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.extensionUri, 'dist', 'src', 'ui', 'webview'),
                        vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'webview'),
                        vscode.Uri.joinPath(this.extensionUri, 'media')
                    ]
                }
            );

            this.panel.webview.html = this.getWebviewContent();

            // Handle when the panel is disposed
            this.panel.onDidDispose(() => {
                console.log('🚀 KIRO-CONSTELLATION: Webview panel disposed');
                this.panel = undefined;
            }, null, this.context.subscriptions);

            console.log('🚀 KIRO-CONSTELLATION: New webview panel created successfully');

        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error creating webview panel:', error);
            vscode.window.showErrorMessage('Failed to create architecture map panel');
        }
    }

    /**
     * Generates the HTML content for the webview with proper resource URIs
     */
    private getWebviewContent(): string {
        try {
            if (!this.panel) {
                throw new Error('No panel available for content generation');
            }

            // Get paths to resources on disk - use dist folder for compiled assets
            const webviewPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'src', 'ui', 'webview');
            const htmlFilePath = vscode.Uri.joinPath(webviewPath, 'webview.html');

            // Read the HTML file
            let htmlContent: string;
            try {
                htmlContent = fs.readFileSync(htmlFilePath.fsPath, 'utf8');
            } catch (fileError) {
                console.error('🚀 KIRO-CONSTELLATION: Could not read webview.html, using fallback content');
                return this.getFallbackHtmlContent();
            }

            // Convert resource paths to webview URIs
            const stylesUri = this.panel.webview.asWebviewUri(
                vscode.Uri.joinPath(webviewPath, 'webview.css')
            );
            
            // Read the JavaScript file to inline it
            let scriptContent = '';
            try {
                const scriptPath = vscode.Uri.joinPath(webviewPath, 'webview.js');
                scriptContent = fs.readFileSync(scriptPath.fsPath, 'utf8');
            } catch (scriptError) {
                console.error('🚀 KIRO-CONSTELLATION: Could not read webview.js:', scriptError);
                scriptContent = 'console.error("Webview script could not be loaded");';
            }

            // Replace placeholder paths with proper URIs and inline script
            htmlContent = htmlContent
                .replace(/href="webview.css"/g, `href="${stylesUri}"`)
                .replace(/<script src="webview.js"><\/script>/g, `<script>${scriptContent}</script>`);

            console.log('🚀 KIRO-CONSTELLATION: Webview content generated with proper resource URIs');
            return htmlContent;

        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error generating webview content:', error);
            return this.getFallbackHtmlContent();
        }
    }

    /**
     * Provides fallback HTML content if the main HTML file cannot be loaded
     */
    private getFallbackHtmlContent(): string {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Kiro Constellation - Architecture Map</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    padding: 16px;
                    text-align: center;
                }
                #cy {
                    width: 300px;
                    height: 300px;
                    border: 1px solid var(--vscode-panel-border);
                    margin: 16px auto;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: var(--vscode-editor-background);
                }
            </style>
        </head>
        <body>
            <h1>Loading map...</h1>
            <div id="cy">Map container ready</div>
            <script>
                console.log("Hello World from webview!");
                console.log("🚀 KIRO-CONSTELLATION: Fallback webview content loaded");
            </script>
        </body>
        </html>`;
    }

    /**
     * Disposes of the webview panel if it exists
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
            console.log('🚀 KIRO-CONSTELLATION: WebviewManager disposed');
        }
    }

    /**
     * Sends dependency graph data to the webview
     */
    public sendGraphData(data: DependencyGraph): void {
        try {
            // Check if panel exists and is active
            if (!this.panel) {
                console.warn('🚀 KIRO-CONSTELLATION: Cannot send graph data - no active panel');
                return;
            }

            if (!data || typeof data !== 'object') {
                console.error('🚀 KIRO-CONSTELLATION: Invalid graph data provided to sendGraphData');
                return;
            }

            // Format message with GraphUpdateMessage interface
            const message: GraphUpdateMessage = {
                command: 'updateGraph',
                data: {
                    modules: data.modules,
                    summary: data.summary
                },
                timestamp: new Date().toISOString(),
                metadata: {
                    source: 'extension',
                    version: '1.0'
                }
            };

            // Send message to webview
            this.panel.webview.postMessage(message);
            
            console.log(`🚀 KIRO-CONSTELLATION: Graph data sent to webview (${data.modules.length} modules)`);

        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error sending graph data to webview:', error);
        }
    }

    /**
     * Sends status messages to the webview for different states
     */
    public sendStatus(status: 'initializing' | 'analyzing' | 'ready' | 'warning' | 'error', messageText: string): void {
        try {
            // Check if panel exists and is active
            if (!this.panel) {
                console.warn('🚀 KIRO-CONSTELLATION: Cannot send status - no active panel');
                return;
            }

            // Format message with GraphStatusMessage interface
            const message: GraphStatusMessage = {
                command: 'status',
                status: status,
                message: messageText,
                timestamp: new Date().toISOString(),
                metadata: {
                    source: 'extension'
                }
            };

            // Send message to webview
            this.panel.webview.postMessage(message);
            
            console.log(`🚀 KIRO-CONSTELLATION: Status message sent: ${status} - ${messageText}`);

        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error sending status message to webview:', error);
        }
    }
}
