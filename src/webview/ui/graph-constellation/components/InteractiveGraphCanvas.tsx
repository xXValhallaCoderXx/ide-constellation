import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { useRef } from "preact/hooks";
import { IConstellationGraph } from "@/types/graph.types";
import {
  LayoutType,
  DEFAULT_LAYOUT_TYPE,
  LAYOUT_STORAGE_KEY,
} from "@/types/layout.types";
import { GraphCanvas, HeatmapNode } from "./GraphCanvas";
import { SearchBox } from "./SearchBox";
import { HeatmapLegend } from "./HeatmapLegend";
import { LayoutSwitcher } from "./LayoutSwitcher";
import { FilterDropdown, FilterState } from "./FilterDropdown";
import { StatsOverlay, GraphStats } from "./StatsOverlay";
import { GraphErrorBoundary } from "./ErrorBoundary"; // Task 9.3: Error boundary import
import { PerformanceMonitor } from "@/utils/performance.utils";
import "@/types/vscode-api.types";

interface ActiveHighlightState {
  fileId: string | null;
  reason?: string;
}

interface FocusState {
  enabled: boolean;
  selectedNode: string | null;
  depth: number;
  showDependencies: boolean;
  showDependents: boolean;
  keyboardNavigatedNode?: string | null; // For keyboard navigation highlighting
}

interface InteractiveGraphCanvasProps {
  graph: IConstellationGraph | null;
  onNodeClick?: (
    nodeId: string,
    openMode: "default" | "split",
    event?: { ctrlKey?: boolean; metaKey?: boolean; detail?: number }
  ) => void;
  onError?: (error: string) => void;
  activeHighlight?: ActiveHighlightState; // FR6/FR11 placeholder
}

interface HeatmapState {
  isVisible: boolean;
  isActive: boolean;
  data: HeatmapNode[];
  distribution?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  totalFiles?: number;
}

type OpenModeSetting = "modifier" | "default" | "split";

