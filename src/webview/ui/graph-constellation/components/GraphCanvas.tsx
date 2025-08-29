import { useEffect, useRef, useState, useCallback } from 'preact/hooks';
import cytoscape from 'cytoscape';
import { IConstellationGraph } from "@/types/graph.types";
import {
  AUTO_PAN_ANIMATION_MS,
  AUTO_PAN_VISIBILITY_THRESHOLD,
  AUTO_PAN_MAX_ZOOM,
  AUTO_PAN_MIN_ZOOM,
  computeTargetZoom,
  TOOLTIP_HOVER_DELAY_MS,
  LAYOUT_ANIMATION_MS,
} from "@/constants/sync.constants";
import {
  transformGraphToCytoscape,
  validateGraphData,
} from "@/utils/graph-transform.utils";
import {
  enhancedDebounce,
  throttle,
  PerformanceMonitor,
} from "@/utils/performance.utils";
import {
  OptimizedHeatmapProcessor,
  createOptimizedHeatmapProcessor,
} from "@/utils/heatmap-processor.utils";
import { getFileExtensionInfo } from "@/utils/path.utils";
import { getLayoutConfig, getCytoscapeLayoutName } from "@/utils/layout.utils";
import { RichTooltip, TooltipData } from './RichTooltip';
import { ToastContainer, useToasts } from './ToastNotification';
import { LoadingIndicator, HeatmapLoadingIndicator } from './LoadingIndicator';
import { GraphHelp } from "./ContextualHelp";

/**
 * Task 4.1: Calculate node size based on connection importance
 * Uses Cytoscape's node.degree() method to determine visual sizing
 * Task 4.2: Size scaling logic based on connection count
 * Task 4.4: Optimized for performance with large graphs via sampling
 */
const calculateNodeSize = (connectionCount: number): number => {
  if (connectionCount <= 2) return 30;      // 0-2 connections: 30px
  if (connectionCount <= 6) return 40;      // 3-6 connections: 40px  
  if (connectionCount <= 10) return 50;     // 7-10 connections: 50px
  return 60;                                // 11+ connections: 60px
};

/**
 * Heatmap node data for risk visualization
 */
export interface HeatmapNode {
  nodeId: string;
  score: number;
  color: string;
  metrics: {
    complexity: number;
    churn: number;
    dependencies: number;
    category: string;
  };
}

/**
 * Heatmap overlay state with performance tracking
 */
interface HeatmapState {
  isActive: boolean;
  nodes: HeatmapNode[];
  originalStyles: Map<string, any>;
  lastAppliedTimestamp?: number;
  cacheSize?: number;
  visibleNodesCount?: number;
  processor?: OptimizedHeatmapProcessor;
  isProcessing?: boolean;
  processingProgress?: number;
  performanceMetrics?: {
    lastRenderTime: number;
    averageRenderTime: number;
    cacheHitRate: number;
  };
}

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
interface GraphCanvasProps {
  graph: IConstellationGraph | null;
  searchQuery?: string;
  searchFocusIndex?: number; // Task 5.3: Index of currently focused search result
  /** Report node click with resolved open mode */
  onNodeClick?: (nodeId: string, openMode: 'default' | 'split') => void;
  onError?: (error: string) => void;
  onSearchResultsChange?: (count: number) => void;
  /** Highlight state from extension (FR6/FR11) */
  activeHighlight?: { fileId: string | null; reason?: string };
  /** Heatmap overlay data for risk visualization */
  heatmapData?: HeatmapNode[];
  /** Whether heatmap overlay is enabled */
  heatmapEnabled?: boolean;
  /** Callback when heatmap state changes */
  onHeatmapStateChange?: (isActive: boolean) => void;
  /** Current layout type for the graph */
  currentLayout?: string;
  /** Callback when layout change starts/ends */
  onLayoutChange?: (isChanging: boolean) => void;
  /** Disable user interactions during layout changes */
  disabled?: boolean;
}

