// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { ConfigurationLoader } from './utils/ConfigurationLoader';
import { PolarisController } from './controllers/PolarisController';
import { CommandController } from './controllers/CommandController';

/**
 * Singleton controllers for the extension
 */
let polarisController: PolarisController;
let commandController: CommandController;

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
	const startTime = Date.now();
	const filePath = document.fileName;
	const operationId = `save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	
	console.log(`[${operationId}] HANDLE DOCUMENT SAVE: ${filePath}`);
	
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			console.log(`[${operationId}] Document passed filtering, proceeding with processing`);
			
			// Delegate to PolarisController for processing
			await polarisController.processFileDocumentation(document, startTime, operationId);
		} else {
			console.log(`[${operationId}] Document filtered out, skipping processing: ${filePath}`);
		}
	} catch (error) {
		console.error(`[${operationId}] Error in handleDocumentSave for ${filePath}:`, error);
		vscode.window.showErrorMessage(`Failed to process document save for ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export function activate(context: vscode.ExtensionContext) {
	try {
		// Load environment variables from .env file
		ConfigurationLoader.loadEnvironment(context);

		console.log('Kiro Constellation extension activated!');
		vscode.window.showInformationMessage('Kiro Constellation extension activated!');

		// Initialize singleton controllers
		polarisController = new PolarisController(context);
		commandController = new CommandController(context);

		// Register file save event listener
		const saveListener = vscode.workspace.onDidSaveTextDocument(handleDocumentSave);
		context.subscriptions.push(saveListener);

		// Register file deletion event listener for documentation synchronization
		const deleteListener = vscode.workspace.onDidDeleteFiles(polarisController.handleFilesDeletion.bind(polarisController));
		context.subscriptions.push(deleteListener);

		// Register all commands through CommandController
		commandController.registerCommands();

	} catch (error) {
		console.error('Failed to activate extension:', error);
		vscode.window.showErrorMessage(`Failed to activate Kiro Constellation extension: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
	console.log('Kiro Constellation extension deactivated');
}
