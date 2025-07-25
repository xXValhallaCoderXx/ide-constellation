import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Service for handling file system operations with consistent error handling
 */
export class FileSystemService {
  /**
   * Reads file content with graceful error handling
   * @param uri - VS Code URI of the file to read
   * @returns Promise resolving to file content as string
   * @throws Error with descriptive message if file cannot be read
   */
  static async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const fileData = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(fileData).toString('utf8');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to read file ${uri.fsPath}: ${errorMessage}`);
    }
  }

  /**
   * Writes content to file with directory creation and error handling
   * @param uri - VS Code URI of the file to write
   * @param content - Content to write to the file
   * @throws Error with descriptive message if file cannot be written
   */
  static async writeFile(uri: vscode.Uri, content: string): Promise<void> {
    try {
      // Ensure the directory exists before writing
      await this.ensureDirectoryExists(uri);
      
      const contentBuffer = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to write file ${uri.fsPath}: ${errorMessage}`);
    }
  }

  /**
   * Ensures that the directory for the given file URI exists
   * @param fileUri - VS Code URI of the file whose directory should exist
   * @throws Error with descriptive message if directory cannot be created
   */
  static async ensureDirectoryExists(fileUri: vscode.Uri): Promise<void> {
    try {
      const directoryPath = path.dirname(fileUri.fsPath);
      const directoryUri = vscode.Uri.file(directoryPath);
      
      // Check if directory already exists
      try {
        await vscode.workspace.fs.stat(directoryUri);
        // Directory exists, no need to create
        return;
      } catch {
        // Directory doesn't exist, create it
        await vscode.workspace.fs.createDirectory(directoryUri);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const directoryPath = path.dirname(fileUri.fsPath);
      throw new Error(`Failed to ensure directory exists ${directoryPath}: ${errorMessage}`);
    }
  }
}