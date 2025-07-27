import * as vscode from 'vscode';

/**
 * Configuration interface for file save event processing
 */
export interface FileSaveConfig {
    /** List of allowed file extensions (including the dot) */
    allowedExtensions: string[];
    /** List of directory paths to exclude from processing */
    excludedPaths: string[];
}

/**
 * Default configuration for file save event processing
 */
export const DEFAULT_CONFIG: FileSaveConfig = {
    allowedExtensions: ['.ts', '.js', '.tsx', '.jsx'],
    excludedPaths: ['node_modules', '.constellation']
};

/**
 * Interface for structured document information
 */
export interface DocumentContext {
    /** The VS Code text document */
    document: vscode.TextDocument;
    /** Full file path */
    filePath: string;
    /** File name with extension */
    fileName: string;
    /** File extension (including the dot) */
    fileExtension: string;
    /** Whether this document should be processed */
    shouldProcess: boolean;
}