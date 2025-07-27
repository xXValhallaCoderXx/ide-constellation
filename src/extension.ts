// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { processDocument } from './contentProcessor';

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
function handleDocumentSave(document: vscode.TextDocument): void {
	console.log("HANDLE DOCUMENT SAVE");
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			// Process the document (currently logs content to Debug Console)
			processDocument(document);
		}
	} catch (error) {
		// Ensure extension stability by catching all errors in save event processing
		console.error('Error in file save event handler:', error);

		// Provide fallback logging to indicate an error occurred
		try {
			console.log(`File save event error for: ${document.fileName}`);
		} catch (fallbackError) {
			console.error('Critical error in save event handler:', fallbackError);
		}
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "kiro-constellation" is now active!');

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
		vscode.window.showInformationMessage('Hello World from kiro-Seeeeee!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
