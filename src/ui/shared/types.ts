// Shared types for webview TypeScript files
export interface VSCodeApi {
    postMessage: (message: any) => void;
}

export interface Message {
    type: string;
    data?: any;
}

// Global VS Code API declaration for webview environment
declare global {
    function acquireVsCodeApi(): VSCodeApi;
}
