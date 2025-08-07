// Webview TypeScript for VS Code Architecture Map

// Declare cytoscape as a global variable (loaded from CDN)
declare const cytoscape: any;

// Type definitions for webview messages (inline to avoid imports)
interface DependencyGraphData {
    modules: Array<{
        source: string;
        dependencies: Array<{
            resolved: string;
            coreModule: boolean;
            followable: boolean;
            dynamic: boolean;
        }>;
        dependents: string[];
    }>;
    summary: {
        violations: any[];
        error?: string;
        warn?: any[];
        info?: any[];
        totalDependencies: number;
        totalModules: number;
    };
}

interface GraphUpdateMessage {
    command: 'updateGraph';
    data: DependencyGraphData;
    timestamp: string;
    metadata: {
        source: string;
        version: string;
    };
}

interface GraphStatusMessage {
    command: 'status';
    status: 'initializing' | 'analyzing' | 'ready' | 'warning' | 'error';
    message: string;
    timestamp: string;
    metadata: {
        source: string;
    };
}

interface GraphErrorMessage {
    command: 'error';
    error: string;
    details?: any;
    timestamp: string;
    metadata: {
        source: string;
    };
}

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
let cy: any;

console.log('🚀 KIRO-CONSTELLATION: Webview TypeScript loaded');

// Wait for both DOM and cytoscape to be ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 KIRO-CONSTELLATION: Webview DOM ready');
    
    // Wait for cytoscape to be available
    const waitForCytoscape = () => {
        if (typeof cytoscape !== 'undefined' && cytoscape) {
            console.log('🚀 KIRO-CONSTELLATION: Cytoscape is available');
            initializeWebview();
        } else {
            console.log('🚀 KIRO-CONSTELLATION: Waiting for Cytoscape to load...');
            setTimeout(waitForCytoscape, 100);
        }
    };
    
    waitForCytoscape();
});

function initializeWebview(): void {
    console.log('🚀 KIRO-CONSTELLATION: Initializing webview');
    
    // Get the main container
    const cyContainer = document.getElementById('cy') as HTMLElement;
    
    if (cyContainer) {
        console.log('🚀 KIRO-CONSTELLATION: Found cytoscape container');
        
        // Initialize the architecture map
        initializeArchitectureMap();
        
        // Setup message handling for extension communication
        setupMessageHandling();
        
        // Send ready message to extension
        const message: Message = {
            type: 'webviewReady',
            data: 'Architecture map webview is ready'
        };
        vscodeWebview.postMessage(message);
    } else {
        console.error('🚀 KIRO-CONSTELLATION: Could not find cytoscape container');
    }
}

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
    console.log('🚀 KIRO-CONSTELLATION: transformGraphData called with:', graphData);
    
    // Handle malformed or empty input
    if (!graphData || !Array.isArray(graphData.modules)) {
        console.warn('🚀 KIRO-CONSTELLATION: transformGraphData received invalid or empty graph data');
        return { nodes: [], edges: [] };
    }

    console.log('🚀 KIRO-CONSTELLATION: transformGraphData processing', graphData.modules.length, 'modules');

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
}

