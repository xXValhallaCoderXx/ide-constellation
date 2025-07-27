// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { processDocument } from './contentProcessor';

/**
 * Map to track ongoing processing tasks to handle concurrent saves gracefully
 */
const processingTasks = new Map<string, Promise<void>>();

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
	const startTime = Date.now();
	const filePath = document.fileName;
	
	console.log(`HANDLE DOCUMENT SAVE: ${filePath}`);
	
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			// Handle concurrent file save events gracefully
			const existingTask = processingTasks.get(filePath);
			if (existingTask) {
				console.log(`File already being processed, waiting for completion: ${filePath}`);
				await existingTask;
				console.log(`Previous processing completed for: ${filePath}`);
			}

			// Process the document asynchronously without blocking the save operation
			const processingTask = processDocumentAsync(document, startTime);
			processingTasks.set(filePath, processingTask);

			// Clean up the tracking when processing completes
			processingTask.finally(() => {
				processingTasks.delete(filePath);
			});

			// Don't await here to keep file save operations responsive
			// The processing happens in the background
		} else {
			const endTime = Date.now();
			console.log(`File save completed (filtered out): ${filePath} (${endTime - startTime}ms)`);
		}
	} catch (error) {
		// Ensure extension stability by catching all errors in save event processing
		console.error('Error in file save event handler:', error);

		// Provide fallback logging to indicate an error occurred
		try {
			const endTime = Date.now();
			console.log(`File save event error for: ${filePath} (${endTime - startTime}ms)`);
		} catch (fallbackError) {
			console.error('Critical error in save event handler:', fallbackError);
		}
	}
}

/**
 * Processes a document asynchronously with performance logging
 * @param document - The saved text document
 * @param startTime - When the save event started
 */
async function processDocumentAsync(document: vscode.TextDocument, startTime: number): Promise<void> {
	const filePath = document.fileName;
	const processingStartTime = Date.now();
	
	try {
		console.log(`Starting background processing: ${filePath}`);
		
		// Process the document (includes structural indexing)
		await processDocument(document);
		
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;
		
		console.log(`✅ Processing completed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`);
		
	} catch (error) {
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;
		
		console.error(`❌ Processing failed: ${filePath} (total: ${totalTime}ms, processing: ${processingTime}ms)`, error);
		
		// Don't rethrow - we want background processing errors to be logged but not crash the extension
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Kiro Constellation extension activated!');

	// Show a welcome message
	vscode.window.showInformationMessage('Kiro Constellation extension activated!');

	// Register file save event listener
	const saveListener = vscode.workspace.onDidSaveTextDocument(handleDocumentSave);

	// Add the save listener to context subscriptions for proper disposal
	context.subscriptions.push(saveListener);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from kiro-constellation!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Kiro Constellation extension deactivated');
}
