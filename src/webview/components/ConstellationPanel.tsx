import { useState, useEffect } from 'preact/hooks';
import { StatusIndicator } from './StatusIndicator';
import { ServerStatusButton } from './ServerStatusButton';
import '../../types/vscode-api.types';

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

export function ConstellationPanel() {
  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    status: 'unknown'
  });
  const [serverInfo, setServerInfo] = useState<ServerInfo>({
    isRunning: false
  });
  const [isChecking, setIsChecking] = useState(false);

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
        default:
          console.warn('Unknown message command:', message.command);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Send initial status check on component mount
    setTimeout(() => {
      if (window.vscode) {
        window.vscode.postMessage({ command: 'checkStatus' });
        setIsChecking(true);
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
      </div>
    </div>
  );
}

import '../../types/vscode-api.types';