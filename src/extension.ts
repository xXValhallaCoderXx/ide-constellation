// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('🚀 KIRO-CONSTELLATION: Extension is activating...');
	console.log('🚀 KIRO-CONSTELLATION: VS Code version:', vscode.version);
	console.log('🚀 KIRO-CONSTELLATION: Extension context:', context.extensionPath);
	console.log('🚀 KIRO-CONSTELLATION: Extension is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	try {
		const disposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
			console.log('🚀 KIRO-CONSTELLATION: Hello World command executed!');
			vscode.window.showInformationMessage('Hello World from Kiro Constellation!');
		});

		context.subscriptions.push(disposable);
		console.log('🚀 KIRO-CONSTELLATION: Command registered successfully!');
	} catch (error) {
		console.error('🚀 KIRO-CONSTELLATION: Error registering command:', error);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
