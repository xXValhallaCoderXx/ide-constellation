import * as vscode from 'vscode';
import { WebviewManager } from './webview/webview.service';
import { KiroConstellationMCPProvider } from './mcp/mcp.provider';
import * as path from 'path';
import { spawn } from 'child_process';

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
	} else {
		// Legacy HTTP server path removed; MCP provider is the default
		log('[PRODUCTION] MCP provider path active');
		webviewManager = new WebviewManager(null, output);
	}

	// Register the Hello World command (keeping for compatibility)
	const helloWorldDisposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		log('Hello World command executed');
		vscode.window.showInformationMessage('Hello World from kiro-constellation!');
	});

	// Register the Show Panel command
	const showPanelDisposable = vscode.commands.registerCommand('kiro-constellation.showPanel', () => {
		log('Show Panel command executed');
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

	context.subscriptions.push(helloWorldDisposable, showPanelDisposable, scanProjectDisposable, debugLaunchDisposable);
}

export async function deactivate() {
	// No output channel at this point; keep a console log for host logs
	console.log('Kiro Constellation extension is deactivating...');
	
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


