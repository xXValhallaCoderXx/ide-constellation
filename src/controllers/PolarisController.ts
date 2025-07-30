import * as vscode from 'vscode';
import * as path from 'path';
import { shouldProcessDocument, DEFAULT_CONFIG } from '../documentFilter';
import { processDocument } from '../contentProcessor';
import { CodeParserService } from '../services/CodeParserService';
import { DocGeneratorService } from '../services/DocGeneratorService';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';
import { CodeSymbol, ParsedJSDoc } from '../types';
import { ErrorHandler } from '../utils/ErrorHandler';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { normalizePath } from '../utils/pathUtils';

/**
 * Controller responsible for handling file save events and documentation processing
 */
export class PolarisController {
    private context: vscode.ExtensionContext;
    private processingTasks = new Map<string, Promise<void>>();

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Processes a document for file-level documentation generation
     * @param document - The saved text document
     * @param startTime - When the save event started
     * @param operationId - Unique identifier for this operation
     */
    public async processFileDocumentation(document: vscode.TextDocument, startTime: number, operationId: string): Promise<void> {
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
            embeddingProcessing: 0,
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
                const classification = this.classifySymbols(allSymbols);
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
                    const aiDocumentedSymbols = await this.generateAIDocumentationForSymbols(undocumentedSymbols, operationId);
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

            // Step 5: Process embeddings for symbols with docstrings (non-blocking)
            const embeddingStart = Date.now();
            let embeddingMetrics = {
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0
            };

            embeddingMetrics = await ErrorHandler.measureAndHandle(
                operationId,
                'Embedding workflow',
                async () => {
                    console.log(`[${operationId}] 🔍 Starting embedding workflow for processed symbols...`);
                    return await this.processEmbeddingsForSymbols(processedSymbols, filePath, operationId);
                },
                {
                    allowFailure: true,
                    fallbackValue: embeddingMetrics,
                    additionalMetrics: {
                        symbolCount: processedSymbols.length,
                        fileSize: fileSize
                    },
                    onError: (error, errorInfo) => {
                        // Show user notification for embedding failures
                        if (errorInfo.severity === 'error') {
                            vscode.window.showWarningMessage(
                                `Embedding processing failed: ${errorInfo.userMessage}. Documentation will continue without semantic features.`,
                                'Details'
                            ).then(selection => {
                                if (selection === 'Details') {
                                    const errorMsg = error instanceof Error ? error.message : String(error);
                                    vscode.window.showErrorMessage(`Embedding error (${errorInfo.category}): ${errorMsg}`);
                                }
                            });
                        }
                    }
                }
            ) || embeddingMetrics;

            performanceMetrics.embeddingProcessing = Date.now() - embeddingStart;
            console.log(`[${operationId}] ✅ Embedding workflow completed (${performanceMetrics.embeddingProcessing}ms): ${embeddingMetrics.successful} successful, ${embeddingMetrics.failed} failed, ${embeddingMetrics.skipped} skipped`);

            // Step 6: Create documentation directory structure and generate markdown
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

            // Step 7: Write documentation file
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
            console.log(`[${operationId}]   - Embedding processing: ${performanceMetrics.embeddingProcessing}ms`);
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
            console.log(`[${operationId}]   - Embedding processing: ${performanceMetrics.embeddingProcessing}ms`);
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
    private classifySymbols(symbols: CodeSymbol[]): { documentedSymbols: CodeSymbol[]; undocumentedSymbols: CodeSymbol[] } {
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
    private async generateAIDocumentationForSymbols(undocumentedSymbols: CodeSymbol[], operationId: string): Promise<CodeSymbol[]> {
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
                const { LLMService } = await import('../services/LLMService');
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
                            const formattedJSDoc = this.formatParsedJSDocToComment(parsedJSDoc);

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
     * Convert parsed JSDoc structure back to JSDoc comment format
     * @param parsedJSDoc - Structured JSDoc data
     * @returns string Formatted JSDoc comment
     */
    private formatParsedJSDocToComment(parsedJSDoc: ParsedJSDoc): string {
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

    /**
     * Process embeddings for symbols with docstrings using reconciliation workflow
     * @param symbols - Array of code symbols to process for embeddings
     * @param filePath - The file path for generating unique IDs
     * @param operationId - Unique identifier for this operation
     * @returns Promise<EmbeddingMetrics> Metrics about the embedding processing
     */
    private async processEmbeddingsForSymbols(
        symbols: CodeSymbol[],
        filePath: string,
        operationId: string
    ): Promise<{ processed: number; successful: number; failed: number; skipped: number }> {
        const startTime = Date.now();
        const metrics = {
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        console.log(`[${operationId}] 🔍 Processing embeddings with reconciliation for ${symbols.length} symbols...`);

        // Start overall reconciliation performance monitoring
        PerformanceMonitor.startTimer(operationId, PerformanceMonitor.MetricTypes.RECONCILIATION, {
            symbolCount: symbols.length,
            filePath: filePath
        });

        // Check if embedding services are available
        if (!EmbeddingService.isServiceInitialized() || !VectorStoreService.isServiceInitialized()) {
            console.warn(`[${operationId}] ⚠️ Embedding services not initialized, skipping embedding processing`);
            metrics.skipped = symbols.length;
            return metrics;
        }

        try {
            // Get service instances
            const embeddingService = EmbeddingService.getInstance();
            const vectorStoreService = VectorStoreService.getInstance();

            // Convert file path to relative path for consistent ID generation using centralized utility
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }
            const normalizedFilePath = normalizePath(filePath, workspaceRoot);
            console.log(`[${operationId}] 📁 Using normalized path for IDs: ${normalizedFilePath}`);

            // RECONCILIATION WORKFLOW: Step 1 - Get existing embeddings for this file
            console.log(`[${operationId}] 🔍 Starting reconciliation workflow...`);
            
            const existingIds = await this.executeWithErrorRecovery(
                'Query existing embeddings',
                async () => {
                    return await vectorStoreService.getIdsByFilePath(normalizedFilePath);
                },
                operationId,
                {
                    maxRetries: 3,
                    allowFailure: true,
                    fallbackValue: [],
                    retryableErrorTypes: ['connection', 'timeout', 'database'],
                    onError: (error, attempt) => {
                        console.warn(`[${operationId}] ⚠️ Query attempt ${attempt} failed: ${error.message}`);
                    }
                }
            );
            
            console.log(`[${operationId}] ✅ Retrieved ${existingIds.length} existing embeddings`);

            // RECONCILIATION WORKFLOW: Step 2 - Calculate reconciliation state
            const reconciliationState = await this.executeWithErrorRecovery(
                'Calculate reconciliation state',
                async () => {
                    return await this.calculateReconciliationState(
                        existingIds,
                        symbols,
                        filePath,
                        operationId
                    );
                },
                operationId,
                {
                    maxRetries: 2,
                    allowFailure: false, // This is critical for the workflow
                    retryableErrorTypes: ['temporary']
                }
            );
            
            console.log(`[${operationId}] ✅ Reconciliation state calculated`);
            
            // Log reconciliation metrics
            const reconciliationMetrics = reconciliationState.reconciliationMetrics;
            console.log(`[${operationId}] 📊 Reconciliation plan: delete ${reconciliationMetrics.toDelete}, upsert ${reconciliationMetrics.toUpsert}, unchanged ${reconciliationMetrics.unchanged}`);

            // RECONCILIATION WORKFLOW: Step 3 - Execute delete operations first
            if (reconciliationState.idsToDelete.length > 0) {
                await this.executeWithErrorRecovery(
                    'Delete obsolete embeddings',
                    async () => {
                        console.log(`[${operationId}] 🗑️ Deleting ${reconciliationState.idsToDelete.length} obsolete embeddings...`);
                        await vectorStoreService.delete(reconciliationState.idsToDelete);
                        console.log(`[${operationId}] ✅ Successfully deleted ${reconciliationState.idsToDelete.length} obsolete embeddings`);
                        return true;
                    },
                    operationId,
                    {
                        maxRetries: 3,
                        allowFailure: true, // Deletion failures shouldn't stop upserts
                        retryableErrorTypes: ['connection', 'timeout', 'lock', 'busy'],
                        onError: (error, attempt) => {
                            console.warn(`[${operationId}] ⚠️ Delete attempt ${attempt} failed: ${error.message}`);
                        }
                    }
                );
            } else {
                console.log(`[${operationId}] ℹ️ No obsolete embeddings to delete`);
            }

            // RECONCILIATION WORKFLOW: Step 4 - Execute upsert operations for symbols with documentation
            if (reconciliationState.symbolsToUpsert.length > 0) {
                console.log(`[${operationId}] ⬆️ Upserting embeddings for ${reconciliationState.symbolsToUpsert.length} symbols...`);
                
                // Process each symbol with docstring content
                for (const symbol of reconciliationState.symbolsToUpsert) {
                    metrics.processed++;
                    const symbolStartTime = Date.now();

                    try {
                        // Extract docstring content from symbol
                        const docstringContent = this.extractDocstringContent(symbol, operationId);

                        if (!docstringContent) {
                            console.log(`[${operationId}] ⏭️ Skipping symbol ${symbol.name}: no docstring content`);
                            metrics.skipped++;
                            continue;
                        }

                        console.log(`[${operationId}] 🔄 Processing embedding for symbol: ${symbol.name} (${docstringContent.length} chars)`);

                        // Generate embedding for docstring content
                        const embeddingStartTime = Date.now();
                        PerformanceMonitor.startTimer(`${operationId}-${symbol.name}`, PerformanceMonitor.MetricTypes.EMBEDDING_GENERATION, {
                            symbolName: symbol.name,
                            contentLength: docstringContent.length
                        });
                        
                        const embedding = await embeddingService.generateEmbedding(docstringContent);
                        
                        PerformanceMonitor.stopTimer(`${operationId}-${symbol.name}`, PerformanceMonitor.MetricTypes.EMBEDDING_GENERATION, true, {
                            vectorDimensions: embedding.length
                        });
                        
                        const embeddingDuration = Date.now() - embeddingStartTime;

                        console.log(`[${operationId}] ✅ Generated embedding for ${symbol.name} (${embeddingDuration}ms, ${embedding.length} dimensions)`);

                        // Generate unique ID for vector storage
                        const uniqueId = VectorStoreService.generateUniqueId(normalizedFilePath, symbol.name);

                        // Store embedding in vector database with filePath
                        const storageStartTime = Date.now();
                        PerformanceMonitor.startTimer(`${operationId}-${symbol.name}`, PerformanceMonitor.MetricTypes.VECTOR_STORAGE, {
                            symbolName: symbol.name,
                            vectorDimensions: embedding.length
                        });
                        
                        await vectorStoreService.upsert(uniqueId, docstringContent, embedding, normalizedFilePath);
                        
                        PerformanceMonitor.stopTimer(`${operationId}-${symbol.name}`, PerformanceMonitor.MetricTypes.VECTOR_STORAGE, true);
                        
                        const storageDuration = Date.now() - storageStartTime;

                        const symbolDuration = Date.now() - symbolStartTime;
                        console.log(`[${operationId}] ✅ Stored embedding for ${symbol.name} (storage: ${storageDuration}ms, total: ${symbolDuration}ms)`);

                        metrics.successful++;

                    } catch (symbolError) {
                        const symbolDuration = Date.now() - symbolStartTime;
                        console.error(`[${operationId}] ❌ Failed to process embedding for symbol ${symbol.name} (${symbolDuration}ms):`, symbolError);

                        // Log detailed error information
                        if (symbolError instanceof Error) {
                            console.error(`[${operationId}] Error type: ${symbolError.constructor.name}`);
                            console.error(`[${operationId}] Error message: ${symbolError.message}`);
                        }

                        metrics.failed++;
                        
                        // For individual symbol failures, continue processing other symbols
                        // Only abort if it's a critical infrastructure failure
                        if (symbolError instanceof Error && 
                            (symbolError.message.includes('service unavailable') || 
                             symbolError.message.includes('connection'))) {
                            console.error(`[${operationId}] 🚫 Critical infrastructure failure detected, aborting remaining symbols`);
                            break;
                        }
                    }
                }
            } else {
                console.log(`[${operationId}] ℹ️ No new symbols to upsert (all symbols already exist in database)`);
            }

            const totalDuration = Date.now() - startTime;
            
            // Final reconciliation report
            console.log(`[${operationId}] 📊 Reconciliation workflow completed (${totalDuration}ms):`);
            console.log(`[${operationId}]   - Existing embeddings: ${reconciliationState.reconciliationMetrics.existing}`);
            console.log(`[${operationId}]   - Deleted embeddings: ${reconciliationState.idsToDelete.length}`);
            console.log(`[${operationId}]   - Processed symbols: ${metrics.processed}`);
            console.log(`[${operationId}]   - Successful: ${metrics.successful}`);
            console.log(`[${operationId}]   - Failed: ${metrics.failed}`);
            console.log(`[${operationId}]   - Skipped: ${metrics.skipped}`);
            console.log(`[${operationId}]   - Success rate: ${metrics.processed > 0 ? Math.round((metrics.successful / metrics.processed) * 100) : 0}%`);

            // Stop performance monitoring and log metrics
            PerformanceMonitor.stopTimer(operationId, PerformanceMonitor.MetricTypes.RECONCILIATION, true, {
                existingEmbeddings: reconciliationState.reconciliationMetrics.existing,
                deletedEmbeddings: reconciliationState.idsToDelete.length,
                processedSymbols: metrics.processed,
                successfulEmbeddings: metrics.successful,
                failedEmbeddings: metrics.failed,
                skippedSymbols: metrics.skipped,
                successRate: metrics.processed > 0 ? Math.round((metrics.successful / metrics.processed) * 100) : 0
            });

            // Log performance summary
            PerformanceMonitor.logSummary(operationId);

            return metrics;

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[${operationId}] ❌ Critical error in reconciliation workflow (${totalDuration}ms):`, error);

            // Enhanced error handling with categorization
            if (error instanceof Error) {
                console.error(`[${operationId}] ⚠️ Error type: ${error.constructor.name}`);
                console.error(`[${operationId}] 📋 Error message: ${error.message}`);
                if (error.stack) {
                    console.error(`[${operationId}] 📚 Error stack:`, error.stack);
                }
                
                // Categorize error types
                let errorCategory = 'unknown';
                if (error.message.includes('reconciliation')) {
                    errorCategory = 'reconciliation';
                } else if (error.message.includes('connection') || error.message.includes('database')) {
                    errorCategory = 'database';
                } else if (error.message.includes('service')) {
                    errorCategory = 'service';
                }
                
                console.error(`[${operationId}] 🏷️ Error category: ${errorCategory}`);
                
                // Stop performance monitoring with failure  
                PerformanceMonitor.stopTimer(operationId, PerformanceMonitor.MetricTypes.RECONCILIATION, false, {
                    symbolCount: symbols.length
                });
            }

            // Mark all symbols as failed for this critical error
            metrics.failed = symbols.length;
            metrics.successful = 0;

            // Don't rethrow - embedding failures should not block documentation generation
            return metrics;
        }
    }

    /**
     * Enhanced error handling and recovery for reconciliation operations
     * @param operationName Name of the operation for logging
     * @param operation The operation to execute with error handling
     * @param recoveryOptions Options for error recovery
     * @returns Promise<T> Result of the operation or fallback value
     */
    private async executeWithErrorRecovery<T>(
        operationName: string,
        operation: () => Promise<T>,
        operationId: string,
        recoveryOptions: {
            maxRetries?: number;
            retryDelayMs?: number;
            fallbackValue?: T;
            allowFailure?: boolean;
            retryableErrorTypes?: string[];
            onError?: (error: Error, attempt: number) => void;
        } = {}
    ): Promise<T> {
        const {
            maxRetries = 3,
            retryDelayMs = 1000,
            fallbackValue,
            allowFailure = false,
            retryableErrorTypes = ['connection', 'timeout', 'temporary', 'lock', 'busy'],
            onError
        } = recoveryOptions;

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[${operationId}] 🔄 Executing ${operationName} (attempt ${attempt}/${maxRetries})...`);
                const startTime = Date.now();
                
                const result = await operation();
                
                const duration = Date.now() - startTime;
                if (attempt > 1) {
                    console.log(`[${operationId}] ✅ ${operationName} succeeded on retry attempt ${attempt} (${duration}ms)`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Call error callback if provided
                if (onError) {
                    onError(lastError, attempt);
                }
                
                console.error(`[${operationId}] ❌ ${operationName} failed on attempt ${attempt}/${maxRetries}:`, lastError.message);
                
                // Categorize error to determine if it's retryable
                const isRetryable = this.isErrorRetryable(lastError, retryableErrorTypes);
                
                // If this is the last attempt or error is not retryable, handle final failure
                if (attempt === maxRetries || !isRetryable) {
                    console.error(`[${operationId}] 🚫 ${operationName} failed permanently after ${attempt} attempts`);
                    
                    // Log error categorization
                    const errorCategory = this.categorizeError(lastError);
                    console.error(`[${operationId}] 🏷️ Error category: ${errorCategory}, Retryable: ${isRetryable}`);
                    
                    // Handle final failure
                    if (allowFailure && fallbackValue !== undefined) {
                        console.log(`[${operationId}] 🔄 Using fallback value for ${operationName}`);
                        return fallbackValue;
                    } else if (allowFailure) {
                        console.log(`[${operationId}] ⚠️ Operation ${operationName} failed but marked as non-critical`);
                        throw lastError;
                    } else {
                        // Critical failure - create user notification
                        this.notifyUserOfCriticalError(operationName, lastError, operationId);
                        throw new Error(`Critical failure in ${operationName}: ${lastError.message}`);
                    }
                }
                
                // Wait before retry if this isn't the last attempt
                if (attempt < maxRetries) {
                    const delay = retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`[${operationId}] ⏳ Retrying ${operationName} in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // This should never be reached, but TypeScript requires it
        throw lastError || new Error(`Unexpected error in ${operationName}`);
    }

    /**
     * Determine if an error is retryable based on error message patterns
     * @param error The error to check
     * @param retryableTypes Array of retryable error type keywords
     * @returns boolean True if the error is retryable
     */
    private isErrorRetryable(error: Error, retryableTypes: string[]): boolean {
        const errorMessage = error.message.toLowerCase();
        return retryableTypes.some(type => errorMessage.includes(type));
    }

    /**
     * Categorize an error for better monitoring and debugging
     * @param error The error to categorize
     * @returns string The error category
     */
    private categorizeError(error: Error): string {
        const message = error.message.toLowerCase();
        
        if (message.includes('connection') || message.includes('network')) {
            return 'connection';
        } else if (message.includes('timeout')) {
            return 'timeout';
        } else if (message.includes('permission') || message.includes('access')) {
            return 'permission';
        } else if (message.includes('memory') || message.includes('allocation')) {
            return 'memory';
        } else if (message.includes('schema') || message.includes('type')) {
            return 'schema';
        } else if (message.includes('lock') || message.includes('busy')) {
            return 'lock';
        } else if (message.includes('service') || message.includes('unavailable')) {
            return 'service';
        } else if (message.includes('validation') || message.includes('input')) {
            return 'validation';
        } else {
            return 'unknown';
        }
    }

    /**
     * Notify user of critical errors that require attention
     * @param operationName The operation that failed
     * @param error The error that occurred
     * @param operationId Operation ID for logging
     */
    private notifyUserOfCriticalError(operationName: string, error: Error, operationId: string): void {
        const errorCategory = this.categorizeError(error);
        
        // Create user-friendly error messages based on category
        let userMessage = `${operationName} failed: ${error.message}`;
        let actionSuggestion = '';
        
        switch (errorCategory) {
            case 'connection':
                userMessage = `Database connection error during ${operationName}`;
                actionSuggestion = 'Check your network connection and try again.';
                break;
            case 'permission':
                userMessage = `Permission error during ${operationName}`;
                actionSuggestion = 'Check file permissions for the workspace directory.';
                break;
            case 'memory':
                userMessage = `Memory error during ${operationName}`;
                actionSuggestion = 'Close other applications to free up memory.';
                break;
            case 'service':
                userMessage = `Service unavailable during ${operationName}`;
                actionSuggestion = 'AI services may be temporarily unavailable. Try again later.';
                break;
            default:
                userMessage = `Unexpected error during ${operationName}`;
                actionSuggestion = 'Check the output panel for detailed error information.';
        }
        
        console.error(`[${operationId}] 📢 Notifying user of critical error: ${userMessage}`);
        
        // Show notification with action button
        vscode.window.showErrorMessage(
            `${userMessage}. ${actionSuggestion}`,
            'Show Details',
            'Retry'
        ).then(selection => {
            if (selection === 'Show Details') {
                // Show detailed error in output panel
                console.error(`[${operationId}] 📋 User requested error details:`);
                console.error(`[${operationId}] Operation: ${operationName}`);
                console.error(`[${operationId}] Error: ${error.message}`);
                console.error(`[${operationId}] Category: ${errorCategory}`);
                console.error(`[${operationId}] Stack: ${error.stack || 'Not available'}`);
                
                vscode.window.showInformationMessage(
                    'Detailed error information has been logged to the output panel. Use View > Output and select "IDE Constellation" channel.'
                );
            } else if (selection === 'Retry') {
                vscode.window.showInformationMessage(
                    'Save the file again to retry the operation.'
                );
            }
        });
    }

    /**
     * Calculate reconciliation differences between old database state and new parsed symbols
     * @param existingIds Array of existing embedding IDs in the database for this file
     * @param newSymbols Array of newly parsed symbols from the file
     * @param filePath The file path for logging and ID generation
     * @param operationId Operation ID for logging
     * @returns Object containing IDs to delete and symbols to upsert
     */
    private async calculateReconciliationState(
        existingIds: string[],
        newSymbols: CodeSymbol[],
        filePath: string,
        operationId: string
    ): Promise<{
        idsToDelete: string[];
        symbolsToUpsert: CodeSymbol[];
        reconciliationMetrics: {
            existing: number;
            new: number;
            toDelete: number;
            toUpsert: number;
            unchanged: number;
        }
    }> {
        const startTime = Date.now();
        console.log(`[${operationId}] 🔍 Calculating reconciliation state for file: ${filePath}`);
        console.log(`[${operationId}] 📊 Existing IDs: ${existingIds.length}, New symbols: ${newSymbols.length}`);

        try {
            // Get relative path for consistent ID generation using centralized utility
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }
            const relativePath = normalizePath(filePath, workspaceRoot);
            
            // Generate expected IDs for new symbols
            const newSymbolIds = new Set<string>();
            const symbolIdMap = new Map<string, CodeSymbol>();
            
            for (const symbol of newSymbols) {
                const expectedId = VectorStoreService.generateUniqueId(relativePath, symbol.name);
                newSymbolIds.add(expectedId);
                symbolIdMap.set(expectedId, symbol);
                console.log(`[${operationId}] 🆔 Generated ID for symbol ${symbol.name}: ${expectedId}`);
            }
            
            // Convert existing IDs to Set for efficient lookup
            const existingIdSet = new Set(existingIds);
            
            // Calculate IDs to delete (exist in database but not in new symbols)
            const idsToDelete = existingIds.filter(id => !newSymbolIds.has(id));
            
            // Calculate symbols to upsert (only new symbols that don't already exist)
            // This prevents creating duplicates for unchanged symbols
            const newSymbolsOnly = newSymbols.filter(symbol => {
                const expectedId = VectorStoreService.generateUniqueId(relativePath, symbol.name);
                return !existingIdSet.has(expectedId);
            });
            const symbolsToUpsert = newSymbolsOnly;
            
            // Calculate unchanged symbols (exist in both old and new)
            const unchangedIds = existingIds.filter(id => newSymbolIds.has(id));
            
            // Prepare reconciliation metrics
            const reconciliationMetrics = {
                existing: existingIds.length,
                new: newSymbols.length,
                toDelete: idsToDelete.length,
                toUpsert: symbolsToUpsert.length,
                unchanged: unchangedIds.length
            };
            
            const duration = Date.now() - startTime;
            
            // Log reconciliation analysis
            console.log(`[${operationId}] 📊 Reconciliation analysis completed (${duration}ms):`);
            console.log(`[${operationId}]   - Existing embeddings: ${reconciliationMetrics.existing}`);
            console.log(`[${operationId}]   - New symbols: ${reconciliationMetrics.new}`);
            console.log(`[${operationId}]   - IDs to delete: ${reconciliationMetrics.toDelete}`);
            console.log(`[${operationId}]   - Symbols to upsert: ${reconciliationMetrics.toUpsert}`);
            console.log(`[${operationId}]   - Unchanged symbols: ${reconciliationMetrics.unchanged}`);
            
            // Log details of changes for debugging
            if (idsToDelete.length > 0) {
                console.log(`[${operationId}] 🗑️ IDs to delete (obsolete symbols): ${idsToDelete.slice(0, 5).join(', ')}${idsToDelete.length > 5 ? '...' : ''}`);
            }
            
            if (symbolsToUpsert.length > 0) {
                const symbolNames = symbolsToUpsert.slice(0, 5).map(s => s.name);
                console.log(`[${operationId}] ⬆️ Symbols to upsert (new symbols only): ${symbolNames.join(', ')}${symbolsToUpsert.length > 5 ? '...' : ''}`);
            }
            
            if (unchangedIds.length > 0) {
                console.log(`[${operationId}] ✅ Unchanged symbols (will be preserved): ${unchangedIds.length} symbols`);
            }
            
            // Detect potential issues
            if (reconciliationMetrics.existing > 0 && reconciliationMetrics.new === 0) {
                console.warn(`[${operationId}] ⚠️ Potential issue: File has existing embeddings but no new symbols (file might be empty or parsing failed)`);
            }
            
            if (reconciliationMetrics.toDelete === reconciliationMetrics.existing && reconciliationMetrics.new > 0) {
                console.log(`[${operationId}] 🔄 Full replacement: All existing embeddings will be replaced with new symbols`);
            }
            
            return {
                idsToDelete,
                symbolsToUpsert,
                reconciliationMetrics
            };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[${operationId}] ❌ Reconciliation state calculation failed (${duration}ms):`, error);
            
            // Enhanced error handling with categorization
            if (error instanceof Error) {
                console.error(`[${operationId}] ⚠️ Error type: ${error.constructor.name}`);
                console.error(`[${operationId}] 📋 Error message: ${error.message}`);
                
                // Log stack trace for debugging
                if (error.stack) {
                    console.error(`[${operationId}] 📚 Error stack:`, error.stack);
                }
                
                // Categorize error types for better monitoring
                let errorCategory = 'unknown';
                if (error.message.includes('ID') || error.message.includes('generation')) {
                    errorCategory = 'id_generation';
                } else if (error.message.includes('symbol') || error.message.includes('parsing')) {
                    errorCategory = 'symbol_processing';
                } else if (error.message.includes('path') || error.message.includes('file')) {
                    errorCategory = 'path_resolution';
                }
                
                console.error(`[${operationId}] 🏷️ Error category: ${errorCategory}`);
                
                // Re-throw with enhanced error message
                throw new Error(`Reconciliation state calculation failed (${errorCategory}): ${error.message}`);
            } else {
                console.error(`[${operationId}] ❓ Unknown error type: ${typeof error}`);
                console.error(`[${operationId}] 📋 Error details: ${String(error)}`);
                throw new Error(`Reconciliation state calculation failed with unknown error: ${String(error)}`);
            }
        }
    }

    /**
     * Extract docstring content from a code symbol
     * @param symbol - The code symbol to extract docstring from
     * @param operationId - Operation ID for logging
     * @returns string | null The extracted docstring content or null if none
     */
    private extractDocstringContent(symbol: CodeSymbol, operationId: string): string | null {
        // Check if symbol has documentation
        if (!symbol.documentation || symbol.documentation.trim().length === 0) {
            return null;
        }

        try {
            // Clean up JSDoc comment format to extract plain text content
            let content = symbol.documentation.trim();

            // Remove JSDoc comment markers (/** */)
            content = content.replace(/^\/\*\*/, '').replace(/\*\/$/, '');

            // Remove leading asterisks and whitespace from each line
            content = content
                .split('\n')
                .map(line => line.replace(/^\s*\*\s?/, '').trim())
                .filter(line => line.length > 0)
                .join(' ');

            // Remove JSDoc tags for cleaner embedding content
            content = content.replace(/@\w+\s+[^@]*/g, '').trim();

            if (content.length === 0) {
                return null;
            }

            console.log(`[${operationId}] 📝 Extracted docstring content for ${symbol.name}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
            return content;

        } catch (error) {
            console.error(`[${operationId}] ❌ Failed to extract docstring content for ${symbol.name}:`, error);
            return null;
        }
    }

    /**
     * Handles file deletion events to synchronize documentation files
     * @param event - The file deletion event containing deleted files
     */
    public async handleFilesDeletion(event: vscode.FileDeleteEvent): Promise<void> {
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
                        await this.deleteCorrespondingDocumentationFile(deletedFilePath, operationId);
                        
                        // Also delete embeddings from vector store
                        try {
                            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                            if (!workspaceRoot) {
                                throw new Error('No workspace folder found');
                            }
                            const relativePath = normalizePath(deletedFilePath, workspaceRoot);
                            console.log(`[${operationId}] 🧠 Deleting vector embeddings for file: ${relativePath}`);
                            const vectorStoreService = VectorStoreService.getInstance();
                            await vectorStoreService.deleteFileEmbeddings(relativePath);
                            console.log(`[${operationId}] ✅ Vector embeddings deleted successfully`);
                        } catch (vectorError) {
                            console.error(`[${operationId}] ⚠️ Failed to delete vector embeddings (continuing anyway):`, vectorError);
                            // Don't fail the entire operation if vector cleanup fails
                        }
                        
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
    private async deleteCorrespondingDocumentationFile(sourceFilePath: string, operationId: string): Promise<void> {
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
     * Manages processing tasks to handle concurrent file saves gracefully
     * @param document - The saved text document
     * @param startTime - When the save event started  
     * @param operationId - Unique identifier for this operation
     */
    public async processWithTaskManagement(document: vscode.TextDocument, startTime: number, operationId: string): Promise<void> {
        const filePath = document.fileName;

        // Handle concurrent file save events gracefully
        const existingTask = this.processingTasks.get(filePath);
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
        const processingTask = this.processFileDocumentation(document, startTime, operationId);
        this.processingTasks.set(filePath, processingTask);

        // Clean up the tracking when processing completes
        processingTask.finally(() => {
            this.processingTasks.delete(filePath);
            console.log(`[${operationId}] Removed processing task from tracking map`);
        });

        // Don't await here to keep file save operations responsive
        // The processing happens in the background
    }
}
