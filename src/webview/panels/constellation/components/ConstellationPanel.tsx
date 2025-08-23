import { useState, useEffect } from 'preact/hooks';
import { StatusIndicator } from './StatusIndicator';
import { ServerStatusButton } from './ServerStatusButton';
import { InteractiveGraphCanvas } from './InteractiveGraphCanvas';
import { IConstellationGraph } from '../../../../types/graph.types';
import '../../../../types/vscode-api.types';

interface ServerStatus {
  status: 'ok' | 'error' | 'unknown';
  timestamp?: string;
  port?: number;
  error?: string;
}

interface ServerInfo {
  isRunning: boolean;
  port?: number;
  uptime?: number;
}

interface GraphState {
  graph: IConstellationGraph | null;
  isLoading: boolean;
  error: string | null;
}

export function ConstellationPanel() {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'unknown'
  });
  const [serverInfo, setServerInfo] = useState<ServerInfo>({
    isRunning: false
  });
  const [isChecking, setIsChecking] = useState(false);
  const [graphState, setGraphState] = useState<GraphState>({
    graph: null,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    // Listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message from extension:', message);
      
      switch (message.command) {
        case 'statusUpdate':
          setServerStatus(message.data);
          setIsChecking(false);
          break;
        case 'serverInfo':
          setServerInfo(message.data);
          break;
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
        default:
          console.warn('Unknown message command:', message.command);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send initial status check and graph request on component mount
    setTimeout(() => {
      if (window.vscode) {
        window.vscode.postMessage({ command: 'checkStatus' });
        setIsChecking(true);
        
        // Request graph data
        setGraphState(prev => ({ ...prev, isLoading: true, error: null }));
        window.vscode.postMessage({ command: 'graph:request' });
      }
    }, 100);

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCheckStatus = () => {
    setIsChecking(true);
    setServerStatus(prev => ({ ...prev, status: 'unknown' }));
    
    // Send message to extension
    if (window.vscode) {
      window.vscode.postMessage({ command: 'checkStatus' });
    } else {
      // Fallback if VS Code API is not available
      console.error('VS Code API not available');
      setIsChecking(false);
      setServerStatus({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'VS Code API not available'
      });
    }
  };

  const handleNodeClick = (nodeId: string) => {
    console.log('Node clicked in ConstellationPanel:', nodeId);
    // TODO: Implement file opening functionality
  };

  const handleGraphError = (error: string) => {
    setGraphState(prev => ({ ...prev, error }));
  };

  return (
    <div className="constellation-panel">
      <div className="container">
        <h1>Kiro Constellation POC</h1>
        <div className="status-section">
          <StatusIndicator 
            status={serverStatus} 
            serverInfo={serverInfo}
            isChecking={isChecking}
          />
          <ServerStatusButton 
            onClick={handleCheckStatus}
            disabled={isChecking}
          />
        </div>
        
        {/* Graph visualization section */}
        <div style={{ marginTop: '20px' }}>
          <h2>Codebase Dependency Graph</h2>
          
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
            />
          )}
        </div>
      </div>
    </div>
  );
}