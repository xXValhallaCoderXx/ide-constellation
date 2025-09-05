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

/** Health dashboard request message */
export interface HealthRequestMessage extends WebviewMessage {
  command: 'health:request';
  data?: {
    forceRefresh?: boolean;
  };
}

/** Health dashboard response message */
export interface HealthResponseMessage extends WebviewMessage {
  command: 'health:response';
  data: {
    analysis: import('./health-analysis.types').HealthAnalysis;
    timestamp: string;
  };
}

/** Health dashboard error message */
export interface HealthErrorMessage extends WebviewMessage {
  command: 'health:error';
  data: {
    error: string;
    timestamp: string;
  };
}

/** Health dashboard loading message */
export interface HealthLoadingMessage extends WebviewMessage {
  command: 'health:loading';
}

/** Show heatmap on graph message */
export interface HealthShowHeatmapMessage extends WebviewMessage {
  command: 'health:showHeatmap';
  data: {
    centerNode?: string;
    analysis: import('./health-analysis.types').HealthAnalysis;
  };
}

/** Focus node in graph message */
export interface HealthFocusNodeMessage extends WebviewMessage {
  command: 'health:focusNode';
  data: {
    nodeId: string;
  };
}

/** Refresh health analysis message */
export interface HealthRefreshMessage extends WebviewMessage {
  command: 'health:refresh';
}

/** Dashboard highlight risk message */
export interface DashboardHighlightRiskMessage extends WebviewMessage {
  command: 'dashboard:highlightRisk';
  data: {
    nodeId: string;
  };
}

/** Graph apply heatmap message */
export interface GraphApplyHeatmapMessage extends WebviewMessage {
  command: 'graph:applyHeatmap';
  data: {
    heatmapData: Array<{
      nodeId: string;
      score: number;
      color: string;
      metrics: any;
    }>;
    centerNode?: string;
    distribution: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    totalFiles: number;
  };
}

/** Graph clear heatmap message */
export interface GraphClearHeatmapMessage extends WebviewMessage {
  command: 'graph:clearHeatmap';
}

/** Visual instruction message from MCP provider */
export interface VisualInstructionMessage extends WebviewMessage {
  command: 'visualInstruction';
  data: import('./visual-instruction.types').VisualInstruction;
}

/** Dashboard notification message */
export interface DashboardNotificationMessage extends WebviewMessage {
  command: 'dashboard:notification';
  data: {
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    title?: string;
    duration?: number;
    action?: {
      label: string;
      command: string;
      data?: any;
    };
  };
}

/** Graph set focus message (impact analysis auto-focus) */
export interface GraphSetFocusMessage extends WebviewMessage {
  command: 'graph:setFocus';
  data: {
    targetNodeId: string;
    correlationId?: string; // optional for log correlation
  };
}

/**
 * Overlay apply message (Milestone 1 contract only - rendering not implemented).
 * Provides a flexible payload for future layering / visualization.
 * UI handlers intentionally deferred; consumers MAY ignore unknown fields.
 */
export interface GraphOverlayApplyMessage extends WebviewMessage {
  command: 'graph:overlay:apply';
  data: {
    overlay: {
      type: string; // e.g. 'risk', 'impact', 'custom'
      correlationId?: string; // optional correlation for logging & tracing
      description?: string; // human-readable summary
      source?: string; // origin system identifier
      createdAt: string; // ISO timestamp
      meta?: Record<string, any>; // arbitrary metadata for future use
      nodes: Array<{
        nodeId: string;
        color?: string; // fallback hex / theme token
        intensity?: number; // 0..1 or domain-specific scaling
        label?: string; // optional overlay label per node
        metrics?: any; // domain metrics (risk score, impact vector, etc.)
      }>;
    };
  };
}

/** Clears an active overlay. Rendering logic is future scope. */
export interface GraphOverlayClearMessage extends WebviewMessage {
  command: 'graph:overlay:clear';
  data?: {
    correlationId?: string; // optional for targeted clearing / logging symmetry
  };
}

