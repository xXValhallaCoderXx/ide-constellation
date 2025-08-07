// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WebviewManager } from './ui/webview/WebviewManager';
import { SidebarProvider } from './ui/sidebar/SidebarProvider';
import { generateDependencyGraph } from './analyzer';

/**
 * Lightweight debounce function to prevent excessive analysis calls
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T {
	let timeoutId: NodeJS.Timeout | undefined;
	
	return ((...args: Parameters<T>) => {
		// Clear existing timeout
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		
		// Set new timeout
		timeoutId = setTimeout(() => {
			func.apply(null, args);
		}, delay);
	}) as T;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('🚀 KIRO-CONSTELLATION: Extension is activating...');
	console.log('🚀 KIRO-CONSTELLATION: VS Code version:', vscode.version);
	console.log('🚀 KIRO-CONSTELLATION: Extension context:', context.extensionPath);
	console.log('🚀 KIRO-CONSTELLATION: Extension is now active!');

	// Create WebviewManager instance
	const webviewManager = new WebviewManager(context);

	/**
	 * Performs dependency analysis for the given workspace
	 * @param workspaceRoot - Path to the workspace root
	 */
	async function performDependencyAnalysis(workspaceRoot: string): Promise<void> {
		try {
			console.log('🚀 KIRO-CONSTELLATION: Starting dependency analysis...');
			const dependencyGraph = await generateDependencyGraph(workspaceRoot);
			
			// Log analysis results for debugging
			console.log('🚀 KIRO-CONSTELLATION: Analysis completed successfully');
			console.log('🚀 KIRO-CONSTELLATION: Module count:', dependencyGraph.modules.length);
			console.log('🚀 KIRO-CONSTELLATION: Total dependencies:', dependencyGraph.summary.totalDependencies);
			console.log('🚀 KIRO-CONSTELLATION: Violations found:', dependencyGraph.summary.violations.length);
			
			if (dependencyGraph.summary.error) {
				console.log('🚀 KIRO-CONSTELLATION: Analysis completed with error:', dependencyGraph.summary.error);
			}
			
			// Log first few modules for debugging (avoid overwhelming console)
			if (dependencyGraph.modules.length > 0) {
				const sampleModules = dependencyGraph.modules.slice(0, 3);
				console.log('🚀 KIRO-CONSTELLATION: Sample modules:', JSON.stringify(sampleModules, null, 2));
			}
			
		} catch (error) {
			console.error('🚀 KIRO-CONSTELLATION: Analysis failed with error:', error);
			console.error('🚀 KIRO-CONSTELLATION: Error details:', {
				message: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined,
				workspaceRoot
			});
		}
	}

	// Create debounced analysis function with 500ms delay as specified in requirements
	const debouncedAnalysis = debounce(performDependencyAnalysis, 500);

	// Set up file save event listener
	const fileSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
		console.log('🚀 KIRO-CONSTELLATION: File save event detected:', document.fileName);
		
		// Validate workspace folder availability
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			console.log('🚀 KIRO-CONSTELLATION: No workspace folder open, skipping analysis');
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;
		console.log('🚀 KIRO-CONSTELLATION: Workspace root path:', workspaceRoot);
		console.log('🚀 KIRO-CONSTELLATION: Triggering debounced analysis...');
		
		// Use debounced analysis function to prevent excessive calls
		debouncedAnalysis(workspaceRoot);
		
		console.log('🚀 KIRO-CONSTELLATION: File save event handling complete');
	});

	// Create and register sidebar provider
	const sidebarProvider = new SidebarProvider(context.extensionUri);
	console.log('🚀 KIRO-CONSTELLATION: Created SidebarProvider instance');
	const sidebarDisposable = vscode.window.registerWebviewViewProvider(
		SidebarProvider.viewType,
		sidebarProvider
	);
	console.log('🚀 KIRO-CONSTELLATION: Registered webview view provider for:', SidebarProvider.viewType);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	try {
		const helloWorldDisposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
			console.log('🚀 KIRO-CONSTELLATION: Hello World command executed!');
			vscode.window.showInformationMessage('Hello World from Kiro Constellation!');
		});

		// Register the new showMap command
		const showMapDisposable = vscode.commands.registerCommand('kiro-constellation.showMap', () => {
			console.log('🚀 KIRO-CONSTELLATION: Show Map command executed!');
			webviewManager.createOrShowPanel();
		});

		context.subscriptions.push(helloWorldDisposable);
		context.subscriptions.push(showMapDisposable);
		context.subscriptions.push(sidebarDisposable);
		context.subscriptions.push(fileSaveDisposable);
		console.log('🚀 KIRO-CONSTELLATION: All commands and event listeners registered successfully!');
	} catch (error) {
		console.error('🚀 KIRO-CONSTELLATION: Error registering commands:', error);
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}
