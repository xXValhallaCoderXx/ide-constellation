import { useState } from 'preact/hooks';
import { IConstellationGraph } from '../../../../types/graph.types';
import { GraphCanvas } from './GraphCanvas';
import { SearchBox } from './SearchBox';

interface InteractiveGraphCanvasProps {
  graph: IConstellationGraph | null;
  onNodeClick?: (nodeId: string) => void;
  onError?: (error: string) => void;
}

export function InteractiveGraphCanvas({ graph, onNodeClick, onError }: InteractiveGraphCanvasProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultCount, setSearchResultCount] = useState(0);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchResultsChange = (count: number) => {
    setSearchResultCount(count);
  };

  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked:', nodeId);
    onNodeClick?.(nodeId);
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Search controls */}
      <div style={{ 
        marginBottom: '15px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
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
      </div>

      {/* Graph canvas */}
      <GraphCanvas
        graph={graph}
        searchQuery={searchQuery}
        onNodeClick={handleNodeClick}
        onError={onError}
        onSearchResultsChange={handleSearchResultsChange}
      />
    </div>
  );
}