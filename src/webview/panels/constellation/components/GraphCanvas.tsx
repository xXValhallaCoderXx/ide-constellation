import { useEffect, useRef, useState } from 'preact/hooks';
import cytoscape from 'cytoscape';
import { IConstellationGraph } from '../../../../types/graph.types';
import { AUTO_PAN_ANIMATION_MS, AUTO_PAN_VISIBILITY_THRESHOLD, AUTO_PAN_MAX_ZOOM, AUTO_PAN_MIN_ZOOM, computeTargetZoom } from '../../../../constants/sync.constants';
import { transformGraphToCytoscape, validateGraphData } from '../../../../utils/graph-transform.utils';

/**
 * Sample large graphs to improve performance
 */
function sampleLargeGraph(graph: IConstellationGraph, maxNodes: number): IConstellationGraph {
  if (graph.nodes.length <= maxNodes) {
    return graph;
  }

  // Removed verbose sampling log (cleanup task 14.1)

  // Sort nodes by connection count (degree centrality) to keep most connected nodes
  const nodeConnections = new Map<string, number>();
  
  // Count connections for each node
  graph.edges.forEach(edge => {
    nodeConnections.set(edge.source, (nodeConnections.get(edge.source) || 0) + 1);
    nodeConnections.set(edge.target, (nodeConnections.get(edge.target) || 0) + 1);
  });

  // Sort nodes by connection count (descending)
  const sortedNodes = [...graph.nodes].sort((a, b) => 
    (nodeConnections.get(b.id) || 0) - (nodeConnections.get(a.id) || 0)
  );

  // Take top connected nodes
  const sampledNodes = sortedNodes.slice(0, maxNodes);
  const sampledNodeIds = new Set(sampledNodes.map(n => n.id));

  // Filter edges to only include those between sampled nodes
  const sampledEdges = graph.edges.filter(edge => 
    sampledNodeIds.has(edge.source) && sampledNodeIds.has(edge.target)
  );

  return {
    nodes: sampledNodes,
    edges: sampledEdges,
    metadata: {
      ...graph.metadata,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Get optimal layout configuration based on graph size
 */
function getOptimalLayout(nodeCount: number) {
  // For very large graphs, use simpler layout for performance
  if (nodeCount > 500) {
    return {
      name: 'grid',
      animate: false,
      fit: true,
      padding: 30
    };
  }
  
  // For medium graphs, use faster cose settings
  if (nodeCount > 100) {
    return {
      name: 'cose',
      animate: true,
      animationDuration: 500,
      fit: true,
      padding: 40,
      nodeRepulsion: 200000,
      nodeOverlap: 8,
      idealEdgeLength: 80,
      edgeElasticity: 80,
      nestingFactor: 3,
      gravity: 60,
      numIter: 500,
      initialTemp: 100,
      coolingFactor: 0.95,
      minTemp: 1.0
    };
  }
  
  // For smaller graphs, use full cose layout with animations
  return {
    name: 'cose',
    animate: true,
    animationDuration: 1000,
    fit: true,
    padding: 50,
    nodeRepulsion: 400000,
    nodeOverlap: 10,
    idealEdgeLength: 100,
    edgeElasticity: 100,
    nestingFactor: 5,
    gravity: 80,
    numIter: 1000,
    initialTemp: 200,
    coolingFactor: 0.95,
    minTemp: 1.0
  };
}

interface GraphCanvasProps {
  graph: IConstellationGraph | null;
  searchQuery?: string;
  /** Report node click with resolved open mode */
  onNodeClick?: (nodeId: string, openMode: 'default' | 'split') => void;
  onError?: (error: string) => void;
  onSearchResultsChange?: (count: number) => void;
  /** Highlight state from extension (FR6/FR11) */
  activeHighlight?: { fileId: string | null; reason?: string };
}

interface GraphCanvasState {
  isLoading: boolean;
  searchQuery: string;
  highlightedNodes: string[];
  cytoscapeInstance: cytoscape.Core | null;
}

export function GraphCanvas({ graph, searchQuery, onNodeClick, onError, onSearchResultsChange, activeHighlight }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [state, setState] = useState<GraphCanvasState>({
    isLoading: false,
    searchQuery: '',
    highlightedNodes: [],
    cytoscapeInstance: null
  });

  // Initialize Cytoscape.js instance
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Validate graph data
      if (!validateGraphData(graph)) {
        const error = 'Invalid graph data structure';
        onError?.(error);
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      // Transform graph data to Cytoscape format with optional sampling
      const cytoscapeElements = transformGraphToCytoscape(
        graph.nodes.length > 1000 ? sampleLargeGraph(graph, 1000) : graph
      );

      // Dispose existing instance if it exists
      if (cyRef.current) {
        cyRef.current.destroy();
      }

      // Initialize new Cytoscape instance
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [...cytoscapeElements.nodes, ...cytoscapeElements.edges],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'var(--vscode-charts-blue)',
              'border-color': 'var(--vscode-panel-border)',
              'border-width': 1,
              'label': 'data(label)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px',
              'font-family': 'var(--vscode-font-family)',
              'color': 'var(--vscode-foreground)',
              'width': '30px',
              'height': '30px',
              'text-wrap': 'wrap',
              'text-max-width': '80px',
              'text-background-color': 'var(--vscode-editor-background)',
              'text-background-opacity': 0.8,
              'text-background-padding': '2px'
            }
          },
          {
            selector: 'node:hover',
            style: {
              'background-color': 'var(--vscode-charts-purple)',
              'border-color': 'var(--vscode-focusBorder)',
              'border-width': 2,
              'z-index': 5
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 1,
              'line-color': 'var(--vscode-charts-gray)',
              'target-arrow-color': 'var(--vscode-charts-gray)',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              'arrow-scale': 0.8,
              'opacity': 0.7
            }
          },
          {
            selector: 'edge:hover',
            style: {
              'width': 2,
              'opacity': 1,
              'z-index': 3
            }
          },
          {
            selector: '.highlighted',
            style: {
              'background-color': 'var(--vscode-charts-orange)',
              'border-color': 'var(--vscode-charts-orange)',
              'border-width': 2,
              'line-color': 'var(--vscode-charts-orange)',
              'target-arrow-color': 'var(--vscode-charts-orange)',
              'z-index': 10,
              'text-background-color': 'var(--vscode-charts-orange)',
              'color': 'var(--vscode-editor-background)'
            }
          },
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.2
            }
          },
          // Active node style appended late for precedence (FR9, FR13)
          {
            selector: 'node.active-node',
            style: {
              'border-width': 4,
              'border-color': 'var(--vscode-focusBorder)',
              'background-color': 'var(--vscode-charts-orange)',
              'z-index': 20
            }
          }
        ],
        layout: getOptimalLayout(cytoscapeElements.nodes.length),
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 3.0,
        // Performance optimizations for smooth 60 FPS interactions
        pixelRatio: 'auto',
        motionBlur: true,
        motionBlurOpacity: 0.2,
        textureOnViewport: false,
        hideEdgesOnViewport: false,
        hideLabelsOnViewport: false
      });

      // Add node click handler
      cyRef.current.on('tap', 'node', (event) => {
        const nodeId = event.target.id();
        // Detect modifier keys from the original event (mouse or touch)
        const orig: any = event.originalEvent || {};
        const meta = !!orig.metaKey;
        const ctrl = !!orig.ctrlKey;
        const openMode: 'default' | 'split' = (meta || ctrl) ? 'split' : 'default';
        onNodeClick?.(nodeId, openMode);
      });

      // Add viewport-based performance optimizations
      cyRef.current.on('viewport', () => {
        // Throttle viewport updates for better performance
        const zoom = cyRef.current?.zoom() || 1;
        const container = cyRef.current?.container();
        
        if (container && zoom < 0.3) {
          // Hide labels at low zoom levels for better performance
          cyRef.current?.style()
            .selector('node')
            .style('label', '')
            .update();
        } else if (container && zoom >= 0.3) {
          // Show labels at higher zoom levels
          cyRef.current?.style()
            .selector('node')
            .style('label', 'data(label)')
            .update();
        }
      });

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        cytoscapeInstance: cyRef.current 
      }));

      // Performance monitoring
      const renderEndTime = performance.now();
      const renderDuration = renderEndTime - (performance.now() - 100); // Approximate start time
      // Removed detailed performance + memory logs (cleanup task 14.1)

      // Performance warning for large graphs
      if (cytoscapeElements.nodes.length > 1000) {
        console.warn(`Large graph detected (${cytoscapeElements.nodes.length} nodes). Consider implementing graph sampling for better performance.`);
        onError?.(`Large graph with ${cytoscapeElements.nodes.length} nodes may impact performance. Consider filtering or sampling the data.`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('GraphCanvas initialization error:', errorMessage);
      onError?.(errorMessage);
      setState(prev => ({ ...prev, isLoading: false }));
    }

    // Cleanup on unmount or graph change
    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, [graph, onNodeClick, onError]);

  /**
   * Apply active highlight & auto-pan logic.
   * FR9: Highlight precedence - we only manipulate the 'active-node' class, preserving '.highlighted'.
   * FR8: Auto-pan when target node is outside an inset visibility threshold (AUTO_PAN_VISIBILITY_THRESHOLD).
   */
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    const fileId = activeHighlight?.fileId ?? null;
    // Remove previous active highlight (FR9 precedence: keep .highlighted search class)
    cy.nodes('.active-node').removeClass('active-node');
    if (!fileId) return; // clear only
    const node = cy.getElementById(fileId);
    if (!node || node.empty()) return;
    node.addClass('active-node');
    try {
      const extent = cy.extent();
      const vpW = extent.x2 - extent.x1;
      const vpH = extent.y2 - extent.y1;
      const inset = AUTO_PAN_VISIBILITY_THRESHOLD; // e.g. 0.25 => 25% margin
      const thresholdX1 = extent.x1 + vpW * inset;
      const thresholdX2 = extent.x2 - vpW * inset;
      const thresholdY1 = extent.y1 + vpH * inset;
      const thresholdY2 = extent.y2 - vpH * inset;
      const pos = node.position();
      const outOfView = pos.x < thresholdX1 || pos.x > thresholdX2 || pos.y < thresholdY1 || pos.y > thresholdY2;
      if (outOfView) {
        // Cancel in-flight animations to prevent queue build-up (FR8)
        cy.stop(true);
        const nodeCount = cy.nodes().length;
        const heuristicZoom = computeTargetZoom(nodeCount);
        const targetZoom = Math.min(AUTO_PAN_MAX_ZOOM, Math.max(AUTO_PAN_MIN_ZOOM, heuristicZoom));
        const currentZoom = cy.zoom();
        const animateOptions: any = { center: { eles: node }, duration: AUTO_PAN_ANIMATION_MS };
        if (Math.abs(currentZoom - targetZoom) > 0.05) {
          animateOptions.zoom = targetZoom;
        }
        cy.animate(animateOptions);
        console.log(`Auto-pan (FR8) center=${fileId} zoom=${animateOptions.zoom ?? 'same'} duration=${AUTO_PAN_ANIMATION_MS}ms`);
      }
    } catch (e) {
      console.warn('Auto-pan failed', e);
    }
  }, [activeHighlight]);

  // Task 10.3: Warn if highlight messages arrive before Cytoscape initialized
  useEffect(() => {
    if (activeHighlight && !cyRef.current) {
      console.warn('[GraphCanvas] Highlight received before Cytoscape ready (FR18 resilience)');
    }
  }, [activeHighlight]);

  // Handle search highlighting when searchQuery prop changes
  useEffect(() => {
    if (!cyRef.current) return;

    const query = searchQuery?.trim() || '';
    setState(prev => ({ ...prev, searchQuery: query }));

    if (!query) {
      // Clear highlighting when search is empty
      cyRef.current.elements().removeClass('highlighted dimmed');
      setState(prev => ({ ...prev, highlightedNodes: [] }));
      onSearchResultsChange?.(0);
      return;
    }

    const searchLower = query.toLowerCase();
    const matchingNodes: string[] = [];

    // Find matching nodes
    cyRef.current.nodes().forEach(node => {
      const label = node.data('label')?.toLowerCase() || '';
      const path = node.data('path')?.toLowerCase() || '';
      
      if (label.includes(searchLower) || path.includes(searchLower)) {
        matchingNodes.push(node.id());
      }
    });

    // Apply highlighting
    cyRef.current.elements().removeClass('highlighted dimmed');
    
    if (matchingNodes.length > 0) {
      // Highlight matching nodes
      matchingNodes.forEach(nodeId => {
        cyRef.current?.getElementById(nodeId).addClass('highlighted');
      });
      
      // Dim non-matching elements
      cyRef.current.elements().not('.highlighted').addClass('dimmed');
    }

    setState(prev => ({ ...prev, highlightedNodes: matchingNodes }));
    onSearchResultsChange?.(matchingNodes.length);
  }, [searchQuery, onSearchResultsChange]);

  if (!graph) {
    return (
      <div style={{ 
        width: '100%', 
        height: '400px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        border: '1px solid var(--vscode-panel-border)',
        color: 'var(--vscode-descriptionForeground)'
      }}>
        No graph data available
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '400px', 
      minHeight: '300px',
      position: 'relative',
      backgroundColor: 'var(--vscode-editor-background)'
    }}>
      {state.isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          color: 'var(--vscode-foreground)',
          backgroundColor: 'var(--vscode-editor-background)',
          padding: '12px 16px',
          borderRadius: '4px',
          border: '1px solid var(--vscode-panel-border)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          fontFamily: 'var(--vscode-font-family)',
          fontSize: '13px'
        }}>
          Loading graph...
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '4px',
          outline: 'none' // Remove focus outline since Cytoscape handles focus
        }} 
        tabIndex={0}
        role="application"
        aria-label="Interactive dependency graph"
      />
    </div>
  );
}