export function InteractiveGraphCanvas({
  graph,
  onNodeClick,
  onError,
  activeHighlight,
}: InteractiveGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState("");
  // Track whether focus mode was auto-enabled due to a single search result so we can safely auto-disable only that case
  const autoFocusEnabledRef = useRef(false);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [currentFocusIndex, setCurrentFocusIndex] = useState(-1); // Task 5.3: Focus cycling state
  const [openModeSetting, setOpenModeSetting] =
    useState<OpenModeSetting>("modifier");
  const [currentLayout, setCurrentLayout] =
    useState<LayoutType>(DEFAULT_LAYOUT_TYPE); // Task 6.3: Use LayoutType
  const [isLayoutChanging, setIsLayoutChanging] = useState(false);

  // Create performance monitor instance
  const [performanceMonitor] = useState(() => new PerformanceMonitor());

  // Use ref to track current focus state for keyboard handlers
  const focusStateRef = useRef<FocusState>({
    enabled: false,
    selectedNode: null,
    depth: 2,
    showDependencies: true,
    showDependents: true,
    keyboardNavigatedNode: null,
  });

  const [filterState, setFilterState] = useState<FilterState>({
    fileTypes: [],
    complexity: "all",
    riskLevel: "all",
    dependencies: "all",
    nodeCount: 500,
  });
  const [focusState, setFocusState] = useState<FocusState>({
    enabled: false,
    selectedNode: null,
    depth: 2,
    showDependencies: true,
    showDependents: true,
    keyboardNavigatedNode: null,
  });

  // Keep ref in sync with state
  useEffect(() => {
    focusStateRef.current = focusState;
  }, [focusState]);
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    isVisible: false,
    isActive: false,
    data: [],
    distribution: undefined,
    totalFiles: 0,
  });

  // Statistics state
  const [statsVisible, setStatsVisible] = useState(false);
  const [graphStats, setGraphStats] = useState<GraphStats>({
    totalNodes: 0,
    totalEdges: 0,
    visibleNodes: 0,
    visibleEdges: 0,
    filteredNodes: 0,
    filteredEdges: 0,
    selectedNodes: 0,
    focusedNodes: 0,
    averageConnections: 0,
    maxConnections: 0,
    isolatedNodes: 0,
    clusters: 0,
    nodeSizeDistribution: { small: 0, medium: 0, large: 0 },
    complexityDistribution: { low: 0, medium: 0, high: 0 },
    performanceMetrics: {
      renderTime: 0,
      layoutTime: 0,
      lastUpdate: Date.now(),
    },
  });

  // Pending focus (race: focus command before graph load)
  const pendingFocusRef = useRef<{ nodeId: string | null; correlationId?: string | null }>({ nodeId: null, correlationId: null });

  // Handle focus application
  const applyFocus = useCallback((targetNodeId: string, correlationId?: string) => {
    if (!graph) {
      // Defer
      pendingFocusRef.current = { nodeId: targetNodeId, correlationId };
      console.log(`[graph:setFocus] correlationId=${correlationId} status=pending target=${targetNodeId}`);
      return;
    }
    const exists = graph.nodes.some(n => n.id === targetNodeId);
    if (!exists) {
      console.warn(`[graph:setFocus] correlationId=${correlationId} status=not_found target=${targetNodeId}`);
      return;
    }
    setFocusState(prev => ({
      ...prev,
      enabled: true,
      selectedNode: targetNodeId,
      depth: 1,
      showDependencies: true,
      showDependents: true
    }));
    console.log(`[graph:setFocus] correlationId=${correlationId} status=applied target=${targetNodeId}`);
  }, [graph]);

  // Listener for graph:setFocus messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.command !== 'graph:setFocus' || !msg.data) return;
      const { targetNodeId, correlationId } = msg.data;
      if (!targetNodeId || typeof targetNodeId !== 'string') return;
      // Overwrite semantics: replace any pending
      if (!graph) {
        const prevPending = pendingFocusRef.current.nodeId;
        pendingFocusRef.current = { nodeId: targetNodeId, correlationId };
        if (prevPending && prevPending !== targetNodeId) {
          console.log(`[graph:setFocus] correlationId=${correlationId} status=overwritten previous=${prevPending} target=${targetNodeId}`);
        }
      }
      applyFocus(targetNodeId, correlationId);
    };
    window.addEventListener('message', handler as EventListener);
    return () => window.removeEventListener('message', handler as EventListener);
  }, [applyFocus, graph]);

  // Apply pending once graph loads
  useEffect(() => {
    if (graph && pendingFocusRef.current.nodeId) {
      const { nodeId, correlationId } = pendingFocusRef.current;
      applyFocus(nodeId!, correlationId || undefined);
      pendingFocusRef.current = { nodeId: null, correlationId: null };
    }
  }, [graph, applyFocus]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Reset focus index when search query changes
    setCurrentFocusIndex(-1);
  };

  const handleSearchResultsChange = (count: number) => {
    setSearchResultCount(count);
    // Reset focus index when result count changes
    setCurrentFocusIndex(-1);

    // Auto-focus functionality: automatically trigger focus mode for single results
    if (count === 1 && searchQuery.trim() && graph) {
      // Find the single matching node
      const searchLower = searchQuery.toLowerCase();
      const matchingNode = graph.nodes.find((node) => {
        const label = node.label?.toLowerCase() || "";
        const path = node.path?.toLowerCase() || "";
        return label.includes(searchLower) || path.includes(searchLower);
      });

      if (matchingNode) {
        console.log(
          "[InteractiveGraphCanvas] Auto-focus triggered for single search result:",
          matchingNode.id
        );
        // Enable focus mode and set the matching node as selected
        setFocusState((prev) => ({
          ...prev,
          enabled: true,
          selectedNode: matchingNode.id,
        }));
        autoFocusEnabledRef.current = true;
      }
    } else if (count === 0 || !searchQuery.trim()) {
      // Clear auto-focus when no results or search is cleared ONLY if we previously auto-enabled it
      if (
        autoFocusEnabledRef.current &&
        focusState.enabled &&
        searchQuery.trim() === ""
      ) {
        console.log(
          "[InteractiveGraphCanvas] Auto-focus cleared - search query empty (reverting auto-enabled focus)"
        );
        setFocusState((prev) => ({
          ...prev,
          enabled: false,
          selectedNode: null,
        }));
        autoFocusEnabledRef.current = false;
      }
    } else {
      // Multiple results – ensure we don't auto-disable later; user controls focus now
      autoFocusEnabledRef.current = false;
    }
    // For multiple results (count > 1), don't auto-trigger focus mode
    // Users can manually enable focus mode if desired
  };

  // Task 5.3: Handle focus cycling through search results
  const handleFocusCycle = (direction: "next" | "previous") => {
    if (searchResultCount === 0) return;

    let newIndex: number;
    if (currentFocusIndex === -1) {
      // First time focusing, start at 0
      newIndex = 0;
    } else {
      // Cycle through results
      if (direction === "next") {
        newIndex = (currentFocusIndex + 1) % searchResultCount;
      } else {
        newIndex =
          currentFocusIndex === 0
            ? searchResultCount - 1
            : currentFocusIndex - 1;
      }
    }

    setCurrentFocusIndex(newIndex);

    // If focus mode is enabled, integrate with focus node selection
    if (focusState.enabled && graph && searchQuery.trim()) {
      // Find the matching nodes and select the one at newIndex
      const searchLower = searchQuery.toLowerCase();
      const matchingNodes = graph.nodes.filter((node) => {
        const label = node.label?.toLowerCase() || "";
        const path = node.path?.toLowerCase() || "";
        return label.includes(searchLower) || path.includes(searchLower);
      });

      if (matchingNodes[newIndex]) {
        const selectedNode = matchingNodes[newIndex].id;
        console.log(
          `[InteractiveGraphCanvas] Focus cycling: selecting node ${
            newIndex + 1
          }/${matchingNodes.length}: ${selectedNode}`
        );
        setFocusState((prev) => ({
          ...prev,
          selectedNode,
        }));
      }
    }

    // Trigger focus animation on the graph canvas
    // This will be handled by the GraphCanvas component via searchFocusIndex prop
  };

  const handleFilterChange = useCallback((filters: FilterState) => {
    setFilterState(filters);
    console.log("[InteractiveGraphCanvas] Filter state updated:", filters);
  }, []);

  const handleFocusModeToggle = useCallback(() => {
    setFocusState((prev) => {
      const nextEnabled = !prev.enabled;
      // Manual toggle invalidates any auto-focus tracking
      if (!nextEnabled) {
        autoFocusEnabledRef.current = false;
      }
      console.log(
        "[InteractiveGraphCanvas] Focus mode toggled (manual):",
        nextEnabled
      );
      return {
        ...prev,
        enabled: nextEnabled,
        selectedNode: null, // Reset selection when toggling
      };
    });
  }, []);

  const handleFocusNodeSelect = useCallback((nodeId: string | null) => {
    setFocusState((prev) => ({
      ...prev,
      selectedNode: nodeId,
    }));
    console.log("[InteractiveGraphCanvas] Focus node selected:", nodeId);
  }, []);

  const handleFocusDepthChange = useCallback((depth: number) => {
    setFocusState((prev) => ({
      ...prev,
      depth,
    }));
  }, []);

  const handleFocusDependenciesToggle = useCallback(() => {
    setFocusState((prev) => ({
      ...prev,
      showDependencies: !prev.showDependencies,
    }));
  }, []);

  const handleFocusDependentsToggle = useCallback(() => {
    setFocusState((prev) => ({
      ...prev,
      showDependents: !prev.showDependents,
    }));
  }, []);

  const handleNodeClick = useCallback(
    (
      nodeId: string,
      computedOpenMode: "default" | "split",
      event?: { ctrlKey?: boolean; metaKey?: boolean; detail?: number }
    ) => {
      // Enhanced UX: Prioritize focus mode when enabled
      const isForceOpen =
        event?.ctrlKey ||
        event?.metaKey ||
        (event?.detail && event.detail >= 2); // Ctrl/Cmd+click or double-click

      if (focusState.enabled && !isForceOpen) {
        // Focus mode is enabled and it's a regular click - set as focus center instead of opening file
        console.log(
          "[InteractiveGraphCanvas] Setting focus center via node click (focus mode active):",
          nodeId
        );
        handleFocusNodeSelect(nodeId);

        return; // Don't open the file, just focus
      }

      // Traditional file opening behavior (focus mode disabled or force open)
      let finalMode: "default" | "split" = computedOpenMode;
      if (openModeSetting === "default") finalMode = "default";
      else if (openModeSetting === "split") finalMode = "split";

      const reasonText = isForceOpen
        ? event?.detail && event.detail >= 2
          ? "double-click"
          : "Ctrl/Cmd+click"
        : "focus mode disabled";

      console.log("[InteractiveGraphCanvas] Opening file via node click:", {
        nodeId,
        mode: finalMode,
        reason: reasonText,
        focusModeEnabled: focusState.enabled,
      });
      onNodeClick?.(nodeId, finalMode, event);
    },
    [
      focusState.enabled,
      handleFocusNodeSelect,
      openModeSetting,
      graph,
      onNodeClick,
    ]
  );

  const handleLayoutChange = useCallback((layoutId: string) => {
    const layoutType = layoutId as LayoutType; // Task 6.3: Type-safe layout handling
    setCurrentLayout(layoutType);
    // Layout changing state will be managed by GraphCanvas via onLayoutChange callback
    // No need to manually set isLayoutChanging here
  }, []);

  // Handle performance updates from GraphCanvas
  const handlePerformanceUpdate = useCallback(
    (metrics: { renderTime: number; layoutTime: number }) => {
      setGraphStats((prev) => ({
        ...prev,
        performanceMetrics: {
          renderTime: metrics.renderTime,
          layoutTime: metrics.layoutTime,
          lastUpdate: Date.now(),
        },
      }));

      console.log("[InteractiveGraphCanvas] Performance metrics updated:", {
        renderTime: `${metrics.renderTime.toFixed(1)}ms`,
        layoutTime: `${metrics.layoutTime.toFixed(1)}ms`,
        status: metrics.renderTime > 100 ? "slow" : "fast",
      });
    },
    []
  );

  const handleStatsToggle = useCallback(() => {
    setStatsVisible((prev) => {
      const next = !prev;
      console.log("[InteractiveGraphCanvas] Stats visibility toggled:", next);
      return next;
    });
  }, []);

  const calculateGraphStats = (
    allNodes: any[],
    allEdges: any[],
    visibleNodes: any[],
    visibleEdges: any[],
    performanceMetrics?: { renderTime: number; layoutTime: number }
  ): GraphStats => {
    const totalNodes = allNodes.length;
    const totalEdges = allEdges.length;
    const visibleNodeCount = visibleNodes.length;
    const visibleEdgeCount = visibleEdges.length;
    const filteredNodeCount = totalNodes - visibleNodeCount;
    const filteredEdgeCount = totalEdges - visibleEdgeCount;

    // Calculate connection statistics
    const connections = allNodes.map((node) => {
      return allEdges.filter(
        (edge) => edge.source === node.id || edge.target === node.id
      ).length;
    });

    const maxConnections = Math.max(...connections, 0);
    const averageConnections =
      connections.length > 0
        ? connections.reduce((sum, count) => sum + count, 0) /
          connections.length
        : 0;
    const isolatedNodes = connections.filter((count) => count === 0).length;

    // Calculate node size distribution based on our enhanced sizing logic
    const sizeDistribution = { small: 0, medium: 0, large: 0 };
    allNodes.forEach((node) => {
      const connectionCount = connections[allNodes.indexOf(node)] || 0;
      const pathComplexity =
        (node.path?.split("/").length || 1) +
        (node.path?.split(/[.-_]/).length || 1);
      const fileSize = (node.path?.length || 0) + pathComplexity;

      // Composite score (same as calculateNodeSize)
      const connectionScore = Math.min(
        connectionCount / Math.max(maxConnections, 1),
        1
      );
      const complexityScore = Math.min(pathComplexity / 10, 1);
      const sizeScore = Math.min(fileSize / 100, 1);
      const compositeScore =
        connectionScore * 0.5 + complexityScore * 0.3 + sizeScore * 0.2;

      if (compositeScore < 0.33) {
        sizeDistribution.small++;
      } else if (compositeScore < 0.66) {
        sizeDistribution.medium++;
      } else {
        sizeDistribution.large++;
      }
    });

    // Calculate complexity distribution
    const complexityDistribution = { low: 0, medium: 0, high: 0 };
    allNodes.forEach((node) => {
      const pathComplexity =
        (node.path?.split("/").length || 1) +
        (node.path?.split(/[.-_]/).length || 1);

      if (pathComplexity <= 3) {
        complexityDistribution.low++;
      } else if (pathComplexity <= 6) {
        complexityDistribution.medium++;
      } else {
        complexityDistribution.high++;
      }
    });

    // Simple cluster estimation (connected components)
    const visited = new Set<string>();
    let clusters = 0;

    allNodes.forEach((node) => {
      if (!visited.has(node.id)) {
        // Start BFS for this component
        const queue = [node.id];
        visited.add(node.id);
        clusters++;

        while (queue.length > 0) {
          const currentId = queue.shift()!;
          const connectedEdges = allEdges.filter(
            (edge) => edge.source === currentId || edge.target === currentId
          );

          connectedEdges.forEach((edge) => {
            const otherId =
              edge.source === currentId ? edge.target : edge.source;
            if (!visited.has(otherId)) {
              visited.add(otherId);
              queue.push(otherId);
            }
          });
        }
      }
    });

    return {
      totalNodes,
      totalEdges,
      visibleNodes: visibleNodeCount,
      visibleEdges: visibleEdgeCount,
      filteredNodes: filteredNodeCount,
      filteredEdges: filteredEdgeCount,
      selectedNodes: focusState.selectedNode ? 1 : 0,
      focusedNodes:
        focusState.enabled && focusState.selectedNode
          ? Math.min(visibleNodeCount, Math.pow(2, focusState.depth) * 5)
          : 0, // Rough estimate
      averageConnections,
      maxConnections,
      isolatedNodes,
      clusters,
      nodeSizeDistribution: sizeDistribution,
      complexityDistribution,
      performanceMetrics: {
        renderTime: performanceMetrics?.renderTime || 0,
        layoutTime: performanceMetrics?.layoutTime || 0,
        lastUpdate: Date.now(),
      },
    };
  };

  // Task 6.5: Session-based layout persistence
  useEffect(() => {
    // Reset to default layout on component mount (new session)
    const savedLayout = sessionStorage.getItem(LAYOUT_STORAGE_KEY);
    if (
      savedLayout &&
      [
        "force-directed",
        "circle",
        "grid",
        "hierarchical",
        "concentric",
      ].includes(savedLayout)
    ) {
      setCurrentLayout(savedLayout as LayoutType);
      console.log(
        `[InteractiveGraphCanvas] Restored layout from session: ${savedLayout}`
      );
    } else {
      setCurrentLayout(DEFAULT_LAYOUT_TYPE);
      console.log(
        `[InteractiveGraphCanvas] Using default layout: ${DEFAULT_LAYOUT_TYPE}`
      );
    }
  }, []); // Run only on mount

  // Save layout changes to session storage
  useEffect(() => {
    sessionStorage.setItem(LAYOUT_STORAGE_KEY, currentLayout);
    console.log(
      `[InteractiveGraphCanvas] Layout saved to session: ${currentLayout}`
    );
  }, [currentLayout]);

  // Keyboard navigation for focus mode
  useEffect(() => {
    if (!graph) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Use ref to get current focus state to avoid dependency loop
      const currentFocusState = focusStateRef.current;

      // Only handle keyboard events when focus mode is enabled
      if (!currentFocusState.enabled) return;

      // Get all visible nodes for navigation
      const visibleNodes = graph.nodes.map((node) => node.id);

      if (visibleNodes.length === 0) return;

      let newSelectedNode: string | null = null;

      switch (event.key) {
        case "Tab":
          event.preventDefault();
          if (event.shiftKey) {
            // Previous node (Shift+Tab)
            if (currentFocusState.selectedNode) {
              const currentIndex = visibleNodes.indexOf(
                currentFocusState.selectedNode
              );
              const prevIndex =
                currentIndex <= 0 ? visibleNodes.length - 1 : currentIndex - 1;
              newSelectedNode = visibleNodes[prevIndex];
            } else {
              newSelectedNode = visibleNodes[visibleNodes.length - 1];
            }
          } else {
            // Next node (Tab)
            if (currentFocusState.selectedNode) {
              const currentIndex = visibleNodes.indexOf(
                currentFocusState.selectedNode
              );
              const nextIndex = (currentIndex + 1) % visibleNodes.length;
              newSelectedNode = visibleNodes[nextIndex];
            } else {
              newSelectedNode = visibleNodes[0];
            }
          }
          break;

        case "Enter":
          event.preventDefault();
          if (currentFocusState.selectedNode) {
            // Deselect current node
            newSelectedNode = null;
          } else if (visibleNodes.length > 0) {
            // Select first node if none selected
            newSelectedNode = visibleNodes[0];
          }
          break;

        case "Escape":
          event.preventDefault();
          // Exit focus mode
          setFocusState((prev) => ({
            ...prev,
            enabled: false,
            selectedNode: null,
          }));
          break;
      }

      if (newSelectedNode !== undefined) {
        if (newSelectedNode === null) {
          // Deselecting - clear both selected and keyboard navigated
          setFocusState((prev) => ({
            ...prev,
            selectedNode: null,
            keyboardNavigatedNode: null,
          }));
        } else {
          // Set keyboard navigated node and make it selected
          setFocusState((prev) => ({
            ...prev,
            selectedNode: newSelectedNode,
            keyboardNavigatedNode: newSelectedNode,
          }));
        }
      }
    };

    // Add keyboard event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [graph]); // Removed focusState and handleFocusNodeSelect to prevent re-render loop

  // Ensure clean state on mount
  useEffect(() => {
    setIsLayoutChanging(false);
  }, []);

  // Safety timeout to prevent stuck layout changing state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (isLayoutChanging) {
      // If layout change is taking too long, reset the state
      timeoutId = setTimeout(() => {
        console.warn(
          "[InteractiveGraphCanvas] Layout change timeout, resetting state"
        );
        setIsLayoutChanging(false);
      }, 5000); // 5 second timeout
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLayoutChanging]);

  // Listen for heatmap messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.command) {
        case "graph:applyHeatmap":
          const { heatmapData, distribution, totalFiles } = message.data;
          setHeatmapState((prev) => ({
            ...prev,
            isVisible: true,
            isActive: true,
            data: heatmapData,
            distribution,
            totalFiles,
          }));
          break;
        case "graph:clearHeatmap":
          setHeatmapState((prev) => ({
            ...prev,
            isActive: false,
            data: [],
          }));
          break;
        default:
          // Ignore unknown messages
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Calculate graph statistics when graph or state changes (throttled to reduce re-renders)
  useEffect(() => {
    // Throttle statistics calculation to prevent excessive re-renders
    const timeoutId = setTimeout(() => {
      if (!graph) {
        setGraphStats({
          totalNodes: 0,
          totalEdges: 0,
          visibleNodes: 0,
          visibleEdges: 0,
          filteredNodes: 0,
          filteredEdges: 0,
          selectedNodes: 0,
          focusedNodes: 0,
          averageConnections: 0,
          maxConnections: 0,
          isolatedNodes: 0,
          clusters: 0,
          nodeSizeDistribution: { small: 0, medium: 0, large: 0 },
          complexityDistribution: { low: 0, medium: 0, high: 0 },
          performanceMetrics: {
            renderTime: 0,
            layoutTime: 0,
            lastUpdate: Date.now(),
          },
        });
        return;
      }

      const startTime = performanceMonitor.startRender();

      // For now, we'll calculate based on all nodes being visible
      // In the future, this will be updated when filtering is implemented
      const visibleNodes = graph.nodes;
      const visibleEdges = graph.edges;

      const renderTime = performanceMonitor.endRender(startTime);
      const performanceMetrics = performanceMonitor.getMetrics();

      const stats = calculateGraphStats(
        graph.nodes,
        graph.edges,
        visibleNodes,
        visibleEdges,
        {
          renderTime,
          layoutTime: performanceMetrics.averageRenderTime, // Use average as layout time estimate
        }
      );

      setGraphStats(stats);

      console.log("[InteractiveGraphCanvas] Graph statistics updated:", {
        nodes: `${stats.visibleNodes}/${stats.totalNodes}`,
        edges: `${stats.visibleEdges}/${stats.totalEdges}`,
        avgConnections: stats.averageConnections.toFixed(1),
        clusters: stats.clusters,
        renderTime: `${renderTime.toFixed(1)}ms`,
        performanceStatus: performanceMonitor.isPerformanceDegraded()
          ? "degraded"
          : "good",
      });
    }, 100); // Throttle to 100ms

    return () => clearTimeout(timeoutId);
  }, [graph]); // Only depend on graph, not filter/focus state to reduce re-calculations

  const handleToggleHeatmap = useCallback(() => {
    setHeatmapState((prev) => ({
      ...prev,
      isActive: !prev.isActive,
    }));
  }, []);

  const handleCloseLegend = useCallback(() => {
    setHeatmapState((prev) => ({
      ...prev,
      isVisible: false,
      isActive: false,
      data: [],
    }));
  }, []);

  const handleHeatmapStateChange = useCallback((isActive: boolean) => {
    setHeatmapState((prev) => ({
      ...prev,
      isActive,
    }));
  }, []);

  const handleLayoutStateChange = useCallback((isChanging: boolean) => {
    setIsLayoutChanging(isChanging);
    console.log("[InteractiveGraphCanvas] Layout changing state:", isChanging);
  }, []);

  // Focus neighborhood counts (1-hop) for clearer UX labels
  const [focusCounts, setFocusCounts] = useState<{
    deps: number;
    dependents: number;
  } | null>(null);
  useEffect(() => {
    if (!graph || !focusState.selectedNode || !focusState.enabled) {
      setFocusCounts(null);
      return;
    }
    const selected = focusState.selectedNode;
    let deps = 0; // outgoing (selected -> dependency)
    let dependents = 0; // incoming (other -> selected)
    graph.edges.forEach((e) => {
      if (e.source === selected) deps++;
      if (e.target === selected) dependents++;
    });
    setFocusCounts({ deps, dependents });
  }, [graph, focusState.selectedNode, focusState.enabled]);

  // Track latest visible counts from GraphCanvas incremental filtering/focus
  const [visibleCounts, setVisibleCounts] = useState<{
    visibleNodes: number;
    totalNodes: number;
  } | null>(null);
  const handleVisibleCountsChange = useCallback(
    (counts: { visibleNodes: number; totalNodes: number }) => {
      setVisibleCounts(counts);
      // Update graphStats visible counts without recomputing everything
      setGraphStats((prev) => ({
        ...prev,
        visibleNodes: counts.visibleNodes,
        totalNodes: counts.totalNodes,
        filteredNodes: counts.totalNodes - counts.visibleNodes,
      }));
    },
    []
  );

  // Debug: log focus & stats state each render (can be removed later)
  // console.log('[InteractiveGraphCanvas][render]', { focusEnabled: focusState.enabled, statsVisible });

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Header controls (FR12) */}
      <div
        className="graph-header"
        style={{
          marginBottom: "10px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <SearchBox
          onSearchChange={handleSearchChange}
          onFocusCycle={handleFocusCycle}
          placeholder="Search files by name or path..."
          disabled={!graph}
          resultCount={searchQuery ? searchResultCount : undefined}
          currentFocusIndex={searchQuery ? currentFocusIndex : -1}
        />

        {/* Filter Dropdown */}
        {graph && (
          <FilterDropdown
            currentFilters={filterState}
            onFilterChange={handleFilterChange}
            disabled={isLayoutChanging}
            totalNodeCount={graph.nodes.length}
          />
        )}

        {/* Focus Mode Controls */}
        {graph && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={handleFocusModeToggle}
              style={{
                padding: "0.375rem 0.75rem",
                backgroundColor: focusState.enabled
                  ? "var(--vscode-button-background)"
                  : "var(--vscode-button-secondaryBackground)",
                color: focusState.enabled
                  ? "var(--vscode-button-foreground)"
                  : "var(--vscode-button-secondaryForeground)",
                border: "1px solid var(--vscode-button-border)",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "inherit",
                fontFamily: "inherit",
              }}
              disabled={isLayoutChanging}
              title={
                focusState.enabled
                  ? "Focus mode ON: Click nodes to focus, Ctrl+click or double-click to open files"
                  : "Enable focus mode: Click nodes to focus instead of opening files"
              }
            >
              🎯 Focus
            </button>

            {focusState.enabled && (
              <>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--vscode-charts-yellow)",
                    fontStyle: "italic",
                    whiteSpace: "nowrap",
                  }}
                >
                  💡 Click nodes to focus • Ctrl+click to open files
                </div>

                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <label
                    style={{
                      fontSize: "11px",
                      color: "var(--vscode-descriptionForeground)",
                    }}
                  >
                    Depth:
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={focusState.depth}
                    onChange={(e) =>
                      handleFocusDepthChange(
                        parseInt((e.target as HTMLInputElement).value)
                      )
                    }
                    style={{
                      width: "60px",
                      height: "20px",
                    }}
                    title={`Focus depth: ${focusState.depth} levels`}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--vscode-foreground)",
                      minWidth: "12px",
                      textAlign: "center",
                    }}
                  >
                    {focusState.depth}
                  </span>
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                  }}
                  title="Show files this file directly depends on (outgoing imports)."
                >
                  <input
                    type="checkbox"
                    checked={focusState.showDependencies}
                    onChange={handleFocusDependenciesToggle}
                  />
                  <span style={{ color: "var(--vscode-foreground)" }}>
                    Dependencies{focusCounts ? ` (${focusCounts.deps})` : ""}
                  </span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                  }}
                  title="Show files that depend on this file (incoming references)."
                >
                  <input
                    type="checkbox"
                    checked={focusState.showDependents}
                    onChange={handleFocusDependentsToggle}
                  />
                  <span style={{ color: "var(--vscode-foreground)" }}>
                    Dependents
                    {focusCounts ? ` (${focusCounts.dependents})` : ""}
                  </span>
                </label>

                {focusCounts &&
                  focusCounts.deps === 0 &&
                  focusCounts.dependents === 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--vscode-descriptionForeground)",
                        fontStyle: "italic",
                      }}
                    >
                      No direct links – adjust depth or pick another node
                    </span>
                  )}
              </>
            )}
          </div>
        )}

        {/* Layout Switcher */}
        {graph && (
          <LayoutSwitcher
            currentLayout={currentLayout}
            onLayoutChange={handleLayoutChange}
            disabled={isLayoutChanging}
            nodeCount={graph.nodes.length}
          />
        )}

        {/* Statistics Toggle Button */}
        {graph && (
          <button
            onClick={handleStatsToggle}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: statsVisible
                ? "var(--vscode-button-background)"
                : "var(--vscode-button-secondaryBackground)",
              color: statsVisible
                ? "var(--vscode-button-foreground)"
                : "var(--vscode-button-secondaryForeground)",
              border: "1px solid var(--vscode-button-border)",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "inherit",
              fontFamily: "inherit",
            }}
            disabled={isLayoutChanging}
            title="Toggle graph statistics overlay"
          >
            📊 Stats
          </button>
        )}

        {graph && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
              whiteSpace: "nowrap",
            }}
          >
            {visibleCounts ? `${visibleCounts.visibleNodes}/` : ""}
            {graph.nodes.length} files, {graph.edges.length} dependencies
          </div>
        )}

        {/* Open mode toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <label
            style={{
              fontSize: "11px",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            Open:
          </label>
          <select
            value={openModeSetting}
            onChange={(e) =>
              setOpenModeSetting(
                (e.target as HTMLSelectElement).value as OpenModeSetting
              )
            }
            style={{
              fontSize: "11px",
              background: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              borderRadius: "4px",
              padding: "2px 4px",
            }}
            title="Choose how node clicks open files (Modifier = Ctrl/Cmd for split)"
          >
            <option value="modifier">Modifier</option>
            <option value="default">Same Tab</option>
            <option value="split">Split</option>
          </select>
        </div>
      </div>

      {/* Graph canvas with error boundary - Task 9.3 */}
      <GraphErrorBoundary
        onError={(error, errorInfo) => {
          console.error(
            "[InteractiveGraphCanvas] Error boundary caught:",
            error
          );
          onError?.(`Graph error: ${error.message}`);
        }}
        maxRetries={3}
      >
        <GraphCanvas
          graph={graph}
          searchQuery={searchQuery}
          searchFocusIndex={currentFocusIndex}
          onNodeClick={handleNodeClick}
          onError={onError}
          onSearchResultsChange={handleSearchResultsChange}
          activeHighlight={activeHighlight}
          heatmapData={heatmapState.data}
          heatmapEnabled={heatmapState.isActive}
          onHeatmapStateChange={handleHeatmapStateChange}
          currentLayout={currentLayout}
          onLayoutChange={handleLayoutStateChange}
          disabled={isLayoutChanging}
          filterState={filterState}
          focusState={focusState}
          onFocusNodeSelect={handleFocusNodeSelect}
          onPerformanceUpdate={handlePerformanceUpdate}
          onVisibleCountsChange={handleVisibleCountsChange}
        />
      </GraphErrorBoundary>

      {/* Heatmap Legend */}
      <HeatmapLegend
        isVisible={heatmapState.isVisible}
        isHeatmapActive={heatmapState.isActive}
        distribution={heatmapState.distribution}
        totalFiles={heatmapState.totalFiles}
        onToggleHeatmap={handleToggleHeatmap}
        onClose={handleCloseLegend}
      />

      {/* Statistics Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 1500,
          pointerEvents: "auto",
        }}
      >
        <StatsOverlay
          stats={graphStats}
          isVisible={statsVisible}
          onToggle={() => setStatsVisible(!statsVisible)}
          position="bottom-right"
          compact={false}
        />
      </div>
    </div>
  );
}