// Augmented routing-related messages
import type { PanelKey, SidebarRouteKey } from './routing.types';

export interface PanelOpenMessage extends WebviewMessage {
  command: 'panel:open';
  data: {
    panel: PanelKey;
    origin?: string; // e.g., 'sidebar:Home'
  };
}

export interface ProjectScanMessage extends WebviewMessage {
  command: 'project:scan';
  data?: {
    origin?: string;
  };
}

export interface RouteNavigateMessage extends WebviewMessage {
  command: 'route:navigate';
  data: {
    route: SidebarRouteKey;
  };
}

/** Health export request from webview */
export interface HealthExportMessage extends WebviewMessage {
  command: 'health:export';
  data: {
    format: 'json' | 'csv';
  };
}

/** Health export result from extension to webview */
export interface HealthExportResultMessage extends WebviewMessage {
  command: 'health:export:result';
  data: {
    success: boolean;
    format: 'json' | 'csv';
    uri?: string;
    error?: string;
  };
}

// Type guards (optional safety - FR1.4)
export function isEditorOpenMessage(msg: WebviewMessage): msg is EditorOpenMessage {
  return msg.command === 'editor:open' && !!msg.data && typeof msg.data.fileId === 'string';
}

export function isGraphHighlightNodeMessage(msg: WebviewMessage): msg is GraphHighlightNodeMessage {
  return msg.command === 'graph:highlightNode';
}

// New guards
export function isPanelOpenMessage(msg: WebviewMessage): msg is PanelOpenMessage {
  return msg.command === 'panel:open' && !!(msg as any).data && typeof (msg as any).data.panel === 'string';
}

export function isProjectScanMessage(msg: WebviewMessage): msg is ProjectScanMessage {
  return msg.command === 'project:scan';
}

export function isRouteNavigateMessage(msg: WebviewMessage): msg is RouteNavigateMessage {
  return msg.command === 'route:navigate' && !!(msg as any).data && typeof (msg as any).data.route === 'string';
}

export function isHealthExportMessage(msg: WebviewMessage): msg is HealthExportMessage {
  return msg.command === 'health:export' && !!(msg as any).data && (((msg as any).data.format === 'json') || ((msg as any).data.format === 'csv'));
}

export function isHealthExportResultMessage(msg: WebviewMessage): msg is HealthExportResultMessage {
  return msg.command === 'health:export:result' && !!(msg as any).data && typeof (msg as any).data.success === 'boolean';
}

export function isGraphSetFocusMessage(msg: WebviewMessage): msg is GraphSetFocusMessage {
  return msg.command === 'graph:setFocus' && !!(msg as any).data && typeof (msg as any).data.targetNodeId === 'string';
}

export function isGraphOverlayApplyMessage(msg: WebviewMessage): msg is GraphOverlayApplyMessage {
  return msg.command === 'graph:overlay:apply' && !!(msg as any).data && !!(msg as any).data.overlay;
}

export function isGraphOverlayClearMessage(msg: WebviewMessage): msg is GraphOverlayClearMessage {
  return msg.command === 'graph:overlay:clear';
}

export type WebviewToExtensionMessage = CheckStatusMessage | GraphRequestMessage | EditorOpenMessage | HealthRequestMessage | HealthShowHeatmapMessage | HealthFocusNodeMessage | HealthRefreshMessage | VisualInstructionMessage | PanelOpenMessage | ProjectScanMessage | RouteNavigateMessage | HealthExportMessage;

export type ExtensionToWebviewMessage = StatusUpdateMessage | ServerInfoMessage | GraphResponseMessage | GraphErrorMessage | GraphHighlightNodeMessage | GraphSetFocusMessage | HealthResponseMessage | HealthErrorMessage | HealthLoadingMessage | DashboardHighlightRiskMessage | GraphApplyHeatmapMessage | GraphClearHeatmapMessage | DashboardNotificationMessage | HealthExportResultMessage | GraphOverlayApplyMessage | GraphOverlayClearMessage;