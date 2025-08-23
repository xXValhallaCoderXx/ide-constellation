#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL } from '../types/mcp.types';
import { Worker } from 'worker_threads';
import * as path from 'path';

// Conditional vscode import - only available in extension context
let vscode: any = null;
try {
    // This will only work when running within VS Code extension host
    vscode = require('vscode');
} catch (error) {
    // Running as standalone server - vscode module not available
    console.error('[MCP DEBUG] Running in standalone mode - vscode module not available');
}

import { ScanWorkerData, ScanWorkerMessage } from '../types/scanner.types';

/**
 * MCP Server implementation for VS Code Standard Provider POC
 * This server implements the Model Context Protocol using stdio transport
 * for communication with VS Code/Kiro IDE
 */
export class MCPStdioServer {
    private server: Server;
    private isRunning = false;

    constructor() {
        this.server = new Server(
            {
                name: 'kiro-constellation-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
                instructions: [
                    'Constellation MCP tools:',
                    '- constellation_ping: returns "pong" for connectivity checks.',
                    '- constellation_example_tool: echoes an optional "message" string.',
                    'Prefer using tools when asked to validate MCP connectivity or echo a message.'
                ].join('\n')
            }
        );

        this.setupHandlers();
        this.setupProcessHandlers();
    }

    /**
     * Set up MCP protocol handlers
     */
    private setupHandlers(): void {
        // Handle tools/list requests
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            console.error('[MCP DEBUG] Received tools/list request');
            return {
                tools: [CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL],
            };
        });

        // Handle tools/call requests
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            console.error('[MCP DEBUG] Received tools/call request', JSON.stringify(request));
            const { name, arguments: args } = request.params;

            if (name === CONSTELLATION_PING_TOOL.name) {
                console.error('[MCP DEBUG] PING tool executed');
                return {
                    content: [
                        { type: 'text' as const, text: 'pong' }
                    ]
                };
            }

            if (name !== CONSTELLATION_EXAMPLE_TOOL.name) {
                throw new Error(`Unknown tool: ${name}`);
            }

            // Execute the example tool
            const message = (args?.message as string) || 'Hello from VS Code Standard MCP Provider POC';
            console.error('[MCP DEBUG] Executing tool', name, 'with message=', message);

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: message
                    }
                ]
            };
        });
    }

    /**
     * Set up process signal handlers for graceful shutdown
     */
    private setupProcessHandlers(): void {
        // Only set up process handlers when running as standalone server
        if (require.main === module) {
            const shutdown = async () => {
                if (this.isRunning) {
                    console.error('Shutting down MCP server...');
                    await this.stop();
                    process.exit(0);
                }
            };

            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
            process.on('SIGUSR2', shutdown);

            process.on('uncaughtException', (error) => {
                console.error('Uncaught exception in MCP server:', error);
                process.exit(1);
            });

            process.on('unhandledRejection', (reason, promise) => {
                console.error('Unhandled rejection in MCP server:', reason);
                process.exit(1);
            });
        } else {
            // When used as a library, just log errors without exiting
            process.on('uncaughtException', (error) => {
                console.error('Uncaught exception in MCP server (library mode):', error);
            });

            process.on('unhandledRejection', (reason, promise) => {
                console.error('Unhandled rejection in MCP server (library mode):', reason);
            });
        }
    }

    /**
     * Start the MCP server with stdio transport
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        try {
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            this.isRunning = true;

            // Log to stderr to avoid interfering with stdout JSON communication
            console.error('MCP Server started with stdio transport');
        } catch (error) {
            console.error('Failed to start MCP server:', error);
            throw error;
        }
    }

    /**
     * Stop the MCP server
     */
    async stop(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        try {
            await this.server.close();
            this.isRunning = false;
            console.error('MCP Server stopped');
        } catch (error) {
            console.error('Error stopping MCP server:', error);
            throw error;
        }
    }

    /**
     * Check if server is running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * Execute scan in worker thread with security validation and ExtensionContext
     * Only available when running in extension context (library mode)
     */
    private async executeScanInWorker(targetPath: string = '.', extensionContext: any): Promise<any> {
        return new Promise((resolve, reject) => {
            try {
                // Check if vscode module is available
                if (!vscode) {
                    reject(new Error('Scan functionality not available in standalone mode - requires VS Code extension context'));
                    return;
                }

                // Validate ExtensionContext is provided
                if (!extensionContext) {
                    reject(new Error('Extension context required for secure worker path resolution'));
                    return;
                }

                // Get workspace root and validate it exists
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    reject(new Error('No workspace folder open - cannot perform scan'));
                    return;
                }

                // Validate and secure target path to prevent directory traversal attacks
                const resolvedTargetPath = path.resolve(workspaceRoot, targetPath);
                if (!resolvedTargetPath.startsWith(workspaceRoot)) {
                    reject(new Error('Target path must be within workspace bounds - directory traversal not allowed'));
                    return;
                }

                // Use ExtensionContext for reliable worker path resolution
                const workerUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'dist/workers/scanWorker.mjs');
                const workerPath = workerUri.fsPath;

                console.error(`[SCAN DEBUG] Using worker path: ${workerPath}`);
                console.error(`[SCAN DEBUG] Workspace root: ${workspaceRoot}`);
                console.error(`[SCAN DEBUG] Target path: ${resolvedTargetPath}`);

                const worker = new Worker(workerPath, {
                    workerData: {
                        targetPath: resolvedTargetPath,
                        workspaceRoot
                    } as ScanWorkerData
                });

                worker.on('message', (message: ScanWorkerMessage) => {
                    this.handleWorkerMessage(message, resolve, reject);
                });

                worker.on('error', (error) => {
                    console.error('[SCAN ERROR]', error.message);
                    reject(new Error(`Worker thread error: ${error.message}`));
                });

                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error('[SCAN SETUP ERROR]', errorMessage);
                reject(new Error(`Failed to setup worker thread: ${errorMessage}`));
            }
        });
    }

    /**
     * Handle worker thread messages
     */
    private handleWorkerMessage(
        message: ScanWorkerMessage,
        resolve: Function,
        reject: Function
    ): void {
        const { type, data } = message;

        switch (type) {
            case 'status':
                console.error(`[SCAN STATUS] ${data.status} at ${data.timestamp}`);
                break;

            case 'result':
                console.error(`[SCAN COMPLETE] at ${data.timestamp}`);
                console.error('[SCAN RESULTS]', JSON.stringify(data.result, null, 2));
                resolve({
                    content: [{
                        type: 'text' as const,
                        text: `Scan completed successfully. Results logged to output channel.`
                    }]
                });
                break;

            case 'error':
                console.error(`[SCAN ERROR] ${data.error} at ${data.timestamp}`);
                reject(new Error(data.error));
                break;
        }
    }

    /**
     * Public method to scan project (called directly from extension)
     * Only available when running in extension context (library mode)
     */
    async scanProject(targetPath: string = '.', extensionContext?: any): Promise<void> {
        try {
            if (!vscode) {
                throw new Error('Scan functionality not available in standalone mode - requires VS Code extension context');
            }
            if (!extensionContext) {
                throw new Error('Extension context required for secure worker path resolution');
            }
            await this.executeScanInWorker(targetPath, extensionContext);
        } catch (error) {
            console.error('[SCAN PROJECT ERROR]', error instanceof Error ? error.message : String(error));
            throw error;
        }
    }
}

// If this file is run directly, start the server
if (require.main === module) {
    const server = new MCPStdioServer();

    server.start().catch((error) => {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
    });
}