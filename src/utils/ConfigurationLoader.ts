import * as vscode from 'vscode';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Utility class for loading environment variables with multi-path fallback
 */
export class ConfigurationLoader {
    /**
     * Load environment variables from .env file with multi-path fallback
     * @param context - VSCode extension context for extension path access
     * @returns Promise<void>
     */
    public static loadEnvironment(context: vscode.ExtensionContext): void {
        try {
            // Try multiple paths to find the .env file

            // Possible .env file locations
            const envPaths = [
                '.env',  // Current working directory
                path.join(__dirname, '..', '.env'),  // Parent of out directory
                path.join(__dirname, '..', '..', '.env'),  // Workspace root
                path.join(context.extensionPath, '.env')  // Extension path
            ];

            let envLoaded = false;
            for (const envPath of envPaths) {
                try {
                    if (fs.existsSync(envPath)) {
                        dotenv.config({ path: envPath });
                        console.log(`Environment variables loaded successfully from: ${envPath}`);
                        envLoaded = true;
                        break;
                    }
                } catch (pathError) {
                    console.log(`Failed to load from ${envPath}:`, pathError);
                }
            }

            if (!envLoaded) {
                console.warn('No .env file found in any of the expected locations');
                console.log('Searched paths:', envPaths);
            }

            // Log environment status for debugging
            console.log(`OPENROUTER_API_KEY present: ${!!process.env.OPENROUTER_API_KEY}`);
            if (process.env.OPENROUTER_API_KEY) {
                console.log(`OPENROUTER_API_KEY length: ${process.env.OPENROUTER_API_KEY.length}`);
            }

        } catch (error) {
            console.error('Failed to load environment variables:', error);
            vscode.window.showWarningMessage('Failed to load environment configuration. Some features may not work properly.');
        }
    }
}
