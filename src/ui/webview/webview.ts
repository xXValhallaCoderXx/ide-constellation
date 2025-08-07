// Webview TypeScript for VS Code Architecture Map
import cytoscape from 'cytoscape';
import { DependencyGraphData, GraphUpdateMessage, GraphStatusMessage, GraphErrorMessage } from '../shared/types';

// Type declarations for webview context
interface VSCodeApi {
    postMessage(message: any): void;
}

interface Message {
    type: string;
    data?: any;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscodeWebview: VSCodeApi = acquireVsCodeApi();

// Module-level Cytoscape instance holder
let cy: cytoscape.Core | undefined;

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

// Transform dependency graph data to Cytoscape elements format
function transformGraphData(graphData: DependencyGraphData | null | undefined): { nodes: any[], edges: any[] } {
    // Handle malformed or empty input
    if (!graphData || !Array.isArray(graphData.modules)) {
        console.warn('🚀 KIRO-CONSTELLATION: transformGraphData received invalid or empty graph data');
        return { nodes: [], edges: [] };
    }

    try {
        const nodes: any[] = [];
        const edges: any[] = [];
        const seenNodes = new Set<string>();

        // Helper function for smart truncation of long paths
        const truncateLabel = (label: string, maxLength: number = 40): string => {
            if (label.length <= maxLength) {
                return label;
            }
            return '...' + label.slice(label.length - (maxLength - 3));
        };

        // Create nodes from modules
        for (const module of graphData.modules) {
            if (!module || typeof module.source !== 'string') {
                continue;
            }

            const nodeId = module.source;
            if (!seenNodes.has(nodeId)) {
                seenNodes.add(nodeId);
                nodes.push({
                    data: {
                        id: nodeId,
                        label: truncateLabel(nodeId),
                        fullPath: nodeId
                    }
                });
            }
        }

        // Create edges from dependencies
        for (const module of graphData.modules) {
            if (!module || !Array.isArray(module.dependencies)) {
                continue;
            }

            const sourceId = module.source;
            for (const dependency of module.dependencies) {
                if (!dependency || typeof dependency.resolved !== 'string') {
                    continue;
                }

                const targetId = dependency.resolved;
                
                // Ensure target node exists (for external dependencies)
                if (!seenNodes.has(targetId)) {
                    seenNodes.add(targetId);
                    nodes.push({
                        data: {
                            id: targetId,
                            label: truncateLabel(targetId),
                            fullPath: targetId,
                            external: true
                        }
                    });
                }

                // Create edge
                edges.push({
                    data: {
                        id: `${sourceId}->${targetId}`,
                        source: sourceId,
                        target: targetId,
                        dependencyType: dependency.dynamic ? 'dynamic' : 'static',
                        coreModule: dependency.coreModule
                    }
                });
            }
        }

        console.log(`🚀 KIRO-CONSTELLATION: transformGraphData created ${nodes.length} nodes and ${edges.length} edges`);
        return { nodes, edges };

    } catch (error) {
        console.error('🚀 KIRO-CONSTELLATION: Error in transformGraphData:', error);
        return { nodes: [], edges: [] };
    }
