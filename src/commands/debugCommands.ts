import * as vscode from 'vscode';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorStoreService } from '../services/VectorStoreService';
import { VscodeService } from '../services/VscodeService';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Debug commands module for the Kiro Constellation extension
 * Provides debugging and testing functionality for vector search capabilities
 */

/**
 * Registers all debug commands for the extension
 * @param context VSCode extension context for command registration
 * @param vscodeService Service for VSCode user interactions
 */
export function registerDebugCommands(context: vscode.ExtensionContext, vscodeService: VscodeService): void {
    // Register vector search test command
    const testVectorQueryDisposable = vscode.commands.registerCommand('constellation.testVectorQuery', async () => {
        await handleTestVectorQuery(vscodeService);
    });
    context.subscriptions.push(testVectorQueryDisposable);
}

/**
 * Handle the test vector query command
 * Tests the vector search functionality with user-provided query
 * @param vscodeService Service for VSCode user interactions
 */
async function handleTestVectorQuery(vscodeService: VscodeService): Promise<void> {
    const startTime = Date.now();
    const testId = ErrorHandler.createOperationId('vector-search-test');

    console.log(`[${testId}] 🧪 CommandController: Starting vector search test...`);

    try {
        // Check if services are initialized
        if (!EmbeddingService.isServiceInitialized()) {
            const errorMsg = 'EmbeddingService is not initialized. Please restart the extension.';
            console.error(`[${testId}] ❌ CommandController: ${errorMsg}`);
            vscodeService.showErrorMessage(`Vector Search Test Failed: ${errorMsg}`);
            return;
        }

        if (!VectorStoreService.isServiceInitialized()) {
            const errorMsg = 'VectorStoreService is not initialized. Please restart the extension.';
            console.error(`[${testId}] ❌ CommandController: ${errorMsg}`);
            vscodeService.showErrorMessage(`Vector Search Test Failed: ${errorMsg}`);
            return;
        }

        // Prompt user for search query
        const testQuery = await vscodeService.showInputBox({
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

            vscodeService.showInformationMessage(
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
            vscodeService.showInformationMessage(
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
