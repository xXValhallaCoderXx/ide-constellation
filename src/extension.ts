import * as vscode from 'vscode';
import * as path from 'path';
import { CodeParserService } from './services/CodeParserService';
import { FileSystemService } from './services/FileSystemService';
import { Manifest, CodeSymbol } from './types';

function readSelectedText() {
    // Get the active text editor
    const activeEditor = vscode.window.activeTextEditor;

    // Handle case when no active editor exists
    if (!activeEditor) {
        vscode.window.showInformationMessage('No active ssseditsssor found');
        return;
    }

    // Get the selected text using editor.selection and editor.document.getText()
    const selection = activeEditor.selection;
    const selectedText = activeEditor.document.getText(selection);

    // Handle case when no text is selected
    if (!selectedText || selectedText.trim() === '') {
        vscode.window.showInformationMessage('No text selected');
        return;
    }

    // Display selected text in information popup
    vscode.window.showInformationMessage(`Selected text: ${selectedText}`);
}

function writeTimestamp() {
    // Get the active text editor
    const activeEditor = vscode.window.activeTextEditor;

    // Handle case when no active editor exists
    if (!activeEditor) {
        vscode.window.showInformationMessage('No active editor found');
        return;
    }

    // Generate current timestamp in ISO 8601 format
    const timestamp = new Date().toISOString();

    // Get current cursor position from active editor
    const cursorPosition = activeEditor.selection.active;

    // Use editor.edit() to insert timestamp at cursor position
    activeEditor.edit(editBuilder => {
        editBuilder.insert(cursorPosition, timestamp);
    });
}

async function readKiroSpec() {
    try {
        // Construct file path to /.kiro/spec.md in workspace root
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            console.log('No workspace folder found');
            return;
        }

        const specFilePath = vscode.Uri.joinPath(workspaceFolder.uri, '.kiro', 'spec.md');

        // Use vscode.workspace.fs.readFile() to read file contents
        const fileBuffer = await vscode.workspace.fs.readFile(specFilePath);
        
        // Convert file buffer to string for logging
        const fileContent = Buffer.from(fileBuffer).toString('utf8');
        
        // Log full file content to Extension Debug Console using console.log()
        console.log('Kiro spec.md content:');
        console.log(fileContent);
        
    } catch (error) {
        // Handle file not found case and other file read errors gracefully
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            console.log('File not found');
        } else {
            console.log('Error reading Kiro spec file:', error);
        }
    }
}

/**
 * Constructs the URI for the manifest.json file in the workspace .constellation directory
 * @param workspaceFolder - The workspace folder
 * @returns URI for the manifest.json file
 */
function getManifestUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
    return vscode.Uri.joinPath(workspaceFolder.uri, '.constellation', 'manifest.json');
}

/**
 * Reads the existing manifest from disk with empty object fallback for new workspaces
 * @param workspaceFolder - The workspace folder
 * @returns Promise resolving to the manifest object
 */
async function readManifest(workspaceFolder: vscode.WorkspaceFolder): Promise<Manifest> {
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
async function updateManifest(workspaceFolder: vscode.WorkspaceFolder, filePath: string, symbols: CodeSymbol[]): Promise<void> {
    try {
        // Read current manifest
        const manifest = await readManifest(workspaceFolder);

        // Replace file-specific symbol arrays without affecting other files' entries
        manifest[filePath] = symbols;

        // Write updated manifest atomically
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
async function handleFileSave(document: vscode.TextDocument) {
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

        // Create service instances and wire up basic event flow
        const symbols = CodeParserService.parse(workspaceRelativePath, fileContent);

        console.log(`Extracted ${symbols.length} symbols from ${workspaceRelativePath}`);

        // Update manifest with extracted symbols
        await updateManifest(workspaceFolder, workspaceRelativePath, symbols);

        // Log extracted symbols for debugging
        symbols.forEach(symbol => {
            console.log(`Symbol: ${symbol.name} (${symbol.kind}) at line ${symbol.position.start.line + 1}`);
        });

    } catch (error) {
        console.error('Error processing file save event:', error);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Hello Kiro Extension is now active!');

    // Add onDidSaveTextDocument event listener in activate function
    const fileSaveDisposable = vscode.workspace.onDidSaveTextDocument(handleFileSave);

    const disposable = vscode.commands.registerCommand('helloKiro.showWelcomeMessage', () => {
        vscode.window.showInformationMessage('Weeeesssse from your custom extension! Kiro compatibility confirmed.');
    });

    const readSelectedTextDisposable = vscode.commands.registerCommand('helloKiro.readSelectedText', readSelectedText);
    const writeTimestampDisposable = vscode.commands.registerCommand('helloKiro.writeTimestamp', writeTimestamp);
    const readKiroSpecDisposable = vscode.commands.registerCommand('helloKiro.readKiroSpec', readKiroSpec);

    context.subscriptions.push(fileSaveDisposable);
    context.subscriptions.push(disposable);
    context.subscriptions.push(readSelectedTextDisposable);
    context.subscriptions.push(writeTimestampDisposable);
    context.subscriptions.push(readKiroSpecDisposable);
}

export function deactivate() { }