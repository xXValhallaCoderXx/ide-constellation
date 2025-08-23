/**
 * Shared types for the scanner worker thread and MCP server communication
 */

import { IConstellationGraph } from './graph.types';

export interface ScanWorkerData {
    targetPath: string;
    workspaceRoot: string;
}

export interface ScanWorkerMessage {
    type: 'status' | 'result' | 'error';
    data: {
        status?: 'starting' | 'complete';
        result?: any;
        transformedGraph?: IConstellationGraph;
        error?: string;
        timestamp: string;
    };
}