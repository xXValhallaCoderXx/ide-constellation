import * as vscode from 'vscode';
import { MCPServer } from './server/mcpServer';
import { WebviewManager } from './webview/webviewManager';

// Global instances
let mcpServer: MCPServer | null = null;
let webviewManager: WebviewManager | null = null;

export async function activate(context: vscode.ExtensionContext) {
	console.log('Kiro Constellation extension is now active!');

	// Initialize MCP Server
	try {
		mcpServer = new MCPServer();
		await mcpServer.start();
		console.log(`MCP Server started on port ${mcpServer.getPort()}`);
	} catch (error) {
		console.error('Failed to start MCP Server:', error);
		vscode.window.showErrorMessage('Failed to start Kiro Constellation MCP Server');
	}

	// Initialize Webview Manager
	webviewManager = new WebviewManager(mcpServer);

	// Register the Hello World command (keeping for compatibility)
	const helloWorldDisposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from kiro-constellation!');
	});

	// Register the Show Panel command
	const showPanelDisposable = vscode.commands.registerCommand('kiro-constellation.showPanel', () => {
		webviewManager?.createOrShowPanel(context);
	});

	context.subscriptions.push(helloWorldDisposable, showPanelDisposable);
}

export async function deactivate() {
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


