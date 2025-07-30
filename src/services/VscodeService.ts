import * as vscode from 'vscode';

/**
 * Service wrapper for VSCode user-facing notification APIs
 * Provides a centralized interface for showing messages to users
 * and improves testability by abstracting direct VSCode API calls
 */
export class VscodeService {
    /**
     * Creates a new VscodeService instance
     * This service is stateless and requires no configuration
     */
    constructor() { }

    /**
     * Shows an information message to the user
     * @param message - The message to display
     * @param options - Optional message options and items
     * @returns Promise that resolves to the selected item or undefined
     */
    public async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showInformationMessage(message, ...items);
    }

    /**
     * Shows an error message to the user
     * @param message - The error message to display
     * @param options - Optional message options and items
     * @returns Promise that resolves to the selected item or undefined
     */
    public async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showErrorMessage(message, ...items);
    }

    /**
     * Shows a warning message to the user
     * @param message - The warning message to display
     * @param options - Optional message options and items
     * @returns Promise that resolves to the selected item or undefined
     */
    public async showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showWarningMessage(message, ...items);
    }

    /**
     * Shows an input box to ask the user for input
     * @param options - Input box options
     * @returns Promise that resolves to the entered value or undefined if cancelled
     */
    public async showInputBox(options?: vscode.InputBoxOptions): Promise<string | undefined> {
        return vscode.window.showInputBox(options);
    }
}
