// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { ConfigurationLoader } from './utils/ConfigurationLoader';
import { PolarisController } from './controllers/PolarisController';
import { CommandController } from './controllers/CommandController';
import { EmbeddingService } from './services/EmbeddingService';
import { VectorStoreService } from './services/VectorStoreService';

/**
 * Singleton controllers for the extension
 */
let polarisController: PolarisController;
let commandController: CommandController;

/**
 * Flag to track if embedding services are available
 */
let embeddingServicesAvailable = false;

/**
 * Initialize embedding and vector storage services with proper error handling
 * Implements graceful degradation if services fail to initialize
 */
async function initializeServices(): Promise<void> {
	const initId = `services-init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const startTime = Date.now();

	console.log(`[${initId}] 🚀 Extension: Starting service initialization...`);

	// Get workspace root for proper path resolution
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
	console.log(`[${initId}] 📁 Extension: Using workspace root: ${workspaceRoot}`);

	try {
		// Initialize EmbeddingService
		console.log(`[${initId}] 🤖 Extension: Initializing EmbeddingService...`);
		const embeddingStartTime = Date.now();

		try {
			await EmbeddingService.initialize();
			const embeddingDuration = Date.now() - embeddingStartTime;
			console.log(`[${initId}] ✅ Extension: EmbeddingService initialized successfully (${embeddingDuration}ms)`);
		} catch (embeddingError) {
			const embeddingDuration = Date.now() - embeddingStartTime;
			console.error(`[${initId}] ❌ Extension: EmbeddingService initialization failed (${embeddingDuration}ms):`, embeddingError);

			// Log detailed error information
			if (embeddingError instanceof Error) {
				console.error(`[${initId}] 📋 Extension: EmbeddingService error: ${embeddingError.message}`);
			}

			// Show user notification for embedding service failure
			vscode.window.showWarningMessage(
				'Embedding service failed to initialize. Semantic search features will be unavailable.',
				'Details'
			).then(selection => {
				if (selection === 'Details') {
					const errorMsg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
					vscode.window.showErrorMessage(`Embedding service error: ${errorMsg}`);
				}
			});

			throw embeddingError; // Re-throw to prevent vector store initialization
		}

		// Initialize VectorStoreService
		console.log(`[${initId}] 🗄️ Extension: Initializing VectorStoreService...`);
		const vectorStartTime = Date.now();

		try {
			await VectorStoreService.initialize(workspaceRoot);
			const vectorDuration = Date.now() - vectorStartTime;
			console.log(`[${initId}] ✅ Extension: VectorStoreService initialized successfully (${vectorDuration}ms)`);
		} catch (vectorError) {
			const vectorDuration = Date.now() - vectorStartTime;
			console.error(`[${initId}] ❌ Extension: VectorStoreService initialization failed (${vectorDuration}ms):`, vectorError);

			// Log detailed error information
			if (vectorError instanceof Error) {
				console.error(`[${initId}] 📋 Extension: VectorStoreService error: ${vectorError.message}`);
			}

			// Show user notification for vector store service failure
			vscode.window.showWarningMessage(
				'Vector storage service failed to initialize. Embedding storage will be unavailable.',
				'Details'
			).then(selection => {
				if (selection === 'Details') {
					const errorMsg = vectorError instanceof Error ? vectorError.message : String(vectorError);
					vscode.window.showErrorMessage(`Vector storage error: ${errorMsg}`);
				}
			});

			throw vectorError; // Re-throw to indicate service initialization failure
		}

		// Mark services as available
		embeddingServicesAvailable = true;

		const totalDuration = Date.now() - startTime;
		console.log(`[${initId}] 🎉 Extension: All services initialized successfully (${totalDuration}ms)`);

		// Show success notification
		vscode.window.showInformationMessage('Embedding and vector storage services initialized successfully!');

	} catch (error) {
		const totalDuration = Date.now() - startTime;
		console.error(`[${initId}] ❌ Extension: Service initialization failed (${totalDuration}ms):`, error);

		// Mark services as unavailable
		embeddingServicesAvailable = false;

		// Log graceful degradation
		console.log(`[${initId}] 🔄 Extension: Continuing with graceful degradation - embedding features disabled`);
		console.log(`[${initId}] ✅ Extension: Main documentation workflow will continue without embedding support`);

		// Enhanced error categorization for monitoring
		let errorCategory = 'unknown';
		if (error instanceof Error) {
			if (error.message.includes('network') || error.message.includes('fetch')) {
				errorCategory = 'network';
			} else if (error.message.includes('memory') || error.message.includes('allocation')) {
				errorCategory = 'memory';
			} else if (error.message.includes('permission') || error.message.includes('access')) {
				errorCategory = 'permission';
			} else if (error.message.includes('model') || error.message.includes('transformer')) {
				errorCategory = 'model';
			} else if (error.message.includes('database') || error.message.includes('vector')) {
				errorCategory = 'database';
			}
		}

		console.error(`[${initId}] 🏷️ Extension: Service initialization error category: ${errorCategory}`);

		// Don't throw the error - allow extension to continue with graceful degradation
		// The main documentation workflow should continue to work
	}
}

/**
 * Check if embedding services are available for use
 * @returns boolean True if both services are initialized and available
 */
export function areEmbeddingServicesAvailable(): boolean {
	return embeddingServicesAvailable;
}

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
	const startTime = Date.now();
	const filePath = document.fileName;
	const operationId = `save-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	
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
export async function activate(context: vscode.ExtensionContext) {
	try {
		// Load environment variables from .env file
		ConfigurationLoader.loadEnvironment(context);

		console.log('Kiro Constellation extension activated!');
		vscode.window.showInformationMessage('Kiro Constellation extension activated!');

		// Initialize singleton controllers
		polarisController = new PolarisController(context);
		commandController = new CommandController(context);

		// Initialize embedding and vector storage services
		await initializeServices();

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
