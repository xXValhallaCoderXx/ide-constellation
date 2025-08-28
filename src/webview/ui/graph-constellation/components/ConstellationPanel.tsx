import { useState, useEffect } from 'preact/hooks';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';
import { IConstellationGraph } from '../../../../types/graph.types';
import "../../../../types/vscode-api.types"


interface GraphState {
  graph: IConstellationGraph | null;
  isLoading: boolean;
  error: string | null;
}

export function ConstellationPanel() {
  // Removed server status UI (simplified panel)
  const [graphState, setGraphState] = useState<GraphState>({
    graph: null,
    isLoading: false,
    error: null
  });
  const [activeHighlight, setActiveHighlight] = useState<{ fileId: string | null; reason?: string }>({ fileId: null });

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.command) {
        case 'statusUpdate':
          break; // ignored in simplified view
        case 'serverInfo':
          break; // ignored in simplified view
        case 'graph:response':
          setGraphState({
            graph: message.data.graph,
            isLoading: false,
            error: null
          });
          break;
        case 'graph:error':
          setGraphState(prev => ({
            ...prev,
            isLoading: false,
            error: message.data.error
          }));
          break;
        case 'graph:highlightNode':
          setActiveHighlight({ fileId: message.data.fileId, reason: message.data.reason });
          break;
        default:
          console.warn('Unknown message command:', message.command);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send initial status check and graph request on component mount
    setTimeout(() => {
      if (window.vscode) {
        // Request graph data only
        setGraphState(prev => ({ ...prev, isLoading: true, error: null }));
        window.vscode.postMessage({ command: 'graph:request' });
      }
    }, 50);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Removed handleCheckStatus (status UI removed)

  const handleNodeClick = (nodeId: string, openMode: 'default' | 'split') => {
    // Task 10.1: Guard postMessage with existence check
    if (window?.vscode) {
      window.vscode.postMessage({ command: 'editor:open', data: { fileId: nodeId, openMode } });
    } else {
      console.warn('[ConstellationPanel] VS Code API not available for editor:open');
    }
  };

  const handleGraphError = (error: string) => {
    setGraphState(prev => ({ ...prev, error }));
  };

  return (
    <div className="constellation-panel" style={{ paddingTop: '10px' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        <h2 style={{ marginTop: 0 }}>Codebase Dependency Grapsssh</h2>
          
          {graphState.isLoading && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              color: 'var(--vscode-descriptionForeground)'
            }}>
              Loading graph data...
            </div>
          )}
          
          {graphState.error && (
            <div style={{ 
              padding: '15px',
              backgroundColor: 'var(--vscode-inputValidation-errorBackground)',
              border: '1px solid var(--vscode-inputValidation-errorBorder)',
              borderRadius: '4px',
              color: 'var(--vscode-inputValidation-errorForeground)',
              marginBottom: '15px'
            }}>
              Error loading graph: {graphState.error}
            </div>
          )}
          
        {!graphState.isLoading && !graphState.error && (
          <InteractiveGraphCanvas
            graph={graphState.graph}
            onNodeClick={handleNodeClick}
            onError={handleGraphError}
            activeHighlight={activeHighlight}
          />
        )}
      </div>
    </div>
  );
}