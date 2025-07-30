import * as vscode from 'vscode';
import * as path from 'path';
import { processDocument } from '../contentProcessor';
import { CodeParserService } from '../services/CodeParserService';
import { DocGeneratorService } from '../services/DocGeneratorService';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';
import { VscodeService } from '../services/VscodeService';
import { CodeSymbol, ParsedJSDoc } from '../types';
import { ErrorHandler } from '../utils/ErrorHandler';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';
import { normalizePath } from '../utils/pathUtils';

/**
 * PolarisService handles the heavy business logic for documentation processing
 * This includes symbol parsing, AI documentation generation, and embedding reconciliation
 */
export class PolarisService {
    private context: vscode.ExtensionContext;
    private vscodeService: VscodeService;

    constructor(context: vscode.ExtensionContext, vscodeService: VscodeService) {
        this.context = context;
        this.vscodeService = vscodeService;
    }

    /**
     * Process documentation for a file with all business logic
     * @param document - The saved text document
     * @param startTime - When the save event started
     * @param operationId - Unique identifier for this operation
     */
    public async processDocumentation(document: vscode.TextDocument, startTime: number, operationId: string): Promise<void> {
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
                this.vscodeService.showWarningMessage(
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
                            this.vscodeService.showWarningMessage(
                                `Embedding processing failed: ${errorInfo.userMessage}. Documentation will continue without semantic features.`,
                                'Details'
                            ).then(selection => {
                                if (selection === 'Details') {
                                    const errorMsg = error instanceof Error ? error.message : String(error);
                                    this.vscodeService.showErrorMessage(`Embedding error (${errorInfo.category}): ${errorMsg}`);
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
                this.vscodeService.showErrorMessage(
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
                this.vscodeService.showInformationMessage(
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
                this.vscodeService.showWarningMessage(
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
            this.vscodeService.showErrorMessage(
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
     * Process embeddings for symbols with reconciliation workflow (diffing, deleting, upserting)
     * @param symbols - Array of symbols to process
     * @param filePath - Path of the file being processed
     * @param operationId - Unique identifier for this operation
     * @returns Promise with processing metrics
     */
    private async processEmbeddingsForSymbols(symbols: CodeSymbol[], filePath: string, operationId: string): Promise<any> {
        const embeddingStartTime = Date.now();
        let processedCount = 0;
        let successfulCount = 0;
        let failedCount = 0;
        let skippedCount = 0;

        console.log(`[${operationId}] 🔄 Starting embedding reconciliation workflow for ${symbols.length} symbols`);

        try {
            // Check if embedding services are available
            if (!EmbeddingService.isServiceInitialized() || !VectorStoreService.isServiceInitialized()) {
                console.log(`[${operationId}] ⚠️ Embedding services not available, skipping embedding processing`);
                return {
                    processed: 0,
                    successful: 0,
                    failed: 0,
                    skipped: symbols.length
                };
            }

            const embeddingService = EmbeddingService.getInstance();
            const vectorStoreService = VectorStoreService.getInstance();

            // Get workspace root from vscode
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder found');
            }
            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const normalizedFilePath = normalizePath(filePath, workspaceRoot);

            // Step 1: Get existing embeddings for this file using debug method (this is what's available)
            console.log(`[${operationId}] 📋 Retrieving existing embeddings for file: ${normalizedFilePath}`);
            const allRecords = await vectorStoreService.debugGetAllRecords(normalizedFilePath);
            const existingRecords = allRecords.filter((record: any) => record.filePath === normalizedFilePath);
            console.log(`[${operationId}] 📊 Found ${existingRecords.length} existing embedding records`);

            // Step 2: Prepare new embeddings
            const newEmbeddingRequests = [];
            for (const symbol of symbols) {
                if (symbol.documentation && symbol.documentation.trim().length > 0) {
                    const recordId = `${normalizedFilePath}:${symbol.name}:${symbol.type}`;
                    newEmbeddingRequests.push({
                        id: recordId,
                        symbol: symbol,
                        text: symbol.documentation
                    });
                }
            }

            console.log(`[${operationId}] 📦 Prepared ${newEmbeddingRequests.length} embedding requests`);

            // Step 3: Embedding reconciliation - diff existing vs new
            const existingIds = new Set(existingRecords.map((record: any) => record.id));
            const newIds = new Set(newEmbeddingRequests.map(req => req.id));

            // Identify what to delete (exists but not in new set)
            const toDelete = existingRecords.filter((record: any) => !newIds.has(record.id));
            // Identify what to upsert (new or changed)
            const toUpsert = newEmbeddingRequests.filter(req => !existingIds.has(req.id));

            console.log(`[${operationId}] 🔍 Reconciliation analysis:`);
            console.log(`[${operationId}]   - To delete: ${toDelete.length}`);
            console.log(`[${operationId}]   - To upsert: ${toUpsert.length}`);

            // Step 4: Delete obsolete embeddings
            if (toDelete.length > 0) {
                try {
                    console.log(`[${operationId}] 🗑️ Deleting ${toDelete.length} obsolete embeddings`);
                    const idsToDelete = toDelete.map((record: any) => record.id);
                    await vectorStoreService.delete(idsToDelete);
                    console.log(`[${operationId}] ✅ Deleted ${toDelete.length} obsolete embeddings`);
                } catch (deleteError) {
                    console.error(`[${operationId}] ❌ Failed to delete obsolete embeddings:`, deleteError);
                }
            }

            // Step 5: Process new/updated embeddings
            for (const request of toUpsert) {
                processedCount++;
                try {
                    console.log(`[${operationId}] 🔄 Processing embedding ${processedCount}/${toUpsert.length}: ${request.symbol.name}`);

                    // Generate embedding
                    const embedding = await embeddingService.generateEmbedding(request.text);

                    // Upsert to vector store using the correct API signature
                    await vectorStoreService.upsert(request.id, request.text, embedding, normalizedFilePath);

                    successfulCount++;
                    console.log(`[${operationId}] ✅ Successfully processed embedding for ${request.symbol.name}`);

                } catch (embeddingError) {
                    failedCount++;
                    console.error(`[${operationId}] ❌ Failed to process embedding for ${request.symbol.name}:`, embeddingError);
                }
            }

            // Count skipped symbols (those without documentation)
            skippedCount = symbols.length - newEmbeddingRequests.length;

            const totalDuration = Date.now() - embeddingStartTime;
            console.log(`[${operationId}] ✅ Embedding reconciliation completed (${totalDuration}ms)`);
            console.log(`[${operationId}] 📊 Final metrics: ${successfulCount} successful, ${failedCount} failed, ${skippedCount} skipped`);

            return {
                processed: processedCount,
                successful: successfulCount,
                failed: failedCount,
                skipped: skippedCount
            };

        } catch (error) {
            const totalDuration = Date.now() - embeddingStartTime;
            console.error(`[${operationId}] ❌ Embedding reconciliation workflow failed (${totalDuration}ms):`, error);

            return {
                processed: processedCount,
                successful: successfulCount,
                failed: failedCount + (symbols.length - processedCount),
                skipped: skippedCount
            };
        }
    }
}
