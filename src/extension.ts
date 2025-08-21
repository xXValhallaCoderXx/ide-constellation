import * as vscode from 'vscode';
import { MCPServer } from './server/mcpServer';
import { WebviewManager } from './webview/webviewManager';

// Global instances
let mcpServer: MCPServer | null = null;
let webviewManager: WebviewManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('Kiro Constellation');
	context.subscriptions.push(output);
	const log = (msg: string) => {
		const line = `[${new Date().toISOString()}] ${msg}`;
		console.log(line);
		output.appendLine(line);
	};

	log('Extension activating...');

	// Initialize MCP Server
	try {
		mcpServer = new MCPServer();
		await mcpServer.start();
		log(`MCP Server started on port ${mcpServer.getPort()}`);
	} catch (error) {
		log(`Failed to start MCP Server: ${error instanceof Error ? error.message : String(error)}`);
		vscode.window.showErrorMessage('Failed to start Kiro Constellation MCP Server');
	}

	// Initialize Webview Manager
	webviewManager = new WebviewManager(mcpServer, output);

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

	context.subscriptions.push(helloWorldDisposable, showPanelDisposable);
}

export async function deactivate() {
	// No output channel at this point; keep a console log for host logs
	console.log('Kiro Constellation extension is deactivating...');
	
	// Clean up webview manager
	if (webviewManager) {
		webviewManager.dispose();
		webviewManager = null;
	}

	// Stop MCP Server
	if (mcpServer) {
		try {
			await mcpServer.stop();
			console.log('MCP Server stopped successfully');
		} catch (error) {
			console.error('Error stopping MCP Server:', error);
		}
		mcpServer = null;
	}
}


