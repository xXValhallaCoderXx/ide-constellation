import * as vscode from 'vscode';
import * as path from 'path';
import { CodeParserService } from './services/CodeParserService';
import { FileSystemService } from './services/FileSystemService';
import { Manifest, CodeSymbol } from './types';

/**
 * Constructs the URI for the manifest.json file in the workspace .constellation directory
 * @param workspaceFolder - The workspace folder
 * @returns URI for the manifest.json file
 */
export function getManifestUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder.uri, '.constellation', 'manifest.json');
}

/**
 * Reads the existing manifest from disk with empty object fallback for new workspaces
 * @param workspaceFolder - The workspace folder
 * @returns Promise resolving to the manifest object
 */
export async function readManifest(workspaceFolder: vscode.WorkspaceFolder): Promise<Manifest> {
    try {
        const manifestUri = getManifestUri(workspaceFolder);
        const manifestContent = await FileSystemService.readFile(manifestUri);
        return JSON.parse(manifestContent) as Manifest;
    } catch (error) {
        // Return empty object fallback for new workspaces or read errors
        console.log('Manifest not found or invalid, starting with empty manifest');
        return {};
    }
}

/**
 * Updates the manifest with new symbols for a specific file, ensuring atomic updates
 * @param workspaceFolder - The workspace folder
 * @param filePath - The relative file path from workspace root
 * @param symbols - Array of code symbols for the file
 */
export async function updateManifest(workspaceFolder: vscode.WorkspaceFolder, filePath: string, symbols: CodeSymbol[]): Promise<void> {
    try {
        // Read current manifest
        const manifest = await readManifest(workspaceFolder);

        // Replace file-specific symbol arrays without affecting other files' entries
        manifest[filePath] = symbols;

        // Write updated manifest atomically with proper JSON formatting
        const manifestUri = getManifestUri(workspaceFolder);
        const manifestContent = JSON.stringify(manifest, null, 2);
        await FileSystemService.writeFile(manifestUri, manifestContent);

        console.log(`Updated manifest with ${symbols.length} symbols for ${filePath}`);
    } catch (error) {
        console.error('Error updating manifest:', error);
        throw error;
    }
}

/**
 * Handles file save events for TypeScript files and triggers structural indexing
 * @param document - The saved text document
 */
export async function handleFileSave(document: vscode.TextDocument): Promise<void> {
    try {
        // Get workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            console.log('File is not in a workspace folder, skipping indexing');
            return;
        }

        // Implement file type filtering for TypeScript files (.ts, .tsx)
        const fileExtension = path.extname(document.fileName);
        if (fileExtension !== '.ts' && fileExtension !== '.tsx') {
            // Skip non-TypeScript files
            return;
        }

        // Extract file content and workspace-relative path from save events
        const fileContent = document.getText();
        const workspaceRelativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);

        console.log(`Processing TypeScript file: ${workspaceRelativePath}`);

        // Parse code and extract symbols with error handling
        let symbols: CodeSymbol[] = [];
        try {
            symbols = CodeParserService.parse(workspaceRelativePath, fileContent);
            console.log(`Extracted ${symbols.length} symbols from ${workspaceRelativePath}`);
        } catch (parseError) {
            console.error(`Failed to parse ${workspaceRelativePath}:`, parseError);
            // Continue with empty symbols array for graceful degradation
        }

        // Update manifest with extracted symbols (handles file system errors internally)
        try {
            await updateManifest(workspaceFolder, workspaceRelativePath, symbols);

            // Log extracted symbols for debugging (only in development)
            if (process.env.NODE_ENV !== 'test') {
                symbols.forEach(symbol => {
                    console.log(`Symbol: ${symbol.name} (${symbol.kind}) at line ${symbol.position.start.line + 1}`);
                });
            }
        } catch (manifestError) {
            console.error('Failed to update manifest:', manifestError);
            // Don't re-throw to prevent extension crashes
        }

    } catch (error) {
        console.error('Error processing file save event:', error);
        // Graceful degradation - don't crash the extension
    }
}