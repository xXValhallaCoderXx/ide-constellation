import type { SidebarOutboundMessage, PanelKey, SidebarOrigin } from '@/types/routing.types';

export function postMessage<M extends SidebarOutboundMessage>(msg: M): void {
    // Window typing provided by [VSCodeAPI](src/types/vscode-api.types.ts)
    window.vscode?.postMessage(msg);
}

export function openPanel(panel: PanelKey, origin?: SidebarOrigin): void {
    postMessage({
        command: 'panel:open',
        data: { panel, origin }
    });
}

export function requestProjectScan(origin?: SidebarOrigin): void {
    postMessage({
        command: 'project:scan',
        data: { origin }
    });
}