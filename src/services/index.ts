import * as vscode from 'vscode';
import { EmbeddingService } from './EmbeddingService';
import { VectorStoreService } from './VectorStoreService';
import { VscodeService } from './VscodeService';
import { ErrorHandler } from '../utils/ErrorHandler';
import { ServiceMetrics, ServiceContainer } from '../types';

/**
 * Service initialization coordination module
 * This module extracts the service initialization logic from extension.ts
 * and provides a centralized place for managing service dependencies
 */

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
 * @param workspaceRoot The workspace root path to initialize services with
 * @returns Promise<ServiceContainer> Container with initialized services and metrics
 */
export async function initializeServices(workspaceRoot: string): Promise<ServiceContainer> {
	const initId = `services-init-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const startTime = Date.now();

	console.log(`[${initId}] 🚀 Extension: Starting service initialization...`);

	// Reset metrics
	const serviceMetrics: ServiceMetrics = {
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

	// Initialize services container
	let embeddingService: any = null;
	let vectorStoreService: any = null;
	let vscodeService: any = null;
	let embeddingServicesAvailable = false;

	// Validate workspace root path
	if (!workspaceRoot || workspaceRoot.trim().length === 0) {
		console.error(`[${initId}] ❌ Extension: Workspace root path is empty`);

		// Set services as unavailable and exit early
		serviceMetrics.totalInitializationTime = Date.now() - startTime;
		logServiceMetrics(initId, serviceMetrics);

		// Initialize VscodeService (always available)
		vscodeService = new VscodeService();

		return {
			embeddingService,
			vectorStoreService,
			vscodeService,
			metrics: serviceMetrics
		};
	}

	console.log(`[${initId}] 📁 Extension: Workspace root: ${workspaceRoot}`);

	let criticalFailures: string[] = [];
	let warnings: string[] = [];

	try {
		// Initialize EmbeddingService
		console.log(`[${initId}] 🤖 Extension: Initializing EmbeddingService...`);
		const embeddingStartTime = Date.now();

		try {
			await EmbeddingService.initialize();
			embeddingService = EmbeddingService.getInstance();
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
			vectorStoreService = VectorStoreService.getInstance();
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

	// Initialize VscodeService (always available)
	vscodeService = new VscodeService();

	// Return the service container with initialized services and metrics
	return {
		embeddingService,
		vectorStoreService,
		vscodeService,
		metrics: serviceMetrics
	};
}
