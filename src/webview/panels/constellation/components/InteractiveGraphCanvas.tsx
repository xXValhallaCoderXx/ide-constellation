import { useState } from 'preact/hooks';
import { IConstellationGraph } from '../../../../types/graph.types';
import { GraphCanvas } from './GraphCanvas';
import { SearchBox } from './SearchBox';

interface ActiveHighlightState { fileId: string | null; reason?: string }

interface InteractiveGraphCanvasProps {
  graph: IConstellationGraph | null;
  onNodeClick?: (nodeId: string, openMode: 'default' | 'split') => void;
  onError?: (error: string) => void;
  activeHighlight?: ActiveHighlightState; // FR6/FR11 placeholder
}

type OpenModeSetting = 'modifier' | 'default' | 'split';

export function InteractiveGraphCanvas({ graph, onNodeClick, onError, activeHighlight }: InteractiveGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [openModeSetting, setOpenModeSetting] = useState<OpenModeSetting>('modifier');

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
      />
    </div>
  );
}