interface GraphCanvasState {
  isLoading: boolean;
  searchQuery: string;
  highlightedNodes: string[];
  cytoscapeInstance: cytoscape.Core | null;
  heatmapState: HeatmapState;
  tooltip: {
    visible: boolean;
    data: TooltipData | null;
    position: { x: number; y: number };
  };
}

export function GraphCanvas({ 
  graph, 
  searchQuery, 
  searchFocusIndex = -1,
  onNodeClick, 
  onError, 
  onSearchResultsChange, 
  activeHighlight,
  heatmapData,
  heatmapEnabled = false,
  onHeatmapStateChange,
  currentLayout = 'force-directed',
  onLayoutChange,
  disabled = false
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const performanceMonitor = useRef(new PerformanceMonitor());
  const heatmapProcessor = useRef<OptimizedHeatmapProcessor | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const hasInitialLayoutRef = useRef(false);
  const [state, setState] = useState<GraphCanvasState>({
    isLoading: false,
    searchQuery: '',
    highlightedNodes: [],
    cytoscapeInstance: null,
    heatmapState: {
      isActive: false,
      nodes: [],
      originalStyles: new Map(),
      isProcessing: false,
      processingProgress: 0
    },
    tooltip: {
      visible: false,
      data: null,
      position: { x: 0, y: 0 }
    }
  });

  // Toast notifications
  const {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  } = useToasts();

  // Debounced state update for performance - enhanced with immediate option
  const debouncedSetState = useCallback(
    enhancedDebounce((updater: (prev: GraphCanvasState) => GraphCanvasState) => {
      setState(updater);
    }, 100, false),
    []
  );

  // Throttled viewport update for better performance
  const throttledViewportUpdate = useCallback(
    throttle(() => {
      if (!cyRef.current) return;
      
      const zoom = cyRef.current.zoom();
      
      // Optimize label visibility based on zoom level
      if (zoom < 0.3) {
        cyRef.current.style()
          .selector('node')
          .style('label', '')
          .update();
      } else if (zoom >= 0.3) {
        cyRef.current.style()
          .selector('node')
          .style('label', 'data(label)')
          .update();
      }
      
      // Update heatmap processor viewport if active
      if (heatmapProcessor.current && state.heatmapState.isActive) {
        // Trigger viewport-based optimization
        const viewport = cyRef.current.extent();
        console.log(`[GraphCanvas] Viewport updated: zoom=${zoom.toFixed(2)}, extent=${JSON.stringify(viewport)}`);
      }
    }, 100),
    [state.heatmapState.isActive]
  );

  // Performance tracking with enhanced metrics
  const trackRenderPerformance = useCallback((renderTime: number, operation: string = 'render') => {
    const metrics = performanceMonitor.current.getMetrics();
    
    // Log performance warnings for slow operations
    if (renderTime > 1000) {
      console.warn(`[GraphCanvas] Slow ${operation} detected: ${renderTime}ms (avg: ${metrics.averageRenderTime.toFixed(2)}ms)`);
    }
    
    // Update performance metrics in state
    debouncedSetState(prev => ({
      ...prev,
      heatmapState: {
        ...prev.heatmapState,
        performanceMetrics: {
          lastRenderTime: renderTime,
          averageRenderTime: metrics.averageRenderTime,
          cacheHitRate: prev.heatmapState.performanceMetrics?.cacheHitRate || 0
        }
      }
    }));
  }, [debouncedSetState]);

  // Initialize Cytoscape.js instance
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Reset layout initialization flag for new graph
    hasInitialLayoutRef.current = false;
    
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
              // Task 4.3: Dynamic node sizing based on connection count
              'width': (node: any) => {
                const degree = node.degree();
                return calculateNodeSize(degree);
              },
              'height': (node: any) => {
                const degree = node.degree();
                return calculateNodeSize(degree);
              },
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
              // Task 5.1: Enhanced highlighting with 100% opacity and prominent border
              'background-color': 'var(--vscode-charts-orange)',
              'border-color': 'var(--vscode-charts-orange)',
              'border-width': 3,
              'opacity': 1.0, // Maintain 100% opacity for highlighted nodes
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
              // Task 5.2: Updated dimmed opacity to 30% for better contrast
              'opacity': 0.3
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
          },
          // Heatmap overlay styles
          {
            selector: 'node.heatmap-node',
            style: {
              'transition-property': 'background-color, border-color, border-width',
              'transition-duration': 300,
              'transition-timing-function': 'ease-out'
            }
          },
          {
            selector: 'node.heatmap-node:hover',
            style: {
              'border-width': '+=1',
              'z-index': 25
            }
          }
        ],
        layout: getLayoutConfig('cose', cytoscapeElements.nodes.length),
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

      // Add optimized viewport handling
      cyRef.current.on('viewport', throttledViewportUpdate);

      // Initialize optimized heatmap processor
      if (cyRef.current) {
        heatmapProcessor.current = createOptimizedHeatmapProcessor(
          cyRef.current,
          {
            batchSize: Math.min(50, Math.max(10, Math.floor(cytoscapeElements.nodes.length / 20))),
            animationDuration: 300,
            animationEasing: 'ease-out',
            enableViewportCulling: cytoscapeElements.nodes.length > 100,
            viewportMargin: 150,
            maxCacheSize: Math.min(1000, cytoscapeElements.nodes.length * 2),
            enablePerformanceMonitoring: true
          }
        );
      }

      // Apply file type colors to nodes (Task 2.3: Dynamic background colors)
      cyRef.current.batch(() => {
        cyRef.current!.nodes().forEach(node => {
          const filePath = node.data('path') || node.data('label') || '';
          const fileTypeColor = getFileTypeColor(filePath);
          node.style('background-color', fileTypeColor);
        });
      });

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        cytoscapeInstance: cyRef.current 
      }));

      // Task 4.5: Test node sizing visual differentiation
      // Log node size distribution for verification
      if (cyRef.current) {
        const nodes = cyRef.current.nodes();
        const sizeCounts = { small: 0, medium: 0, large: 0, extraLarge: 0 };
        
        nodes.forEach((node: any) => {
          const degree = node.degree();
          const size = calculateNodeSize(degree);
          
          if (size === 30) sizeCounts.small++;
          else if (size === 40) sizeCounts.medium++;
          else if (size === 50) sizeCounts.large++;
          else if (size === 60) sizeCounts.extraLarge++;
        });

        console.log(`[GraphCanvas] Node sizing distribution:`, {
          total: nodes.length,
          small: `${sizeCounts.small} nodes (30px, ≤2 connections)`,
          medium: `${sizeCounts.medium} nodes (40px, 3-6 connections)`,
          large: `${sizeCounts.large} nodes (50px, 7-10 connections)`,
          extraLarge: `${sizeCounts.extraLarge} nodes (60px, 11+ connections)`
        });
      }

      // Performance monitoring with enhanced tracking
      const renderTime = performanceMonitor.current.endRender(performance.now() - 100);
      trackRenderPerformance(renderTime, 'graph-initialization');

      // Adaptive performance warnings based on graph size
      if (cytoscapeElements.nodes.length > 1000) {
        console.warn(`[GraphCanvas] Large graph detected (${cytoscapeElements.nodes.length} nodes). Performance optimizations enabled.`);
        
        // Only show error for extremely large graphs
        if (cytoscapeElements.nodes.length > 2000) {
          onError?.(`Very large graph with ${cytoscapeElements.nodes.length} nodes detected. Performance may be impacted. Consider filtering the data.`);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('GraphCanvas initialization error:', errorMessage);
      onError?.(errorMessage);
      setState(prev => ({ ...prev, isLoading: false }));
    }

    // Cleanup on unmount or graph change
    return () => {
      // Dispose of heatmap processor
      if (heatmapProcessor.current) {
        heatmapProcessor.current.dispose();
        heatmapProcessor.current = null;
      }
      
      // Cleanup Cytoscape instance
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
      
      // Cancel debounced functions
      debouncedSetState.cancel();
      throttledViewportUpdate.cancel();
      
      // Reset performance monitor
      performanceMonitor.current.reset();
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
    
    // Apply class changes in batch to prevent layout recalculation
    cy.batch(() => {
      // Remove previous active highlight (FR9 precedence: keep .highlighted search class)
      cy.nodes('.active-node').removeClass('active-node');
      if (!fileId) return; // clear only
      const node = cy.getElementById(fileId);
      if (!node || node.empty()) return;
      node.addClass('active-node');
    });
    
    if (!fileId) return; // clear only
    const node = cy.getElementById(fileId);
    if (!node || node.empty()) return;
    
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

  /**
   * Apply heatmap overlay using optimized processor with batching and viewport culling
   * @param heatmapNodes Array of heatmap node data
   */
  const applyHeatmapOverlay = async (heatmapNodes: HeatmapNode[]) => {
    try {
      if (!cyRef.current) {
        showError('Heatmap Error', 'Graph not initialized. Please refresh the page.');
        console.warn('[GraphCanvas] Cannot apply heatmap - Cytoscape not initialized');
        return;
      }

      if (!heatmapNodes || heatmapNodes.length === 0) {
        showWarning('No Heatmap Data', 'No risk analysis data available for visualization.');
        console.warn('[GraphCanvas] Cannot apply heatmap - No heatmap data provided');
        return;
      }

      if (!heatmapProcessor.current) {
        showError('Heatmap Error', 'Heatmap processor not available. Please try refreshing.');
        console.warn('[GraphCanvas] Heatmap processor not initialized');
        return;
      }

      const startTime = performanceMonitor.current.startRender();
      
      // Show loading notification for large datasets
      if (heatmapNodes.length > 100) {
        showInfo('Processing Heatmap', `Applying risk visualization to ${heatmapNodes.length} nodes...`);
      }

      // Store original styles for restoration
      const originalStyles = new Map<string, any>();
      heatmapNodes.forEach(heatmapNode => {
        try {
          if (!heatmapNode?.nodeId) return;
          
          const node = cyRef.current!.getElementById(heatmapNode.nodeId);
          if (!node.empty()) {
            originalStyles.set(heatmapNode.nodeId, {
              backgroundColor: node.style('background-color'),
              borderColor: node.style('border-color'),
              borderWidth: node.style('border-width')
            });
          }
        } catch (error) {
          console.warn(`[GraphCanvas] Error storing original style for node ${heatmapNode?.nodeId}:`, error);
        }
      });

      // Update state to show processing
      debouncedSetState(prev => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          isProcessing: true,
          processingProgress: 0,
          originalStyles
        }
      }));

      // Process heatmap data with optimizations
      const result = await heatmapProcessor.current.processHeatmapData(heatmapNodes);
      
      // Update final state
      debouncedSetState(prev => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          isActive: true,
          nodes: heatmapNodes,
          originalStyles,
          lastAppliedTimestamp: Date.now(),
          cacheSize: result.processedNodes.length,
          visibleNodesCount: result.visibleCount,
          isProcessing: false,
          processingProgress: 100,
          performanceMetrics: {
            lastRenderTime: result.estimatedRenderTime,
            averageRenderTime: performanceMonitor.current.getMetrics().averageRenderTime,
            cacheHitRate: result.cacheHitRate
          }
        }
      }));

      onHeatmapStateChange?.(true);
      
      const totalTime = performanceMonitor.current.endRender(startTime);
      trackRenderPerformance(totalTime, 'heatmap-overlay');
      
      // Show success notification
      showSuccess(
        'Heatmap Applied',
        `Risk visualization applied to ${result.visibleCount} nodes in ${totalTime.toFixed(0)}ms`,
        { duration: 3000 }
      );
      
      console.log(`[GraphCanvas] Applied optimized heatmap overlay: ${result.visibleCount} visible, ${result.hiddenCount} hidden nodes, ${(result.cacheHitRate * 100).toFixed(1)}% cache hit rate in ${totalTime.toFixed(2)}ms`);

    } catch (error) {
      console.error('[GraphCanvas] Critical error applying heatmap overlay:', error);
      
      // Show error notification with retry option
      showError(
        'Heatmap Failed',
        'Failed to apply risk visualization. Click to retry.',
        {
          duration: 8000,
          action: {
            label: 'Retry',
            onClick: () => applyHeatmapOverlay(heatmapNodes)
          }
        }
      );
      
      // Graceful degradation: clear any partial state and notify
      try {
        clearHeatmapOverlay();
      } catch (clearError) {
        console.error('[GraphCanvas] Error during heatmap cleanup:', clearError);
      }
      
      // Update state to show error
      debouncedSetState(prev => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          isProcessing: false,
          processingProgress: 0
        }
      }));
      
      if (onError) {
        onError('Failed to apply heatmap overlay due to an unexpected error.');
      }
    }
  };

  /**
   * Clear heatmap overlay and restore original node styles with optimized cleanup
   */
  const clearHeatmapOverlay = () => {
    if (!cyRef.current || !state.heatmapState.isActive) {
      return;
    }

    const startTime = performanceMonitor.current.startRender();
    const cy = cyRef.current;
    const { originalStyles } = state.heatmapState;

    try {
      // Clear processor queue and cache
      if (heatmapProcessor.current) {
        heatmapProcessor.current.clearCache();
      }

      // Batch restore original styles for better performance
      const restoreBatch = Array.from(originalStyles.entries());
      const BATCH_SIZE = 25; // Smaller batches for clearing
      
      const processClearBatch = (batchIndex: number) => {
        const startIdx = batchIndex * BATCH_SIZE;
        const endIdx = Math.min(startIdx + BATCH_SIZE, restoreBatch.length);
        
        if (startIdx >= restoreBatch.length) {
          // All batches processed
          debouncedSetState(prev => ({
            ...prev,
            heatmapState: {
              isActive: false,
              nodes: [],
              originalStyles: new Map(),
              isProcessing: false,
              processingProgress: 0,
              performanceMetrics: undefined
            }
          }));

          onHeatmapStateChange?.(false);
          
          const totalTime = performanceMonitor.current.endRender(startTime);
          trackRenderPerformance(totalTime, 'heatmap-clear');
          
          // Show success notification
          showInfo('Heatmap Cleared', 'Risk visualization has been removed from the graph.');
          
          console.log(`[GraphCanvas] Cleared heatmap overlay in ${totalTime.toFixed(2)}ms`);
          return;
        }

        // Process current batch
        for (let i = startIdx; i < endIdx; i++) {
          const [nodeId, originalStyle] = restoreBatch[i];
          try {
            const node = cy.getElementById(nodeId);
            if (!node.empty()) {
              // Clear risk data and heatmap class
              node.removeData('riskData');
              node.removeClass('heatmap-node');
              
              // Animate back to original styles with staggered timing
              const animationDelay = (i - startIdx) * 2; // 2ms stagger
              
              setTimeout(() => {
                if (cy && !cy.destroyed()) {
                  node.animate({
                    style: {
                      'background-color': originalStyle.backgroundColor,
                      'border-color': originalStyle.borderColor,
                      'border-width': originalStyle.borderWidth,
                      'z-index': 1
                    }
                  }, {
                    duration: 200, // Faster clear animation
                    easing: 'ease-out'
                  });
                }
              }, animationDelay);
            }
          } catch (error) {
            console.warn(`[GraphCanvas] Error clearing style for node ${nodeId}:`, error);
          }
        }

        // Schedule next batch
        requestAnimationFrame(() => processClearBatch(batchIndex + 1));
      };

      // Start batch processing
      processClearBatch(0);

    } catch (error) {
      console.error('[GraphCanvas] Error clearing heatmap overlay:', error);
      
      // Fallback: immediate state update
      debouncedSetState(prev => ({
        ...prev,
        heatmapState: {
          isActive: false,
          nodes: [],
          originalStyles: new Map(),
          isProcessing: false,
          processingProgress: 0
        }
      }));
      
      onHeatmapStateChange?.(false);
    }
  };

  /**
   * Toggle heatmap overlay on/off
   */
  const toggleHeatmapOverlay = () => {
    if (state.heatmapState.isActive) {
      clearHeatmapOverlay();
    } else if (heatmapData && heatmapData.length > 0) {
      applyHeatmapOverlay(heatmapData);
    }
  };

  // Handle heatmap data changes with debouncing for performance
  useEffect(() => {
    if (!cyRef.current) return;

    // Update processor with current Cytoscape instance
    if (heatmapProcessor.current) {
      heatmapProcessor.current.updateCytoscapeInstance(cyRef.current);
    }

    if (heatmapEnabled && heatmapData && heatmapData.length > 0) {
      // Debounce heatmap application for rapid changes
      const debouncedApply = enhancedDebounce(() => {
        applyHeatmapOverlay(heatmapData);
      }, 150, false);
      
      debouncedApply();
      
      return () => debouncedApply.cancel();
    } else if (!heatmapEnabled && state.heatmapState.isActive) {
      clearHeatmapOverlay();
    }
  }, [heatmapData, heatmapEnabled, state.heatmapState.isActive]);

  // Enhanced rich tooltip system for nodes with proper debouncing
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    let tooltipTimeout: NodeJS.Timeout;

    const showTooltip = (node: cytoscape.NodeSingular, event: cytoscape.EventObject) => {
      console.log('[GraphCanvas] Showing tooltip for node:', node.id());
      const riskData = node.data('riskData') as HeatmapNode | undefined;
      const label = node.data('label') || 'Unknown';
      const path = node.data('path') || '';

      // Create rich tooltip data
      const tooltipData: TooltipData = {
        title: label,
        path: path || undefined,
        riskData: riskData ? {
          score: riskData.score,
          category: riskData.metrics.category,
          complexity: riskData.metrics.complexity,
          churn: riskData.metrics.churn,
          dependencies: riskData.metrics.dependencies,
          dependents: riskData.metrics.dependencies * 0.7, // Estimated dependents
          recommendation: getRecommendationForRisk(riskData)
        } : undefined,
        basicInfo: !riskData ? {
          type: getFileType(path),
          size: node.data('size'),
          lastModified: node.data('lastModified')
        } : undefined
      };

      // Get cursor position
      const originalEvent = event.originalEvent as MouseEvent;
      const position = {
        x: originalEvent?.clientX || 0,
        y: originalEvent?.clientY || 0
      };

      console.log('[GraphCanvas] Setting tooltip state with position:', position, 'data:', tooltipData);
      setState(prev => ({
        ...prev,
        tooltip: {
          visible: true,
          data: tooltipData,
          position
        }
      }));
    };

    const hideTooltip = () => {
      console.log('[GraphCanvas] Hiding tooltip');
      clearTimeout(tooltipTimeout);
      setState(prev => ({
        ...prev,
        tooltip: {
          visible: false,
          data: null,
          position: { x: 0, y: 0 }
        }
      }));
    };

    // Add hover event listeners with direct timeout approach
    cy.on('mouseover', 'node', (event) => {
      console.log('[GraphCanvas] Node mouseover detected:', event.target.id());
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        showTooltip(event.target, event);
      }, TOOLTIP_HOVER_DELAY_MS);
    });

    cy.on('mouseout', 'node', () => {
      console.log('[GraphCanvas] Node mouseout detected');
      hideTooltip();
    });

    // Hide tooltip on graph interaction
    cy.on('pan zoom', () => {
      hideTooltip();
    });

    // Cleanup on unmount
    return () => {
      clearTimeout(tooltipTimeout);
    };
  }, [state.cytoscapeInstance]); // Re-run when Cytoscape instance changes

  // Helper functions for tooltip data
  const getRecommendationForRisk = (riskData: HeatmapNode): string | undefined => {
    const { score, metrics } = riskData;
    
    if (score > 0.8) {
      if (metrics.complexity > 15) {
        return "Consider refactoring to reduce complexity and improve maintainability.";
      }
      if (metrics.churn > 20) {
        return "High change frequency detected. Consider stabilizing this component.";
      }
      return "High risk detected. Review and consider refactoring.";
    }
    
    if (score > 0.6) {
      return "Moderate risk. Monitor for changes and consider preventive refactoring.";
    }
    
    return undefined;
  };

  const getFileType = (path: string): string => {
    if (!path) return 'Unknown';
    const ext = path.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'ts': return 'TypeScript';
      case 'tsx': return 'TypeScript React';
      case 'js': return 'JavaScript';
      case 'jsx': return 'JavaScript React';
      case 'py': return 'Python';
      case 'java': return 'Java';
      case 'cpp': case 'cc': case 'cxx': return 'C++';
      case 'c': return 'C';
      case 'cs': return 'C#';
      case 'go': return 'Go';
      case 'rs': return 'Rust';
      case 'php': return 'PHP';
      case 'rb': return 'Ruby';
      case 'swift': return 'Swift';
      case 'kt': return 'Kotlin';
      case 'scala': return 'Scala';
      case 'html': return 'HTML';
      case 'css': return 'CSS';
      case 'scss': case 'sass': return 'Sass';
      case 'json': return 'JSON';
      case 'xml': return 'XML';
      case 'yaml': case 'yml': return 'YAML';
      case 'md': return 'Markdown';
      default: return 'File';
    }
  };

  /**
   * Get file type color based on extension using existing path utils
   * Task 2.1: File type color mapping for visual differentiation
   */
  const getFileTypeColor = (filePath: string): string => {
    const fileInfo = getFileExtensionInfo(filePath);
    
    // Check for test files first (higher priority)
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('/test/') || filePath.includes('__tests__')) {
      return '#4caf50'; // Green for test files
    }
    
    switch (fileInfo.type) {
      case 'source':
        switch (fileInfo.extension) {
          case 'ts':
          case 'tsx':
            return '#3178c6'; // TypeScript blue
          case 'js':
          case 'jsx':
            return '#f7df1e'; // JavaScript yellow
          default:
            return '#3178c6'; // Default to TypeScript blue for other source files
        }
      case 'config':
        return '#6B46C1'; // Purple for config files
      case 'asset':
        switch (fileInfo.extension) {
          case 'css':
          case 'scss':
          case 'sass':
          case 'less':
            return '#ff9800'; // Orange for CSS
          case 'html':
          case 'htm':
            return '#e91e63'; // Pink for HTML
          default:
            return '#9e9e9e'; // Gray for other assets
        }
      case 'documentation':
        return '#9e9e9e'; // Gray for documentation
      default:
        return '#9e9e9e'; // Gray for unknown files
    }
  };

  // Handle search highlighting when searchQuery prop changes
  useEffect(() => {
    if (!cyRef.current) return;

    const query = searchQuery?.trim() || '';
    const previousQuery = state.searchQuery || '';
    const isNewSearch = query !== previousQuery && query.length > 0;
    
    setState(prev => ({ ...prev, searchQuery: query }));

    if (!query) {
      // Clear highlighting when search is empty using batch operation
      cyRef.current.batch(() => {
        cyRef.current!.elements().removeClass('highlighted dimmed');
      });
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

    // Apply highlighting using batch operation for atomic updates
    cyRef.current.batch(() => {
      cyRef.current!.elements().removeClass('highlighted dimmed');
      
      if (matchingNodes.length > 0) {
        // Highlight matching nodes
        matchingNodes.forEach(nodeId => {
          cyRef.current?.getElementById(nodeId).addClass('highlighted');
        });
        
        // Dim non-matching elements
        cyRef.current!.elements().not('.highlighted').addClass('dimmed');
      }
    });

    // Only animate focus for new searches to preserve viewport stability
    if (isNewSearch && matchingNodes.length > 0) {
      const firstMatchNode = cyRef.current.getElementById(matchingNodes[0]);
      if (!firstMatchNode.empty()) {
        const currentZoom = cyRef.current.zoom();
        cyRef.current.animate({
          center: { eles: firstMatchNode },
          zoom: currentZoom, // Maintain current zoom level
          duration: LAYOUT_ANIMATION_MS
        });
      }
    }

    setState(prev => ({ ...prev, highlightedNodes: matchingNodes }));
    onSearchResultsChange?.(matchingNodes.length);
  }, [searchQuery, onSearchResultsChange]);

  // Task 5.4: Handle search focus cycling with animation
  useEffect(() => {
    if (!cyRef.current || !searchQuery || searchFocusIndex < 0 || state.highlightedNodes.length === 0) {
      return;
    }

    const targetNodeId = state.highlightedNodes[searchFocusIndex];
    if (!targetNodeId) return;

    const targetNode = cyRef.current.getElementById(targetNodeId);
    if (targetNode.empty()) return;

    // Task 5.4: Focus animation using AUTO_PAN_ANIMATION_MS (400ms) while maintaining zoom
    const currentZoom = cyRef.current.zoom();
    cyRef.current.animate({
      center: { eles: targetNode },
      zoom: currentZoom, // Maintain current zoom level  
      duration: AUTO_PAN_ANIMATION_MS // Use the 400ms constant
    });

    console.log(`[GraphCanvas] Focused on search result ${searchFocusIndex + 1}/${state.highlightedNodes.length}: ${targetNodeId}`);
  }, [searchFocusIndex, searchQuery, state.highlightedNodes]);

  // Handle layout changes (Task 3.5: Layout change logic with animation)
  useEffect(() => {
    if (!cyRef.current || !graph || state.isLoading) return;

    // Skip the initial layout setup - only handle user-initiated layout changes
    if (!hasInitialLayoutRef.current) {
      hasInitialLayoutRef.current = true;
      return;
    }

    const cy = cyRef.current;
    const cytoscapeLayoutName = getCytoscapeLayoutName(currentLayout);
    const layoutConfig = getLayoutConfig(cytoscapeLayoutName, graph.nodes.length);

    // Notify parent that layout change is starting
    onLayoutChange?.(true);

    // Apply the new layout
    const layout = cy.layout(layoutConfig);
    
    const handleLayoutStop = () => {
      // Notify parent that layout change is complete
      onLayoutChange?.(false);
    };

    layout.on('layoutstop', handleLayoutStop);
    layout.run();

    // Cleanup function to remove event listeners
    return () => {
      try {
        layout.off('layoutstop', handleLayoutStop);
      } catch (e) {
        // Layout might already be destroyed
      }
    };

  }, [currentLayout, graph, onLayoutChange, state.isLoading]);

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
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          width: "100%",
          height: "400px",
          minHeight: "300px",
          position: "relative",
          backgroundColor: "var(--vscode-editor-background)",
        }}
      >
        {/* Contextual Help */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 20,
          }}
        >
          <GraphHelp />
        </div>

        {/* Loading Indicator */}
        {state.isLoading && (
          <LoadingIndicator
            state={{
              isLoading: true,
              message: "Loading graph...",
              type: "spinner",
            }}
            size="large"
            overlay={true}
            position="center"
          />
        )}

        {/* Layout Change Loading Indicator */}
        {disabled && (
          <LoadingIndicator
            state={{
              isLoading: true,
              message: "Changing layout...",
              type: "spinner",
            }}
            size="large"
            overlay={true}
            position="center"
          />
        )}

        {/* Heatmap Processing Indicator */}
        {state.heatmapState.isProcessing && (
          <HeatmapLoadingIndicator
            progress={state.heatmapState.processingProgress}
            message="Processing heatmap..."
          />
        )}

        {/* Graph Container */}
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            border: "1px solid var(--vscode-panel-border)",
            borderRadius: "4px",
            outline: "none", // Remove focus outline since Cytoscape handles focus
            pointerEvents: disabled ? "none" : "auto",
            opacity: disabled ? 0.6 : 1,
            transition: "opacity 0.3s ease"
          }}
          tabIndex={disabled ? -1 : 0}
          role="application"
          aria-label="Interactive dependency graph"
        />

        {/* Rich Tooltip */}
        <RichTooltip
          data={state.tooltip.data}
          position={state.tooltip.position}
          visible={state.tooltip.visible}
          theme="auto"
        />

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </>
  );
}