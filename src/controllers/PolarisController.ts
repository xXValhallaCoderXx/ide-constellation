import * as vscode from 'vscode';
import * as path from 'path';
import { shouldProcessDocument, DEFAULT_CONFIG } from '../documentFilter';
import { PolarisService } from '../polaris/PolarisService';
import { VscodeService } from '../services/VscodeService';
import { VectorStoreService } from '../services/VectorStoreService';
import { ErrorHandler } from '../utils/ErrorHandler';

/**
 * Controller responsible for coordinating file save events and VSCode integration
 * Business logic has been moved to PolarisService for better separation of concerns
 */
export class PolarisController {
    private context: vscode.ExtensionContext;
    private processingTasks = new Map<string, Promise<void>>();
    private polarisService: PolarisService;
    private vscodeService: VscodeService;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.vscodeService = new VscodeService();
        this.polarisService = new PolarisService(context, this.vscodeService);
    }

    /**
     * Handle document save events (moved from extension.ts)
     * @param document - The saved text document
     */
    public async onDidSave(document: vscode.TextDocument): Promise<void> {
        const startTime = Date.now();
        const filePath = document.fileName;
        const operationId = `save-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = path.basename(filePath);
        const fileSize = document.getText().length;

        console.log(`[${operationId}] 📄 HANDLE DOCUMENT SAVE: ${fileName} (${fileSize} bytes)`);

        try {
            // Apply document filtering
            if (!shouldProcessDocument(document, DEFAULT_CONFIG)) {
                console.log(`[${operationId}] ⏭️ Skipping document processing: ${fileName} (filtered out)`);
                return;
            }

            // Check if already processing this file
            if (this.processingTasks.has(filePath)) {
                console.log(`[${operationId}] ⏳ File already being processed: ${fileName}`);
                await this.vscodeService.showInformationMessage(`${fileName} is already being processed...`);
                return;
            }

            // Start processing task
            const processingTask = this.processFileDocumentation(document, startTime, operationId);
            this.processingTasks.set(filePath, processingTask);

            // Wait for completion and clean up
            await processingTask;
            this.processingTasks.delete(filePath);

        } catch (error) {
            // Clean up processing task on error
            this.processingTasks.delete(filePath);

            const totalTime = Date.now() - startTime;
            const errorInfo = ErrorHandler.logError(operationId, 'Document save handling', error, totalTime);

            // Show user notification using VscodeService
            await this.vscodeService.showErrorMessage(
                `Failed to process ${fileName}: ${errorInfo.userMessage}`
            );
        }
    }

    /**
     * Processes a document for file-level documentation generation
     * Now delegates to PolarisService for business logic
     * @param document - The saved text document
     * @param startTime - When the save event started
     * @param operationId - Unique identifier for this operation
     */
    public async processFileDocumentation(document: vscode.TextDocument, startTime: number, operationId: string): Promise<void> {
        const fileName = path.basename(document.fileName);

        console.log(`[${operationId}] 🚀 PolarisController: Starting coordination for ${fileName}`);

        try {
            // Delegate business logic to PolarisService
            await this.polarisService.processDocumentation(document, startTime, operationId);

            console.log(`[${operationId}] ✅ PolarisController: Coordination completed for ${fileName}`);

        } catch (error) {
            console.error(`[${operationId}] ❌ PolarisController: Coordination failed for ${fileName}:`, error);

            // Error presentation through VscodeService
            await this.vscodeService.showErrorMessage(
                `Documentation processing failed for ${fileName}. Check output panel for details.`
            );

            // Re-throw to allow upstream error handling
            throw error;
        }
    }

    /**
     * Handle file deletion events - VSCode workspace event coordination
     * @param deletedFiles - Array of deleted file URIs
     */
    public async handleFilesDeletion(deletedFiles: readonly vscode.Uri[]): Promise<void> {
        const operationId = `delete-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[${operationId}] 🗑️ PolarisController: Handling deletion of ${deletedFiles.length} files`);

        try {
            // Only proceed if vector store service is available
            if (!VectorStoreService.isServiceInitialized()) {
                console.log(`[${operationId}] ⚠️ VectorStoreService not initialized, skipping embedding cleanup`);
                return;
            }

            const vectorStoreService = VectorStoreService.getInstance();

            // Process each deleted file
            for (const deletedUri of deletedFiles) {
                const deletedPath = deletedUri.fsPath;
                const fileName = path.basename(deletedPath);

                try {
                    console.log(`[${operationId}] 🧹 Cleaning up embeddings for deleted file: ${fileName}`);

                    // Delete embeddings associated with this file
                    await vectorStoreService.deleteFileEmbeddings(deletedPath);

                    console.log(`[${operationId}] ✅ Embedding cleanup completed for: ${fileName}`);

                } catch (deleteError) {
                    console.error(`[${operationId}] ❌ Failed to clean up embeddings for ${fileName}:`, deleteError);

                    // Show warning but continue with other files
                    await this.vscodeService.showWarningMessage(
                        `Failed to clean up embeddings for deleted file: ${fileName}`
                    );
                }
            }

            console.log(`[${operationId}] ✅ File deletion handling completed for ${deletedFiles.length} files`);

        } catch (error) {
            console.error(`[${operationId}] ❌ File deletion handling failed:`, error);

            await this.vscodeService.showErrorMessage(
                'Failed to clean up embeddings for deleted files. Check output panel for details.'
            );
        }
    }
}
