// ... existing code ...
import type {
    WebviewMessage,
    EditorOpenMessage,
    HealthRequestMessage,
    HealthRefreshMessage,
    HealthExportMessage,
    HealthShowHeatmapMessage,
    HealthFocusNodeMessage,
} from '@/types/messages.types';
import type { HealthAnalysis } from '@/types/health-analysis.types';

/** Low-level sender for the Health Dashboard bundle */
export function post(msg: WebviewMessage): void {
    // typing provided by [VSCodeAPI](src/types/vscode-api.types.ts)
    (window as any).vscode?.postMessage(msg);
}

/** Request health analysis, optionally forcing a refresh */
export function requestHealth(forceRefresh?: boolean): void {
    const message: HealthRequestMessage = {
        command: 'health:request',
        data: { forceRefresh },
    };
    post(message);
}

/** Convenience refresh health command */
export function refreshHealth(): void {
    const message: HealthRefreshMessage = {
        command: 'health:refresh',
    };
    post(message);
}

/** Ask the extension to export the current analysis into the chosen format */
export function exportHealth(format: 'json' | 'csv'): void {
    const message: HealthExportMessage = {
        command: 'health:export',
        data: { format },
    };
    post(message);
}

/** Ask the extension to open a file in the editor */
export function openFile(fileId: string, openMode: 'default' | 'split' = 'default'): void {
    const message: EditorOpenMessage = {
        command: 'editor:open',
        data: { fileId, openMode },
    };
    post(message);
}

/** Ask the graph panel to show a heatmap based on analysis data */
export function showHeatmap(analysis: HealthAnalysis, centerNode?: string): void {
    const message: HealthShowHeatmapMessage = {
        command: 'health:showHeatmap',
        data: { analysis, centerNode },
    };
    post(message);
}

/** Ask the graph panel to focus a particular node */
export function focusNode(nodeId: string): void {
    const message: HealthFocusNodeMessage = {
        command: 'health:focusNode',
        data: { nodeId },
    };
    post(message);
}
// ... existing code ...