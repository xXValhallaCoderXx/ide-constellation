import { useState, useEffect } from 'preact/hooks';
import { IConstellationGraph } from "@/types/graph.types";
import {
  LayoutType,
  DEFAULT_LAYOUT_TYPE,
  LAYOUT_STORAGE_KEY,
} from "@/types/layout.types";
import { GraphCanvas, HeatmapNode } from './GraphCanvas';
import { SearchBox } from './SearchBox';
import { HeatmapLegend } from './HeatmapLegend';
import { LayoutSwitcher } from './LayoutSwitcher';
import { GraphErrorBoundary } from './ErrorBoundary'; // Task 9.3: Error boundary import
import "@/types/vscode-api.types";

interface ActiveHighlightState { fileId: string | null; reason?: string }

interface InteractiveGraphCanvasProps {
  graph: IConstellationGraph | null;
  onNodeClick?: (nodeId: string, openMode: 'default' | 'split') => void;
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

type OpenModeSetting = 'modifier' | 'default' | 'split';

export function InteractiveGraphCanvas({ graph, onNodeClick, onError, activeHighlight }: InteractiveGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [currentFocusIndex, setCurrentFocusIndex] = useState(-1); // Task 5.3: Focus cycling state
  const [openModeSetting, setOpenModeSetting] = useState<OpenModeSetting>('modifier');
  const [currentLayout, setCurrentLayout] =
    useState<LayoutType>(DEFAULT_LAYOUT_TYPE); // Task 6.3: Use LayoutType
  const [isLayoutChanging, setIsLayoutChanging] = useState(false);
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    isVisible: false,
    isActive: false,
    data: [],
    distribution: undefined,
    totalFiles: 0,
  });

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    // Reset focus index when search query changes
    setCurrentFocusIndex(-1);
  };

  const handleSearchResultsChange = (count: number) => {
    setSearchResultCount(count);
    // Reset focus index when result count changes
    setCurrentFocusIndex(-1);
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

    // Trigger focus animation on the graph canvas
    // This will be handled by the GraphCanvas component via a new prop
  };

  const handleNodeClick = (
    nodeId: string,
    computedOpenMode: "default" | "split"
  ) => {
    // Override computed open mode based on user setting
    let finalMode: "default" | "split" = computedOpenMode;
    if (openModeSetting === "default") finalMode = "default";
    else if (openModeSetting === "split") finalMode = "split";
    onNodeClick?.(nodeId, finalMode);
  };

  const handleLayoutChange = (layoutId: string) => {
    const layoutType = layoutId as LayoutType; // Task 6.3: Type-safe layout handling
    setCurrentLayout(layoutType);
    // Layout changing state will be managed by GraphCanvas via onLayoutChange callback
    // No need to manually set isLayoutChanging here
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
        console.warn('[InteractiveGraphCanvas] Layout change timeout, resetting state');
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
        case 'graph:applyHeatmap':
          const { heatmapData, distribution, totalFiles } = message.data;
          setHeatmapState(prev => ({
            ...prev,
            isVisible: true,
            isActive: true,
            data: heatmapData,
            distribution,
            totalFiles
          }));
          break;
        case 'graph:clearHeatmap':
          setHeatmapState(prev => ({
            ...prev,
            isActive: false,
            data: []
          }));
          break;
        default:
          // Ignore unknown messages
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleToggleHeatmap = () => {
    setHeatmapState(prev => ({
      ...prev,
      isActive: !prev.isActive
    }));
  };

  const handleCloseLegend = () => {
    setHeatmapState(prev => ({
      ...prev,
      isVisible: false,
      isActive: false,
      data: []
    }));
  };

  const handleHeatmapStateChange = (isActive: boolean) => {
    setHeatmapState(prev => ({
      ...prev,
      isActive
    }));
  };

  return (
    <div style={{ width: "100%" }}>
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

        {/* Layout Switcher */}
        {graph && (
          <LayoutSwitcher
            currentLayout={currentLayout}
            onLayoutChange={handleLayoutChange}
            disabled={isLayoutChanging}
            nodeCount={graph.nodes.length}
          />
        )}

        {graph && (
          <div
            style={{
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
              whiteSpace: "nowrap",
            }}
          >
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
          onLayoutChange={setIsLayoutChanging}
          disabled={isLayoutChanging}
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
    </div>
  );
}