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
import {
  LayoutState,
  LayoutType,
  DEFAULT_LAYOUT_TYPE,
} from "@/types/layout.types";
import { FilterState } from "./FilterDropdown";
import { RichTooltip, TooltipData } from './RichTooltip';

interface FocusState {
  enabled: boolean;
  selectedNode: string | null;
  depth: number;
  showDependencies: boolean;
  showDependents: boolean;
  keyboardNavigatedNode?: string | null;
}
import { ToastContainer, useToasts } from "./ToastNotification";
import { LoadingIndicator, HeatmapLoadingIndicator } from "./LoadingIndicator";
import { GraphHelp } from "./ContextualHelp";
import { ImpactAnimationHandler, useImpactAnimation } from "./ImpactAnimationHandler";
import { ImpactAnimationInstruction, AnimationEvent, AnimationEventType } from "../../../../types/impact-animation.types";

/**
 * Task 4.1: Enhanced node size calculation based on multiple criteria
 * Considers connection count, complexity, and file characteristics
 */
const calculateNodeSize = (connectionCount: number, node?: any): number => {
  // Base size ranges: Small (20-40px), Medium (30-60px), Large (40-80px)
  let baseSize = 30; // Default medium size
  let sizeMultiplier = 1.0;

  // 1. Connection count scoring (primary factor)
  const connectionScore = Math.min(connectionCount / 10, 1.0); // Normalize to 0-1

  // 2. Complexity scoring (if available in node data)
  let complexityScore = 0;
  if (node?.data) {
    const path = node.data.path || "";
    // Simple heuristic: path depth as complexity indicator
    const pathDepth = path.split("/").length;
    complexityScore = Math.min(pathDepth / 8, 1.0); // Normalize to 0-1

    // File type complexity weighting
    const extension = path.split(".").pop()?.toLowerCase();
    const complexFileTypes = ["ts", "tsx", "js", "jsx"];
    if (complexFileTypes.includes(extension || "")) {
      complexityScore *= 1.2; // Boost for complex file types
    }
  }

  // 3. File size estimation (based on file name length as proxy)
  let fileSizeScore = 0;
  if (node?.data?.label) {
    const nameLength = node.data.label.length;
    fileSizeScore = Math.min(nameLength / 50, 1.0); // Normalize to 0-1
  }

  // Calculate weighted composite score
  const weights = {
    connections: 0.5, // 50% weight to connections (most important)
    complexity: 0.3, // 30% weight to complexity
    fileSize: 0.2, // 20% weight to file size
  };

  const compositeScore =
    connectionScore * weights.connections +
    complexityScore * weights.complexity +
    fileSizeScore * weights.fileSize;

  // Determine size category and calculate final size
  if (compositeScore <= 0.33) {
    // Small category: 20-40px
    baseSize = 20;
    sizeMultiplier = 1 + compositeScore / 0.33; // 1.0 to 2.0
  } else if (compositeScore <= 0.66) {
    // Medium category: 30-60px
    baseSize = 30;
    sizeMultiplier = 1 + (compositeScore - 0.33) / 0.33; // 1.0 to 2.0
  } else {
    // Large category: 40-80px
    baseSize = 40;
    sizeMultiplier = 1 + (compositeScore - 0.66) / 0.34; // 1.0 to 2.0
  }

  const finalSize = Math.round(baseSize * sizeMultiplier);

  // Ensure size stays within bounds
  return Math.min(Math.max(finalSize, 20), 80);
};

/**
 * Legacy calculateNodeSize function for backward compatibility
 * @deprecated Use the enhanced version with node parameter
 */
