import * as vscode from 'vscode';
import * as path from 'path';
import { CodeParserService } from './services/CodeParserService';
import { FileSystemService } from './services/FileSystemService';
import { Manifest, CodeSymbol } from './types';

// Performance optimization constants
const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1MB limit to prevent memory issues
const EXCLUDED_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '.next',
    'coverage',
    '.nyc_output',
    'lib',
    'es',
    'umd',
    '.cache'
];

// Cache for file modification times to optimize manifest updates
const fileModificationCache = new Map<string, number>();

/**
 * Clears the file modification cache (useful for testing and memory management)
 */
export function clearFileModificationCache(): void {
    fileModificationCache.clear();
}

/**
 * Checks if a file path should be excluded from indexing based on exclusion patterns
 * @param filePath - The file path to check
 * @returns True if the file should be excluded, false otherwise
 */
function shouldExcludeFile(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/'); // Normalize path separators

    return EXCLUDED_PATTERNS.some(pattern => {
        // Check if the path contains the excluded pattern
        return normalizedPath.includes(`/${pattern}/`) ||
            normalizedPath.startsWith(`${pattern}/`) ||
            normalizedPath.includes(`\\${pattern}\\`) ||
            normalizedPath.startsWith(`${pattern}\\`);
    });
}

/**
 * Checks if a file has been modified since last processing
 * @param document - The text document to check
 * @returns True if the file has been modified, false otherwise
 */
function hasFileChanged(document: vscode.TextDocument): boolean {
    const filePath = document.uri.fsPath;
    const lastModified = document.version; // Use document version as modification indicator

    const cachedVersion = fileModificationCache.get(filePath);
    if (cachedVersion === lastModified) {
        return false; // File hasn't changed since last processing
    }

    // Update cache with new version
    fileModificationCache.set(filePath, lastModified);
    return true;
}

/**
 * Checks if a file size is within acceptable limits for processing
 * @param document - The text document to check
 * @returns True if the file size is acceptable, false otherwise
 */
function isFileSizeAcceptable(document: vscode.TextDocument): boolean {
    const fileSize = Buffer.byteLength(document.getText(), 'utf8');
    return fileSize <= MAX_FILE_SIZE_BYTES;
}

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
    const startTime = Date.now(); // Track processing time for performance monitoring

    try {
        // Get workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
            console.log('File is not in a workspace folder, skipping indexing');
            return;
        }

        // Extract workspace-relative path early for filtering
        const workspaceRelativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);

        // Performance optimization: Check exclusion patterns first
        if (shouldExcludeFile(workspaceRelativePath)) {
            console.log(`Skipping excluded file: ${workspaceRelativePath}`);
            return;
        }

        // Implement file type filtering for TypeScript files (.ts, .tsx)
        const fileExtension = path.extname(document.fileName);
        if (fileExtension !== '.ts' && fileExtension !== '.tsx') {
            // Skip non-TypeScript files
            return;
        }

        // Performance optimization: Check file size limits
        if (!isFileSizeAcceptable(document)) {
            console.log(`Skipping large file (>${MAX_FILE_SIZE_BYTES} bytes): ${workspaceRelativePath}`);
            return;
        }

        // Performance optimization: Only process changed files
        if (!hasFileChanged(document)) {
            console.log(`Skipping unchanged file: ${workspaceRelativePath}`);
            return;
        }

        // Extract file content after all filters pass
        const fileContent = document.getText();

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

        // Performance monitoring: Log processing time
        const processingTime = Date.now() - startTime;
        if (processingTime > 100) { // Log if processing takes more than 100ms
            console.warn(`File processing took ${processingTime}ms for ${workspaceRelativePath}`);
        }

    } catch (error) {
        console.error('Error processing file save event:', error);
        // Graceful degradation - don't crash the extension
    }
}