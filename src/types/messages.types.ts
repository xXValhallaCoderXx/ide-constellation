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

/** Editor -> Extension open file request (FR1, FR2, FR3, FR16) */
export interface EditorOpenMessage extends WebviewMessage {
  command: 'editor:open';
  data: {
    /** Workspace-relative file identifier (same as graph node id) */
    fileId: string;
    /** Open mode requested */
    openMode: 'default' | 'split';
  };
}

/** Extension -> Webview highlight graph node (FR6, FR8, FR9, FR11) */
export interface GraphHighlightNodeMessage extends WebviewMessage {
  command: 'graph:highlightNode';
  data: {
    /** File id to highlight; null to clear */
    fileId: string | null;
    /** Optional reason for null highlight */
    reason?: 'notInGraph';
  };
}

// Type guards (optional safety - FR1.4)
export function isEditorOpenMessage(msg: WebviewMessage): msg is EditorOpenMessage {
  return msg.command === 'editor:open' && !!msg.data && typeof msg.data.fileId === 'string';
}

export function isGraphHighlightNodeMessage(msg: WebviewMessage): msg is GraphHighlightNodeMessage {
  return msg.command === 'graph:highlightNode';
}

export type WebviewToExtensionMessage = CheckStatusMessage | GraphRequestMessage | EditorOpenMessage;
export type ExtensionToWebviewMessage = StatusUpdateMessage | ServerInfoMessage | GraphResponseMessage | GraphErrorMessage | GraphHighlightNodeMessage;