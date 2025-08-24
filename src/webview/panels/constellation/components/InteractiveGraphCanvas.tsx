import { useState, useEffect } from 'preact/hooks';
import { IConstellationGraph } from '../../../../types/graph.types';
import { GraphCanvas, HeatmapNode } from './GraphCanvas';
import { SearchBox } from './SearchBox';
import { HeatmapLegend } from './HeatmapLegend';
import '../../../../types/vscode-api.types';

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
  const [openModeSetting, setOpenModeSetting] = useState<OpenModeSetting>('modifier');
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    isVisible: false,
    isActive: false,
    data: [],
    distribution: undefined,
    totalFiles: 0
  });

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchResultsChange = (count: number) => {
    setSearchResultCount(count);
  };

  const handleNodeClick = (nodeId: string, computedOpenMode: 'default' | 'split') => {
    // Override computed open mode based on user setting
    let finalMode: 'default' | 'split' = computedOpenMode;
    if (openModeSetting === 'default') finalMode = 'default';
    else if (openModeSetting === 'split') finalMode = 'split';
    onNodeClick?.(nodeId, finalMode);
  };

  // Listen for heatmap messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'graph:applyHeatmap':
          const { heatmapData, distribution, totalFiles } = message.data || {};
          if (!heatmapData || heatmapData.length === 0) {
            console.warn('[InteractiveGraphCanvas] Received graph:applyHeatmap with empty heatmapData');
            return; // safeguard (Task 5.4)
          }
          console.time?.('GraphPanel:heatmapMessageToRender'); // timing start (Task 6.5)
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
    <div style={{ width: '100%' }}>
      {/* Header controls (FR12) */}
      <div className="graph-header" style={{
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <SearchBox
          onSearchChange={handleSearchChange}
          placeholder="Search files by name or path..."
          disabled={!graph}
          resultCount={searchQuery ? searchResultCount : undefined}
        />
        
        {graph && (
          <div style={{
            fontSize: '12px',
            color: 'var(--vscode-descriptionForeground)',
            whiteSpace: 'nowrap'
          }}>
            {graph.nodes.length} files, {graph.edges.length} dependencies
          </div>
        )}

        {/* Open mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>Open:</label>
          <select
            value={openModeSetting}
            onChange={(e) => setOpenModeSetting((e.target as HTMLSelectElement).value as OpenModeSetting)}
            style={{
              fontSize: '11px',
              background: 'var(--vscode-input-background)',
              color: 'var(--vscode-input-foreground)',
              border: '1px solid var(--vscode-input-border)',
              borderRadius: '4px',
              padding: '2px 4px'
            }}
            title="Choose how node clicks open files (Modifier = Ctrl/Cmd for split)"
          >
            <option value="modifier">Modifier</option>
            <option value="default">Same Tab</option>
            <option value="split">Split</option>
          </select>
        </div>
      </div>

      {/* Graph canvas */}
      <GraphCanvas
        graph={graph}
        searchQuery={searchQuery}
        onNodeClick={handleNodeClick}
        onError={onError}
        onSearchResultsChange={handleSearchResultsChange}
        activeHighlight={activeHighlight}
        heatmapData={heatmapState.data}
        heatmapEnabled={heatmapState.isActive}
        onHeatmapStateChange={handleHeatmapStateChange}
      />

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