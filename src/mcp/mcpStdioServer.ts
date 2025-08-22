#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL } from '../types/mcp';

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
}

// If this file is run directly, start the server
if (require.main === module) {
    const server = new MCPStdioServer();

    server.start().catch((error) => {
        console.error('Failed to start MCP server:', error);
        process.exit(1);
    });
}