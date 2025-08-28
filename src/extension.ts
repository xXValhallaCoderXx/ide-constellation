import * as vscode from 'vscode';
import { WebviewManager } from './webview/webview.service';
import { KiroConstellationMCPProvider } from './mcp/mcp.provider';
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
	const output = vscode.window.createOutputChannel('Kiro Constellation');
	context.subscriptions.push(output);
	const log = (msg: string) => {
		const line = `[${new Date().toISOString()}] ${msg}`;
		console.log(line);
		output.appendLine(line);
	};

	log('Extension activating...');

	if (CONFIG.USE_STANDARD_PROVIDER_POC) {
    log("[POC] VS Code Standard MCP Provider POC mode enabled");
    log("[POC] Starting VS Code Standard MCP Provider POC...");

    // Initialize MCP Provider for POC
    try {
      mcpProvider = new KiroConstellationMCPProvider(context, output);
      const success = await mcpProvider.registerProvider();

      if (success) {
        log("[POC] MCP Provider registration completed successfully");
        log("[POC] Testing provider functionality...");
        await mcpProvider.testProvider();
      } else {
        log(
          "[POC] MCP Provider registration failed - API may not be available"
        );
      }
    } catch (error) {
      log(
        `[POC] Error in MCP Provider setup: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Initialize Webview Manager (always available)
    webviewManager = new WebviewManager(null, output);
    webviewManager.initialize(context);
    // Initialize Panel Registry once
    panelRegistry = new PanelRegistry(webviewManager, output);
    webviewManager.setPanelRegistry(panelRegistry);
    // Inject into provider for visualInstruction routing
    if (
      mcpProvider &&
      typeof (mcpProvider as any).setWebviewManager === "function"
    ) {
      (mcpProvider as any).setWebviewManager(webviewManager);
    }
  } else {
    // Legacy HTTP server path removed; MCP provider is the default
    log("[PRODUCTION] MCP provider path active");
    webviewManager = new WebviewManager(null, output);
    webviewManager.initialize(context);
    // Initialize Panel Registry once
    panelRegistry = new PanelRegistry(webviewManager, output);
    webviewManager.setPanelRegistry(panelRegistry);
    if (
      mcpProvider &&
      typeof (mcpProvider as any).setWebviewManager === "function"
    ) {
      (mcpProvider as any).setWebviewManager(webviewManager);
    }
  }

	// Register the sidebar provider
	const sidebarProvider = new ConstellationSidebarProvider(context);
	const sidebarDisposable = vscode.window.registerWebviewViewProvider(
		'kiro-constellation.sidebar',
		sidebarProvider
	);

	// Register the Show Graph command (renamed to constellation.showGraph for consistency)
	const showGraphDisposable = vscode.commands.registerCommand('constellation.showGraph', () => {
		log('Show Graph command executed');
		panelRegistry?.open("dependencyGraph", "command:showGraph");
	});

	// Register the Scan Project command
	const scanProjectDisposable = vscode.commands.registerCommand('constellation.scanProject', async () => {
		log('Scan Project command executed');
		try {
			if (mcpProvider) {
				await mcpProvider.scanProject();
				vscode.window.showInformationMessage('Project scan completed. Check the output channel for results.');
			} else {
				log('[ERROR] MCP Provider not available for scanning');
				vscode.window.showErrorMessage('MCP Provider not available. Cannot perform scan.');
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			log(`[ERROR] Scan Project command failed: ${errorMessage}`);
			vscode.window.showErrorMessage(`Scan failed: ${errorMessage}`);
		}
	});

	// Register the Health Dashboard command (simple open)
	const healthDashboardDisposable = vscode.commands.registerCommand('constellation.healthDashboard', () => {
		log('Health Dashboard command executed');
		panelRegistry?.open("healthDashboard", "command:healthDashboard");
	});

	// Removed deprecated/legacy commands: healthReport, healthReportGraph, clearHeatmap, analyzeHealth, debugLaunchMcp

	context.subscriptions.push(
		sidebarDisposable,
		showGraphDisposable,
		scanProjectDisposable,
		healthDashboardDisposable
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
			statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
			context.subscriptions.push(statusItem);
		}
		statusItem.text = text;
		statusItem.show();
		if (statusTimer) { clearTimeout(statusTimer); }
		statusTimer = setTimeout(() => { statusItem?.hide(); }, STATUS_BAR_TIMEOUT_MS);
	};
	/**
	 * Dispatch highlight message to webview for active editor file.
	 * FR4/FR6: Synchronize active editor -> graph highlight.
	 * Guards for panel existence and file membership.
	 */
	const sendHighlight = async (editor: vscode.TextEditor | undefined) => {
		if (!webviewManager) { return; }
		const panel = (webviewManager as any).currentPanel as vscode.WebviewPanel | undefined; // access private for now
		if (!panel) { return; }
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) { return; }
		if (!editor || editor.document.isUntitled || editor.document.uri.scheme !== 'file') {
			panel.webview.postMessage({ command: 'graph:highlightNode', data: { fileId: null } }); // Task 10.1 guard already ensured
			return;
		}
		const rel = path.relative(workspaceRoot, editor.document.uri.fsPath).replace(/\\/g, '/');
		const graph = GraphService.getInstance().getGraph();
		const exists = !!graph?.nodes.find(n => n.id === rel);
		if (exists) {
			panel.webview.postMessage({ command: 'graph:highlightNode', data: { fileId: rel } });
		} else {
			panel.webview.postMessage({ command: 'graph:highlightNode', data: { fileId: null, reason: 'notInGraph' } });
			showTransientStatus('Constellation: File not in graph');
		}
	};

	const debouncedHighlight = debounce((ed: vscode.TextEditor | undefined) => {
		sendHighlight(ed);
	}, SYNC_DEBOUNCE_MS); // FR5 debounce
	vscode.window.onDidChangeActiveTextEditor((ed) => {
		debouncedHighlight(ed);
	}, null, context.subscriptions);

	// Task 10.4: Log unhandled promise rejections for resilience diagnostics
	if (!(global as any).__constellationUnhandledRejectionHookInstalled) {
		process.on('unhandledRejection', (reason) => {
			console.warn('[Constellation] Unhandled promise rejection:', reason);
		});
		(global as any).__constellationUnhandledRejectionHookInstalled = true;
	}
}


export async function deactivate() {
	// No output channel at this point; keep a console log for host logs
	console.log('Kiro Constellation extension is deactivating...');

	// Clean up GraphService singleton
	try {
		const { GraphService } = await import('./services/graph.service');
		const graphService = GraphService.getInstance();
		graphService.clear();
		console.log('GraphService singleton cleared');
	} catch (error) {
		console.warn('Failed to clear GraphService singleton:', error);
	}

	// Clean up webview manager
	if (webviewManager) {
		webviewManager.dispose();
		webviewManager = null;
	}

	if (CONFIG.USE_STANDARD_PROVIDER_POC) {
		console.log('[POC] Cleaning up MCP Provider POC...');
		// MCP Provider cleanup is handled automatically by VS Code through disposables
		mcpProvider = null;
	}
}
