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

export type WebviewToExtensionMessage = CheckStatusMessage;
export type ExtensionToWebviewMessage = StatusUpdateMessage | ServerInfoMessage;