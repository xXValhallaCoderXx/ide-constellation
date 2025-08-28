import * as vscode from 'vscode';
import { WebviewManager } from '../webview/webview.service';
import { PanelKey } from '../types/routing.types';

export class PanelRegistry {
    constructor(
        private readonly webviewManager: WebviewManager,
        private readonly output?: vscode.OutputChannel
    ) { }

    public open(panel: PanelKey, origin: string = 'unknown'): void {
        const ts = new Date().toISOString();
        const info = `[INFO] panel:open key=${panel} origin=${origin}`;
        this.output?.appendLine(`[${ts}] ${info}`);
        try {
            switch (panel) {
                case 'dependencyGraph':
                    this.webviewManager.createOrShowPanel();
                    break;
                case 'healthDashboard':
                    this.webviewManager.createOrShowHealthDashboard();
                    break;
                default:
                    this.warnUnknown(panel);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.output?.appendLine(`[${ts}] [ERROR] panel:open failed key=${panel} origin=${origin} error=${msg}`);
        }
    }

    private warnUnknown(panel: string): void {
        const ts = new Date().toISOString();
        this.output?.appendLine(`[${ts}] [WARN] Unknown panel key: ${panel}`);
    }
}