const calculateNodeSizeLegacy = (connectionCount: number): number => {
  if (connectionCount <= 2) return 30; // 0-2 connections: 30px
  if (connectionCount <= 6) return 40; // 3-6 connections: 40px
  if (connectionCount <= 10) return 50; // 7-10 connections: 50px
  return 60; // 11+ connections: 60px
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
function sampleLargeGraph(
  graph: IConstellationGraph,
  maxNodes: number
): IConstellationGraph {
  if (graph.nodes.length <= maxNodes) {
    return graph;
  }

  // Removed verbose sampling log (cleanup task 14.1)

  // Sort nodes by connection count (degree centrality) to keep most connected nodes
  const nodeConnections = new Map<string, number>();

  // Count connections for each node
  graph.edges.forEach((edge) => {
    nodeConnections.set(
      edge.source,
      (nodeConnections.get(edge.source) || 0) + 1
    );
    nodeConnections.set(
      edge.target,
      (nodeConnections.get(edge.target) || 0) + 1
    );
  });

  // Sort nodes by connection count (descending)
  const sortedNodes = [...graph.nodes].sort(
    (a, b) =>
      (nodeConnections.get(b.id) || 0) - (nodeConnections.get(a.id) || 0)
  );

  // Take top connected nodes
  const sampledNodes = sortedNodes.slice(0, maxNodes);
  const sampledNodeIds = new Set(sampledNodes.map((n) => n.id));

  // Filter edges to only include those between sampled nodes
  const sampledEdges = graph.edges.filter(
    (edge) => sampledNodeIds.has(edge.source) && sampledNodeIds.has(edge.target)
  );

  return {
    nodes: sampledNodes,
    edges: sampledEdges,
    metadata: {
      ...graph.metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Filter graph nodes based on filter criteria
 * @param graph - The graph to filter
 * @param filters - Filter criteria to apply
 * @returns Filtered graph with nodes and edges that match criteria
 */
function filterNodes(
  graph: IConstellationGraph,
  filters: FilterState
): IConstellationGraph {
  if (!filters) {
    return graph;
  }

  let filteredNodes = [...graph.nodes];

  // Filter by file types
  if (filters.fileTypes.length > 0) {
    filteredNodes = filteredNodes.filter((node) => {
      const extension = node.path?.split(".").pop()?.toLowerCase();
      return extension && filters.fileTypes.includes(extension);
    });
  }

  // Filter by complexity level (placeholder - would need health analysis data)
  if (filters.complexity !== "all") {
    // For now, implement a simple heuristic based on file size or path depth
    filteredNodes = filteredNodes.filter((node) => {
      const pathDepth = node.path.split("/").length;
      switch (filters.complexity) {
        case "low":
          return pathDepth <= 3;
        case "medium":
          return pathDepth > 3 && pathDepth <= 6;
        case "high":
          return pathDepth > 6;
        default:
          return true;
      }
    });
  }

  // Filter by risk level (placeholder - would need risk analysis data)
  if (filters.riskLevel !== "all") {
    // For now, implement a simple heuristic based on file type
    filteredNodes = filteredNodes.filter((node) => {
      const extension = node.path?.split(".").pop()?.toLowerCase();
      const isHighRisk = ["js", "jsx", "ts", "tsx"].includes(extension || "");

      switch (filters.riskLevel) {
        case "low":
          return !isHighRisk;
        case "medium":
          return isHighRisk && node.path.includes("components");
        case "high":
          return isHighRisk && !node.path.includes("components");
        default:
          return true;
      }
    });
  }

  // Filter by dependencies
  if (filters.dependencies !== "all") {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    filteredNodes = filteredNodes.filter((node) => {
      const nodeEdges = graph.edges.filter(
        (e) => e.source === node.id || e.target === node.id
      );

      if (filters.dependencies === "internal") {
        // Keep nodes that have internal dependencies (within project)
        return nodeEdges.some(
          (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
        );
      } else if (filters.dependencies === "external") {
        // Keep nodes that have external dependencies (simplified: any dependencies)
        return nodeEdges.length > 0;
      }
      return true;
    });
  }

  // Filter by node count limit
  if (filters.nodeCount < filteredNodes.length) {
    // Sort by importance (connection count) and take top N
    const nodeConnections = new Map<string, number>();
    graph.edges.forEach((edge) => {
      nodeConnections.set(
        edge.source,
        (nodeConnections.get(edge.source) || 0) + 1
      );
      nodeConnections.set(
        edge.target,
        (nodeConnections.get(edge.target) || 0) + 1
      );
    });

    filteredNodes = filteredNodes
      .sort(
        (a, b) =>
          (nodeConnections.get(b.id) || 0) - (nodeConnections.get(a.id) || 0)
      )
      .slice(0, filters.nodeCount);
  }

  // Filter edges to only include those between filtered nodes
  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (edge) =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: {
      ...graph.metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Calculate focus subgraph based on selected node and focus settings
 * @param graph - The graph to analyze
 * @param focusState - Focus configuration
 * @returns Filtered graph containing only nodes within focus range
 */
function calculateFocusSubgraph(
  graph: IConstellationGraph,
  focusState: FocusState
): IConstellationGraph {
  if (!focusState.enabled || !focusState.selectedNode) {
    return graph;
  }

  const { selectedNode, depth, showDependencies, showDependents } = focusState;
  const focusedNodes = new Set<string>();
  const edgeMap = new Map<string, string[]>();

  // Build adjacency map for efficient traversal
  graph.edges.forEach((edge) => {
    // Ensure keys exist
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, []);

    // Corrected semantics:
    // Edge source -> target means: source depends on target.
    // showDependencies: follow outgoing edges (source -> target) to the things the node depends on.
    // showDependents: follow incoming edges (target -> source) to nodes that depend on the current node.
    if (showDependencies) {
      edgeMap.get(edge.source)!.push(edge.target); // dependencies: outward traversal
    }
    if (showDependents) {
      edgeMap.get(edge.target)!.push(edge.source); // dependents: inward traversal
    }
  });

  // Breadth-first search to find nodes within specified depth
  const queue: Array<{ nodeId: string; currentDepth: number }> = [
    { nodeId: selectedNode, currentDepth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { nodeId, currentDepth } = queue.shift()!;

    if (visited.has(nodeId) || currentDepth > depth) {
      continue;
    }

    visited.add(nodeId);
    focusedNodes.add(nodeId);

    // Add connected nodes to queue if within depth limit
    if (currentDepth < depth) {
      const connectedNodes = edgeMap.get(nodeId) || [];
      connectedNodes.forEach((connectedNodeId) => {
        if (!visited.has(connectedNodeId)) {
          queue.push({
            nodeId: connectedNodeId,
            currentDepth: currentDepth + 1,
          });
        }
      });
    }
  }

  // Filter nodes and edges to include only focused subgraph
  const filteredNodes = graph.nodes.filter((node) => focusedNodes.has(node.id));
  const filteredEdges = graph.edges.filter(
    (edge) => focusedNodes.has(edge.source) && focusedNodes.has(edge.target)
  );

  console.log(
    `[calculateFocusSubgraph] Focus on "${selectedNode}" (depth ${depth}): ${filteredNodes.length}/${graph.nodes.length} nodes`
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: {
      ...graph.metadata,
      timestamp: new Date().toISOString(),
    },
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
  onNodeClick?: (
    nodeId: string,
    openMode: "default" | "split",
    event?: { ctrlKey?: boolean; metaKey?: boolean; detail?: number }
  ) => void;
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
  /** Filter state for node filtering */
  filterState?: FilterState;
  /** Focus state for focus mode */
  focusState?: FocusState;
  /** Callback when a node is selected for focus */
  onFocusNodeSelect?: (nodeId: string | null) => void;
  /** Callback for performance metrics updates */
  onPerformanceUpdate?: (metrics: {
    renderTime: number;
    layoutTime: number;
  }) => void;
  /** Callback with current visible vs total node counts after filtering/focus */
  onVisibleCountsChange?: (counts: {
    visibleNodes: number;
    totalNodes: number;
  }) => void;
  /** Ref to expose GraphCanvas methods */
  ref?: { current: GraphCanvasRef | null };
}

interface GraphCanvasState {
  isLoading: boolean;
  searchQuery: string;
  highlightedNodes: string[];
  cytoscapeInstance: cytoscape.Core | null;
  heatmapState: HeatmapState;
  layoutState: LayoutState; // Task 6.2: Layout state management
  tooltip: {
    visible: boolean;
    data: TooltipData | null;
    position: { x: number; y: number };
  };
}

/**
 * Ref interface for GraphCanvas component
 */
export interface GraphCanvasRef {
  /** Get the current Cytoscape instance */
  getCytoscapeInstance: () => cytoscape.Core | null;
  /** Apply impact animation to the graph */
  applyImpactAnimation: (payload: any) => Promise<void>;
  /** Clear any active animations */
  clearAnimation: () => void;
  /** Reset animation state */
  resetAnimation: () => void;
  /** Check if animation is currently running */
  isAnimating: () => boolean;
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
  currentLayout = "force-directed",
  onLayoutChange,
  disabled = false,
  filterState,
  focusState,
  onFocusNodeSelect,
  onPerformanceUpdate,
  onVisibleCountsChange,
  ref,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const performanceMonitor = useRef(new PerformanceMonitor());
  const heatmapProcessor = useRef<OptimizedHeatmapProcessor | null>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const hasInitialLayoutRef = useRef(false);
  const [state, setState] = useState<GraphCanvasState>({
    isLoading: false,
    searchQuery: "",
    highlightedNodes: [],
    cytoscapeInstance: null,
    heatmapState: {
      isActive: false,
      nodes: [],
      originalStyles: new Map(),
      isProcessing: false,
      processingProgress: 0,
    },
    layoutState: {
      currentLayout: (currentLayout as LayoutType) || DEFAULT_LAYOUT_TYPE,
      isChanging: false,
      history: [],
      performanceMetrics: {
        totalChanges: 0,
      },
    },
    tooltip: {
      visible: false,
      data: null,
      position: { x: 0, y: 0 },
    },
  });

  // Toast notifications
  const {
    toasts,
    dismissToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  } = useToasts();

  // Impact animation handler
  const handleAnimationEvent = useCallback((event: AnimationEvent) => {
    switch (event.type) {
      case AnimationEventType.ANIMATION_START:
        showInfo("Impact analysis animation started");
        break;
      case AnimationEventType.ANIMATION_COMPLETE:
        showSuccess("Impact analysis animation completed");
        break;
      case AnimationEventType.ANIMATION_ERROR:
        showError("Impact animation failed");
        break;
    }
  }, [showInfo, showSuccess, showError]);

  const { applyImpactAnimation, clearAnimation, isAnimating } = useImpactAnimation({
    cy: cyRef.current,
    onAnimationEvent: handleAnimationEvent,
    enabled: true
  });

  // Expose ref methods
  useEffect(() => {
    if (ref) {
      ref.current = {
        getCytoscapeInstance: () => cyRef.current,
        applyImpactAnimation,
        clearAnimation,
        resetAnimation: clearAnimation, // resetAnimation is an alias for clearAnimation
        isAnimating: () => isAnimating
      };
    }
    return () => {
      if (ref) {
        ref.current = null;
      }
    };
  }, [ref, applyImpactAnimation, clearAnimation, isAnimating]);

  // Debounced state update for performance - enhanced with immediate option
  const debouncedSetState = useCallback(
    enhancedDebounce(
      (updater: (prev: GraphCanvasState) => GraphCanvasState) => {
        setState(updater);
      },
      100,
      false
    ),
    []
  );

  // Throttled viewport update for better performance
  const throttledViewportUpdate = useCallback(
    throttle(() => {
      if (!cyRef.current) return;

      const zoom = cyRef.current.zoom();

      // Optimize label visibility based on zoom level
      if (zoom < 0.3) {
        cyRef.current.style().selector("node").style("label", "").update();
      } else if (zoom >= 0.3) {
        cyRef.current
          .style()
          .selector("node")
          .style("label", "data(label)")
          .update();
      }

      // Update heatmap processor viewport if active
      if (heatmapProcessor.current && state.heatmapState.isActive) {
        // Trigger viewport-based optimization
        const viewport = cyRef.current.extent();
        console.log(
          `[GraphCanvas] Viewport updated: zoom=${zoom.toFixed(
            2
          )}, extent=${JSON.stringify(viewport)}`
        );
      }
    }, 100),
    [state.heatmapState.isActive]
  );

  // Performance tracking with enhanced metrics
  const trackRenderPerformance = useCallback(
    (renderTime: number, operation: string = "render") => {
      const metrics = performanceMonitor.current.getMetrics();

      // Log performance warnings for slow operations
      if (renderTime > 1000) {
        console.warn(
          `[GraphCanvas] Slow ${operation} detected: ${renderTime}ms (avg: ${metrics.averageRenderTime.toFixed(
            2
          )}ms)`
        );
      }

      // Update performance metrics in state
      debouncedSetState((prev) => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          performanceMetrics: {
            lastRenderTime: renderTime,
            averageRenderTime: metrics.averageRenderTime,
            cacheHitRate:
              prev.heatmapState.performanceMetrics?.cacheHitRate || 0,
          },
        },
      }));
    },
    [debouncedSetState]
  );

  // Initialize Cytoscape.js instance
  // Initial graph build (no filter/focus dependencies to preserve viewport)
  useEffect(() => {
    if (!containerRef.current || !graph) return;

    // Reset layout initialization flag for new graph
    hasInitialLayoutRef.current = false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Task 9.4: Edge case validation for empty graphs, single nodes, disconnected components
      if (!graph.nodes || graph.nodes.length === 0) {
        console.warn("[GraphCanvas] Empty graph detected");
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Task 9.4: Handle single node case
      if (graph.nodes.length === 1) {
        console.log("[GraphCanvas] Single node graph detected");
      }

      // Task 9.4: Detect disconnected components
      const edgeNodeIds = new Set();
      (graph.edges || []).forEach((edge) => {
        edgeNodeIds.add(edge.source);
        edgeNodeIds.add(edge.target);
      });

      const disconnectedNodes = graph.nodes.filter(
        (node) => !edgeNodeIds.has(node.id)
      );
      if (disconnectedNodes.length > 0) {
        console.log(
          `[GraphCanvas] Found ${disconnectedNodes.length} disconnected nodes`
        );
      }

      // Validate graph data
      if (!validateGraphData(graph)) {
        const error = "Invalid graph data structure";
        onError?.(error);
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Transform graph data to Cytoscape format with optional sampling and filtering
      let processedGraph = graph;

      // Apply filters if provided
      if (filterState) {
        processedGraph = filterNodes(graph, filterState);
        console.log(
          `[GraphCanvas] Applied filters, nodes: ${graph.nodes.length} -> ${processedGraph.nodes.length}`
        );
      }

      // Apply focus mode if enabled
      if (focusState?.enabled && focusState.selectedNode) {
        processedGraph = calculateFocusSubgraph(processedGraph, focusState);
        console.log(
          `[GraphCanvas] Applied focus, final nodes: ${processedGraph.nodes.length}`
        );
      }

      // Apply sampling for large graphs
      if (processedGraph.nodes.length > 1000) {
        processedGraph = sampleLargeGraph(processedGraph, 1000);
        console.log(
          `[GraphCanvas] Applied sampling, final nodes: ${processedGraph.nodes.length}`
        );
      }

      const cytoscapeElements = transformGraphToCytoscape(processedGraph);

      // Dispose existing instance if it exists
      if (cyRef.current) {
        cyRef.current.destroy();
      }

      // Task 9.4: Adaptive layout selection for edge cases
      let initialLayout = "cose"; // Default force-directed layout
      const nodeCount = graph.nodes.length;
      const edgeCount = graph.edges?.length || 0;

      if (nodeCount === 1) {
        // Single node: use a simple centered layout
        initialLayout = "center";
        console.log("[GraphCanvas] Using center layout for single node");
      } else if (nodeCount <= 5 && edgeCount === 0) {
        // Few disconnected nodes: use circle layout
        initialLayout = "circle";
        console.log(
          "[GraphCanvas] Using circle layout for small disconnected graph"
        );
      } else if (disconnectedNodes.length > nodeCount * 0.5) {
        // Mostly disconnected: use grid layout for better spacing
        initialLayout = "grid";
        console.log(
          "[GraphCanvas] Using grid layout for highly disconnected graph"
        );
      }

      // Validate Cytoscape feature availability before initialization
      const validateCytoscapeFeatures = () => {
        try {
          const testInstance = cytoscape({ headless: true });

          // Check if required layout algorithms are available
          const requiredLayouts = [
            "cose",
            "circle",
            "grid",
            "breadthfirst",
            "concentric",
          ];
          const availableLayouts = requiredLayouts.filter((layout) => {
            try {
              testInstance.layout({ name: layout }).run();
              return true;
            } catch (e) {
              console.warn(
                `[GraphCanvas] Layout '${layout}' not available:`,
                e
              );
              return false;
            }
          });

          // Clean up test instance
          testInstance.destroy();

          if (availableLayouts.length === 0) {
            throw new Error("No supported layout algorithms available");
          }

          // If the requested layout is not available, fall back to available ones
          if (!availableLayouts.includes(initialLayout)) {
            const fallbackLayout = availableLayouts.includes("cose")
              ? "cose"
              : availableLayouts[0];
            console.warn(
              `[GraphCanvas] Requested layout '${initialLayout}' not available, falling back to '${fallbackLayout}'`
            );
            initialLayout = fallbackLayout;
          }

          return true;
        } catch (error) {
          console.error(
            "[GraphCanvas] Cytoscape feature validation failed:",
            error
          );
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Cytoscape initialization failed: ${errorMessage}`);
        }
      };

      // Validate features before proceeding
      validateCytoscapeFeatures();

      // Initialize new Cytoscape instance
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: [...cytoscapeElements.nodes, ...cytoscapeElements.edges],
        style: [
          {
            selector: "node",
            style: {
              "background-color": "var(--vscode-charts-blue)",
              "border-color": "var(--vscode-panel-border)",
              "border-width": 1,
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "font-size": "10px",
              "font-family": "var(--vscode-font-family)",
              "font-weight": 500,
              color: "white",
              // Task 4.3: Enhanced dynamic node sizing based on multiple criteria
              width: (node: any) => {
                const degree = node.degree();
                return calculateNodeSize(degree, node);
              },
              height: (node: any) => {
                const degree = node.degree();
                return calculateNodeSize(degree, node);
              },
              "text-wrap": "wrap",
              "text-max-width": "70px",
              "text-background-color": "rgba(0, 0, 0, 0.75)",
              "text-background-opacity": 1.0,
              "text-background-padding": "1px",
            },
          },
          {
            selector: "node:hover",
            style: {
              "background-color": "var(--vscode-charts-purple)",
              "border-color": "var(--vscode-focusBorder)",
              "border-width": 2,
              "z-index": 5,
              "font-size": "11px",
              color: "white",
            },
          },
          {
            selector: "edge",
            style: {
              width: 1,
              "line-color": "var(--vscode-charts-gray)",
              "target-arrow-color": "var(--vscode-charts-gray)",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              "arrow-scale": 0.8,
              opacity: 0.7,
            },
          },
          {
            selector: "edge:hover",
            style: {
              width: 2,
              opacity: 1,
              "z-index": 3,
            },
          },
          {
            selector: ".highlighted",
            style: {
              // Task 5.1: Enhanced highlighting with 100% opacity and prominent border
              "background-color": "var(--vscode-charts-orange)",
              "border-color": "var(--vscode-charts-orange)",
              "border-width": 3,
              opacity: 1.0, // Maintain 100% opacity for highlighted nodes
              "line-color": "var(--vscode-charts-orange)",
              "target-arrow-color": "var(--vscode-charts-orange)",
              "z-index": 10,
              "font-size": "11px",
              color: "white",
            },
          },
          // IMPORTANT: .dimmed selector must come AFTER other selectors for proper precedence
          {
            selector: "node.dimmed, edge.dimmed",
            style: {
              // Task 5.2: Updated dimmed opacity to 30% for better contrast
              opacity: 0.3,
            },
          },
          {
            selector: ".dimmed",
            style: {
              // Task 5.2: Fallback dimmed opacity for elements
              opacity: 0.3,
            },
          },
          // Active node style appended late for precedence (FR9, FR13)
          {
            selector: "node.active-node",
            style: {
              "border-width": 4,
              "border-color": "var(--vscode-focusBorder)",
              "background-color": "var(--vscode-charts-orange)",
              "z-index": 20,
              "font-size": "12px",
              color: "white",
            },
          },
          // Heatmap overlay styles
          {
            selector: "node.heatmap-node",
            style: {
              "transition-property":
                "background-color, border-color, border-width",
              "transition-duration": 300,
              "transition-timing-function": "ease-out",
            },
          },
          {
            selector: "node.heatmap-node:hover",
            style: {
              "border-width": "+=1",
              "z-index": 25,
            },
          },
        ],
        layout: getLayoutConfig("cose", cytoscapeElements.nodes.length),
        wheelSensitivity: 0.2,
        minZoom: 0.1,
        maxZoom: 3.0,
        // Performance optimizations for smooth 60 FPS interactions
        pixelRatio: "auto",
        motionBlur: true,
        motionBlurOpacity: 0.2,
        textureOnViewport: false,
        hideEdgesOnViewport: false,
        hideLabelsOnViewport: false,
      });

      // Add node click handler with enhanced UX
      cyRef.current.on("tap", "node", (event) => {
        const nodeId = event.target.id();

        // Detect modifier keys and click details from the original event
        const orig: any = event.originalEvent || {};
        const meta = !!orig.metaKey;
        const ctrl = !!orig.ctrlKey;
        const openMode: "default" | "split" =
          meta || ctrl ? "split" : "default";

        // Pass click event details to the handler for enhanced UX logic
        const clickEvent = {
          ctrlKey: ctrl,
          metaKey: meta,
          detail: orig.detail || 1, // Click count for double-click detection
        };

        // Enhanced UX: Let InteractiveGraphCanvas decide behavior based on focus mode
        onNodeClick?.(nodeId, openMode, clickEvent);
      });

      // Add double-click handler for reliable double-click detection
      cyRef.current.on("dblclick", "node", (event) => {
        const nodeId = event.target.id();

        // Double-click always opens the file
        const orig: any = event.originalEvent || {};
        const meta = !!orig.metaKey;
        const ctrl = !!orig.ctrlKey;
        const openMode: "default" | "split" =
          meta || ctrl ? "split" : "default";

        const clickEvent = {
          ctrlKey: ctrl,
          metaKey: meta,
          detail: 2, // Force double-click
        };

        onNodeClick?.(nodeId, openMode, clickEvent);
      });

      // Add optimized viewport handling
      cyRef.current.on("viewport", throttledViewportUpdate);

      // Initialize optimized heatmap processor
      if (cyRef.current) {
        heatmapProcessor.current = createOptimizedHeatmapProcessor(
          cyRef.current,
          {
            batchSize: Math.min(
              50,
              Math.max(10, Math.floor(cytoscapeElements.nodes.length / 20))
            ),
            animationDuration: 300,
            animationEasing: "ease-out",
            enableViewportCulling: cytoscapeElements.nodes.length > 100,
            viewportMargin: 150,
            maxCacheSize: Math.min(1000, cytoscapeElements.nodes.length * 2),
            enablePerformanceMonitoring: true,
          }
        );
      }

      // Apply file type colors to nodes (Task 2.3: Dynamic background colors)
      cyRef.current.batch(() => {
        cyRef.current!.nodes().forEach((node) => {
          const filePath = node.data("path") || node.data("label") || "";
          const fileTypeColor = getFileTypeColor(filePath);
          node.style("background-color", fileTypeColor);
        });
      });

      setState((prev) => ({
        ...prev,
        isLoading: false,
        cytoscapeInstance: cyRef.current,
      }));

      // Task 4.5: Test node sizing visual differentiation
      // Log node size distribution for verification
      if (cyRef.current) {
        const nodes = cyRef.current.nodes();
        const sizeCounts = { small: 0, medium: 0, large: 0, extraLarge: 0 };

        nodes.forEach((node: any) => {
          const degree = node.degree();
          const size = calculateNodeSize(degree, node);

          if (size <= 30) sizeCounts.small++;
          else if (size <= 45) sizeCounts.medium++;
          else if (size <= 60) sizeCounts.large++;
          else sizeCounts.extraLarge++;
        });

        console.log(`[GraphCanvas] Node sizing distribution:`, {
          total: nodes.length,
          small: `${sizeCounts.small} nodes (30px, ≤2 connections)`,
          medium: `${sizeCounts.medium} nodes (40px, 3-6 connections)`,
          large: `${sizeCounts.large} nodes (50px, 7-10 connections)`,
          extraLarge: `${sizeCounts.extraLarge} nodes (60px, 11+ connections)`,
        });
      }

      // Performance monitoring with enhanced tracking
      const renderTime = performanceMonitor.current.endRender(
        performance.now() - 100
      );
      trackRenderPerformance(renderTime, "graph-initialization");

      // Adaptive performance warnings based on graph size
      if (cytoscapeElements.nodes.length > 1000) {
        console.warn(
          `[GraphCanvas] Large graph detected (${cytoscapeElements.nodes.length} nodes). Performance optimizations enabled.`
        );

        // Only show error for extremely large graphs
        if (cytoscapeElements.nodes.length > 2000) {
          onError?.(
            `Very large graph with ${cytoscapeElements.nodes.length} nodes detected. Performance may be impacted. Consider filtering the data.`
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("GraphCanvas initialization error:", errorMessage);
      onError?.(errorMessage);
      setState((prev) => ({ ...prev, isLoading: false }));
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
    // After first build, report counts (safely)
    if (graph && cyRef.current) {
      const localGraph = graph!; // guarded above
      const cyInstance = cyRef.current!; // guarded above
      try {
        const visibleCount = cyInstance.nodes().length;
        const total = localGraph.nodes.length;
        onVisibleCountsChange?.({
          visibleNodes: visibleCount,
          totalNodes: total,
        });
      } catch {
        /* ignore */
      }
    }
  }, [
    graph,
    onNodeClick,
    onError,
    /* filterState removed for incremental filtering */ /* focusState removed for incremental focus */ onFocusNodeSelect,
  ]);

  // Ref to track currently filtered-in node IDs
  const filteredIdsRef = useRef<Set<string> | null>(null);

  // Incremental filtering (hide/show without rebuilding instance)
  useEffect(() => {
    if (!cyRef.current || !graph) return;
    if (!filterState) {
      filteredIdsRef.current = null; // No filtering
      return;
    }
    const filteredGraph = filterNodes(graph, filterState);
    const allowedIds = new Set(filteredGraph.nodes.map((n) => n.id));
    filteredIdsRef.current = allowedIds;
    const cy = cyRef.current;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const id = n.id();
        if (!filteredIdsRef.current || filteredIdsRef.current.has(id)) {
          if (n.style("display") === "none") n.style("display", "element");
        } else {
          if (n.style("display") !== "none") n.style("display", "none");
        }
      });
      cy.edges().forEach((e) => {
        const src = e.data("source");
        const tgt = e.data("target");
        const visible =
          !filteredIdsRef.current ||
          (filteredIdsRef.current.has(src) && filteredIdsRef.current.has(tgt));
        if (visible) {
          if (e.style("display") === "none") e.style("display", "element");
        } else {
          if (e.style("display") !== "none") e.style("display", "none");
        }
      });
    });
    // Report counts post filtering
    if (onVisibleCountsChange) {
      const visibleNodes = cy
        .nodes()
        .filter((n) => n.style("display") !== "none").length;
      onVisibleCountsChange({ visibleNodes, totalNodes: graph.nodes.length });
    }
    console.log("[GraphCanvas] Incremental filter applied:", {
      visible: filteredIdsRef.current
        ? filteredIdsRef.current.size
        : graph.nodes.length,
      total: graph.nodes.length,
      filters: filterState,
    });
  }, [filterState, graph, onVisibleCountsChange]);

  // Incremental focus mode application without rebuilding Cytoscape instance
  useEffect(() => {
    if (!cyRef.current || !graph) return;

    const cy = cyRef.current;

    // If focus disabled or no selected node -> show all
    if (!focusState?.enabled || !focusState.selectedNode) {
      cy.batch(() => {
        cy.nodes().forEach((n) => {
          if (n.removed()) return;
          const id = n.id();
          const shouldBeVisible =
            !filteredIdsRef.current || filteredIdsRef.current.has(id);
          const desiredDisplay = shouldBeVisible ? "element" : "none";
          if (n.style("display") !== desiredDisplay)
            n.style("display", desiredDisplay);
        });
        cy.edges().forEach((e) => {
          if (e.removed()) return;
          const src = e.data("source");
          const tgt = e.data("target");
          const shouldBeVisible =
            !filteredIdsRef.current ||
            (filteredIdsRef.current.has(src) &&
              filteredIdsRef.current.has(tgt));
          const desiredDisplay = shouldBeVisible ? "element" : "none";
          if (e.style("display") !== desiredDisplay)
            e.style("display", desiredDisplay);
        });
      });
      if (onVisibleCountsChange) {
        const visibleNodes = cy
          .nodes()
          .filter((n) => n.style("display") !== "none").length;
        onVisibleCountsChange({ visibleNodes, totalNodes: graph.nodes.length });
      }
      return;
    }

    // Compute focused subgraph (node IDs to keep)
    const focusSubgraph = calculateFocusSubgraph(graph, focusState); // uses full graph
    // Intersection with filtered set (if any)
    const allowedIds = new Set<string>();
    const focusIds = new Set(focusSubgraph.nodes.map((n) => n.id));
    if (filteredIdsRef.current) {
      filteredIdsRef.current.forEach((id) => {
        if (focusIds.has(id)) allowedIds.add(id);
      });
    } else {
      focusIds.forEach((id) => allowedIds.add(id));
    }

    // Always hide non-focused nodes for clarity
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const id = n.id();
        const inFocus = allowedIds.has(id);
        const desired = inFocus ? "element" : "none";
        if (n.style("display") !== desired) n.style("display", desired);
        if (!inFocus) n.removeClass("dimmed");
      });
      cy.edges().forEach((e) => {
        const src = e.data("source");
        const tgt = e.data("target");
        const visible = allowedIds.has(src) && allowedIds.has(tgt);
        const desired = visible ? "element" : "none";
        if (e.style("display") !== desired) e.style("display", desired);
        if (!visible) e.removeClass("dimmed");
      });
    });

    // Report counts post focus
    if (onVisibleCountsChange) {
      const visibleNodes = cy
        .nodes()
        .filter((n) => n.style("display") !== "none").length;
      onVisibleCountsChange({ visibleNodes, totalNodes: graph.nodes.length });
    }

    console.log("[GraphCanvas] Incremental focus applied:", {
      visibleAfterFocus: allowedIds.size,
      total: graph.nodes.length,
      depth: focusState.depth,
      selected: focusState.selectedNode,
    });
  }, [focusState, graph]);

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
      cy.nodes(".active-node").removeClass("active-node");
      if (!fileId) return; // clear only
      const node = cy.getElementById(fileId);
      if (!node || node.empty()) return;
      node.addClass("active-node");
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
      const outOfView =
        pos.x < thresholdX1 ||
        pos.x > thresholdX2 ||
        pos.y < thresholdY1 ||
        pos.y > thresholdY2;
      if (outOfView) {
        // Cancel in-flight animations to prevent queue build-up (FR8)
        cy.stop(true);
        const nodeCount = cy.nodes().length;
        const heuristicZoom = computeTargetZoom(nodeCount);
        const targetZoom = Math.min(
          AUTO_PAN_MAX_ZOOM,
          Math.max(AUTO_PAN_MIN_ZOOM, heuristicZoom)
        );
        const currentZoom = cy.zoom();
        const animateOptions: any = {
          center: { eles: node },
          duration: AUTO_PAN_ANIMATION_MS,
        };
        if (Math.abs(currentZoom - targetZoom) > 0.05) {
          animateOptions.zoom = targetZoom;
        }
        cy.animate(animateOptions);
        console.log(
          `Auto-pan (FR8) center=${fileId} zoom=${animateOptions.zoom ?? "same"
          } duration=${AUTO_PAN_ANIMATION_MS}ms`
        );
      }
    } catch (e) {
      console.warn("Auto-pan failed", e);
    }
  }, [activeHighlight]);

  // Task 10.3: Warn if highlight messages arrive before Cytoscape initialized
  useEffect(() => {
    if (activeHighlight && !cyRef.current) {
      console.warn(
        "[GraphCanvas] Highlight received before Cytoscape ready (FR18 resilience)"
      );
    }
  }, [activeHighlight]);

  /**
   * Apply heatmap overlay using optimized processor with batching and viewport culling
   * @param heatmapNodes Array of heatmap node data
   */
  const applyHeatmapOverlay = async (heatmapNodes: HeatmapNode[]) => {
    try {
      if (!cyRef.current) {
        showError(
          "Heatmap Error",
          "Graph not initialized. Please refresh the page."
        );
        console.warn(
          "[GraphCanvas] Cannot apply heatmap - Cytoscape not initialized"
        );
        return;
      }

      if (!heatmapNodes || heatmapNodes.length === 0) {
        showWarning(
          "No Heatmap Data",
          "No risk analysis data available for visualization."
        );
        console.warn(
          "[GraphCanvas] Cannot apply heatmap - No heatmap data provided"
        );
        return;
      }

      if (!heatmapProcessor.current) {
        showError(
          "Heatmap Error",
          "Heatmap processor not available. Please try refreshing."
        );
        console.warn("[GraphCanvas] Heatmap processor not initialized");
        return;
      }

      const startTime = performanceMonitor.current.startRender();

      // Show loading notification for large datasets
      if (heatmapNodes.length > 100) {
        showInfo(
          "Processing Heatmap",
          `Applying risk visualization to ${heatmapNodes.length} nodes...`
        );
      }

      // Store original styles for restoration
      const originalStyles = new Map<string, any>();
      heatmapNodes.forEach((heatmapNode) => {
        try {
          if (!heatmapNode?.nodeId) return;

          const node = cyRef.current!.getElementById(heatmapNode.nodeId);
          if (!node.empty()) {
            originalStyles.set(heatmapNode.nodeId, {
              backgroundColor: node.style("background-color"),
              borderColor: node.style("border-color"),
              borderWidth: node.style("border-width"),
            });
          }
        } catch (error) {
          console.warn(
            `[GraphCanvas] Error storing original style for node ${heatmapNode?.nodeId}:`,
            error
          );
        }
      });

      // Update state to show processing
      debouncedSetState((prev) => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          isProcessing: true,
          processingProgress: 0,
          originalStyles,
        },
      }));

      // Process heatmap data with optimizations
      const result = await heatmapProcessor.current.processHeatmapData(
        heatmapNodes
      );

      // Update final state
      debouncedSetState((prev) => ({
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
            averageRenderTime:
              performanceMonitor.current.getMetrics().averageRenderTime,
            cacheHitRate: result.cacheHitRate,
          },
        },
      }));

      onHeatmapStateChange?.(true);

      const totalTime = performanceMonitor.current.endRender(startTime);
      trackRenderPerformance(totalTime, "heatmap-overlay");

      // Report performance metrics to parent component
      onPerformanceUpdate?.({
        renderTime: totalTime,
        layoutTime: 0, // Heatmap is not a layout operation
      });

      // Show success notification
      showSuccess(
        "Heatmap Applied",
        `Risk visualization applied to ${result.visibleCount
        } nodes in ${totalTime.toFixed(0)}ms`,
        { duration: 3000 }
      );

      console.log(
        `[GraphCanvas] Applied optimized heatmap overlay: ${result.visibleCount
        } visible, ${result.hiddenCount} hidden nodes, ${(
          result.cacheHitRate * 100
        ).toFixed(1)}% cache hit rate in ${totalTime.toFixed(2)}ms`
      );
    } catch (error) {
      console.error(
        "[GraphCanvas] Critical error applying heatmap overlay:",
        error
      );

      // Show error notification with retry option
      showError(
        "Heatmap Failed",
        "Failed to apply risk visualization. Click to retry.",
        {
          duration: 8000,
          action: {
            label: "Retry",
            onClick: () => applyHeatmapOverlay(heatmapNodes),
          },
        }
      );

      // Graceful degradation: clear any partial state and notify
      try {
        clearHeatmapOverlay();
      } catch (clearError) {
        console.error(
          "[GraphCanvas] Error during heatmap cleanup:",
          clearError
        );
      }

      // Update state to show error
      debouncedSetState((prev) => ({
        ...prev,
        heatmapState: {
          ...prev.heatmapState,
          isProcessing: false,
          processingProgress: 0,
        },
      }));

      if (onError) {
        onError("Failed to apply heatmap overlay due to an unexpected error.");
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
          debouncedSetState((prev) => ({
            ...prev,
            heatmapState: {
              isActive: false,
              nodes: [],
              originalStyles: new Map(),
              isProcessing: false,
              processingProgress: 0,
              performanceMetrics: undefined,
            },
          }));

          onHeatmapStateChange?.(false);

          const totalTime = performanceMonitor.current.endRender(startTime);
          trackRenderPerformance(totalTime, "heatmap-clear");

          // Show success notification
          showInfo(
            "Heatmap Cleared",
            "Risk visualization has been removed from the graph."
          );

          console.log(
            `[GraphCanvas] Cleared heatmap overlay in ${totalTime.toFixed(2)}ms`
          );
          return;
        }

        // Process current batch
        for (let i = startIdx; i < endIdx; i++) {
          const [nodeId, originalStyle] = restoreBatch[i];
          try {
            const node = cy.getElementById(nodeId);
            if (!node.empty()) {
              // Clear risk data and heatmap class
              node.removeData("riskData");
              node.removeClass("heatmap-node");

              // Animate back to original styles with staggered timing
              const animationDelay = (i - startIdx) * 2; // 2ms stagger

              setTimeout(() => {
                if (cy && !cy.destroyed()) {
                  node.animate(
                    {
                      style: {
                        "background-color": originalStyle.backgroundColor,
                        "border-color": originalStyle.borderColor,
                        "border-width": originalStyle.borderWidth,
                        "z-index": 1,
                      },
                    },
                    {
                      duration: 200, // Faster clear animation
                      easing: "ease-out",
                    }
                  );
                }
              }, animationDelay);
            }
          } catch (error) {
            console.warn(
              `[GraphCanvas] Error clearing style for node ${nodeId}:`,
              error
            );
          }
        }

        // Schedule next batch
        requestAnimationFrame(() => processClearBatch(batchIndex + 1));
      };

      // Start batch processing
      processClearBatch(0);
    } catch (error) {
      console.error("[GraphCanvas] Error clearing heatmap overlay:", error);

      // Fallback: immediate state update
      debouncedSetState((prev) => ({
        ...prev,
        heatmapState: {
          isActive: false,
          nodes: [],
          originalStyles: new Map(),
          isProcessing: false,
          processingProgress: 0,
        },
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
      const debouncedApply = enhancedDebounce(
        () => {
          applyHeatmapOverlay(heatmapData);
        },
        150,
        false
      );

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

    const showTooltip = (
      node: cytoscape.NodeSingular,
      event: cytoscape.EventObject
    ) => {
      const riskData = node.data("riskData") as HeatmapNode | undefined;
      const label = node.data("label") || "Unknown";
      const path = node.data("path") || "";

      // Create rich tooltip data
      const tooltipData: TooltipData = {
        title: label,
        path: path || undefined,
        riskData: riskData
          ? {
            score: riskData.score,
            category: riskData.metrics.category,
            complexity: riskData.metrics.complexity,
            churn: riskData.metrics.churn,
            dependencies: riskData.metrics.dependencies,
            dependents: riskData.metrics.dependencies * 0.7, // Estimated dependents
            recommendation: getRecommendationForRisk(riskData),
          }
          : undefined,
        basicInfo: !riskData
          ? {
            type: getFileType(path),
            size: node.data("size"),
            lastModified: node.data("lastModified"),
          }
          : undefined,
      };

      // Get cursor position
      const originalEvent = event.originalEvent as MouseEvent;
      const position = {
        x: originalEvent?.clientX || 0,
        y: originalEvent?.clientY || 0,
      };

      console.log(
        "[GraphCanvas] Setting tooltip state with position:",
        position,
        "data:",
        tooltipData
      );
      setState((prev) => ({
        ...prev,
        tooltip: {
          visible: true,
          data: tooltipData,
          position,
        },
      }));
    };

    const hideTooltip = () => {
      clearTimeout(tooltipTimeout);
      setState((prev) => ({
        ...prev,
        tooltip: {
          visible: false,
          data: null,
          position: { x: 0, y: 0 },
        },
      }));
    };

    // Add hover event listeners with direct timeout approach
    cy.on("mouseover", "node", (event) => {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        showTooltip(event.target, event);
      }, TOOLTIP_HOVER_DELAY_MS);
    });

    cy.on("mouseout", "node", () => {
      hideTooltip();
    });

    // Hide tooltip on graph interaction
    cy.on("pan zoom", () => {
      hideTooltip();
    });

    // Cleanup on unmount
    return () => {
      clearTimeout(tooltipTimeout);
    };
  }, [state.cytoscapeInstance]); // Re-run when Cytoscape instance changes

  // Helper functions for tooltip data
  const getRecommendationForRisk = (
    riskData: HeatmapNode
  ): string | undefined => {
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
    if (!path) return "Unknown";
    const ext = path.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "ts":
        return "TypeScript";
      case "tsx":
        return "TypeScript React";
      case "js":
        return "JavaScript";
      case "jsx":
        return "JavaScript React";
      case "py":
        return "Python";
      case "java":
        return "Java";
      case "cpp":
      case "cc":
      case "cxx":
        return "C++";
      case "c":
        return "C";
      case "cs":
        return "C#";
      case "go":
        return "Go";
      case "rs":
        return "Rust";
      case "php":
        return "PHP";
      case "rb":
        return "Ruby";
      case "swift":
        return "Swift";
      case "kt":
        return "Kotlin";
      case "scala":
        return "Scala";
      case "html":
        return "HTML";
      case "css":
        return "CSS";
      case "scss":
      case "sass":
        return "Sass";
      case "json":
        return "JSON";
      case "xml":
        return "XML";
      case "yaml":
      case "yml":
        return "YAML";
      case "md":
        return "Markdown";
      default:
        return "File";
    }
  };

  /**
   * Get file type color based on extension using existing path utils
   * Task 2.1: File type color mapping for visual differentiation
   * Task 9.2: Enhanced error handling for file extension detection
   */
  const getFileTypeColor = (filePath: string): string => {
    try {
      // Task 9.2: Input validation
      if (!filePath || typeof filePath !== "string") {
        console.warn(
          "[FileType] Invalid file path provided, using default color"
        );
        return "var(--vscode-charts-blue)"; // Safe default
      }

      // Task 9.2: Safe file extension detection with fallback
      let fileInfo;
      try {
        fileInfo = getFileExtensionInfo(filePath);
      } catch (error) {
        console.warn("[FileType] Error in file extension detection:", error);
        // Fallback: try to extract extension manually
        const lastDot = filePath.lastIndexOf(".");
        const extension =
          lastDot > 0 ? filePath.substring(lastDot + 1).toLowerCase() : "";
        fileInfo = {
          type: "unknown" as const,
          extension: extension,
          isSource: false,
          isConfig: false,
          isAsset: false,
          isDocumentation: false,
        };
      }

      // Task 9.2: Validate fileInfo structure
      if (!fileInfo || typeof fileInfo !== "object") {
        console.warn(
          "[FileType] Invalid file info structure, using default color"
        );
        return "var(--vscode-charts-blue)";
      }

      // Check for test files first (higher priority)
      if (
        filePath.includes(".test.") ||
        filePath.includes(".spec.") ||
        filePath.includes("/test/") ||
        filePath.includes("__tests__")
      ) {
        return "#4caf50"; // Green for test files
      }

      switch (fileInfo.type) {
        case "source":
          switch (fileInfo.extension) {
            case "ts":
            case "tsx":
              return "#3178c6"; // TypeScript blue
            case "js":
            case "jsx":
              return "#f7df1e"; // JavaScript yellow
            default:
              return "#3178c6"; // Default to TypeScript blue for other source files
          }
        case "config":
          return "#6B46C1"; // Purple for config files
        case "asset":
          switch (fileInfo.extension) {
            case "css":
            case "scss":
            case "sass":
            case "less":
              return "#ff9800"; // Orange for CSS
            case "html":
            case "htm":
              return "#e91e63"; // Pink for HTML
            default:
              return "#9e9e9e"; // Gray for other assets
          }
        case "documentation":
          return "#9e9e9e"; // Gray for documentation
        default:
          // Task 9.2: Safe fallback for unknown file types
          return "#9e9e9e"; // Gray for unknown files
      }
    } catch (error) {
      // Task 9.2: Comprehensive error handling for file type detection
      console.error("[FileType] Error in getFileTypeColor:", error);
      console.log("[FileType] Falling back to default blue color");
      return "var(--vscode-charts-blue)"; // Safe default fallback
    }
  };

  // Handle search highlighting when searchQuery prop changes
  useEffect(() => {
    if (!cyRef.current) return;

    // Task 8.1: Performance monitoring for search operations
    const searchStartTime = performance.now();
    const nodeCount = cyRef.current.nodes().length;

    const query = searchQuery?.trim() || "";
    const previousQuery = state.searchQuery || "";
    const isNewSearch = query !== previousQuery && query.length > 0;

    setState((prev) => ({ ...prev, searchQuery: query }));

    if (!query) {
      // Clear highlighting when search is empty using batch operation
      cyRef.current.batch(() => {
        cyRef.current!.elements().removeClass("highlighted dimmed");
        // Reset opacity to default values
        cyRef.current!.elements().removeStyle("opacity");
      });
      setState((prev) => ({ ...prev, highlightedNodes: [] }));
      onSearchResultsChange?.(0);

      // Task 8.1: Log performance metrics for search clear operation
      const clearTime = performance.now() - searchStartTime;
      if (nodeCount >= 500) {
        console.log(
          `[PERF] Search clear - Nodes: ${nodeCount}, Time: ${clearTime.toFixed(
            2
          )}ms`
        );
      }
      return;
    }

    const searchLower = query.toLowerCase();
    const matchingNodes: string[] = [];

    // Task 8.1: Optimize search for large graphs with performance monitoring
    const searchOperationStart = performance.now();

    // Find matching nodes with optimized search for large graphs
    if (nodeCount >= 500) {
      // Use optimized search for large graphs - process in smaller batches
      const nodes = cyRef.current.nodes();
      const batchSize = Math.min(100, Math.floor(nodeCount / 5));

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        batch.forEach((node) => {
          const label = node.data("label")?.toLowerCase() || "";
          const path = node.data("path")?.toLowerCase() || "";

          if (label.includes(searchLower) || path.includes(searchLower)) {
            matchingNodes.push(node.id());
          }
        });
      }
    } else {
      // Standard search for smaller graphs
      cyRef.current.nodes().forEach((node) => {
        const label = node.data("label")?.toLowerCase() || "";
        const path = node.data("path")?.toLowerCase() || "";

        if (label.includes(searchLower) || path.includes(searchLower)) {
          matchingNodes.push(node.id());
        }
      });
    }

    const searchTime = performance.now() - searchOperationStart;

    // Apply highlighting using batch operation for atomic updates
    const batchStartTime = performance.now();
    cyRef.current.batch(() => {
      // First, clear all existing classes and reset opacity
      cyRef.current!.elements().removeClass("highlighted dimmed");
      cyRef.current!.elements().removeStyle("opacity");

      if (matchingNodes.length > 0) {
        // Highlight matching nodes
        matchingNodes.forEach((nodeId) => {
          const node = cyRef.current?.getElementById(nodeId);
          if (node && !node.empty()) {
            node.addClass("highlighted");
            // Ensure highlighted nodes have full opacity
            node.style("opacity", 1.0);
          }
        });

        // Dim non-matching elements (both nodes and edges)
        const nonMatchingElements = cyRef
          .current!.elements()
          .not(".highlighted");
        nonMatchingElements.addClass("dimmed");
        // Apply dimmed opacity directly to ensure it overrides other styles
        nonMatchingElements.style("opacity", 0.3);
      }
    });

    const batchTime = performance.now() - batchStartTime;
    const totalSearchTime = performance.now() - searchStartTime;

    // Task 8.1: Log performance metrics for search operations on large graphs
    if (nodeCount >= 500) {
      console.log(
        `[PERF] Search operation - Nodes: ${nodeCount}, Matches: ${matchingNodes.length}`
      );
      console.log(
        `[PERF] Search timing - Find: ${searchTime.toFixed(
          2
        )}ms, Batch: ${batchTime.toFixed(
          2
        )}ms, Total: ${totalSearchTime.toFixed(2)}ms`
      );

      // Warn if search is taking too long (should be under 100ms for good UX)
      if (totalSearchTime > 100) {
        console.warn(
          `[PERF] Search performance warning: ${totalSearchTime.toFixed(
            2
          )}ms exceeds 100ms target`
        );
      }
    }

    // Only animate focus for new searches to preserve viewport stability
    if (isNewSearch && matchingNodes.length > 0) {
      const firstMatchNode = cyRef.current.getElementById(matchingNodes[0]);
      if (!firstMatchNode.empty()) {
        const currentZoom = cyRef.current.zoom();
        cyRef.current.animate({
          center: { eles: firstMatchNode },
          zoom: currentZoom, // Maintain current zoom level
          duration: LAYOUT_ANIMATION_MS,
        });
      }
    }

    setState((prev) => ({ ...prev, highlightedNodes: matchingNodes }));
    onSearchResultsChange?.(matchingNodes.length);
  }, [searchQuery, onSearchResultsChange]);

  // Handle focus mode visual styling
  useEffect(() => {
    if (!cyRef.current) return;

    // Clear any existing focus styling
    cyRef.current.elements().removeClass("focus-center keyboard-navigated");
    cyRef.current
      .elements()
      .removeStyle("border-width border-color border-style");

    // Apply focus center styling if focus mode is enabled
    if (focusState?.enabled && focusState.selectedNode) {
      const focusNode = cyRef.current.getElementById(focusState.selectedNode);
      if (focusNode && !focusNode.empty()) {
        focusNode.addClass("focus-center");
        focusNode.style({
          "border-width": "4px",
          "border-color": "#007acc", // VS Code blue
          "border-style": "solid",
        });
      }
    }

    // Apply keyboard navigation highlighting (different from focus center)
    if (
      focusState?.enabled &&
      focusState.keyboardNavigatedNode &&
      focusState.keyboardNavigatedNode !== focusState.selectedNode
    ) {
      const keyboardNode = cyRef.current.getElementById(
        focusState.keyboardNavigatedNode
      );
      if (keyboardNode && !keyboardNode.empty()) {
        keyboardNode.addClass("keyboard-navigated");
        keyboardNode.style({
          "border-width": "2px",
          "border-color": "#ffcc00", // Yellow for keyboard navigation
          "border-style": "dashed",
        });
      }
    }
  }, [focusState]);

  // Task 5.4: Handle search focus cycling with animation
  useEffect(() => {
    if (
      !cyRef.current ||
      !searchQuery ||
      searchFocusIndex < 0 ||
      state.highlightedNodes.length === 0
    ) {
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
      duration: AUTO_PAN_ANIMATION_MS, // Use the 400ms constant
    });

    console.log(
      `[GraphCanvas] Focused on search result ${searchFocusIndex + 1}/${state.highlightedNodes.length
      }: ${targetNodeId}`
    );
  }, [searchFocusIndex, searchQuery, state.highlightedNodes]);

  // Handle layout changes (Task 3.5: Layout change logic with animation)
  // Task 6.4: Enhanced state management for layout changes
  useEffect(() => {
    if (!cyRef.current || !graph || state.isLoading) return;

    // Skip the initial layout setup - only handle user-initiated layout changes
    if (!hasInitialLayoutRef.current) {
      hasInitialLayoutRef.current = true;
      return;
    }

    // Task 8.3: Memory usage monitoring before layout change
    const memoryBefore = (performance as any).memory
      ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      }
      : null;

    // Task 8.4: Use existing performance monitoring infrastructure
    const performanceMonitor = new PerformanceMonitor();
    const startTime = performanceMonitor.startRender();
    const cy = cyRef.current;
    const cytoscapeLayoutName = getCytoscapeLayoutName(currentLayout);
    const layoutConfig = getLayoutConfig(
      cytoscapeLayoutName,
      graph.nodes.length
    );

    // Task 6.4: Update layout state when change starts
    setState((prev) => ({
      ...prev,
      layoutState: {
        ...prev.layoutState,
        currentLayout: currentLayout as LayoutType,
        isChanging: true,
        lastChanged: new Date().toISOString(),
        history: [
          ...(prev.layoutState.history || []),
          currentLayout as LayoutType,
        ].slice(-10), // Keep last 10
      },
    }));

    // Notify parent that layout change is starting
    onLayoutChange?.(true);

    // Apply the new layout
    const layout = cy.layout(layoutConfig);

    const handleLayoutStop = () => {
      // Task 8.4: End performance monitoring using existing infrastructure
      const duration = performanceMonitor.endRender(startTime);

      // Report performance metrics to parent component
      onPerformanceUpdate?.({
        renderTime: duration,
        layoutTime: duration,
      });

      // Task 8.2: Enhanced performance monitoring for layout switching
      const nodeCount = graph.nodes.length;
      console.log(
        `[PERF] Layout switch - Algorithm: ${currentLayout}, Nodes: ${nodeCount}, Duration: ${duration.toFixed(
          2
        )}ms`
      );

      // Task 8.3: Memory usage monitoring after layout change
      const memoryAfter = (performance as any).memory
        ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        }
        : null;

      if (memoryBefore && memoryAfter) {
        const memoryDelta =
          memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize;
        const memoryMB = (memoryDelta / 1024 / 1024).toFixed(2);
        console.log(
          `[PERF] Layout memory usage - Delta: ${memoryMB}MB, Total: ${(
            memoryAfter.usedJSHeapSize /
            1024 /
            1024
          ).toFixed(2)}MB`
        );

        // Task 8.3: Memory leak detection
        if (memoryDelta > 10 * 1024 * 1024) {
          // > 10MB increase
          console.warn(
            `[PERF] Potential memory leak detected - Layout change increased memory by ${memoryMB}MB`
          );
        }
      }

      // Task 8.2: Performance validation - warn if layout takes too long
      if (nodeCount <= 500 && duration > 1000) {
        console.warn(
          `[PERF] Layout performance warning: ${duration.toFixed(
            2
          )}ms exceeds 1000ms target for ${nodeCount} nodes`
        );
      }

      // Task 8.2: Performance recommendations for large graphs
      if (nodeCount > 500) {
        console.log(
          `[PERF] Large graph detected (${nodeCount} nodes) - layout time: ${duration.toFixed(
            2
          )}ms`
        );
        if (duration > 2000) {
          console.warn(
            `[PERF] Consider using simplified layouts for graphs with ${nodeCount}+ nodes`
          );
        }
      }

      // Task 6.4: Update layout state when change completes
      setState((prev) => {
        // Task 8.2: Track performance trends
        const avgDuration =
          prev.layoutState.performanceMetrics?.averageDuration || duration;
        if (duration > avgDuration * 1.5) {
          console.warn(
            `[PERF] Layout performance degradation detected: ${duration.toFixed(
              2
            )}ms vs ${avgDuration.toFixed(2)}ms average`
          );
        }

        return {
          ...prev,
          layoutState: {
            ...prev.layoutState,
            isChanging: false,
            performanceMetrics: {
              lastChangeDuration: duration,
              averageDuration: prev.layoutState.performanceMetrics
                ?.averageDuration
                ? (prev.layoutState.performanceMetrics.averageDuration +
                  duration) /
                2
                : duration,
              totalChanges:
                (prev.layoutState.performanceMetrics?.totalChanges || 0) + 1,
            },
          },
        };
      });

      // Notify parent that layout change is complete
      onLayoutChange?.(false);

      console.log(
        `[GraphCanvas] Layout change to ${currentLayout} completed in ${duration.toFixed(
          2
        )}ms`
      );
    };

    layout.on("layoutstop", handleLayoutStop);
    layout.run();

    // Cleanup function to remove event listeners
    return () => {
      try {
        layout.off("layoutstop", handleLayoutStop);
      } catch (e) {
        // Layout might already be destroyed
      }
    };
  }, [currentLayout, graph, onLayoutChange, state.isLoading]);

  // Task 8.3: Component cleanup and memory validation on disposal
  useEffect(() => {
    return () => {
      // Task 8.3: Memory cleanup monitoring
      const memoryAtCleanup = (performance as any).memory
        ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        }
        : null;

      if (memoryAtCleanup) {
        console.log(
          `[PERF] Component cleanup - Memory at disposal: ${(
            memoryAtCleanup.usedJSHeapSize /
            1024 /
            1024
          ).toFixed(2)}MB`
        );
      }

      // Task 8.3: Cytoscape cleanup
      if (cyRef.current) {
        try {
          console.log(
            `[PERF] Cleaning up Cytoscape instance with ${cyRef.current.elements().length
            } elements`
          );
          cyRef.current.destroy();
        } catch (e) {
          console.warn("[PERF] Error during Cytoscape cleanup:", e);
        }
      }

      // Task 8.3: Heatmap processor cleanup
      if (heatmapProcessor.current) {
        try {
          // Clean up any cached data
          console.log("[PERF] Cleaning up heatmap processor");
        } catch (e) {
          console.warn("[PERF] Error during heatmap processor cleanup:", e);
        }
      }
    };
  }, []);

  if (!graph) {
    return (
      <div
        style={{
          width: "100%",
          height: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--vscode-panel-border)",
          color: "var(--vscode-descriptionForeground)",
        }}
      >
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
            transition: "opacity 0.3s ease",
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

        {/* Impact Animation Handler */}
        <ImpactAnimationHandler
          cy={cyRef.current}
          onAnimationEvent={handleAnimationEvent}
          enabled={true}
        />
      </div>
    </>
  );
}