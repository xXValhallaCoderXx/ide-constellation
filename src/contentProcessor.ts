import * as vscode from 'vscode';

/**
 * Logs the document content to the Debug Console
 * @param document - The VS Code text document to log
 */
export function logDocumentContent(document: vscode.TextDocument): void {
    try {
        const filePath = document.fileName;
        const content = document.getText();

        console.log(`File saved: ${filePath}`);
        console.log(`Content:\n${content}`);
    } catch (error) {
        console.error(`Error logging document content for ${document.fileName}:`, error);
    }
}

/**
 * Processes a filtered document by logging its content
 * This function handles the main processing logic for documents that pass filtering
 * @param document - The VS Code text document to process
 */
export function processDocument(document: vscode.TextDocument): void {
    try {
        if (!document) {
            console.error('Cannot process document: document is null or undefined');
            return;
        }

        // For now, processing means logging the document content
        // This can be extended in the future to trigger Polaris functionality
        logDocumentContent(document);

    } catch (error) {
        console.error(`Error processing document ${document.fileName}:`, error);

        // Fallback logging when document content cannot be accessed
        try {
            console.log(`File saved (content unavailable): ${document.fileName}`);
        } catch (fallbackError) {
            console.error('Critical error: Cannot access document information:', fallbackError);
        }
    }
}