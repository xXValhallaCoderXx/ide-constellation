import * as vscode from 'vscode';

function readSelectedText() {
    // Get the active text editor
    const activeEditor = vscode.window.activeTextEditor;

    // Handle case when no active editor exists
    if (!activeEditor) {
        vscode.window.showInformationMessage('No active editor found');
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

export function activate(context: vscode.ExtensionContext) {
    console.log('Hello Kiro Extension is now active!');

    const disposable = vscode.commands.registerCommand('helloKiro.showWelcomeMessage', () => {
        vscode.window.showInformationMessage('ssss from your custom extension! Kiro compatibility confirmed.');
    });

    const readSelectedTextDisposable = vscode.commands.registerCommand('helloKiro.readSelectedText', readSelectedText);
    const writeTimestampDisposable = vscode.commands.registerCommand('helloKiro.writeTimestamp', writeTimestamp);
    const readKiroSpecDisposable = vscode.commands.registerCommand('helloKiro.readKiroSpec', readKiroSpec);

    context.subscriptions.push(disposable);
    context.subscriptions.push(readSelectedTextDisposable);
    context.subscriptions.push(writeTimestampDisposable);
    context.subscriptions.push(readKiroSpecDisposable);
}

export function deactivate() { }