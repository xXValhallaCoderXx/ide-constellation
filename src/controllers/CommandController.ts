import * as vscode from 'vscode';

/**
 * Controller responsible for managing all VSCode command registrations
 */
export class CommandController {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Registers all VSCode commands for the extension
     */
    public registerCommands(): void {
        // Register hello world command
        const disposable = vscode.commands.registerCommand('kiro-constellation.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World from kiro-constellation!');
        });
        this.context.subscriptions.push(disposable);
    }
}
