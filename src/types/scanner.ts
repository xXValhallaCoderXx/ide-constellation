/**
 * Shared types for the scanner worker thread and MCP server communication
 */

export interface ScanWorkerData {
    targetPath: string;
    workspaceRoot: string;
}

export interface ScanWorkerMessage {
    type: 'status' | 'result' | 'error';
    data: {
        status?: 'starting' | 'complete';
        result?: any;
        error?: string;
        timestamp: string;
    };
}