import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MCPStdioServer } from './mcp-stdio.server';
import { ParsedToolEnvelope, DualToolResponse } from '../types/visual-instruction.types';
import { BridgeService } from '../services/bridge/bridge.service';
import { BridgeEnvelope } from '../types/bridge.types';

/**
 * VS Code MCP Provider for registering the Kiro Constellation MCP Server
 * This implements the standard VS Code MCP provider pattern for the POC
 */
export class KiroConstellationMCPProvider {
    private extensionContext: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private serverInstance: MCPStdioServer | null = null;
    // Future: routing related helpers will be added in subsequent tasks
    private static readonly MAX_LOG_DATAFORAI_CHARS = 5000; // truncation limit
    private static readonly VISUAL_INSTRUCTION_SIZE_LIMIT = 1_048_576; // 1MB
    private webviewManager: any | null = null; // lazily set by extension
    private viDebounceTimer: NodeJS.Timeout | null = null;
    private pendingInstruction: import('../types/visual-instruction.types').VisualInstruction | null = null;

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel, bridgeEnv?: { socketPath: string; authToken: string }) {
        this.extensionContext = context;
        this.outputChannel = outputChannel;
        // Create a server instance for direct method calls with extension context
        this.serverInstance = new MCPStdioServer(context);
        // Set this provider instance for visual instruction routing
        if (this.serverInstance) {
            this.serverInstance.setProviderInstance(this);
        }
        // Persist bridge env for server definitions
        if (bridgeEnv) {
            (this as any)._bridgeEnv = bridgeEnv;
        }
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

            const bridgeEnv = (this as any)._bridgeEnv as { socketPath: string; authToken: string } | undefined;
            const serverDefinition: any = {
                id: 'constellation-poc',
                transport: 'stdio',
                command: process.execPath,
                args: [serverScriptPath],
                label: finalLabel,
                cwd: this.extensionContext.extensionPath,
                env: bridgeEnv ? { BRIDGE_SOCKET_PATH: bridgeEnv.socketPath, BRIDGE_AUTH_TOKEN: bridgeEnv.authToken } : {}
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
     * [VI] logging helper for visualInstruction pattern tasks.
     * level: INFO | WARN | DEBUG
     */
    private logVI(level: 'INFO'|'WARN'|'DEBUG', msg: string, meta?: any) {
        const base = `[VI][${level}] ${msg}`;
        if (meta) {
            try {
                let metaString = JSON.stringify(meta);
                if (metaString.length > 2000) { // safeguard for meta verbosity
                    metaString = metaString.slice(0, 2000) + '...<truncated-meta>';
                }
                this.outputChannel.appendLine(base + ' meta=' + metaString);
            } catch {
                this.outputChannel.appendLine(base + ' meta=[unserializable]');
            }
        } else {
            this.outputChannel.appendLine(base);
        }
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
            await this.serverInstance.scanProject(targetPath, this.extensionContext);
            this.log('[SCAN] Project scan completed successfully');
        } catch (error) {
            this.log(`[SCAN] Project scan failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    // --- visualInstruction pattern: parsing utility (Tasks 2.1 - 2.4) ---
    /**
     * Parse a potential dual payload tool response.
     * Never throws. Falls back to plain classification on any issue.
     */
    public parseDualResponse(text: string): ParsedToolEnvelope<any> { // public for reuse in later routing tasks
        const rawText = text ?? '';
        // Guard: empty / whitespace only -> plain
        if (!rawText || !rawText.trim()) {
            this.logVI('WARN', 'Parse fallback (plain) reason=empty');
            return { kind: 'plain', rawText };
        }
        try {
            const parsed = JSON.parse(rawText);
            // Basic structural validation
            if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'dataForAI')) {
                const dual: DualToolResponse<any> = parsed;
                // Prepare truncated preview for dataForAI logging without leaking huge content
                let preview: string | undefined;
                try {
                    const serialized = JSON.stringify(dual.dataForAI);
                    if (serialized.length > KiroConstellationMCPProvider.MAX_LOG_DATAFORAI_CHARS) {
                        preview = serialized.slice(0, KiroConstellationMCPProvider.MAX_LOG_DATAFORAI_CHARS) + '...<truncated>';
                    } else {
                        preview = serialized;
                    }
                } catch {
                    preview = '[unserializable dataForAI]';
                }
                this.logVI('INFO', `Parse success (dual) hasVisualInstruction=${!!dual.visualInstruction}`, { dataForAIPreview: preview });
                return { kind: 'dual', rawText, dual };
            }
            this.logVI('WARN', 'Parse fallback (plain) reason=missing dataForAI');
            return { kind: 'plain', rawText };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logVI('WARN', 'Parse fallback (plain) reason=json-error', { error: msg });
            return { kind: 'plain', rawText, parseError: msg };
        }
    }

    // --- visualInstruction pattern: routing entrypoint (Tasks 5.x) ---
    /**
     * Handle raw tool result text (JSON or plain) and route visualInstruction if present.
     * Future tasks will expand with debounce & size guards.
     */
    public handleToolResult(rawText: string) {
        const envelope = this.parseDualResponse(rawText);
        if (envelope.kind === 'dual' && envelope.dual?.visualInstruction) {
            // Placeholder dispatch call; actual implementation (debounce, size guard, panel ensure) in later tasks 6-7
            this.logVI('INFO', `Handle tool result detected visualInstruction action=${envelope.dual.visualInstruction.action}`);
            this.dispatchVisualInstruction(envelope.dual.visualInstruction);
        } else {
            this.logVI('DEBUG', 'Handle tool result no visualInstruction present');
        }
        // Bridge envelope parsing
        const bridge = BridgeService.getInstance();
        const maybeBridge = bridge.tryParseEnvelope(rawText) as BridgeEnvelope | null;
        if (maybeBridge?.bridgeMessage) {
            this.logVI('INFO', `Bridge message detected type=${maybeBridge.bridgeMessage.type}`);
            bridge.send({ ...maybeBridge.bridgeMessage }).catch(err => this.logVI('WARN', 'Bridge send error', { error: String(err) }));
        }
    }

    /** Inject webviewManager instance (called from extension activation) */
    public setWebviewManager(manager: any) {
        this.webviewManager = manager;
    }

    /** Size guard check */
    private isInstructionTooLarge(instr: import('../types/visual-instruction.types').VisualInstruction): boolean {
        try {
            const size = Buffer.byteLength(JSON.stringify(instr), 'utf8');
            if (size > KiroConstellationMCPProvider.VISUAL_INSTRUCTION_SIZE_LIMIT) {
                this.logVI('WARN', 'Payload too large – skipped', { size });
                return true;
            }
        } catch (e) {
            this.logVI('WARN', 'Failed to measure instruction size, allowing dispatch', { error: String(e) });
        }
        return false;
    }

    /** Debounced dispatch implementing FR6/FR7/FR8/FR9/FR10/FR12/FR13 logic */
    private dispatchVisualInstruction(instr: import('../types/visual-instruction.types').VisualInstruction) {
        try {
            if (!instr || !instr.action) {
                this.logVI('WARN', 'Dispatch skipped invalid instruction (missing action)');
                return;
            }
            if (this.isInstructionTooLarge(instr)) {
                return; // size guard
            }

            // Replace pending and debounce
            this.pendingInstruction = instr;
            if (this.viDebounceTimer) {
                clearTimeout(this.viDebounceTimer);
            }
            this.viDebounceTimer = setTimeout(() => {
                const toSend = this.pendingInstruction;
                this.pendingInstruction = null;
                this.viDebounceTimer = null;
                if (!toSend) { return; }
                // Ensure webview panel
                if (!this.webviewManager) {
                    this.logVI('WARN', 'No webviewManager available; skipping dispatch');
                    return;
                }
                try {
                    // createOrShowPanel will reveal existing panel (fulfills focus requirement)
                    if (this.extensionContext) {
                        this.webviewManager.createOrShowPanel(this.extensionContext);
                    }
                    const panel = (this.webviewManager as any).currentPanel as vscode.WebviewPanel | undefined;
                    if (!panel) {
                        this.logVI('WARN', 'Panel not available after ensure; skipping dispatch');
                        return;
                    }
                    const message = { command: 'visualInstruction', data: { ...toSend } };
                    panel.webview.postMessage(message);
                    const corr = toSend.correlationId ? `[${toSend.correlationId}] ` : '';
                    this.logVI('INFO', `${corr}Routed action=${toSend.action}`, { ts: toSend.ts });
                } catch (err) {
                    this.logVI('WARN', 'Dispatch error during send', { error: err instanceof Error ? err.message : String(err) });
                }
            }, 50); // 50ms debounce
        } catch (err) {
            this.logVI('WARN', 'Dispatch error outer', { error: err instanceof Error ? err.message : String(err) });
        }
    }

    /**
     * Trigger opening (or focusing) of the main dependency graph panel.
     * Used by impact analysis MVP to create instant visual feedback.
     */
    public triggerGraphPanelOpen() {
        try {
            if (!this.webviewManager) {
                this.logVI('WARN', 'triggerGraphPanelOpen skipped – webviewManager unavailable');
                return;
            }
            if (!this.extensionContext) {
                this.logVI('WARN', 'triggerGraphPanelOpen skipped – missing extension context');
                return;
            }
            this.logVI('INFO', 'Triggering graph panel open');
            this.webviewManager.createOrShowPanel(this.extensionContext);
        } catch (err) {
            this.logVI('WARN', 'triggerGraphPanelOpen error', { error: err instanceof Error ? err.message : String(err) });
        }
    }

    /**
     * Dispatch graph:setFocus message to webview (Impact Analysis auto-focus)
     */
    public sendGraphSetFocus(targetNodeId: string, correlationId: string) {
        try {
            if (!this.webviewManager || !this.extensionContext) {
                this.logVI('WARN', 'sendGraphSetFocus skipped – webviewManager or context unavailable', { targetNodeId, correlationId });
                return;
            }
            // Ensure panel is open (idempotent)
            this.webviewManager.createOrShowPanel(this.extensionContext);
            const panel = (this.webviewManager as any).currentPanel as vscode.WebviewPanel | undefined;
            if (!panel) {
                this.logVI('WARN', 'sendGraphSetFocus skipped – panel missing', { targetNodeId, correlationId });
                return;
            }
            const msg = { command: 'graph:setFocus', data: { targetNodeId, correlationId } };
            panel.webview.postMessage(msg);
            this.logVI('INFO', 'Dispatched graph:setFocus', { targetNodeId, correlationId });
        } catch (err) {
            this.logVI('WARN', 'sendGraphSetFocus error', { error: err instanceof Error ? err.message : String(err), targetNodeId, correlationId });
        }
    }
}