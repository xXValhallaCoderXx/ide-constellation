import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPStdioServer } from './mcpStdioServer';

/**
 * VS Code MCP Provider for registering the Kiro Constellation MCP Server
 * This implements the standard VS Code MCP provider pattern for the POC
 */
export class KiroConstellationMCPProvider {
    private extensionContext: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private serverInstance: MCPStdioServer | null = null;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.extensionContext = context;
        this.outputChannel = outputChannel;
        // Create a server instance for direct method calls
        this.serverInstance = new MCPStdioServer();
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
                // Fallback: Offer to create a Kiro MCP config using stdio server
                await this.offerCreateWorkspaceMcpConfig();
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
     * Offer to create or update a Kiro MCP config pointing to the bundled stdio server.
     * Workspace level: .kiro/settings/mcp.json
     * User level: ~/.kiro/settings/mcp.json
     */
    private async offerCreateWorkspaceMcpConfig(): Promise<void> {
        try {
            const folders = vscode.workspace.workspaceFolders;

            // Resolve workspace target path
            if (!folders || folders.length === 0) {
                this.log('[FALLBACK] No workspace folder is open; cannot create workspace-level Kiro MCP config');
                return;
            }
            let targetFolder = folders[0];
            if (folders.length > 1) {
                const picked = await vscode.window.showQuickPick(
                    folders.map(f => ({ label: f.name, description: f.uri.fsPath, folder: f })),
                    { placeHolder: 'Select a workspace folder for .kiro/settings/mcp.json' }
                );
                if (!picked) {
                    this.log('[FALLBACK] Creation cancelled (no folder selected)');
                    return;
                }
                targetFolder = picked.folder;
            }
            const wsPath = targetFolder.uri.fsPath;
            const kiroDir = path.join(wsPath, '.kiro', 'settings');
            if (!fs.existsSync(kiroDir)) {
                fs.mkdirSync(kiroDir, { recursive: true });
            }
            const mcpJsonPath = path.join(kiroDir, 'mcp.json');
            const targetName = targetFolder.name;

            // Ensure bundled server exists
            const serverScriptPath = this.getServerScriptPath();
            if (!fs.existsSync(serverScriptPath)) {
                this.log(`[FALLBACK] MCP server script missing at ${serverScriptPath}. Run: npm run compile:mcp`);
                vscode.window.showWarningMessage('Constellation MCP server bundle not found. Run the build first (npm run compile:mcp).');
                return;
            }

            // Read existing mcp.json (if present) and merge
            let current: any = {};
            try {
                if (fs.existsSync(mcpJsonPath)) {
                    const raw = fs.readFileSync(mcpJsonPath, 'utf8');
                    current = JSON.parse(raw || '{}');
                }
            } catch (e) {
                this.log(`[FALLBACK] Failed to parse existing mcp.json, will overwrite: ${e instanceof Error ? e.message : String(e)}`);
                current = {};
            }

            if (!current || typeof current !== 'object') {
                current = {};
            }
            if (!current.mcpServers || typeof current.mcpServers !== 'object') {
                current.mcpServers = {};
            }

            // Define/update the constellation stdio server entry
            const serverId = 'constellation-stdio';
            const existing = current.mcpServers[serverId] || {};
            const suggestedAutoApprove = ['constellation_ping', 'constellation_example_tool'];
            const mergedAutoApprove = Array.from(new Set([...(existing.autoApprove || []), ...suggestedAutoApprove]));
            current.mcpServers[serverId] = {
                type: 'stdio',
                // Use system Node from PATH to run the bundled server
                command: 'node',
                args: [serverScriptPath],
                env: existing.env || {},
                disabled: typeof existing.disabled === 'boolean' ? existing.disabled : false,
                autoApprove: mergedAutoApprove
            };

            fs.writeFileSync(mcpJsonPath, JSON.stringify(current, null, 2) + '\n', 'utf8');

            this.log(`[FALLBACK] Wrote MCP config to ${mcpJsonPath}`);
            vscode.window.showInformationMessage(`Created/updated MCP config at '${targetName}'.`);
        } catch (err) {
            this.log(`[FALLBACK] Failed to create Kiro MCP config: ${err instanceof Error ? err.message : String(err)}`);
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

    this.log(`[POC] Bundled MCP server script path: ${serverScriptPath}`);

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

    /**
     * Get the server instance for direct method calls
     */
    public getServerInstance(): MCPStdioServer | null {
        return this.serverInstance;
    }

    /**
     * Scan project using the server instance
     */
    public async scanProject(targetPath: string = '.'): Promise<void> {
        if (!this.serverInstance) {
            throw new Error('MCP server instance not available');
        }
        
        this.log(`[SCAN] Starting project scan for path: ${targetPath}`);
        try {
            await this.serverInstance.scanProject(targetPath);
            this.log('[SCAN] Project scan completed successfully');
        } catch (error) {
            this.log(`[SCAN] Project scan failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}