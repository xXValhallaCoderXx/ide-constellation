import * as vscode from 'vscode';
import { WebviewManager } from '../webview/webview.service';
import { PanelKey, ORIGIN } from '../types/routing.types';

export class PanelRegistry {
    constructor(
        private readonly webviewManager: WebviewManager,
        private readonly output?: vscode.OutputChannel
    ) { }

  /**
   * Open or focus a registered panel.
   *
   * Usage: This is the ONLY supported entry point for opening Constellation panels.
   * Callers MUST NOT invoke `webviewManager.createOrShowPanel()` or
   * `webviewManager.createOrShowHealthDashboard()` directly (those are
   * considered internal and will be deprecated after migration).
   *
* Origins: Prefer structured origins from `ORIGIN.SIDEBAR.*` for sidebar triggers.
* Additional origins MUST follow the `<namespace>:<action>` convention.
* Common namespaces: `mcp:*`, `command:*`, `system:*`.
* Examples:
*  - ORIGIN.SIDEBAR.HOME (sidebar:home)
*  - ORIGIN.MCP.VISUAL_INSTRUCTION (mcp:visualInstruction)
*  - ORIGIN.COMMAND.OPEN_GRAPH (command:openGraph)
*  - ORIGIN.SYSTEM.FALLBACK (system:fallback)
* If omitted, origin defaults to 'unknown'.
   *
   * Logging: Emits a single INFO log per invocation in the format:
   * `[ISO_TIMESTAMP] [INFO] panel:open key=<panel> origin=<origin>`
   * Errors are caught and logged without throwing to callers.
   */
    public open(panel: PanelKey, origin: string = 'unknown'): void {
        const ts = new Date().toISOString();
        this.output?.appendLine(
          `[${ts}] [INFO] panel:open key=${panel} origin=${origin}`
        );
        try {
            switch (panel) {
              case "dependencyGraph":
                this.webviewManager.createOrShowPanel();
                break;
              case "healthDashboard":
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
    this.output?.appendLine(`[${ts}] [WARN] panel:open unknown key=${panel}`);
  }
}