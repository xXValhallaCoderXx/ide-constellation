// Webview TypeScript for VS Code Architecture Map
import type { Message, VSCodeApi } from '../types/webview.types';

const vscodeWebview: VSCodeApi = acquireVsCodeApi();

console.log('🚀 KIRO-CONSTELLATION: Webview TypeScript loaded');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Webview DOM ready');
    
    // Get the main container
    const cyContainer = document.getElementById('cy') as HTMLElement;
    
    if (cyContainer) {
        console.log('🚀 KIRO-CONSTELLATION: Found cytoscape container');
        
        // Initialize the architecture map
        initializeArchitectureMap();
        
        // Send ready message to extension
        const message: Message = {
            type: 'webviewReady',
            data: 'Architecture map webview is ready'
        };
        vscodeWebview.postMessage(message);
    } else {
        console.error('🚀 KIRO-CONSTELLATION: Could not find cytoscape container');
    }
});

function initializeArchitectureMap(): void {
    console.log('🚀 KIRO-CONSTELLATION: Initializing architecture map visualization');
    
    // For now, just update the loading text
    const cyContainer = document.getElementById('cy') as HTMLElement;
    if (cyContainer) {
        cyContainer.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: var(--vscode-foreground);
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">🌟</div>
                <h3>Architecture Map Ready</h3>
                <p>Webview is now active and ready for visualization</p>
                <div style="margin-top: 20px; padding: 10px; border: 1px dashed var(--vscode-focusBorder); border-radius: 4px;">
                    <small>This will show your project's architecture<br/>components and connections</small>
                </div>
            </div>
        `;
    }
    
    // Future: This is where we'll initialize Cytoscape.js or other visualization library
}
