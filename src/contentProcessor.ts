import * as vscode from 'vscode';
import { CodeParserService } from './services/CodeParserService';
import { ManifestService } from './services/ManifestService';

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
 * Processes a filtered document by parsing its structure and updating the manifest
 * This function handles the main processing logic for documents that pass filtering
 * @param document - The VS Code text document to process
 */
export async function processDocument(document: vscode.TextDocument): Promise<void> {
    const startTime = Date.now();
    
    try {
        if (!document) {
            console.error('Cannot process document: document is null or undefined');
            return;
        }

        // Extract file content, file path, and file extension from vscode.TextDocument
        const fileContent = document.getText();
        const filePath = document.fileName;
        const fileExtension = filePath.substring(filePath.lastIndexOf('.'));

        // Only process TypeScript and JavaScript files
        if (!['.ts', '.js', '.tsx', '.jsx'].includes(fileExtension)) {
            console.log(`Skipping parsing for unsupported file type: ${fileExtension}`);
            return;
        }

        console.log(`Processing document: ${filePath} (${fileExtension}, ${fileContent.length} chars)`);

        // Yield control to keep the UI responsive during processing
        await new Promise(resolve => setImmediate(resolve));

        // Call CodeParserService with extracted information
        const parsingStartTime = Date.now();
        const codeParserService = new CodeParserService();
        const extractedSymbols = codeParserService.parseCode(fileContent, filePath, fileExtension);
        const parsingTime = Date.now() - parsingStartTime;

        console.log(`Extracted ${extractedSymbols.length} symbols from ${filePath} (parsing: ${parsingTime}ms)`);

        // Yield control again before manifest update
        await new Promise(resolve => setImmediate(resolve));

        // Update the manifest with the extracted symbols
        const manifestStartTime = Date.now();
        const manifestService = new ManifestService();
        await manifestService.updateFileSymbols(filePath, extractedSymbols);
        const manifestTime = Date.now() - manifestStartTime;

        const totalTime = Date.now() - startTime;
        console.log(`✅ Successfully processed and indexed: ${filePath} (total: ${totalTime}ms, parsing: ${parsingTime}ms, manifest: ${manifestTime}ms)`);

    } catch (error) {
        const totalTime = Date.now() - startTime;
        // Add error handling to ensure parsing failures don't crash the extension
        console.error(`❌ Error processing document ${document.fileName} (${totalTime}ms):`, error);

        // Fallback logging when document content cannot be accessed
        try {
            console.log(`File saved (processing failed): ${document.fileName}`);
        } catch (fallbackError) {
            console.error('Critical error: Cannot access document information:', fallbackError);
        }
    }
}