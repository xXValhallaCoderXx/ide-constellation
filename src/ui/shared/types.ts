// Shared types for webview TypeScript files
export interface VSCodeApi {
    postMessage: (message: any) => void;
}

export interface Message {
    type: string;
    data?: any;
}

// Dependency graph data interfaces matching analyzer.ts structure
export interface DependencyGraphData {
    modules: DependencyModule[];
    summary: {
        totalDependencies: number;
        violations: Violation[];
        error?: string;
    };
}

export interface DependencyModule {
    source: string;
    dependencies: Dependency[];
    dependents: string[];
}

export interface Dependency {
    resolved: string;
    coreModule: boolean;
    followable: boolean;
    dynamic: boolean;
}

export interface Violation {
    from: string;
    to: string;
    rule: {
        severity: string;
        name: string;
    };
}

// Graph update message interface
export interface GraphUpdateMessage {
    command: 'updateGraph';
    data: DependencyGraphData;
    timestamp: string;
    metadata?: {
        source?: string;
        version?: string;
        [key: string]: any;
    };
}

// Status message types
export interface GraphStatusMessage {
    command: 'status';
    status: 'initializing' | 'analyzing' | 'ready' | 'warning' | 'error';
    message: string;
    timestamp: string;
    metadata?: {
        source?: string;
        [key: string]: any;
    };
}

export interface GraphErrorMessage {
    command: 'error';
    error: string;
    timestamp: string;
    metadata?: {
        source?: string;
        [key: string]: any;
    };
}

// WebviewReady message for initialization
export interface WebviewReadyMessage {
    command: 'webviewReady';
    timestamp: string;
    data?: string;
}

// Union type for all graph-related messages
export type GraphMessage = GraphUpdateMessage | GraphStatusMessage | GraphErrorMessage | WebviewReadyMessage;

// Global VS Code API declaration for webview environment
declare global {
    function acquireVsCodeApi(): VSCodeApi;
}
