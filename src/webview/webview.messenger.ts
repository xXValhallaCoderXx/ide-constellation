import * as vscode from 'vscode';
import {
    ExtensionToWebviewMessage,
    StatusUpdateMessage,
    ServerInfoMessage,
    GraphResponseMessage,
    GraphErrorMessage,
    GraphHighlightNodeMessage,
    GraphSetFocusMessage,
    HealthLoadingMessage,
    HealthResponseMessage,
    HealthErrorMessage,
    GraphApplyHeatmapMessage,
    GraphClearHeatmapMessage,
    DashboardNotificationMessage,
    GraphOverlayApplyMessage,
    GraphOverlayClearMessage
} from '../types/messages.types';

/**
 * WebviewMessenger centralizes all extension -> webview outbound messaging.
 *
 * DO NOT call panel.webview.postMessage directly outside this class once migration completes.
 * Log format (parse-friendly):
 *   [ISO_TIMESTAMP] [INFO] messenger:send command=<command> size=<bytes>
 *   [ISO_TIMESTAMP] [WARN] messenger:drop command=<command> reason=<reason> [size=<bytes>]
 *   [ISO_TIMESTAMP] [ERROR] messenger:send command=<command> error=<message>
 *
 * Grammar (keys):
 *  domain:action  -> messenger:send | messenger:drop
 *  command=<command> (always present)
 *  size=<bytes> (INFO) | size=<bytes> optional on drops
 *  reason=<reason> (drops only)
 *  error=<message> (errors only)
 */
export class WebviewMessenger {
    private static readonly MAX_BYTES = 1_048_576; // 1MB generic guard (visualInstruction may later override)

    constructor(
        private readonly panelProvider: () => vscode.WebviewPanel | undefined,
        private readonly output?: vscode.OutputChannel
    ) { }

    // Generic send helper
    private send(message: ExtensionToWebviewMessage, opts: { allowLarge?: boolean } = {}): boolean {
        const panel = this.panelProvider();
        const ts = new Date().toISOString();
        if (!panel) {
            this.output?.appendLine(`[${ts}] [WARN] messenger:drop command=${message.command} reason=panelMissing`);
            return false;
        }
        let json: string;
        try {
            json = JSON.stringify(message);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.output?.appendLine(`[${ts}] [ERROR] messenger:send command=${message.command} error=${msg}`);
            return false;
        }
        const size = json.length;
        if (!opts.allowLarge && size > WebviewMessenger.MAX_BYTES) {
            this.output?.appendLine(`[${ts}] [WARN] messenger:drop command=${message.command} reason=sizeLimit size=${size}`);
            return false;
        }
        try {
            panel.webview.postMessage(message); // fire and forget
            this.output?.appendLine(`[${ts}] [INFO] messenger:send command=${message.command} size=${size}`);
            return true;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.output?.appendLine(`[${ts}] [ERROR] messenger:send command=${message.command} error=${msg}`);
            return false;
        }
    }

    // ---------- Typed API Methods ----------

    sendStatusUpdate(data: StatusUpdateMessage['data']): boolean {
        const msg: StatusUpdateMessage = { command: 'statusUpdate', data };
        return this.send(msg);
    }

    sendServerInfo(data: ServerInfoMessage['data']): boolean {
        const msg: ServerInfoMessage = { command: 'serverInfo', data };
        return this.send(msg);
    }

    sendGraphResponse(graph: GraphResponseMessage['data']['graph'], timestamp: string): boolean {
        const msg: GraphResponseMessage = { command: 'graph:response', data: { graph, timestamp } };
        return this.send(msg);
    }

    sendGraphError(error: string, timestamp: string): boolean {
        const msg: GraphErrorMessage = { command: 'graph:error', data: { error, timestamp } };
        return this.send(msg);
    }

    sendGraphHighlightNode(fileId: string | null, reason?: 'notInGraph'): boolean {
        const msg: GraphHighlightNodeMessage = { command: 'graph:highlightNode', data: { fileId, reason } };
        return this.send(msg);
    }

    sendGraphSetFocus(targetNodeId: string, correlationId?: string): boolean {
        const msg: GraphSetFocusMessage = { command: 'graph:setFocus', data: { targetNodeId, correlationId } };
        return this.send(msg);
    }

    sendHealthLoading(): boolean {
        const msg: HealthLoadingMessage = { command: 'health:loading' };
        return this.send(msg);
    }

    sendHealthResponse(analysis: HealthResponseMessage['data']['analysis'], timestamp: string): boolean {
        const msg: HealthResponseMessage = { command: 'health:response', data: { analysis, timestamp } };
        return this.send(msg, { allowLarge: true }); // could be large
    }

    sendHealthError(error: string, timestamp: string): boolean {
        const msg: HealthErrorMessage = { command: 'health:error', data: { error, timestamp } };
        return this.send(msg);
    }

    sendGraphApplyHeatmap(data: GraphApplyHeatmapMessage['data']): boolean {
        const msg: GraphApplyHeatmapMessage = { command: 'graph:applyHeatmap', data };
        return this.send(msg, { allowLarge: true });
    }

    sendGraphClearHeatmap(): boolean {
        const msg: GraphClearHeatmapMessage = { command: 'graph:clearHeatmap' };
        return this.send(msg);
    }

    sendDashboardNotification(data: DashboardNotificationMessage['data']): boolean {
        const msg: DashboardNotificationMessage = { command: 'dashboard:notification', data };
        return this.send(msg);
    }

    // ---------- Overlay (placeholder) ----------
    /** Overlay rendering not implemented in Milestone 1. */
    sendGraphOverlayApply(overlay: GraphOverlayApplyMessage['data']['overlay']): boolean {
        const msg: GraphOverlayApplyMessage = { command: 'graph:overlay:apply', data: { overlay } };
        return this.send(msg, { allowLarge: true });
    }

    /** Overlay clearing placeholder. */
    sendGraphOverlayClear(correlationId?: string): boolean {
        const msg: GraphOverlayClearMessage = { command: 'graph:overlay:clear', data: correlationId ? { correlationId } : undefined };
        return this.send(msg);
    }
}

export type { ExtensionToWebviewMessage };
