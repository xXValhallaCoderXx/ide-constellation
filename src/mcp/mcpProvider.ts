import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * VS Code MCP Provider for registering the Kiro Constellation MCP Server
 * This implements the standard VS Code MCP provider pattern for the POC
 */
export class KiroConstellationMCPProvider {
    private extensionContext: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.extensionContext = context;
        this.outputChannel = outputChannel;
    }

    /**
     * Register the MCP provider with VS Code
     * This is the main entry point for the POC test
     */
    public async registerProvider(): Promise<boolean> {
        try {
            this.log('[POC] Testing VS Code MCP API availability...');

            // Test if the MCP API is available
            if (!vscode.lm || typeof vscode.lm.registerMcpServerDefinitionProvider !== 'function') {
                this.log('[FAILURE] vscode.lm.registerMcpServerDefinitionProvider is not available');
                this.log('[FAILURE] The standard MCP API is not supported in this IDE');
                return false;
            }

            this.log('[SUCCESS] VS Code MCP API is available!');
            this.log('[POC] Registering MCP server definition provider...');
            this.log('[DEBUG] Attempting to register provider with ID: "kiro-constellation"');

            // Register our provider
            // Note: Using 'any' temporarily for POC since MCP API types may not be fully available yet
            const disposable = (vscode.lm as any).registerMcpServerDefinitionProvider(
                'kiro-constellation',
                {
                    provideMcpServerDefinitions: () => this.provideMcpServerDefinitions()
                }
            );

            // Add to extension subscriptions for cleanup
            this.extensionContext.subscriptions.push(disposable);

            this.log('[SUCCESS] MCP provider registered successfully');
            this.log('[POC] Waiting for IDE to call provideMcpServerDefinitions...');

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`[FAILURE] Error registering MCP provider: ${errorMessage}`);

            // Provide helpful debugging information
            if (errorMessage.includes('package.json')) {
                this.log('[DEBUG] This suggests the package.json mcpServerDefinitionProviders needs to match the registration ID');
                this.log('[DEBUG] Current registration ID: "kiro-constellation"');
                this.log('[DEBUG] Check package.json contributes.mcpServerDefinitionProviders array');
            }

            return false;
        }
    }

    /**
     * Provide MCP server definitions to VS Code
     * This method is called by VS Code when it needs to discover MCP servers
     */
    private async provideMcpServerDefinitions(): Promise<any[]> {
        try {
            this.log('[POC] provideMcpServerDefinitions called by IDE - this is a SUCCESS indicator!');

            // Resolve the absolute path to our bundled MCP server
            const serverScriptPath = this.getServerScriptPath();
            this.log(`[POC] MCP server script path: ${serverScriptPath}`);

            const label = 'Constellation MCP';
            const finalLabel = typeof label === 'string' && label.trim().length > 0 ? label.trim() : 'Constellation MCP (default)';

            const serverDefinition: any = {
                id: 'constellation-poc',
                transport: 'stdio',
                command: process.execPath,
                args: [serverScriptPath],
                label: finalLabel,
                cwd: this.extensionContext.extensionPath,
                env: {}
            };

            // Validate the server definition before returning
            this.log(`[DEBUG] Server definition label: "${serverDefinition.label}" (type=${typeof serverDefinition.label})`);
            this.log(`[DEBUG] Server definition command: "${serverDefinition.command}"`);
            this.log(`[DEBUG] Server definition transport: "${serverDefinition.transport}"`);
            this.log(`[DEBUG] Server definition cwd: "${serverDefinition.cwd}"`);
            this.log(`[DEBUG] Server definition args: [${serverDefinition.args.join(', ')}]`);
            this.log(`[DEBUG] Full serverDefinition JSON: ${JSON.stringify(serverDefinition)}`);

            // Validate server script exists using absolute path
            const absoluteServerPath = path.resolve(this.extensionContext.extensionPath, 'out', 'mcp-server.js');
            const exists = fs.existsSync(absoluteServerPath);
            this.log(`[DEBUG] Checking if server script exists at: ${absoluteServerPath} (exists=${exists})`);
            if (!exists) {
                this.log('[ERROR] MCP server script not found. Did the MCP build complete? Run: npm run compile:mcp');
            }

            this.log('[SUCCESS] Returning MCP server definition to IDE');
            return [serverDefinition];
        } catch (error) {
            this.log(`[FAILURE] Error in provideMcpServerDefinitions: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Get the absolute path to the bundled MCP server script
     */
    private getServerScriptPath(): string {
        // Use extensionPath to resolve the bundled server script
        // This works in local development, remote containers, and Codespaces
        const serverScriptPath = path.join(this.extensionContext.extensionPath, 'out', 'mcp-server.js');

        this.log(`[POC] Resolved server script path from extensionPath: ${this.extensionContext.extensionPath}`);

        return serverScriptPath;
    }

    /**
     * Log messages to the output channel with timestamp
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        console.log(logMessage);
        this.outputChannel.appendLine(logMessage);
    }

    /**
     * Test method to validate the provider can be called
     */
    public async testProvider(): Promise<void> {
        this.log('[POC] Testing provider functionality...');
        try {
            const definitions = await this.provideMcpServerDefinitions();
            this.log(`[POC] Provider test successful, returned ${definitions.length} server definition(s)`);
        } catch (error) {
            this.log(`[POC] Provider test failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}