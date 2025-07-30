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
import { ErrorHandler } from './utils/ErrorHandler';

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
 * Performance and error metrics for monitoring
 */
interface ServiceMetrics {
	embeddingService: {
		initializationTime: number;
		initializationSuccess: boolean;
		errorCategory?: string;
		errorMessage?: string;
	};
	vectorStoreService: {
		initializationTime: number;
		initializationSuccess: boolean;
		errorCategory?: string;
		errorMessage?: string;
	};
	totalInitializationTime: number;
}

let serviceMetrics: ServiceMetrics = {
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



/**
 * Log performance metrics for monitoring and debugging
 * @param initId Initialization ID for logging
 * @param metrics Service metrics to log
 */
function logServiceMetrics(initId: string, metrics: ServiceMetrics): void {
	console.log(`[${initId}] 📊 Extension: Service initialization metrics:`);
	console.log(`[${initId}]   - Total time: ${metrics.totalInitializationTime}ms`);
	console.log(`[${initId}]   - EmbeddingService: ${metrics.embeddingService.initializationTime}ms (${metrics.embeddingService.initializationSuccess ? 'SUCCESS' : 'FAILED'})`);
	console.log(`[${initId}]   - VectorStoreService: ${metrics.vectorStoreService.initializationTime}ms (${metrics.vectorStoreService.initializationSuccess ? 'SUCCESS' : 'FAILED'})`);

	if (!metrics.embeddingService.initializationSuccess) {
		console.log(`[${initId}]   - EmbeddingService error: ${metrics.embeddingService.errorCategory} - ${metrics.embeddingService.errorMessage}`);
	}

	if (!metrics.vectorStoreService.initializationSuccess) {
		console.log(`[${initId}]   - VectorStoreService error: ${metrics.vectorStoreService.errorCategory} - ${metrics.vectorStoreService.errorMessage}`);
	}
}

/**
 * Initialize embedding and vector storage services with comprehensive error handling
 * Implements graceful degradation if services fail to initialize
 */
async function initializeServices(): Promise<void> {
	const initId = `services-init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const startTime = Date.now();

	console.log(`[${initId}] 🚀 Extension: Starting service initialization...`);

	// Reset metrics
	serviceMetrics = {
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

	// Robust workspace root detection with proper error handling
	let workspaceRoot: string;
	try {
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders || workspaceFolders.length === 0) {
			console.error(`[${initId}] ❌ Extension: No workspace folder is open`);

			// Display error message to user
			const errorMessage = "Kiro Constellation could not start: No workspace folder is open.";
			vscode.window.showErrorMessage(errorMessage);

			// Log workspace root detection failure
			console.error(`[${initId}] 🚫 Extension: Workspace root detection failed - extension will be disabled`);

			// Set services as unavailable and exit early
			embeddingServicesAvailable = false;
			serviceMetrics.totalInitializationTime = Date.now() - startTime;

			console.log(`[${initId}] ⚠️ Extension: Services disabled due to workspace detection failure (${serviceMetrics.totalInitializationTime}ms)`);
			logServiceMetrics(initId, serviceMetrics);
			return; // Exit early - no services will be initialized
		}

		workspaceRoot = workspaceFolders[0].uri.fsPath;
		console.log(`[${initId}] 📁 Extension: Workspace root detection successful: ${workspaceRoot}`);

		// Validate workspace root path
		if (!workspaceRoot || workspaceRoot.trim().length === 0) {
			throw new Error('Workspace root path is empty');
		}

	} catch (workspaceError) {
		console.error(`[${initId}] ❌ Extension: Workspace root detection error:`, workspaceError);

		const errorMessage = "Kiro Constellation could not start: No workspace folder is open.";
		vscode.window.showErrorMessage(errorMessage);

		// Set services as unavailable and exit early
		embeddingServicesAvailable = false;
		serviceMetrics.totalInitializationTime = Date.now() - startTime;

		console.log(`[${initId}] ⚠️ Extension: Services disabled due to workspace detection error (${serviceMetrics.totalInitializationTime}ms)`);
		logServiceMetrics(initId, serviceMetrics);
		return; // Exit early - no services will be initialized
	}

	let criticalFailures: string[] = [];
	let warnings: string[] = [];

	try {
		// Initialize EmbeddingService
		console.log(`[${initId}] 🤖 Extension: Initializing EmbeddingService...`);
		const embeddingStartTime = Date.now();

		try {
			await EmbeddingService.initialize();
			serviceMetrics.embeddingService.initializationTime = Date.now() - embeddingStartTime;
			serviceMetrics.embeddingService.initializationSuccess = true;
			console.log(`[${initId}] ✅ Extension: EmbeddingService initialized successfully (${serviceMetrics.embeddingService.initializationTime}ms)`);
		} catch (embeddingError) {
			serviceMetrics.embeddingService.initializationTime = Date.now() - embeddingStartTime;
			serviceMetrics.embeddingService.initializationSuccess = false;

			const errorInfo = ErrorHandler.categorizeError(embeddingError);
			serviceMetrics.embeddingService.errorCategory = errorInfo.category;
			serviceMetrics.embeddingService.errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);

			console.error(`[${initId}] ❌ Extension: EmbeddingService initialization failed (${serviceMetrics.embeddingService.initializationTime}ms):`, embeddingError);
			console.error(`[${initId}] 🏷️ Extension: Error category: ${errorInfo.category}, Retryable: ${errorInfo.isRetryable}`);

			// Log detailed error information
			if (embeddingError instanceof Error && embeddingError.stack) {
				console.error(`[${initId}] 📚 Extension: EmbeddingService error stack:`, embeddingError.stack);
			}

			criticalFailures.push(`Embedding service: ${errorInfo.userMessage}`);

			// Show user notification for embedding service failure
			const message = `Embedding service failed to initialize: ${errorInfo.userMessage}`;
			vscode.window.showWarningMessage(
				message,
				'Details', 'Retry'
			).then(async selection => {
				if (selection === 'Details') {
					const errorMsg = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
					vscode.window.showErrorMessage(`Embedding service error (${errorInfo.category}): ${errorMsg}`);
				} else if (selection === 'Retry' && errorInfo.isRetryable) {
					console.log(`[${initId}] 🔄 Extension: User requested retry for EmbeddingService`);
					// Note: In a real implementation, you might want to implement retry logic here
					vscode.window.showInformationMessage('Please reload the extension to retry initialization.');
				}
			});

			throw embeddingError; // Re-throw to prevent vector store initialization
		}

		// Initialize VectorStoreService
		console.log(`[${initId}] 🗄️ Extension: Initializing VectorStoreService...`);
		const vectorStartTime = Date.now();

		try {
			await VectorStoreService.initialize(workspaceRoot);
			serviceMetrics.vectorStoreService.initializationTime = Date.now() - vectorStartTime;
			serviceMetrics.vectorStoreService.initializationSuccess = true;
			console.log(`[${initId}] ✅ Extension: VectorStoreService initialized successfully (${serviceMetrics.vectorStoreService.initializationTime}ms)`);
		} catch (vectorError) {
			serviceMetrics.vectorStoreService.initializationTime = Date.now() - vectorStartTime;
			serviceMetrics.vectorStoreService.initializationSuccess = false;

			const errorInfo = ErrorHandler.categorizeError(vectorError);
			serviceMetrics.vectorStoreService.errorCategory = errorInfo.category;
			serviceMetrics.vectorStoreService.errorMessage = vectorError instanceof Error ? vectorError.message : String(vectorError);

			console.error(`[${initId}] ❌ Extension: VectorStoreService initialization failed (${serviceMetrics.vectorStoreService.initializationTime}ms):`, vectorError);
			console.error(`[${initId}] 🏷️ Extension: Error category: ${errorInfo.category}, Retryable: ${errorInfo.isRetryable}`);

			// Log detailed error information
			if (vectorError instanceof Error && vectorError.stack) {
				console.error(`[${initId}] 📚 Extension: VectorStoreService error stack:`, vectorError.stack);
			}

			criticalFailures.push(`Vector storage service: ${errorInfo.userMessage}`);

			// Show user notification for vector store service failure
			const message = `Vector storage service failed to initialize: ${errorInfo.userMessage}`;
			vscode.window.showWarningMessage(
				message,
				'Details', 'Retry'
			).then(async selection => {
				if (selection === 'Details') {
					const errorMsg = vectorError instanceof Error ? vectorError.message : String(vectorError);
					vscode.window.showErrorMessage(`Vector storage error (${errorInfo.category}): ${errorMsg}`);
				} else if (selection === 'Retry' && errorInfo.isRetryable) {
					console.log(`[${initId}] 🔄 Extension: User requested retry for VectorStoreService`);
					// Note: In a real implementation, you might want to implement retry logic here
					vscode.window.showInformationMessage('Please reload the extension to retry initialization.');
				}
			});

			throw vectorError; // Re-throw to indicate service initialization failure
		}

		// Mark services as available
		embeddingServicesAvailable = true;
		serviceMetrics.totalInitializationTime = Date.now() - startTime;

		// Log success metrics
		logServiceMetrics(initId, serviceMetrics);
		console.log(`[${initId}] 🎉 Extension: All services initialized successfully (${serviceMetrics.totalInitializationTime}ms)`);

		// Show success notification with performance info
		const successMessage = `Embedding services initialized successfully! (${serviceMetrics.totalInitializationTime}ms)`;
		vscode.window.showInformationMessage(successMessage);

	} catch (error) {
		serviceMetrics.totalInitializationTime = Date.now() - startTime;
		embeddingServicesAvailable = false;

		console.error(`[${initId}] ❌ Extension: Service initialization failed (${serviceMetrics.totalInitializationTime}ms):`, error);

		// Log comprehensive metrics even on failure
		logServiceMetrics(initId, serviceMetrics);

		// Log graceful degradation
		console.log(`[${initId}] 🔄 Extension: Continuing with graceful degradation - embedding features disabled`);
		console.log(`[${initId}] ✅ Extension: Main documentation workflow will continue without embedding support`);

		// Enhanced error categorization for monitoring
		const errorInfo = ErrorHandler.categorizeError(error);
		console.error(`[${initId}] 🏷️ Extension: Service initialization error category: ${errorInfo.category}`);

		// Show comprehensive user notification about degraded functionality
		if (criticalFailures.length > 0) {
			const failureMessage = `Some services failed to initialize:\n${criticalFailures.join('\n')}\n\nDocumentation generation will continue without semantic search features.`;
			vscode.window.showWarningMessage(
				'Extension running in degraded mode',
				'Details', 'Continue'
			).then(selection => {
				if (selection === 'Details') {
					vscode.window.showErrorMessage(failureMessage);
				}
			});
		}

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
 * Get service metrics for monitoring and debugging
 * @returns ServiceMetrics Current service metrics
 */
export function getServiceMetrics(): ServiceMetrics {
	return { ...serviceMetrics };
}

/**
 * Handles document save events with filtering and processing
 * @param document - The saved text document
 */
async function handleDocumentSave(document: vscode.TextDocument): Promise<void> {
	const startTime = Date.now();
	const filePath = document.fileName;
	const operationId = `save-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const fileName = path.basename(filePath);
	const fileSize = document.getText().length;
	
	console.log(`[${operationId}] 📄 HANDLE DOCUMENT SAVE: ${fileName} (${fileSize} bytes)`);
	
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			console.log(`[${operationId}] ✅ Document passed filtering, proceeding with processing`);

			// Log embedding service availability
			if (embeddingServicesAvailable) {
				console.log(`[${operationId}] 🔍 Embedding services available - full processing enabled`);
			} else {
				console.log(`[${operationId}] ⚠️ Embedding services unavailable - processing without semantic features`);
			}
			
			// Delegate to PolarisController for processing
			await polarisController.processFileDocumentation(document, startTime, operationId);

			const totalDuration = Date.now() - startTime;
			console.log(`[${operationId}] ✅ Document save processing completed (${totalDuration}ms)`);

		} else {
			console.log(`[${operationId}] 🚫 Document filtered out, skipping processing: ${fileName}`);
		}
	} catch (error) {
		const totalDuration = Date.now() - startTime;
		console.error(`[${operationId}] ❌ Error in handleDocumentSave for ${fileName} (${totalDuration}ms):`, error);

		// Enhanced error logging
		if (error instanceof Error) {
			console.error(`[${operationId}] 📋 Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] 📋 Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] 📚 Error stack:`, error.stack);
			}
		}

		// Categorize error for better user feedback
		const errorInfo = ErrorHandler.categorizeError(error);
		console.error(`[${operationId}] 🏷️ Error category: ${errorInfo.category}`);

		// Show user-friendly error message
		const userMessage = `Failed to process ${fileName}: ${errorInfo.userMessage}`;
		if (errorInfo.isRetryable) {
			vscode.window.showWarningMessage(
				userMessage,
				'Retry', 'Details'
			).then(selection => {
				if (selection === 'Retry') {
					console.log(`[${operationId}] 🔄 User requested retry for document processing`);
					// Trigger another save event or manual processing
					vscode.window.showInformationMessage('Please save the file again to retry processing.');
				} else if (selection === 'Details') {
					const errorMsg = error instanceof Error ? error.message : String(error);
					vscode.window.showErrorMessage(`Document processing error (${errorInfo.category}): ${errorMsg}`);
				}
			});
		} else {
			vscode.window.showErrorMessage(userMessage, 'Details').then(selection => {
				if (selection === 'Details') {
					const errorMsg = error instanceof Error ? error.message : String(error);
					vscode.window.showErrorMessage(`Document processing error (${errorInfo.category}): ${errorMsg}`);
				}
			});
		}
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
