import * as vscode from 'vscode';

/**
 * Configuration interface for document filtering
 */
export interface DocumentFilterOptions {
    allowedExtensions: string[];
    excludedPaths: string[];
}

/**
 * Default configuration for file save processing
 */
export const DEFAULT_CONFIG: DocumentFilterOptions = {
    allowedExtensions: ['.ts', '.js', '.tsx', '.jsx'],
    excludedPaths: ['node_modules', '.constellation']
};

/**
 * Checks if a document's file type is in the allowed extensions list
 * @param document - The VS Code text document to check
 * @param allowedExtensions - Array of allowed file extensions (e.g., ['.ts', '.js'])
 * @returns true if the file extension is allowed, false otherwise
 */
export function isAllowedFileType(document: vscode.TextDocument, allowedExtensions: string[]): boolean {
    if (!document || !document.fileName) {
        return false;
    }

    const fileName = document.fileName.toLowerCase();

    return allowedExtensions.some(ext => fileName.endsWith(ext.toLowerCase()));
}

/**
 * Checks if a document's path contains any excluded directory patterns
 * @param document - The VS Code text document to check
 * @param excludedPaths - Array of excluded path patterns (e.g., ['node_modules', '.constellation'])
 * @returns true if the path should be excluded, false otherwise
 */
export function isExcludedPath(document: vscode.TextDocument, excludedPaths: string[]): boolean {
    if (!document || !document.fileName) {
        return true; // Exclude if we can't determine the path
    }

    const filePath = document.fileName;

    return excludedPaths.some(excludedPath => {
        // Check if the path contains the excluded directory anywhere in the path
        return filePath.includes(`/${excludedPath}/`) ||
            filePath.includes(`\\${excludedPath}\\`) ||
            filePath.endsWith(`/${excludedPath}`) ||
            filePath.endsWith(`\\${excludedPath}`);
    });
}

/**
 * Main filtering function that determines if a document should be processed
 * Combines file type and path filtering logic
 * @param document - The VS Code text document to check
 * @param options - Configuration options for filtering
 * @returns true if the document should be processed, false otherwise
 */
export function shouldProcessDocument(document: vscode.TextDocument, options: DocumentFilterOptions): boolean {
    if (!document) {
        return false;
    }

    // Check if file type is allowed
    if (!isAllowedFileType(document, options.allowedExtensions)) {
        return false;
    }

    // Check if path should be excluded
    if (isExcludedPath(document, options.excludedPaths)) {
        return false;
    }

    return true;
}