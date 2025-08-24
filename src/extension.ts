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

// POC Configuration Flag
// Set to true to use the VS Code Standard MCP Provider POC
const USE_STANDARD_PROVIDER_POC = true;

// Global instances
let webviewManager: WebviewManager | null = null;
let mcpProvider: KiroConstellationMCPProvider | null = null;
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

	if (USE_STANDARD_PROVIDER_POC) {
		log('[POC] VS Code Standard MCP Provider POC mode enabled');
		log('[POC] Starting VS Code Standard MCP Provider POC...');

		// Initialize MCP Provider for POC
		try {
			mcpProvider = new KiroConstellationMCPProvider(context, output);
			const success = await mcpProvider.registerProvider();

			if (success) {
				log('[POC] MCP Provider registration completed successfully');
				log('[POC] Testing provider functionality...');
				await mcpProvider.testProvider();
			} else {
				log('[POC] MCP Provider registration failed - API may not be available');
			}
		} catch (error) {
			log(`[POC] Error in MCP Provider setup: ${error instanceof Error ? error.message : String(error)}`);
		}

		// Initialize Webview Manager (always available)
		webviewManager = new WebviewManager(null, output);
		webviewManager.initialize(context);
		// Inject into provider for visualInstruction routing
		if (mcpProvider && typeof (mcpProvider as any).setWebviewManager === 'function') {
			(mcpProvider as any).setWebviewManager(webviewManager);
		}
	} else {
		// Legacy HTTP server path removed; MCP provider is the default
		log('[PRODUCTION] MCP provider path active');
		webviewManager = new WebviewManager(null, output);
		webviewManager.initialize(context);
		if (mcpProvider && typeof (mcpProvider as any).setWebviewManager === 'function') {
			(mcpProvider as any).setWebviewManager(webviewManager);
		}
	}

	// Register the sidebar provider
	const sidebarProvider = new ConstellationSidebarProvider(context);
	const sidebarDisposable = vscode.window.registerWebviewViewProvider(
		'kiro-constellation.sidebar',
		sidebarProvider
	);

	// Register the Show Graph command
	const showGraphDisposable = vscode.commands.registerCommand('kiro-constellation.showGraph', () => {
		log('Show Graph command executed');
		webviewManager?.createOrShowPanel(context);
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

	// Register the Health Report command (new dual-view dashboard)
	const healthReportDisposable = vscode.commands.registerCommand('constellation.healthReport', async () => {
		log('Health Report command executed');
		
		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Generating health report...',
			cancellable: false
		}, async (progress) => {
			try {
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceRoot) {
					throw new Error('No workspace folder found. Please open a workspace first.');
				}

				progress.report({ increment: 20, message: 'Initializing health analyzer...' });
				
				// Import services dynamically to avoid circular dependencies
				const { HealthAnalyzer } = await import('./services/health-analyzer.service');
				
				// Get or create HealthAnalyzer instance
				const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
				
				progress.report({ increment: 30, message: 'Checking graph data...' });
				
				// Ensure we have graph data
				const graphService = GraphService.getInstance();
				let graph = graphService.getGraph();
				
				if (!graph) {
					progress.report({ increment: 0, message: 'No graph data found. Scanning project first...' });
					
					// Trigger a scan first
					if (mcpProvider) {
						await mcpProvider.scanProject();
						graph = graphService.getGraph();
					}
					
					if (!graph) {
						throw new Error('Unable to load graph data. Please run "Constellation: Scan Project" first.');
					}
				}
				
				progress.report({ increment: 20, message: 'Analyzing file complexity and churn...' });
				
				// Perform health analysis
				const analysis = await healthAnalyzer.analyzeCodebase(graph);
				
				progress.report({ increment: 30, message: 'Opening health dashboard...' });
				
				// Display health analysis in dashboard
				if (webviewManager) {
					webviewManager.createOrShowHealthDashboard();
					await webviewManager.displayHealthAnalysis(analysis);
				}
				
				// Show success message
				const summaryMessage = `Health Report: ${analysis.healthScore}/100 score, ${analysis.distribution.critical} critical files`;
				vscode.window.showInformationMessage(summaryMessage);
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log(`[ERROR] Health report failed: ${errorMessage}`);
				vscode.window.showErrorMessage(`Health report failed: ${errorMessage}`);
			}
		});
	});

	// Register the Health Report with Graph command (direct graph access)
	const healthReportGraphDisposable = vscode.commands.registerCommand('constellation.healthReportGraph', async () => {
		log('Health Report Graph command executed');
		
		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Generating health report with heatmap...',
			cancellable: false
		}, async (progress) => {
			try {
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceRoot) {
					throw new Error('No workspace folder found. Please open a workspace first.');
				}

				progress.report({ increment: 20, message: 'Initializing health analyzer...' });
				
				// Import services dynamically to avoid circular dependencies
				const { HealthAnalyzer } = await import('./services/health-analyzer.service');
				
				// Get or create HealthAnalyzer instance
				const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
				
				progress.report({ increment: 30, message: 'Checking graph data...' });
				
				// Ensure we have graph data
				const graphService = GraphService.getInstance();
				let graph = graphService.getGraph();
				
				if (!graph) {
					progress.report({ increment: 0, message: 'No graph data found. Scanning project first...' });
					
					// Trigger a scan first
					if (mcpProvider) {
						await mcpProvider.scanProject();
						graph = graphService.getGraph();
					}
					
					if (!graph) {
						throw new Error('Unable to load graph data. Please run "Constellation: Scan Project" first.');
					}
				}
				
				progress.report({ increment: 20, message: 'Analyzing file complexity and churn...' });
				
				// Perform health analysis
				const analysis = await healthAnalyzer.analyzeCodebase(graph);
				
				progress.report({ increment: 30, message: 'Applying heatmap to graph...' });
				
				// Apply heatmap directly to graph
				if (webviewManager) {
					await webviewManager.navigateFromDashboardToGraph(analysis.riskScores);
				}
				
				// Show success message
				const summaryMessage = `Health Heatmap Applied: ${analysis.healthScore}/100 score, ${analysis.distribution.critical} critical files highlighted`;
				vscode.window.showInformationMessage(summaryMessage);
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log(`[ERROR] Health report graph failed: ${errorMessage}`);
				vscode.window.showErrorMessage(`Health report graph failed: ${errorMessage}`);
			}
		});
	});

	// Register the Clear Heatmap command
	const clearHeatmapDisposable = vscode.commands.registerCommand('constellation.clearHeatmap', () => {
		log('Clear Heatmap command executed');
		
		try {
			if (webviewManager) {
				const panel = (webviewManager as any).currentPanel as vscode.WebviewPanel | undefined;
				if (panel) {
					panel.webview.postMessage({
						command: 'graph:clearHeatmap'
					});
					vscode.window.showInformationMessage('Health heatmap cleared from graph');
				} else {
					vscode.window.showWarningMessage('No graph panel is currently open');
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			log(`[ERROR] Clear heatmap failed: ${errorMessage}`);
			vscode.window.showErrorMessage(`Clear heatmap failed: ${errorMessage}`);
		}
	});

	// Register the legacy Analyze Health command (for backward compatibility)
	const analyzeHealthDisposable = vscode.commands.registerCommand('constellation.analyzeHealth', async () => {
		log('Analyze Health command executed (legacy)');
		
		// Show progress indicator
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Analyzing codebase health...',
			cancellable: false
		}, async (progress) => {
			try {
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceRoot) {
					throw new Error('No workspace folder found. Please open a workspace first.');
				}

				// Import services dynamically to avoid circular dependencies
				const { HealthAnalyzer } = await import('./services/health-analyzer.service');
				const { HealthDisplayService } = await import('./services/health-display.service');
				
				progress.report({ increment: 20, message: 'Initializing health analyzer...' });
				
				// Get or create HealthAnalyzer instance
				const healthAnalyzer = HealthAnalyzer.getInstance(workspaceRoot);
				
				progress.report({ increment: 30, message: 'Checking graph data...' });
				
				// Ensure we have graph data
				const graphService = GraphService.getInstance();
				let graph = graphService.getGraph();
				
				if (!graph) {
					progress.report({ increment: 0, message: 'No graph data found. Scanning project first...' });
					
					// Trigger a scan first
					if (mcpProvider) {
						await mcpProvider.scanProject();
						graph = graphService.getGraph();
					}
					
					if (!graph) {
						throw new Error('Unable to load graph data. Please run "Constellation: Scan Project" first.');
					}
				}
				
				progress.report({ increment: 20, message: 'Analyzing file complexity and churn...' });
				
				// Perform health analysis
				const analysis = await healthAnalyzer.analyzeCodebase(graph);
				
				progress.report({ increment: 30, message: 'Generating recommendations...' });
				
				// Display results using the dedicated service
				HealthDisplayService.displayInWebview(analysis, context);
				
				// Log detailed results to output channel
				HealthDisplayService.logAnalysisResults(analysis, output);
				
				// Show success message
				const summaryMessage = HealthDisplayService.createSummaryMessage(analysis);
				vscode.window.showInformationMessage(summaryMessage);
				
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				log(`[ERROR] Health analysis failed: ${errorMessage}`);
				vscode.window.showErrorMessage(`Health analysis failed: ${errorMessage}`);
			}
		});
	});

	// Register a debug command to manually launch the MCP stdio server
	const debugLaunchDisposable = vscode.commands.registerCommand('kiro-constellation.debugLaunchMcp', async () => {
		if (!IS_DEV) {
			log('[DEBUG] Debug launch is disabled in production builds');
			return;
		}
		try {
			const serverScriptPath = path.join(context.extensionPath, 'out', 'mcp-server.js');
			log(`[DEBUG] Spawning MCP server with: ${process.execPath} ${serverScriptPath}`);
			const child = spawn(process.execPath, [serverScriptPath], {
				cwd: context.extensionPath,
				env: process.env,
			});

			child.stdout.on('data', (data) => {
				output.appendLine(`[MCP STDOUT] ${data.toString().trim()}`);
			});
			child.stderr.on('data', (data) => {
				output.appendLine(`[MCP STDERR] ${data.toString().trim()}`);
			});
			child.on('exit', (code, signal) => {
				output.appendLine(`[MCP EXIT] code=${code} signal=${signal ?? ''}`);
			});

			// Send a quick initialize + tools/list over stdio to validate roundtrip
			const init = {
				jsonrpc: '2.0',
				id: 1,
				method: 'initialize',
				params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kiro-constellation', version: 'dev' } }
			};
			const list = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
			const call = { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'constellation_example_tool', arguments: { message: 'Hello from debug command' } } };
			const ping = { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'constellation_ping', arguments: {} } };
			child.stdin.write(`${JSON.stringify(init)}\n`);
			child.stdin.write(`${JSON.stringify(list)}\n`);
			child.stdin.write(`${JSON.stringify(call)}\n`);
			child.stdin.write(`${JSON.stringify(ping)}\n`);
		} catch (err) {
			log(`[DEBUG] Failed to launch MCP server: ${err instanceof Error ? err.message : String(err)}`);
		}
	});

	context.subscriptions.push(
		sidebarDisposable, 
		showGraphDisposable, 
		scanProjectDisposable, 
		healthReportDisposable,
		healthReportGraphDisposable,
		clearHeatmapDisposable,
		analyzeHealthDisposable, 
		debugLaunchDisposable
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

	if (USE_STANDARD_PROVIDER_POC) {
		console.log('[POC] Cleaning up MCP Provider POC...');
		// MCP Provider cleanup is handled automatically by VS Code through disposables
		mcpProvider = null;
	}
}


