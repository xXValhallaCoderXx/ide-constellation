import * as vscode from 'vscode';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Controller responsible for managing all VSCode command registrations
 */
export class CommandController {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Registers all VSCode commands for the extension
     */
    public registerCommands(): void {
        // Register hello world command
        const helloWorldDisposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World from kiro-constellation!');
        });
        this.context.subscriptions.push(helloWorldDisposable);

        // Register vector search test command
        const testVectorQueryDisposable = vscode.commands.registerCommand('constellation.testVectorQuery', async () => {
            await this.handleTestVectorQuery();
        });
        this.context.subscriptions.push(testVectorQueryDisposable);

        // Register debug vector database command
        const debugVectorDbDisposable = vscode.commands.registerCommand('constellation.debugVectorDb', async () => {
            await this.handleDebugVectorDb();
        });
        this.context.subscriptions.push(debugVectorDbDisposable);
    }

    /**
     * Handle the test vector query command
     * Tests the vector search functionality with user-provided query
     */
    private async handleTestVectorQuery(): Promise<void> {
        const startTime = Date.now();
        const testId = ErrorHandler.createOperationId('vector-search-test');

        console.log(`[${testId}] 🧪 CommandController: Starting vector search test...`);

        try {
            // Check if services are initialized
            if (!EmbeddingService.isServiceInitialized()) {
                const errorMsg = 'EmbeddingService is not initialized. Please restart the extension.';
                console.error(`[${testId}] ❌ CommandController: ${errorMsg}`);
                vscode.window.showErrorMessage(`Vector Search Test Failed: ${errorMsg}`);
                return;
            }

            if (!VectorStoreService.isServiceInitialized()) {
                const errorMsg = 'VectorStoreService is not initialized. Please restart the extension.';
                console.error(`[${testId}] ❌ CommandController: ${errorMsg}`);
                vscode.window.showErrorMessage(`Vector Search Test Failed: ${errorMsg}`);
                return;
            }

            // Prompt user for search query
            const testQuery = await vscode.window.showInputBox({
                prompt: 'Enter a search query to test vector similarity search',
                placeHolder: 'e.g., "a function that calculates age"',
                value: 'a function that calculates age', // Default value from requirements
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return 'Search query cannot be empty';
                    }
                    if (value.trim().length < 3) {
                        return 'Search query must be at least 3 characters long';
                    }
                    return null;
                }
            });

            // Check if user cancelled the input
            if (testQuery === undefined) {
                console.log(`[${testId}] ❌ CommandController: User cancelled vector search test`);
                return;
            }

            console.log(`[${testId}] 📝 CommandController: Test query: "${testQuery}"`);

            // Get service instances
            const embeddingService = EmbeddingService.getInstance();
            const vectorStoreService = VectorStoreService.getInstance();

            // Generate embedding for test query
            console.log(`[${testId}] 🤖 CommandController: Generating embedding for test query...`);
            const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
            console.log(`[${testId}] ✅ CommandController: Query embedding generated (${queryEmbedding.length} dimensions)`);

            // Perform similarity search
            console.log(`[${testId}] 🔍 CommandController: Performing similarity search...`);
            const searchResults = await vectorStoreService.search(queryEmbedding, 5);
            console.log(`[${testId}] ✅ CommandController: Search completed, found ${searchResults.length} results`);

            // Display results in debug console
            console.log(`[${testId}] 📊 CommandController: === VECTOR SEARCH TEST RESULTS ===`);
            console.log(`[${testId}] 📝 CommandController: Query: "${testQuery}"`);
            console.log(`[${testId}] 🔢 CommandController: Results found: ${searchResults.length}`);
            console.log(`[${testId}] ⏱️ CommandController: Total time: ${Date.now() - startTime}ms`);
            console.log(`[${testId}] 📊 CommandController: =====================================`);

            if (searchResults.length === 0) {
                console.log(`[${testId}] 📭 CommandController: No similar docstrings found in the vector database.`);
                console.log(`[${testId}] 💡 CommandController: This might mean:`);
                console.log(`[${testId}] 💡 CommandController: - No files have been processed yet`);
                console.log(`[${testId}] 💡 CommandController: - No docstrings match the query`);
                console.log(`[${testId}] 💡 CommandController: - The vector database is empty`);

                vscode.window.showInformationMessage(
                    `Vector Search Test Completed: No results found for "${testQuery}". Check debug console for details.`
                );
            } else {
                // Log detailed results
                searchResults.forEach((result, index) => {
                    console.log(`[${testId}] 📄 CommandController: Result ${index + 1}:`);
                    console.log(`[${testId}] 🆔 CommandController:   ID: ${result.id}`);
                    console.log(`[${testId}] 📊 CommandController:   Score: ${result.score.toFixed(4)}`);
                    console.log(`[${testId}] 📝 CommandController:   Text: ${result.text.substring(0, 200)}${result.text.length > 200 ? '...' : ''}`);
                    console.log(`[${testId}] ➖ CommandController:   ${'─'.repeat(50)}`);
                });

                // Show success message with top result
                const topResult = searchResults[0];
                vscode.window.showInformationMessage(
                    `Vector Search Test Completed: Found ${searchResults.length} results. Top match: "${topResult.id}" (score: ${topResult.score.toFixed(4)}). Check debug console for full results.`
                );
            }

            console.log(`[${testId}] 🎉 CommandController: Vector search test completed successfully`);

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            const errorInfo = ErrorHandler.logError(testId, 'Vector search test', error, totalDuration);

            // Show user-friendly error notification
            await ErrorHandler.showUserNotification(
                'Vector Search Test',
                errorInfo,
                error,
                {
                    customMessage: `Vector search test failed: ${errorInfo.userMessage}`,
                    onRetry: () => {
                        console.log(`[${testId}] 🔄 CommandController: User requested retry for vector search test`);
                        vscode.commands.executeCommand('constellation.testVectorQuery');
                    }
                }
            );
        }
    }

    /**
     * Handle the debug vector database command
     * Shows debugging information about vector database state
     */
    private async handleDebugVectorDb(): Promise<void> {
        const debugId = `debug-${Date.now()}`;

        try {
            console.log(`[${debugId}] 🐛 CommandController: Starting vector database debug...`);

            // Get the active file if available
            const activeEditor = vscode.window.activeTextEditor;
            let targetFilePath: string | undefined;

            if (activeEditor) {
                targetFilePath = activeEditor.document.uri.fsPath;
                console.log(`[${debugId}] 📂 Using active file: ${targetFilePath}`);
            } else {
                console.log(`[${debugId}] ℹ️ No active file, will show all records`);
            }

            // Initialize vector store service
            const vectorStoreInstance = VectorStoreService.getInstance();
            await VectorStoreService.initialize();

            // Get ALL records first to see what's in the database
            console.log(`[${debugId}] 🔍 Getting ALL records in database...`);
            const allRecords = await vectorStoreInstance.debugGetAllRecords();

            console.log(`[${debugId}] 📊 Total records in database: ${allRecords.length}`);

            // If we have a target file, also check path normalization
            let normalizedPath: string | undefined;
            let recordsForFile: any[] = [];

            if (targetFilePath) {
                // Test path normalization
                try {
                    normalizedPath = vectorStoreInstance.validateAndNormalizeFilePath(targetFilePath, debugId);
                    console.log(`[${debugId}] 🔧 Normalized path: ${normalizedPath}`);

                    // Get records for the specific file
                    recordsForFile = await vectorStoreInstance.debugGetAllRecords(normalizedPath);
                    console.log(`[${debugId}] 📁 Records for normalized path: ${recordsForFile.length}`);
                } catch (error) {
                    console.error(`[${debugId}] ❌ Error normalizing path:`, error);
                }
            }

            // Show detailed results
            let message = `📊 Database Status:\n`;
            message += `Total Records: ${allRecords.length}\n`;

            if (targetFilePath) {
                message += `\n📂 Active File: ${targetFilePath}\n`;
                if (normalizedPath) {
                    message += `🔧 Normalized: ${normalizedPath}\n`;
                }
                message += `📁 Records for file: ${recordsForFile.length}\n`;
            }

            if (allRecords.length > 0) {
                message += `\n📋 All Records:\n`;
                allRecords.slice(0, 10).forEach((r, i) => {
                    message += `${i + 1}. ID: ${r.id}\n`;
                    message += `   Path: ${r.filePath}\n`;
                    message += `   Hash: ${r.contentHash.substring(0, 12)}...\n\n`;
                });

                if (allRecords.length > 10) {
                    message += `... and ${allRecords.length - 10} more records\n`;
                }

                // Check for path mismatches
                if (targetFilePath && normalizedPath) {
                    const pathVariations = allRecords.map(r => r.filePath).filter((path, index, self) => self.indexOf(path) === index);
                    message += `\n🔍 Unique file paths in database:\n`;
                    pathVariations.slice(0, 5).forEach(path => {
                        message += `- ${path}\n`;
                    });

                    if (pathVariations.length > 5) {
                        message += `... and ${pathVariations.length - 5} more paths\n`;
                    }
                }
            } else {
                message += `\n❌ No records found in database!`;
            }

            // Show in information message with option to copy to clipboard
            const action = await vscode.window.showInformationMessage(
                message,
                'Copy Debug Info',
                'Show in Console',
                'OK'
            );

            if (action === 'Copy Debug Info') {
                const debugInfo = {
                    timestamp: new Date().toISOString(),
                    targetFile: targetFilePath || 'ALL_FILES',
                    normalizedPath: normalizedPath,
                    totalRecords: allRecords.length,
                    recordsForFile: recordsForFile.length,
                    allRecords: allRecords,
                    uniquePaths: allRecords.map(r => r.filePath).filter((path, index, self) => self.indexOf(path) === index)
                };

                await vscode.env.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
                vscode.window.showInformationMessage('Debug information copied to clipboard!');
            } else if (action === 'Show in Console') {
                console.log(`[${debugId}] 📊 DETAILED DEBUG INFO:`, {
                    targetFile: targetFilePath,
                    normalizedPath,
                    totalRecords: allRecords.length,
                    recordsForFile: recordsForFile.length,
                    allRecords,
                    uniquePaths: allRecords.map(r => r.filePath).filter((path, index, self) => self.indexOf(path) === index)
                });
                vscode.window.showInformationMessage('Debug information logged to console - check Developer Tools');
            }

            console.log(`[${debugId}] ✅ CommandController: Vector database debug completed`);

        } catch (error) {
            console.error(`[${debugId}] ❌ CommandController: Vector database debug failed:`, error);

            const errorInfo = ErrorHandler.categorizeError(error);
            await ErrorHandler.showUserNotification(
                'Vector Database Debug',
                errorInfo,
                error,
                {
                    customMessage: `Debug failed: ${errorInfo.userMessage}`,
                    onRetry: () => {
                        console.log(`[${debugId}] 🔄 CommandController: User requested retry for vector database debug`);
                        vscode.commands.executeCommand('constellation.debugVectorDb');
                    }
                }
            );
        }
    }
}
