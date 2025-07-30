// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ConfigurationLoader } from './utils/ConfigurationLoader';
import { PolarisController } from './controllers/PolarisController';
import { registerDebugCommands } from './commands/debugCommands';
import { initializeServices } from './services/index';
import { ServiceMetrics, ServiceContainer } from './types';

/**
 * Singleton controllers for the extension
 */
let polarisController: PolarisController;

/**
 * Service container with initialized services and metrics
 */
let serviceContainer: ServiceContainer;

/**
 * This method is called when your extension is activated
 * Your extension is activated the very first time the command is executed
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log('🚀 Extension: Kiro Constellation is activating...');

	try {
		// Load environment configuration
		ConfigurationLoader.loadEnvironment(context);

		// Get workspace root for service initialization
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			console.error('❌ Extension: No workspace folder is open');
			vscode.window.showErrorMessage("Kiro Constellation could not start: No workspace folder is open.");
			return;
		}
		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		// Initialize services using the new centralized initialization
		console.log('🔧 Extension: Initializing services...');
		serviceContainer = await initializeServices(workspaceRoot);

		// Instantiate controllers
		polarisController = new PolarisController(context);

		// Register debug commands
		registerDebugCommands(context, serviceContainer.vscodeService);

		// Register VSCode event handlers with simple delegation
		const onDidSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
			await polarisController.onDidSave(document);
		});
		context.subscriptions.push(onDidSaveDisposable);

		const onDidDeleteDisposable = vscode.workspace.onDidDeleteFiles(async (deleteEvent) => {
			await polarisController.handleFilesDeletion(deleteEvent.files);
		});
		context.subscriptions.push(onDidDeleteDisposable);

		console.log('✅ Extension: Kiro Constellation activated successfully');

	} catch (error) {
		console.error('❌ Extension: Activation failed:', error);

		// Show user notification about activation failure
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		vscode.window.showErrorMessage(`Kiro Constellation failed to activate: ${errorMsg}`);
	}
}

/**
 * This method is called when your extension is deactivated
 */
export function deactivate() {
	console.log('🔄 Extension: Kiro Constellation is deactivating...');
}

/**
 * Get service metrics for monitoring and debugging
 * @returns ServiceMetrics Current service metrics
 */
export function getServiceMetrics(): ServiceMetrics {
	return serviceContainer?.metrics || {
		embeddingService: {
			initializationTime: 0,
			initializationSuccess: false
		},
		vectorStoreService: {
			initializationTime: 0,
			initializationSuccess: false
		},
		totalInitializationTime: 0
	};
}

/**
 * Check if embedding services are available for use
 * @returns boolean True if both services are initialized and available
 */
export function areEmbeddingServicesAvailable(): boolean {
	return serviceContainer?.metrics.embeddingService.initializationSuccess &&
		serviceContainer?.metrics.vectorStoreService.initializationSuccess || false;
}
