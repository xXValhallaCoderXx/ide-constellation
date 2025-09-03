import * as vscode from 'vscode';
import { WebviewManager } from './webview/webview.service';
import { KiroConstellationMCPProvider } from './mcp/mcp.provider';
import { BridgeService } from './services/bridge/bridge.service';
import { BRIDGE_MESSAGE_TYPES } from './types/bridge.types';
import * as os from 'os';
import * as crypto from 'crypto';
import { ConstellationSidebarProvider } from './webview/providers/sidebar.provider';
import * as path from 'path';
import { spawn } from 'child_process';
import { SYNC_DEBOUNCE_MS } from './constants/sync.constants';
import { GraphService } from './services/graph.service';
import { STATUS_BAR_TIMEOUT_MS } from './constants/sync.constants';
import { debounce } from './utils/debounce';
import { PanelRegistry } from './services/panel-registry.service';
import { CONFIG } from './config/extension.config';

// Global instances
let webviewManager: WebviewManager | null = null;
let mcpProvider: KiroConstellationMCPProvider | null = null;
let panelRegistry: PanelRegistry | null = null; // Single instance (FR1, FR15)
const IS_DEV = process.env.NODE_ENV !== 'production';

export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Kiro Constellation");
  context.subscriptions.push(output);
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    output.appendLine(line);
  };

  log("Extension activating...");

  // --- Bridge initialization (must precede MCP provider so env vars available) ---
  const socketPath = path.join(os.tmpdir(), `kiro-bridge-${process.pid}.sock`);
  const fileBridgeDir = path.join(context.globalStorageUri.fsPath, 'bridge');
  const authToken = context.globalState.get<string>('bridge.authToken') || crypto.randomUUID();
  await context.globalState.update('bridge.authToken', authToken);
  // Expose to in-process MCP server instance (scan & ping helper)
  process.env.BRIDGE_SOCKET_PATH = socketPath;
  process.env.BRIDGE_AUTH_TOKEN = authToken;
  const bridge = BridgeService.getInstance();
  await bridge.init({ socketPath, fileBridgeDir, authToken, output });

  // Register POC handler: ui:showPanel -> open dependency graph panel
  bridge.register(BRIDGE_MESSAGE_TYPES.UI_SHOW_PANEL, async (msg) => {
    const desired = (msg.payload?.panel ?? 'dependencyGraph') as string;
    if (desired === 'dependencyGraph') {
      panelRegistry?.open('dependencyGraph', 'bridge:ui:showPanel');
    }
  });

  // --- Always create webview + panel infrastructure first ---
  webviewManager = new WebviewManager(null, output);
  webviewManager.initialize(context);
  panelRegistry = new PanelRegistry(webviewManager, output);
  webviewManager.setPanelRegistry(panelRegistry);

  // --- Always attempt MCP provider registration (previously only in POC branch) ---
  try {
  mcpProvider = new KiroConstellationMCPProvider(context, output, { socketPath, authToken });
    const registered = await mcpProvider.registerProvider();
    if (registered) {
      log("[MCP] Provider registration successful");
      if (CONFIG.USE_STANDARD_PROVIDER_POC) {
        log("[POC] Running provider self-test");
        await mcpProvider.testProvider();
      }
    } else {
      log(
        "[MCP] Provider registration did not complete (API unavailable). Fallback config logic executed if possible."
      );
    }
  } catch (err) {
    log(
      `[MCP] Error during provider setup: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Inject webview manager for visualInstruction routing if supported
  if (
    mcpProvider &&
    typeof (mcpProvider as any).setWebviewManager === "function"
  ) {
    (mcpProvider as any).setWebviewManager(webviewManager);
  }

  // Register the sidebar provider
  const sidebarProvider = new ConstellationSidebarProvider(context);
  const sidebarDisposable = vscode.window.registerWebviewViewProvider(
    "kiro-constellation.sidebar",
    sidebarProvider
  );

  // Register the Show Graph command (renamed to constellation.showGraph for consistency)
  const showGraphDisposable = vscode.commands.registerCommand(
    "constellation.showGraph",
    () => {
      log("Show Graph command executed");
      panelRegistry?.open("dependencyGraph", "command:showGraph");
    }
  );

  // Register the Scan Project command
  const scanProjectDisposable = vscode.commands.registerCommand(
    "constellation.scanProject",
    async () => {
      log("Scan Project command executed");
      try {
        if (mcpProvider) {
          await mcpProvider.scanProject();
          vscode.window.showInformationMessage(
            "Project scan completed. Check the output channel for results."
          );
        } else {
          log("[ERROR] MCP Provider not available for scanning");
          vscode.window.showErrorMessage(
            "MCP Provider not available. Cannot perform scan."
          );
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log(`[ERROR] Scan Project command failed: ${errorMessage}`);
        vscode.window.showErrorMessage(`Scan failed: ${errorMessage}`);
      }
    }
  );

  // Register the Health Dashboard command (simple open)
  const healthDashboardDisposable = vscode.commands.registerCommand(
    "constellation.healthDashboard",
    () => {
      log("Health Dashboard command executed");
      panelRegistry?.open("healthDashboard", "command:healthDashboard");
    }
  );

  // Minimal bridge ping test command
  const pingBridgeDisposable = vscode.commands.registerCommand(
    'constellation.pingBridgeTest',
    async () => {
      try {
        log('[BridgeTest] Executing ping tool');
        const server = mcpProvider?.getServerInstance();
        if (!server) { vscode.window.showErrorMessage('MCP server unavailable'); return; }
        await server.executePing();
        vscode.window.showInformationMessage('Bridge ping sent (should open graph panel)');
      } catch (e) {
        vscode.window.showErrorMessage('Bridge ping failed: ' + (e instanceof Error ? e.message : String(e)));
      }
    }
  );

  // Removed deprecated/legacy commands: healthReport, healthReportGraph, clearHeatmap, analyzeHealth, debugLaunchMcp

  context.subscriptions.push(
    sidebarDisposable,
    showGraphDisposable,
    scanProjectDisposable,
  healthDashboardDisposable,
  pingBridgeDisposable
  );

  // (FR4/FR5/FR6) Active editor tracking -> highlight graph node (debounced per FR5)
  let statusTimer: NodeJS.Timeout | null = null;
  let statusItem: vscode.StatusBarItem | null = null;
  /**
   * Show a temporary status bar message for missing node scenarios.
   * FR7: Transient status feedback.
   */
  const showTransientStatus = (text: string) => {
    if (!statusItem) {
      statusItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
      );
      context.subscriptions.push(statusItem);
    }
    statusItem.text = text;
    statusItem.show();
    if (statusTimer) {
      clearTimeout(statusTimer);
    }
    statusTimer = setTimeout(() => {
      statusItem?.hide();
    }, STATUS_BAR_TIMEOUT_MS);
  };
  /**
   * Dispatch highlight message to webview for active editor file.
   * FR4/FR6: Synchronize active editor -> graph highlight.
   * Guards for panel existence and file membership.
   */
  const sendHighlight = async (editor: vscode.TextEditor | undefined) => {
    if (!webviewManager) {
      return;
    }
    const panel = (webviewManager as any).currentPanel as vscode.WebviewPanel | undefined;
    if (!panel) {
      return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }
    if (
      !editor ||
      editor.document.isUntitled ||
      editor.document.uri.scheme !== "file"
    ) {
      (webviewManager as any).messenger?.sendGraphHighlightNode(null);
      return;
    }
    const rel = path
      .relative(workspaceRoot, editor.document.uri.fsPath)
      .replace(/\\/g, "/");
    const graph = GraphService.getInstance().getGraph();
    const exists = !!graph?.nodes.find((n) => n.id === rel);
    if (exists) {
      (webviewManager as any).messenger?.sendGraphHighlightNode(rel);
    } else {
      (webviewManager as any).messenger?.sendGraphHighlightNode(null, 'notInGraph');
      showTransientStatus("Constellation: File not in graph");
    }
  };

  const debouncedHighlight = debounce((ed: vscode.TextEditor | undefined) => {
    sendHighlight(ed);
  }, SYNC_DEBOUNCE_MS); // FR5 debounce
  vscode.window.onDidChangeActiveTextEditor(
    (ed) => {
      debouncedHighlight(ed);
    },
    null,
    context.subscriptions
  );

  // Task 10.4: Log unhandled promise rejections for resilience diagnostics
  if (!(global as any).__constellationUnhandledRejectionHookInstalled) {
    process.on("unhandledRejection", (reason) => {
      console.warn("[Constellation] Unhandled promise rejection:", reason);
    });
    (global as any).__constellationUnhandledRejectionHookInstalled = true;
  }
}


export async function deactivate() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [INFO] lifecycle:deactivate phase=start`);

  // Clean up GraphService singleton
  try {
    const { GraphService } = await import('./services/graph.service');
    const graphService = GraphService.getInstance();
    graphService.clear();
    console.log(`[${new Date().toISOString()}] [INFO] lifecycle:deactivate action=graphServiceClear status=success`);
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] [WARN] lifecycle:deactivate action=graphServiceClear status=failed error=${error instanceof Error ? error.message : String(error)}`);
  }

  // Clean up webview manager
  if (webviewManager) {
    try {
      webviewManager.dispose();
      console.log(`[${new Date().toISOString()}] [INFO] lifecycle:deactivate action=webviewManagerDispose status=success`);
    } catch (e) {
      console.warn(`[${new Date().toISOString()}] [WARN] lifecycle:deactivate action=webviewManagerDispose status=failed error=${e instanceof Error ? e.message : String(e)}`);
    }
    webviewManager = null;
  }

  if (CONFIG.USE_STANDARD_PROVIDER_POC) {
    console.log(`[${new Date().toISOString()}] [INFO] lifecycle:deactivate action=mcpProviderCleanup mode=POC`);
    mcpProvider = null; // Disposables handle underlying cleanup
  }

  console.log(`[${new Date().toISOString()}] [INFO] lifecycle:deactivate phase=complete`);
}
