import * as vscode from 'vscode';
import { Manifest, CodeSymbol } from '../types';

/**
 * Service responsible for managing the manifest.json file that stores
 * structural indexing data for the workspace
 */
export class ManifestService {
    private readonly manifestPath: string;

    constructor() {
        // Define manifest file path as /.constellation/manifest.json
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace folder found');
        }
        this.manifestPath = workspaceRoot + '/.constellation/manifest.json';
    }

    /**
     * Reads the current manifest from disk
     * @returns Current manifest object or empty manifest if file doesn't exist
     */
    public async readManifest(): Promise<Manifest> {
        try {
            // Use VS Code's file system API to read the manifest
            const manifestUri = vscode.Uri.file(this.manifestPath);
            const fileContent = await vscode.workspace.fs.readFile(manifestUri);
            
            // Convert Uint8Array to string
            const jsonString = Buffer.from(fileContent).toString('utf8').trim();

            // Check if the file is empty or contains only whitespace
            if (!jsonString) {
                console.log('Manifest file is empty, returning empty manifest');
                return this.createEmptyManifest();
            }
            
            // Parse JSON content
            const manifest: Manifest = JSON.parse(jsonString);
            
            // Validate the structure - ensure required properties exist
            if (typeof manifest !== 'object' || manifest === null) {
                console.warn('Invalid manifest structure, returning empty manifest');
                return this.createEmptyManifest();
            }
            
            // Ensure required properties exist with defaults
            return {
                lastUpdated: manifest.lastUpdated || new Date().toISOString(),
                version: manifest.version || '1.0.0',
                files: manifest.files || {}
            };
            
        } catch (error) {
            // Handle file not found or parsing errors
            if ((error as vscode.FileSystemError).code === 'FileNotFound') {
                // File doesn't exist, return empty manifest
                console.log('Manifest file not found, returning empty manifest');
                return this.createEmptyManifest();
            } else if (error instanceof SyntaxError) {
                // JSON parsing error - this can happen if the file is corrupted or partially written
                console.log('Manifest file contains invalid JSON, creating new manifest');
                return this.createEmptyManifest();
            } else {
                // Other file system errors
                console.error('Failed to read manifest file:', error);
                throw error;
            }
        }
    }

    /**
     * Updates the manifest with symbols for a specific file
     * @param filePath - File path to update
     * @param symbols - Array of code symbols for the file
     */
    public async updateFileSymbols(filePath: string, symbols: CodeSymbol[]): Promise<void> {
        try {
            // Read the current manifest (or get empty one if it doesn't exist)
            const manifest = await this.readManifest();
            
            // Normalize the file path to be relative to workspace root
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder found');
            }
            
            // Convert absolute path to relative path if needed
            let relativePath = filePath;
            if (filePath.startsWith(workspaceRoot)) {
                relativePath = filePath.substring(workspaceRoot.length + 1);
            }

            // Normalize file paths within the symbols themselves to be consistent
            const normalizedSymbols = symbols.map(symbol => ({
                ...symbol,
                location: {
                    ...symbol.location,
                    filePath: relativePath
                }
            }));

            // Preserve existing data for other files while updating only current file's data
            manifest.files[relativePath] = normalizedSymbols;            // Update lastUpdated timestamp when making changes
            manifest.lastUpdated = new Date().toISOString();
            
            // Write the updated manifest back to disk
            await this.writeManifest(manifest);
            
            console.log(`Updated symbols for file: ${relativePath} (${symbols.length} symbols)`);
            
        } catch (error) {
            console.error(`Failed to update file symbols for ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Writes the manifest object to disk
     * @param manifest - Manifest object to write
     */
    private async writeManifest(manifest: Manifest): Promise<void> {
        try {
            // Ensure the .constellation directory exists before writing
            await this.ensureDirectoryExists();
            
            // Serialize Manifest object to formatted JSON with proper indentation for readability
            const jsonContent = JSON.stringify(manifest, null, 2);
            
            // Write the formatted JSON to the manifest file using VS Code's file system API
            const manifestUri = vscode.Uri.file(this.manifestPath);
            const jsonBuffer = Buffer.from(jsonContent, 'utf8');
            await vscode.workspace.fs.writeFile(manifestUri, jsonBuffer);
            
            console.log(`Manifest updated successfully at ${this.manifestPath}`);
            
        } catch (error) {
            // Handle file system errors gracefully with appropriate logging
            console.error('Failed to write manifest file:', error);
            throw error;
        }
    }

    /**
     * Ensures the .constellation directory exists
     */
    private async ensureDirectoryExists(): Promise<void> {
        try {
            // Extract directory path manually (remove filename)
            const manifestDir = this.manifestPath.substring(0, this.manifestPath.lastIndexOf('/'));
            const manifestDirUri = vscode.Uri.file(manifestDir);
            
            // Create directory using VS Code's file system API
            await vscode.workspace.fs.createDirectory(manifestDirUri);
        } catch (error) {
            // VS Code's createDirectory doesn't fail if directory already exists
            // Only log if it's an actual error
            if ((error as vscode.FileSystemError).code !== 'FileExists') {
                console.error('Failed to create .constellation directory:', error);
                throw error;
            }
        }
    }

    /**
     * Creates an empty manifest object with default values
     */
    private createEmptyManifest(): Manifest {
        return {
            lastUpdated: new Date().toISOString(),
            version: '1.0.0',
            files: {}
        };
    }
}