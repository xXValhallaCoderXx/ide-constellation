import * as vscode from 'vscode';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';

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
    }

    /**
     * Handle the test vector query command
     * Tests the vector search functionality with user-provided query
     */
    private async handleTestVectorQuery(): Promise<void> {
        const startTime = Date.now();
        const testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
            console.error(`[${testId}] ❌ CommandController: Vector search test failed (${totalDuration}ms):`, error);

            // Enhanced error logging
            if (error instanceof Error) {
                console.error(`[${testId}] ⚠️ CommandController: Error type: ${error.constructor.name}`);
                console.error(`[${testId}] 📋 CommandController: Error message: ${error.message}`);

                if (error.stack) {
                    console.error(`[${testId}] 📚 CommandController: Error stack:`, error.stack);
                }

                // Show user-friendly error message
                vscode.window.showErrorMessage(
                    `Vector Search Test Failed: ${error.message}. Check debug console for details.`
                );
            } else {
                console.error(`[${testId}] ❓ CommandController: Unknown error type: ${typeof error}`);
                console.error(`[${testId}] 📋 CommandController: Error details: ${String(error)}`);

                vscode.window.showErrorMessage(
                    `Vector Search Test Failed: Unknown error occurred. Check debug console for details.`
                );
            }
        }
    }
}
