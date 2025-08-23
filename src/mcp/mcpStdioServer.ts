#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL } from '../types/mcp';
import { Worker } from 'worker_threads';
import * as path from 'path';

interface ScanWorkerMessage {
    type: 'status' | 'result' | 'error';
    data: {
        status?: 'starting' | 'complete';
        result?: any;
        error?: string;
        timestamp: string;
    };
}

interface ScanWorkerData {
    targetPath: string;
    workspaceRoot: string;
}

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
     * Execute scan in worker thread
     */
    private async executeScanInWorker(targetPath: string = '.'): Promise<any> {
        return new Promise((resolve, reject) => {
            // The MCP server is built to out/mcp-server.js, so workers are at ../dist/workers/
            const workerPath = path.join(__dirname, '../dist/workers/scanWorker.mjs');
            const worker = new Worker(workerPath, {
                workerData: {
                    targetPath,
                    workspaceRoot: process.cwd()
                } as ScanWorkerData
            });

            worker.on('message', (message: ScanWorkerMessage) => {
                this.handleWorkerMessage(message, resolve, reject);
            });

            worker.on('error', (error) => {
                console.error('[SCAN ERROR]', error.message);
                reject(error);
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    reject(new Error(`Worker stopped with exit code ${code}`));
                }
            });
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
     */
    async scanProject(targetPath: string = '.'): Promise<void> {
        try {
            await this.executeScanInWorker(targetPath);
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