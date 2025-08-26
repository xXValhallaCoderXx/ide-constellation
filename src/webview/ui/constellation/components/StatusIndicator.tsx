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

interface StatusIndicatorProps {
  status: ServerStatus;
  serverInfo: ServerInfo;
  isChecking: boolean;
}

export function StatusIndicator({ status, serverInfo, isChecking }: StatusIndicatorProps) {
  const formatStatusText = () => {
    if (isChecking) {
      return 'Status: Checking...';
    }

    let statusText = `Status: ${status.status}`;
    
    if (status.timestamp) {
      const time = new Date(status.timestamp).toLocaleTimeString();
      statusText += ` (Last checked: ${time})`;
    }
    
    if (status.port || serverInfo.port) {
      statusText += ` - Port: ${status.port || serverInfo.port}`;
    }
    
    if (status.error) {
      statusText += ` - Error: ${status.error}`;
    }

    if (serverInfo.isRunning && status.status === 'ok') {
      statusText += ' ✓';
    }

    return statusText;
  };

  const getStatusClass = () => {
    if (isChecking) return 'status-checking';
    switch (status.status) {
      case 'ok': return 'status-ok';
      case 'error': return 'status-error';
      default: return 'status-unknown';
    }
  };

  return (
    <div className={`status-text ${getStatusClass()}`}>
      {formatStatusText()}
    </div>
  );
}