// Render graph with destroy-and-recreate pattern
function renderGraph(elements: { nodes: any[], edges: any[] }): void {
    console.log('🚀 KIRO-CONSTELLATION: renderGraph called with:', elements.nodes.length, 'nodes and', elements.edges.length, 'edges');
    
    const container = document.getElementById('cy');
    if (!container) {
        console.error('🚀 KIRO-CONSTELLATION: Cannot find #cy container for graph rendering');
        return;
    }

    // Performance guardrail: check if node count exceeds 500
    const nodeCount = elements.nodes.length;
    if (nodeCount > 500) {
        console.warn(`🚀 KIRO-CONSTELLATION: Large dataset detected (${nodeCount} nodes), displaying warning`);
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: var(--vscode-editorWarning-foreground);
                padding: 16px;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <h3>Dataset Too Large</h3>
                <p>This project has ${nodeCount} modules, which exceeds the 500-module limit for performance.</p>
                <p>Please consider filtering your analysis or focusing on a specific directory.</p>
            </div>
        `;
        return;
    }

    // Handle empty data case
    if (nodeCount === 0) {
        console.log('🚀 KIRO-CONSTELLATION: No dependencies found to visualize');
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: var(--vscode-descriptionForeground);
                padding: 16px;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                <h3>No Dependencies Found</h3>
                <p>No dependencies found to visualize.</p>
                <p>Make sure your project has JavaScript/TypeScript files with import/require statements.</p>
            </div>
        `;
        return;
    }

    // Destroy existing Cytoscape instance if it exists
    if (cy) {
        try {
            cy.destroy();
            console.log('🚀 KIRO-CONSTELLATION: Destroyed previous Cytoscape instance');
        } catch (error) {
            console.warn('🚀 KIRO-CONSTELLATION: Error destroying previous Cytoscape instance:', error);
        }
        cy = undefined;
    }

    // Clear container content
    container.innerHTML = '';

    try {
        // Initialize new Cytoscape instance with cose layout and styling
        cy = cytoscape({
            container: container,
            elements: [...elements.nodes, ...elements.edges],
            
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'var(--vscode-button-background)',
                        'color': 'var(--vscode-button-foreground)',
                        'label': 'data(label)',
                        'font-size': '10px',
                        'text-halign': 'center',
                        'text-valign': 'center',
                        'text-wrap': 'wrap',
                        'text-max-width': '80px',
                        'border-width': '1px',
                        'border-color': 'var(--vscode-button-border)'
                    }
                },
                {
                    selector: 'node[external]',
                    style: {
                        'background-color': 'var(--vscode-descriptionForeground)',
                        'opacity': 0.6
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1.5,
                        'curve-style': 'bezier',
                        'line-color': 'var(--vscode-editorIndentGuide-background)',
                        'target-arrow-color': 'var(--vscode-editorIndentGuide-background)',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 0.8
                    }
                },
                {
                    selector: 'edge[dependencyType = "dynamic"]',
                    style: {
                        'line-style': 'dashed',
                        'line-color': 'var(--vscode-editorWarning-foreground)'
                    }
                }
            ],
            
            layout: {
                name: 'cose',
                animate: true,
                padding: 30,
                idealEdgeLength: 50,
                nodeOverlap: 20
            }
        });

        console.log(`🚀 KIRO-CONSTELLATION: Successfully rendered graph with ${nodeCount} nodes and ${elements.edges.length} edges`);

        // Add user interaction features: tooltips
        addTooltipSupport();

    } catch (error) {
        console.error('🚀 KIRO-CONSTELLATION: Error initializing Cytoscape instance:', error);
        container.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                text-align: center;
                color: var(--vscode-errorForeground);
                padding: 16px;
            ">
                <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
                <h3>Rendering Error</h3>
                <p>Failed to initialize graph visualization.</p>
                <p>Check the developer console for details.</p>
            </div>
        `;
    }
}

// Add tooltip support for node and edge hover interactions
function addTooltipSupport(): void {
    if (!cy) {
        return;
    }

    // Create tooltip element
    let tooltip = document.getElementById('cy-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'cy-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.backgroundColor = 'var(--vscode-editorHoverWidget-background)';
        tooltip.style.color = 'var(--vscode-editorHoverWidget-foreground)';
        tooltip.style.border = '1px solid var(--vscode-editorHoverWidget-border)';
        tooltip.style.borderRadius = '4px';
        tooltip.style.padding = '8px';
        tooltip.style.fontSize = '12px';
        tooltip.style.zIndex = '1000';
        tooltip.style.display = 'none';
        tooltip.style.maxWidth = '300px';
        tooltip.style.wordWrap = 'break-word';
        document.body.appendChild(tooltip);
    }

    // Node hover: show complete file path
    cy.on('mouseover', 'node', (event: any) => {
        const node = event.target;
        const fullPath = node.data('fullPath') || node.id();
        const isExternal = node.data('external');
        
        tooltip!.innerHTML = `
            <strong>${isExternal ? 'External Module' : 'Source File'}</strong><br>
            ${fullPath}
        `;
        tooltip!.style.display = 'block';
    });

    // Edge hover: show dependency type
    cy.on('mouseover', 'edge', (event: any) => {
        const edge = event.target;
        const dependencyType = edge.data('dependencyType');
        const isCore = edge.data('coreModule');
        
        const typeText = dependencyType === 'dynamic' ? 'Dynamic Import' : 'Static Import';
        const coreText = isCore ? ' (Core Module)' : '';
        
        tooltip!.innerHTML = `
            <strong>Dependency</strong><br>
            ${typeText}${coreText}<br>
            <small>${edge.data('source')} → ${edge.data('target')}</small>
        `;
        tooltip!.style.display = 'block';
    });

    // Update tooltip position on mouse move
    cy.on('mousemove', (event: any) => {
        if (tooltip!.style.display === 'block' && cy) {
            const container = cy.container();
            if (container) {
                const containerBounds = container.getBoundingClientRect();
                tooltip!.style.left = (containerBounds.left + event.renderedPosition.x + 10) + 'px';
                tooltip!.style.top = (containerBounds.top + event.renderedPosition.y - 10) + 'px';
            }
        }
    });

    // Hide tooltip when not hovering
    cy.on('mouseout', 'node, edge', () => {
        tooltip!.style.display = 'none';
    });

    // Log interaction capabilities for testing
    console.log('🚀 KIRO-CONSTELLATION: User interaction features enabled');
    console.log('🚀 KIRO-CONSTELLATION: - Tooltip support for nodes and edges');
    console.log('🚀 KIRO-CONSTELLATION: - Pan and zoom functionality (default Cytoscape behavior)');
    console.log('🚀 KIRO-CONSTELLATION: - Mouse drag panning on empty space');
}

// Message handling for communication with extension
function setupMessageHandling(): void {
    console.log('🚀 KIRO-CONSTELLATION: Setting up message handling');
    
    // Listen for messages from the extension
    window.addEventListener('message', (event) => {
        const message = event.data;
        
        console.log('🚀 KIRO-CONSTELLATION: Raw message received:', message);
        
        // Validate message structure
        if (!message || typeof message !== 'object') {
            console.warn('🚀 KIRO-CONSTELLATION: Received invalid message format');
            return;
        }

        console.log('🚀 KIRO-CONSTELLATION: Processing message command:', message.command || message.type);

        switch (message.command) {
            case 'updateGraph':
                console.log('🚀 KIRO-CONSTELLATION: Handling updateGraph message');
                handleGraphUpdate(message as GraphUpdateMessage);
                break;
            case 'status':
                console.log('🚀 KIRO-CONSTELLATION: Handling status message');
                handleStatusMessage(message as GraphStatusMessage);
                break;
            case 'error':
                console.log('🚀 KIRO-CONSTELLATION: Handling error message');
                handleErrorMessage(message as GraphErrorMessage);
                break;
            default:
                console.log('🚀 KIRO-CONSTELLATION: Unknown command, checking legacy format');
                // Handle legacy message format for backwards compatibility
                if (message.type === 'updateGraph' && message.data) {
                    console.log('🚀 KIRO-CONSTELLATION: Handling legacy updateGraph format');
                    const graphData = message.data as DependencyGraphData;
                    const elements = transformGraphData(graphData);
                    renderGraph(elements);
                } else {
                    console.warn('🚀 KIRO-CONSTELLATION: Unknown message format:', message);
                }
                break;
        }
    });

    console.log('🚀 KIRO-CONSTELLATION: Message handling setup complete');
}

// Handle graph update messages
function handleGraphUpdate(message: GraphUpdateMessage): void {
    if (!message.data) {
        console.error('🚀 KIRO-CONSTELLATION: Graph update message missing data');
        return;
    }

    console.log('🚀 KIRO-CONSTELLATION: Processing graph update with', message.data.modules?.length || 0, 'modules');
    
    const elements = transformGraphData(message.data);
    renderGraph(elements);
}

// Handle status messages
function handleStatusMessage(message: GraphStatusMessage): void {
    console.log(`🚀 KIRO-CONSTELLATION: Status update: ${message.status} - ${message.message}`);
    
    const container = document.getElementById('cy');
    if (!container) {
        return;
    }

    let statusColor = 'var(--vscode-foreground)';
    let statusIcon = '📄';

    switch (message.status) {
        case 'initializing':
            statusIcon = '🔄';
            statusColor = 'var(--vscode-progressBar-background)';
            break;
        case 'analyzing':
            statusIcon = '🔍';
            statusColor = 'var(--vscode-progressBar-background)';
            break;
        case 'ready':
            // Don't show status message for ready state, graph should be rendered
            return;
        case 'warning':
            statusIcon = '⚠️';
            statusColor = 'var(--vscode-editorWarning-foreground)';
            break;
        case 'error':
            statusIcon = '❌';
            statusColor = 'var(--vscode-errorForeground)';
            break;
    }

    container.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: ${statusColor};
            padding: 16px;
        ">
            <div style="font-size: 48px; margin-bottom: 16px;">${statusIcon}</div>
            <h3>${message.message}</h3>
            ${message.status === 'analyzing' ? '<p>This may take a moment for large projects...</p>' : ''}
        </div>
    `;
}

// Handle error messages
function handleErrorMessage(message: GraphErrorMessage): void {
    console.error('🚀 KIRO-CONSTELLATION: Error message received:', message.error);
    
    const container = document.getElementById('cy');
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            color: var(--vscode-errorForeground);
            padding: 16px;
        ">
            <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
            <h3>Error</h3>
            <p>${message.error}</p>
        </div>
    `;
}
