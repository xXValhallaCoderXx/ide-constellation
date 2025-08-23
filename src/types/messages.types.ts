// Message types for webview-extension communication

export interface WebviewMessage {
  command: string;
  data?: any;
}

export interface CheckStatusMessage extends WebviewMessage {
  command: 'checkStatus';
}

export interface StatusUpdateMessage extends WebviewMessage {
  command: 'statusUpdate';
  data: {
    status: 'ok' | 'error' | 'unknown';
    timestamp: string;
    port?: number;
    error?: string;
  };
}

export interface ServerInfoMessage extends WebviewMessage {
  command: 'serverInfo';
  data: {
    isRunning: boolean;
    port?: number;
    uptime?: number;
  };
}

export interface GraphRequestMessage extends WebviewMessage {
  command: 'graph:request';
}

export interface GraphResponseMessage extends WebviewMessage {
  command: 'graph:response';
  data: {
    graph: import('./graph.types').IConstellationGraph;
    timestamp: string;
  };
}

export interface GraphErrorMessage extends WebviewMessage {
  command: 'graph:error';
  data: {
    error: string;
    timestamp: string;
  };
}

export type WebviewToExtensionMessage = CheckStatusMessage | GraphRequestMessage;
export type ExtensionToWebviewMessage = StatusUpdateMessage | ServerInfoMessage | GraphResponseMessage | GraphErrorMessage;