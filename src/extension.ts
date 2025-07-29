// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { shouldProcessDocument, DEFAULT_CONFIG } from './documentFilter';
import { processDocument } from './contentProcessor';
import { CodeParserService } from './services/CodeParserService';
import { DocGeneratorService } from './services/DocGeneratorService';
import { CodeSymbol, ParsedJSDoc } from './types';

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
	const operationId = `save-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	
	console.log(`[${operationId}] HANDLE DOCUMENT SAVE: ${filePath}`);
	
	try {
		// Apply document filtering to determine if we should process this file
		if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
			console.log(`[${operationId}] Document passed filtering, proceeding with processing`);

			// Handle concurrent file save events gracefully
			const existingTask = processingTasks.get(filePath);
			if (existingTask) {
				console.log(`[${operationId}] File already being processed, waiting for completion: ${filePath}`);
				try {
					await existingTask;
					console.log(`[${operationId}] Previous processing completed for: ${filePath}`);
				} catch (existingTaskError) {
					console.error(`[${operationId}] Previous processing failed for: ${filePath}`, existingTaskError);
					// Continue with new processing attempt despite previous failure
				}
			}

			// Process the document with new file-level documentation workflow
			const processingTask = processFileDocumentationAsync(document, startTime, operationId);
			processingTasks.set(filePath, processingTask);

			// Clean up the tracking when processing completes
			processingTask.finally(() => {
				processingTasks.delete(filePath);
				console.log(`[${operationId}] Removed processing task from tracking map`);
			});

			// Don't await here to keep file save operations responsive
			// The processing happens in the background
		} else {
			const endTime = Date.now();
			console.log(`[${operationId}] File save completed (filtered out): ${filePath} (${endTime - startTime}ms)`);
		}
	} catch (error) {
		// Ensure extension stability by catching all errors in save event processing
		const endTime = Date.now();
		const duration = endTime - startTime;

		console.error(`[${operationId}] Critical error in file save event handler for ${filePath} (${duration}ms):`, error);

		// Log detailed error information for debugging
		if (error instanceof Error) {
			console.error(`[${operationId}] Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] Error stack:`, error.stack);
			}
		}

		// Provide fallback logging to indicate an error occurred
		try {
			console.log(`[${operationId}] File save event error for: ${filePath} (${duration}ms)`);

			// Show user notification for critical errors
			vscode.window.showWarningMessage(
				`Documentation processing failed for ${path.basename(filePath)}. Check the output panel for details.`
			);
		} catch (fallbackError) {
			console.error(`[${operationId}] Critical error in save event handler fallback:`, fallbackError);
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

/**
 * Processes a document for file-level documentation generation
 * @param document - The saved text document
 * @param startTime - When the save event started
 * @param operationId - Unique identifier for this operation
 */
async function processFileDocumentationAsync(document: vscode.TextDocument, startTime: number, operationId: string): Promise<void> {
	const filePath = document.fileName;
	const processingStartTime = Date.now();
	const fileName = path.basename(filePath);
	const fileSize = document.getText().length;

	// Performance monitoring
	const performanceMetrics = {
		structuralIndexing: 0,
		symbolParsing: 0,
		symbolClassification: 0,
		aiDocumentation: 0,
		markdownGeneration: 0,
		fileWriting: 0
	};

	console.log(`[${operationId}] 📝 Starting file-level documentation processing: ${fileName} (${fileSize} bytes)`);

	// Check for large files and warn about potential performance impact
	if (fileSize > 100000) { // 100KB
		console.warn(`[${operationId}] ⚠️ Large file detected (${fileSize} bytes), processing may take longer`);
	}

	try {
		// Step 1: Continue with existing structural indexing for backward compatibility
		const indexingStart = Date.now();
		try {
			console.log(`[${operationId}] 🔄 Starting structural indexing...`);
			await processDocument(document);
			performanceMetrics.structuralIndexing = Date.now() - indexingStart;
			console.log(`[${operationId}] ✅ Structural indexing completed (${performanceMetrics.structuralIndexing}ms)`);
		} catch (indexingError) {
			performanceMetrics.structuralIndexing = Date.now() - indexingStart;
			console.error(`[${operationId}] ❌ Structural indexing failed (${performanceMetrics.structuralIndexing}ms):`, indexingError);
			// Continue with documentation generation even if indexing fails
		}

		// Step 2: Parse entire file and extract all symbols using CodeParserService
		const parsingStart = Date.now();
		let allSymbols: CodeSymbol[] = [];
		try {
			const codeParserService = new CodeParserService();
			const fileExtension = path.extname(filePath);
			const sourceContent = document.getText();

			console.log(`[${operationId}] 🔍 Parsing symbols from ${fileName} (${sourceContent.length} characters)`);
			allSymbols = codeParserService.parseCode(sourceContent, filePath, fileExtension);
			performanceMetrics.symbolParsing = Date.now() - parsingStart;
			console.log(`[${operationId}] 📊 Extracted ${allSymbols.length} symbols (${performanceMetrics.symbolParsing}ms)`);
		} catch (parsingError) {
			performanceMetrics.symbolParsing = Date.now() - parsingStart;
			console.error(`[${operationId}] ❌ Symbol parsing failed (${performanceMetrics.symbolParsing}ms):`, parsingError);

			// Show user notification for parsing failures
			vscode.window.showWarningMessage(
				`Failed to parse symbols in ${fileName}. Documentation may be incomplete.`
			);
			// Continue with empty symbols array
		}

		// Step 3: Implement symbol classification to separate documented from undocumented symbols
		const classificationStart = Date.now();
		let documentedSymbols: CodeSymbol[] = [];
		let undocumentedSymbols: CodeSymbol[] = [];
		try {
			const classification = classifySymbols(allSymbols);
			documentedSymbols = classification.documentedSymbols;
			undocumentedSymbols = classification.undocumentedSymbols;
			performanceMetrics.symbolClassification = Date.now() - classificationStart;
			console.log(`[${operationId}] 📋 Symbol classification completed (${performanceMetrics.symbolClassification}ms): ${documentedSymbols.length} documented, ${undocumentedSymbols.length} undocumented`);
		} catch (classificationError) {
			performanceMetrics.symbolClassification = Date.now() - classificationStart;
			console.error(`[${operationId}] ❌ Symbol classification failed (${performanceMetrics.symbolClassification}ms):`, classificationError);
			// Use all symbols as undocumented if classification fails
			undocumentedSymbols = allSymbols;
		}

		// Step 4: Process undocumented symbols with AI-powered documentation generation
		const aiStart = Date.now();
		let processedSymbols = [...documentedSymbols];
		if (undocumentedSymbols.length > 0) {
			try {
				console.log(`[${operationId}] 🤖 Starting AI-powered documentation generation for ${undocumentedSymbols.length} undocumented symbols`);
				const aiDocumentedSymbols = await generateAIDocumentationForSymbols(undocumentedSymbols, operationId);
				processedSymbols = [...documentedSymbols, ...aiDocumentedSymbols];
				performanceMetrics.aiDocumentation = Date.now() - aiStart;
				console.log(`[${operationId}] ✅ AI documentation generation completed (${performanceMetrics.aiDocumentation}ms). Total symbols: ${processedSymbols.length}`);
			} catch (aiError) {
				performanceMetrics.aiDocumentation = Date.now() - aiStart;
				console.error(`[${operationId}] ❌ AI documentation generation failed (${performanceMetrics.aiDocumentation}ms):`, aiError);

				// Fallback: use symbols without AI documentation
				processedSymbols = [...documentedSymbols, ...undocumentedSymbols];
				console.log(`[${operationId}] 🔄 Using fallback: proceeding with ${processedSymbols.length} symbols without AI documentation`);
			}
		} else {
			performanceMetrics.aiDocumentation = Date.now() - aiStart;
			console.log(`[${operationId}] ℹ️ No undocumented symbols found, skipping AI documentation generation`);
		}

		// Step 5: Create documentation directory structure and generate markdown
		const generationStart = Date.now();
		let markdownContent = '';
		try {
			const docGeneratorService = new DocGeneratorService();
			await docGeneratorService.ensureDocsDirectory();
			markdownContent = docGeneratorService.generateFileDoc(filePath, processedSymbols);
			performanceMetrics.markdownGeneration = Date.now() - generationStart;
			console.log(`[${operationId}] 📝 Markdown generation completed (${performanceMetrics.markdownGeneration}ms): ${markdownContent.length} characters`);
		} catch (generationError) {
			performanceMetrics.markdownGeneration = Date.now() - generationStart;
			console.error(`[${operationId}] ❌ Markdown generation failed (${performanceMetrics.markdownGeneration}ms):`, generationError);
			throw generationError; // This is critical, can't continue without content
		}

		// Step 6: Write documentation file
		const writingStart = Date.now();
		try {
			const docGeneratorService = new DocGeneratorService();
			await docGeneratorService.writeDocumentationFile(filePath, markdownContent);
			performanceMetrics.fileWriting = Date.now() - writingStart;
			console.log(`[${operationId}] 💾 Documentation file written (${performanceMetrics.fileWriting}ms)`);
		} catch (writingError) {
			performanceMetrics.fileWriting = Date.now() - writingStart;
			console.error(`[${operationId}] ❌ Documentation file writing failed (${performanceMetrics.fileWriting}ms):`, writingError);

			// Show user notification for file writing failures
			vscode.window.showErrorMessage(
				`Failed to write documentation file for ${fileName}. Check file permissions and disk space.`
			);
			throw writingError;
		}

		// Success: Log performance metrics and completion
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;

		console.log(`[${operationId}] ✅ File-level documentation completed: ${fileName}`);
		console.log(`[${operationId}] ⏱️ Performance metrics:`);
		console.log(`[${operationId}]   - Total time: ${totalTime}ms`);
		console.log(`[${operationId}]   - Processing time: ${processingTime}ms`);
		console.log(`[${operationId}]   - Structural indexing: ${performanceMetrics.structuralIndexing}ms`);
		console.log(`[${operationId}]   - Symbol parsing: ${performanceMetrics.symbolParsing}ms`);
		console.log(`[${operationId}]   - Symbol classification: ${performanceMetrics.symbolClassification}ms`);
		console.log(`[${operationId}]   - AI documentation: ${performanceMetrics.aiDocumentation}ms`);
		console.log(`[${operationId}]   - Markdown generation: ${performanceMetrics.markdownGeneration}ms`);
		console.log(`[${operationId}]   - File writing: ${performanceMetrics.fileWriting}ms`);

		// Show success notification for large files or slow processing
		if (fileSize > 50000 || processingTime > 5000) {
			vscode.window.showInformationMessage(
				`Documentation generated for ${fileName} (${processingTime}ms)`
			);
		}

	} catch (error) {
		const endTime = Date.now();
		const totalTime = endTime - startTime;
		const processingTime = endTime - processingStartTime;

		console.error(`[${operationId}] ❌ File-level documentation failed: ${fileName} (total: ${totalTime}ms, processing: ${processingTime}ms)`);

		// Log detailed error information
		if (error instanceof Error) {
			console.error(`[${operationId}] Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] Error stack:`, error.stack);
			}
		}

		// Log performance metrics even on failure for debugging
		console.log(`[${operationId}] 📊 Performance metrics (partial):`);
		console.log(`[${operationId}]   - Structural indexing: ${performanceMetrics.structuralIndexing}ms`);
		console.log(`[${operationId}]   - Symbol parsing: ${performanceMetrics.symbolParsing}ms`);
		console.log(`[${operationId}]   - Symbol classification: ${performanceMetrics.symbolClassification}ms`);
		console.log(`[${operationId}]   - AI documentation: ${performanceMetrics.aiDocumentation}ms`);
		console.log(`[${operationId}]   - Markdown generation: ${performanceMetrics.markdownGeneration}ms`);
		console.log(`[${operationId}]   - File writing: ${performanceMetrics.fileWriting}ms`);

		// Don't rethrow - we want background processing errors to be logged but not crash the extension
	}
}

/**
 * Classifies symbols into documented and undocumented categories
 * @param symbols - Array of code symbols to classify
 * @returns Object containing arrays of documented and undocumented symbols
 */
function classifySymbols(symbols: CodeSymbol[]): { documentedSymbols: CodeSymbol[]; undocumentedSymbols: CodeSymbol[] } {
	const documentedSymbols: CodeSymbol[] = [];
	const undocumentedSymbols: CodeSymbol[] = [];

	symbols.forEach(symbol => {
		// A symbol is considered documented if it has JSDoc documentation
		if (symbol.documentation && symbol.documentation.trim().length > 0) {
			documentedSymbols.push(symbol);
		} else {
			undocumentedSymbols.push(symbol);
		}
	});

	return { documentedSymbols, undocumentedSymbols };
}

/**
 * Generate AI-powered documentation for undocumented symbols using concurrent processing
 * @param undocumentedSymbols - Array of symbols that need documentation
 * @param operationId - Unique identifier for this operation
 * @returns Promise<CodeSymbol[]> Array of symbols with AI-generated documentation
 */
async function generateAIDocumentationForSymbols(undocumentedSymbols: CodeSymbol[], operationId: string): Promise<CodeSymbol[]> {
	const startTime = Date.now();
	const maxConcurrentRequests = 3; // Limit concurrent API requests to avoid rate limiting
	const requestTimeout = 30000; // 30 second timeout per request

	console.log(`[${operationId}] 🤖 Starting AI documentation generation for ${undocumentedSymbols.length} symbols`);
	console.log(`[${operationId}] ⚙️ Configuration: max concurrent requests: ${maxConcurrentRequests}, timeout: ${requestTimeout}ms`);

	// Performance and error tracking
	let llmService: any = null;
	let successfulCount = 0;
	let failedCount = 0;
	let timeoutCount = 0;
	let serviceUnavailableCount = 0;

	try {
		// Import and initialize LLMService with error handling
		console.log(`[${operationId}] 📡 Initializing LLM service...`);
		try {
			const { LLMService } = await import('./services/LLMService');
			llmService = new LLMService();
			console.log(`[${operationId}] ✅ LLM service initialized successfully`);
		} catch (serviceError) {
			console.error(`[${operationId}] ❌ Failed to initialize LLM service:`, serviceError);
			throw new Error(`LLM service initialization failed: ${serviceError instanceof Error ? serviceError.message : 'Unknown error'}`);
		}

		// Process symbols in batches to control concurrency and avoid overwhelming the API
		const batches = [];
		for (let i = 0; i < undocumentedSymbols.length; i += maxConcurrentRequests) {
			batches.push(undocumentedSymbols.slice(i, i + maxConcurrentRequests));
		}

		console.log(`[${operationId}] 📦 Processing ${undocumentedSymbols.length} symbols in ${batches.length} batches`);

		const documentedSymbols: CodeSymbol[] = [];

		// Process each batch sequentially to control load
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			const batchStartTime = Date.now();

			console.log(`[${operationId}] 🔄 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} symbols)`);

			// Process symbols in current batch concurrently
			const batchPromises = batch.map(async (symbol, symbolIndex) => {
				const globalIndex = batchIndex * maxConcurrentRequests + symbolIndex + 1;
				const symbolStartTime = Date.now();

				try {
					console.log(`[${operationId}] 🔄 Processing symbol ${globalIndex}/${undocumentedSymbols.length}: ${symbol.name} (${symbol.type})`);

					// Validate symbol has source text
					if (!symbol.sourceText || symbol.sourceText.trim().length === 0) {
						console.warn(`[${operationId}] ⚠️ Skipping symbol ${symbol.name}: no source text available`);
						return symbol; // Return original symbol unchanged
					}

					// Check for very large symbols that might cause timeouts
					if (symbol.sourceText.length > 10000) {
						console.warn(`[${operationId}] ⚠️ Large symbol detected: ${symbol.name} (${symbol.sourceText.length} characters)`);
					}

					// Create timeout promise for this specific request
					const timeoutPromise = new Promise<never>((_, reject) => {
						setTimeout(() => {
							reject(new Error(`Documentation generation timeout after ${requestTimeout}ms`));
						}, requestTimeout);
					});

					// Generate documentation with timeout protection
					const documentationPromise = (async () => {
						// Generate raw JSDoc using LLMService
						const rawJSDoc = await llmService.generateDocstring(symbol.sourceText);
						console.log(`[${operationId}] 📝 Generated raw JSDoc for ${symbol.name}: ${rawJSDoc.substring(0, 50)}...`);

						// Parse raw JSDoc into structured format using JSDoc parser
						const parsedJSDoc = llmService.parseRawDocstring(rawJSDoc);
						console.log(`[${operationId}] 🔍 Parsed JSDoc for ${symbol.name}: description length ${parsedJSDoc.description.length}, ${parsedJSDoc.params.length} params`);

						// Convert parsed JSDoc back to JSDoc comment format for storage
						const formattedJSDoc = formatParsedJSDocToComment(parsedJSDoc);

						// Update symbol with AI-generated documentation
						return {
							...symbol,
							documentation: formattedJSDoc
						};
					})();

					// Race between documentation generation and timeout
					const updatedSymbol = await Promise.race([documentationPromise, timeoutPromise]);

					const symbolDuration = Date.now() - symbolStartTime;
					console.log(`[${operationId}] ✅ Successfully generated documentation for ${symbol.name} (${symbolDuration}ms)`);
					successfulCount++;

					return updatedSymbol;

				} catch (error) {
					const symbolDuration = Date.now() - symbolStartTime;
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';

					console.error(`[${operationId}] ❌ Failed to generate documentation for symbol ${symbol.name} (${symbolDuration}ms):`, errorMessage);

					// Categorize error types for better monitoring
					if (errorMessage.includes('timeout')) {
						timeoutCount++;
						console.error(`[${operationId}] ⏰ Timeout error for ${symbol.name}`);
					} else if (errorMessage.includes('service unavailable') || errorMessage.includes('rate limit')) {
						serviceUnavailableCount++;
						console.error(`[${operationId}] 🚫 Service unavailable error for ${symbol.name}`);
					} else {
						failedCount++;
						console.error(`[${operationId}] 💥 General error for ${symbol.name}:`, error);
					}

					// Return original symbol with a categorized fallback documentation note
					let fallbackMessage = 'Documentation generation failed, manual review required';
					if (errorMessage.includes('timeout')) {
						fallbackMessage = 'Documentation generation timed out, manual review required';
					} else if (errorMessage.includes('service unavailable') || errorMessage.includes('rate limit')) {
						fallbackMessage = 'AI documentation service temporarily unavailable, manual review required';
					}

					const fallbackSymbol: CodeSymbol = {
						...symbol,
						documentation: `/**\n * ${symbol.name} - ${fallbackMessage}\n * @todo Add proper documentation\n */`
					};

					return fallbackSymbol;
				}
			});

			// Wait for current batch to complete
			try {
				const batchResults = await Promise.all(batchPromises);
				documentedSymbols.push(...batchResults);

				const batchDuration = Date.now() - batchStartTime;
				console.log(`[${operationId}] ✅ Batch ${batchIndex + 1}/${batches.length} completed (${batchDuration}ms)`);

				// Add small delay between batches to be respectful to the API
				if (batchIndex < batches.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
				}
			} catch (batchError) {
				console.error(`[${operationId}] ❌ Batch ${batchIndex + 1} failed:`, batchError);
				// Continue with next batch even if current batch fails
			}
		}

		// Calculate final statistics
		const totalDuration = Date.now() - startTime;
		const totalProcessed = successfulCount + failedCount + timeoutCount + serviceUnavailableCount;

		console.log(`[${operationId}] 📊 AI documentation generation completed (${totalDuration}ms):`);
		console.log(`[${operationId}]   - Total symbols: ${undocumentedSymbols.length}`);
		console.log(`[${operationId}]   - Successful: ${successfulCount}`);
		console.log(`[${operationId}]   - Failed: ${failedCount}`);
		console.log(`[${operationId}]   - Timeouts: ${timeoutCount}`);
		console.log(`[${operationId}]   - Service unavailable: ${serviceUnavailableCount}`);
		console.log(`[${operationId}]   - Success rate: ${totalProcessed > 0 ? Math.round((successfulCount / totalProcessed) * 100) : 0}%`);

		// Show user notification if there were significant issues
		if (timeoutCount > 0 || serviceUnavailableCount > 0) {
			const issueCount = timeoutCount + serviceUnavailableCount;
			vscode.window.showWarningMessage(
				`AI documentation generation had ${issueCount} issue(s). Check output panel for details.`
			);
		}

		return documentedSymbols;

	} catch (error) {
		const totalDuration = Date.now() - startTime;
		console.error(`[${operationId}] ❌ Critical error in AI documentation generation (${totalDuration}ms):`, error);

		// Log detailed error information
		if (error instanceof Error) {
			console.error(`[${operationId}] Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] Error stack:`, error.stack);
			}
		}

		// Return original symbols with fallback documentation
		const fallbackSymbols = undocumentedSymbols.map(symbol => ({
			...symbol,
			documentation: `/**\n * ${symbol.name} - AI documentation service unavailable\n * @todo Add proper documentation\n */`
		}));

		console.log(`[${operationId}] 🔄 Returning ${fallbackSymbols.length} symbols with fallback documentation`);

		// Show user notification for critical failures
		vscode.window.showErrorMessage(
			`AI documentation service failed. Documentation will be generated with placeholders.`
		);

		return fallbackSymbols;
	}
}

/**
 * Handles file deletion events to synchronize documentation files
 * @param event - The file deletion event containing deleted files
 */
async function handleFilesDeletion(event: vscode.FileDeleteEvent): Promise<void> {
	const operationId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const startTime = Date.now();

	console.log(`[${operationId}] 🗑️ HANDLE FILES DELETION: ${event.files.length} file(s) deleted`);

	let successCount = 0;
	let skipCount = 0;
	let errorCount = 0;

	try {
		// Process each deleted file with individual error handling
		for (const deletedFileUri of event.files) {
			const deletedFilePath = deletedFileUri.fsPath;
			const fileName = path.basename(deletedFilePath);

			try {
				console.log(`[${operationId}] 🔍 Processing deleted file: ${fileName}`);

				// Check if the deleted file is a source file that should have documentation
				const document = { fileName: deletedFilePath } as vscode.TextDocument;
				if (shouldProcessDocument(document, DEFAULT_CONFIG)) {
					console.log(`[${operationId}] 📝 File passed filtering, attempting documentation deletion`);
					await deleteCorrespondingDocumentationFile(deletedFilePath, operationId);
					successCount++;
				} else {
					console.log(`[${operationId}] 📋 Skipped documentation deletion for filtered file: ${fileName}`);
					skipCount++;
				}
			} catch (fileError) {
				errorCount++;
				console.error(`[${operationId}] ❌ Error processing deleted file ${fileName}:`, fileError);

				// Log detailed error information
				if (fileError instanceof Error) {
					console.error(`[${operationId}] Error type: ${fileError.constructor.name}`);
					console.error(`[${operationId}] Error message: ${fileError.message}`);
				}

				// Continue processing other files even if one fails
			}
		}

		const duration = Date.now() - startTime;
		console.log(`[${operationId}] ✅ File deletion processing completed (${duration}ms):`);
		console.log(`[${operationId}]   - Total files: ${event.files.length}`);
		console.log(`[${operationId}]   - Successfully processed: ${successCount}`);
		console.log(`[${operationId}]   - Skipped (filtered): ${skipCount}`);
		console.log(`[${operationId}]   - Errors: ${errorCount}`);

		// Show user notification if there were errors
		if (errorCount > 0) {
			vscode.window.showWarningMessage(
				`${errorCount} documentation file(s) could not be deleted. Check output panel for details.`
			);
		}

	} catch (error) {
		const duration = Date.now() - startTime;
		console.error(`[${operationId}] ❌ Critical error in file deletion event handler (${duration}ms):`, error);

		// Log detailed error information
		if (error instanceof Error) {
			console.error(`[${operationId}] Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] Error stack:`, error.stack);
			}
		}

		// Show user notification for critical failures
		vscode.window.showErrorMessage(
			`Critical error during file deletion processing. Some documentation files may not have been cleaned up.`
		);

		// Don't rethrow - we want deletion errors to be logged but not crash the extension
	}
}

/**
 * Delete the corresponding documentation file for a deleted source file
 * @param sourceFilePath - Path to the deleted source file
 * @param operationId - Unique identifier for this operation
 */
async function deleteCorrespondingDocumentationFile(sourceFilePath: string, operationId: string): Promise<void> {
	const startTime = Date.now();
	const fileName = path.basename(sourceFilePath);

	try {
		console.log(`[${operationId}] 📝 Calculating documentation file path for: ${fileName}`);

		// Calculate corresponding documentation file path using the same logic as DocGeneratorService
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspaceRoot) {
			console.warn(`[${operationId}] ⚠️ No workspace folder found, cannot delete documentation file`);
			throw new Error('No workspace folder found');
		}

		const docsBasePath = path.join(workspaceRoot, 'docs', 'api');
		const fileNameWithoutExt = path.basename(sourceFilePath, path.extname(fileName));
		const docFilePath = path.join(docsBasePath, `${fileNameWithoutExt}.md`);
		const docFileName = path.basename(docFilePath);

		console.log(`[${operationId}] 🎯 Target documentation file: ${docFileName}`);

		// Check if documentation file exists before attempting deletion
		const docFileUri = vscode.Uri.file(docFilePath);
		let fileExists = false;

		try {
			const statStartTime = Date.now();
			await vscode.workspace.fs.stat(docFileUri);
			const statDuration = Date.now() - statStartTime;
			fileExists = true;
			console.log(`[${operationId}] 📄 Documentation file exists, proceeding with deletion (stat: ${statDuration}ms)`);
		} catch (statError) {
			const statDuration = Date.now() - startTime;
			// File doesn't exist, which is fine - no need to delete
			console.log(`[${operationId}] 📭 Documentation file doesn't exist, no deletion needed: ${docFileName} (stat: ${statDuration}ms)`);
			return;
		}

		// Delete the documentation file with timeout protection
		if (fileExists) {
			const deleteStartTime = Date.now();
			try {
				// Set up timeout for file deletion (should be fast, but network drives might be slow)
				const deleteTimeout = 5000; // 5 seconds
				const deletePromise = vscode.workspace.fs.delete(docFileUri);
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => {
						reject(new Error(`File deletion timeout after ${deleteTimeout}ms`));
					}, deleteTimeout);
				});

				await Promise.race([deletePromise, timeoutPromise]);

				const deleteDuration = Date.now() - deleteStartTime;
				const totalDuration = Date.now() - startTime;
				console.log(`[${operationId}] ✅ Successfully deleted documentation file: ${docFileName} (delete: ${deleteDuration}ms, total: ${totalDuration}ms)`);
			} catch (deleteError) {
				const deleteDuration = Date.now() - deleteStartTime;
				const totalDuration = Date.now() - startTime;

				console.error(`[${operationId}] ❌ Failed to delete documentation file: ${docFileName} (delete: ${deleteDuration}ms, total: ${totalDuration}ms)`);

				// Log detailed error information
				if (deleteError instanceof Error) {
					console.error(`[${operationId}] Delete error type: ${deleteError.constructor.name}`);
					console.error(`[${operationId}] Delete error message: ${deleteError.message}`);
				}

				throw deleteError;
			}
		}

	} catch (error) {
		const totalDuration = Date.now() - startTime;
		console.error(`[${operationId}] ❌ Failed to delete documentation file for ${fileName} (${totalDuration}ms):`, error);

		// Log detailed error information
		if (error instanceof Error) {
			console.error(`[${operationId}] Error type: ${error.constructor.name}`);
			console.error(`[${operationId}] Error message: ${error.message}`);
			if (error.stack) {
				console.error(`[${operationId}] Error stack:`, error.stack);
			}
		}

		// Provide user feedback for deletion failures
		vscode.window.showWarningMessage(
			`Failed to delete documentation for ${fileName}. The documentation file may need to be removed manually.`
		);

		// Rethrow to allow caller to handle the error appropriately
		throw error;
	}
}

/**
 * Convert parsed JSDoc structure back to JSDoc comment format
 * @param parsedJSDoc - Structured JSDoc data
 * @returns string Formatted JSDoc comment
 */
function formatParsedJSDocToComment(parsedJSDoc: ParsedJSDoc): string {
	const lines: string[] = ['/**'];

	// Add description
	if (parsedJSDoc.description) {
		lines.push(` * ${parsedJSDoc.description}`);
	}

	// Add empty line before parameters if we have both description and parameters
	if (parsedJSDoc.description && parsedJSDoc.params.length > 0) {
		lines.push(' *');
	}

	// Add parameters
	parsedJSDoc.params.forEach(param => {
		const typeStr = param.type ? `{${param.type}} ` : '';
		lines.push(` * @param ${typeStr}${param.name} ${param.description}`);
	});

	// Add return information
	if (parsedJSDoc.returns) {
		const typeStr = parsedJSDoc.returns.type ? `{${parsedJSDoc.returns.type}} ` : '';
		lines.push(` * @returns ${typeStr}${parsedJSDoc.returns.description}`);
	}

	// Add examples if present
	if (parsedJSDoc.examples && parsedJSDoc.examples.length > 0) {
		parsedJSDoc.examples.forEach(example => {
			lines.push(' * @example');
			// Split example into lines and add proper indentation
			example.split('\n').forEach(exampleLine => {
				lines.push(` * ${exampleLine}`);
			});
		});
	}

	lines.push(' */');

	return lines.join('\n');
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Load environment variables from .env file
	try {
		// Try multiple paths to find the .env file

		// Possible .env file locations
		const envPaths = [
			'.env',  // Current working directory
			path.join(__dirname, '..', '.env'),  // Parent of out directory
			path.join(__dirname, '..', '..', '.env'),  // Workspace root
			path.join(context.extensionPath, '.env')  // Extension path
		];

		let envLoaded = false;
		for (const envPath of envPaths) {
			try {
				if (fs.existsSync(envPath)) {
					dotenv.config({ path: envPath });
					console.log(`Environment variables loaded successfully from: ${envPath}`);
					envLoaded = true;
					break;
				}
			} catch (pathError) {
				console.log(`Failed to load from ${envPath}:`, pathError);
			}
		}

		if (!envLoaded) {
			console.warn('No .env file found in any of the expected locations');
			console.log('Searched paths:', envPaths);
		}

		// Log environment status for debugging
		console.log(`OPENROUTER_API_KEY present: ${!!process.env.OPENROUTER_API_KEY}`);
		if (process.env.OPENROUTER_API_KEY) {
			console.log(`OPENROUTER_API_KEY length: ${process.env.OPENROUTER_API_KEY.length}`);
		}

	} catch (error) {
		console.error('Failed to load environment variables:', error);
		vscode.window.showWarningMessage('Failed to load environment configuration. Some features may not work properly.');
	}

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Kiro Constellation extension activated!');

	// Show a welcome message
	vscode.window.showInformationMessage('Kiro Constellation extension activated!');

	// Register file save event listener
	const saveListener = vscode.workspace.onDidSaveTextDocument(handleDocumentSave);

	// Register file deletion event listener for documentation synchronization
	const deleteListener = vscode.workspace.onDidDeleteFiles(handleFilesDeletion);

	// Add the listeners to context subscriptions for proper disposal
	context.subscriptions.push(saveListener, deleteListener);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from kiro-constellation!');
	});

	context.subscriptions.push(disposable);

	// Register the LLM connection test command
	const testLlmConnectionCommand = vscode.commands.registerCommand('constellation.testLlmConnection', async () => {
		const startTime = Date.now();
		console.log('🔄 Starting LLM connection test...');

		try {
			// Log environment check
			const hasApiKey = !!process.env.OPENROUTER_API_KEY;
			console.log(`Environment check - API key present: ${hasApiKey}`);

			if (!hasApiKey) {
				console.log('❌ API key not found in environment variables');
			}

			// Dynamically import and instantiate LLMService
			console.log('📡 Initializing LLM service...');
			const { LLMService } = await import('./services/LLMService');
			const llmService = new LLMService();

			console.log('🌐 Making API request to OpenRouter...');
			const response = await llmService.testConnection();

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Show success message with API response
			vscode.window.showInformationMessage(`✅ LLM Connection Test Successful: ${response}`);
			console.log(`✅ LLM connection test completed successfully in ${duration}ms`);
			console.log(`API Response: "${response}"`);

		} catch (error) {
			const endTime = Date.now();
			const duration = endTime - startTime;

			// Handle different types of errors with specific user feedback
			let userMessage = 'LLM Connection Test Failed';
			let errorDetails = '';

			if (error instanceof Error) {
				errorDetails = error.message;

				// Provide more specific user guidance based on error type
				if (error.message.includes('OPENROUTER_API_KEY')) {
					userMessage = '🔑 Configuration Error: Missing API Key';
					console.log('❌ Configuration error detected - missing API key');
				} else if (error.message.includes('Authentication failed') || error.message.includes('Invalid API key')) {
					userMessage = '🔐 Authentication Error: Invalid API Key';
					console.log('❌ Authentication error detected - invalid API key');
				} else if (error.message.includes('Network error') || error.message.includes('Unable to connect')) {
					userMessage = '🌐 Network Error: Connection Failed';
					console.log('❌ Network error detected - connection failed');
				} else if (error.message.includes('Rate limit')) {
					userMessage = '⏱️ Rate Limit Error: Too Many Requests';
					console.log('❌ Rate limit error detected');
				} else if (error.message.includes('server error') || error.message.includes('service unavailable')) {
					userMessage = '🔧 Service Error: API Temporarily Unavailable';
					console.log('❌ Service error detected - API unavailable');
				} else {
					userMessage = '❌ API Error: Request Failed';
					console.log('❌ General API error detected');
				}
			} else {
				errorDetails = 'Unknown error occurred';
				console.log('❌ Unknown error type detected');
			}

			// Display error message to user
			vscode.window.showErrorMessage(`${userMessage}: ${errorDetails}`);

			// Comprehensive error logging for debugging
			console.error(`❌ LLM Connection Test failed after ${duration}ms`);
			console.error('Error details:', error);
			console.error('Error type:', typeof error);
			console.error('Error constructor:', error?.constructor?.name);

			// Log environment state for debugging
			console.log('🔍 Debug info:');
			console.log(`  - API key configured: ${!!process.env.OPENROUTER_API_KEY}`);
			console.log(`  - API key length: ${process.env.OPENROUTER_API_KEY?.length || 0}`);
			console.log(`  - Test duration: ${duration}ms`);
		}
	});

	context.subscriptions.push(testLlmConnectionCommand);

	// Register the docstring generation test command
	const testDocstringGenerationCommand = vscode.commands.registerCommand('constellation.testDocstringGeneration', async () => {
		const startTime = Date.now();
		console.log('🔄 Starting docstring generation test...');

		// Define testFunction constant with multi-line calculateAge function implementation including edge case logic
		const testFunction = `function calculateAge(birthDate: Date, currentDate?: Date): number {
    // Use current date if not provided
    const today = currentDate || new Date();
    
    // Validate input parameters
    if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) {
        throw new Error('Invalid birth date provided');
    }
    
    if (!(today instanceof Date) || isNaN(today.getTime())) {
        throw new Error('Invalid current date provided');
    }
    
    // Check if birth date is in the future
    if (birthDate > today) {
        throw new Error('Birth date cannot be in the future');
    }
    
    // Calculate age in years
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year yet
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    // Handle edge case where calculated age is negative (shouldn't happen with validation above)
    if (age < 0) {
        throw new Error('Calculated age cannot be negative');
    }
    
    return age;
}`;

		try {
			// Log environment check
			const hasApiKey = !!process.env.OPENROUTER_API_KEY;
			console.log(`Environment check - API key present: ${hasApiKey}`);

			if (!hasApiKey) {
				console.log('❌ API key not found in environment variables');
				vscode.window.showErrorMessage('🔑 Configuration Error: Missing API Key. Please check your .env file.');
				return;
			}

			// Dynamically import and instantiate LLMService
			console.log('📡 Initializing LLM service...');
			const { LLMService } = await import('./services/LLMService');
			const llmService = new LLMService();

			console.log('🔧 Calling generateDocstring with test function...');
			console.log('📝 Test function preview:', testFunction.substring(0, 100) + '...');

			// Implement proper async/await handling for API call
			const generatedJSDoc = await llmService.generateDocstring(testFunction);

			const endTime = Date.now();
			const duration = endTime - startTime;

			// Log the generated JSDoc comment to Debug Console
			console.log(`✅ Docstring generation test completed successfully in ${duration}ms`);
			console.log(`Generated JSDoc:`);
			console.log(generatedJSDoc);

			// Show success message to user with truncated JSDoc for readability
			const truncatedJSDoc = generatedJSDoc.length > 100
				? generatedJSDoc.substring(0, 100) + '...'
				: generatedJSDoc;
			vscode.window.showInformationMessage(`✅ Docstring Generation Test Successful! Check Debug Console for full output. Preview: ${truncatedJSDoc}`);

		} catch (error) {
			const endTime = Date.now();
			const duration = endTime - startTime;

			// Add error handling and user feedback messages for command execution success/failure
			let userMessage = 'Docstring Generation Test Failed';
			let errorDetails = '';

			if (error instanceof Error) {
				errorDetails = error.message;

				// Provide more specific user guidance based on error type
				if (error.message.includes('OPENROUTER_API_KEY')) {
					userMessage = '🔑 Configuration Error: Missing API Key';
					console.log('❌ Configuration error detected - missing API key');
				} else if (error.message.includes('Authentication failed') || error.message.includes('Invalid API key')) {
					userMessage = '🔐 Authentication Error: Invalid API Key';
					console.log('❌ Authentication error detected - invalid API key');
				} else if (error.message.includes('Network error') || error.message.includes('Unable to connect')) {
					userMessage = '🌐 Network Error: Connection Failed';
					console.log('❌ Network error detected - connection failed');
				} else if (error.message.includes('Rate limit')) {
					userMessage = '⏱️ Rate Limit Error: Too Many Requests';
					console.log('❌ Rate limit error detected');
				} else if (error.message.includes('server error') || error.message.includes('service unavailable')) {
					userMessage = '🔧 Service Error: API Temporarily Unavailable';
					console.log('❌ Service error detected - API unavailable');
				} else {
					userMessage = '❌ Generation Error: Request Failed';
					console.log('❌ General generation error detected');
				}
			} else {
				errorDetails = 'Unknown error occurred';
				console.log('❌ Unknown error type detected');
			}

			// Display error message to user
			vscode.window.showErrorMessage(`${userMessage}: ${errorDetails}`);

			// Comprehensive error logging for debugging
			console.error(`❌ Docstring Generation Test failed after ${duration}ms`);
			console.error('Error details:', error);
			console.error('Error type:', typeof error);
			console.error('Error constructor:', error?.constructor?.name);

			// Log environment state for debugging
			console.log('🔍 Debug info:');
			console.log(`  - API key configured: ${!!process.env.OPENROUTER_API_KEY}`);
			console.log(`  - API key length: ${process.env.OPENROUTER_API_KEY?.length || 0}`);
			console.log(`  - Test duration: ${duration}ms`);
			console.log(`  - Test function length: ${testFunction.length} characters`);
		}
	});

	context.subscriptions.push(testDocstringGenerationCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Kiro Constellation extension deactivated');
}
