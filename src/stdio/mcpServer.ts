#!/usr/bin/env node

import * as readline from 'readline';
import { CONSTELLATION_EXAMPLE_TOOL } from '../types/mcp.js';
import { MCPMessage, MCPError, MCPErrorCode, ToolCallParams, ToolCallResult, ToolsListResponse } from '../types/mcp.js';

// Local tool registry (6.2)
const tools = [CONSTELLATION_EXAMPLE_TOOL];

/**
 * stdio MCP Server class that handles communication over stdin/stdout
 */
class StdioMCPServer {
    private rl: readline.Interface;

    constructor() {
        // Set up readline interface for stdin/stdout communication
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        // Handle incoming messages
        this.rl.on('line', (line) => {
            this.handleMessage(line);
        });

        // Handle process termination
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }

    /**
     * Handle incoming JSON message from stdin
     */
    private handleMessage(line: string): void {
        try {
            const message = this.parseMessage(line);
            this.processMessage(message);
        } catch (error) {
            this.sendError(undefined, MCPErrorCode.PARSE_ERROR, 'Parse error', error);
        }
    }

    /**
     * Parse and validate incoming JSON message
     */
    private parseMessage(line: string): MCPMessage {
        if (!line.trim()) {
            throw new Error('Empty message received');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(line);
        } catch (error) {
            throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Validate JSON-RPC 2.0 structure
        if (!this.isValidMCPMessage(parsed)) {
            throw new Error('Invalid MCP message structure');
        }

        return parsed as MCPMessage;
    }

    /**
     * Validate MCP message structure
     */
    private isValidMCPMessage(obj: any): boolean {
        // Must have jsonrpc field with value "2.0"
        if (obj.jsonrpc !== "2.0") {
            return false;
        }

        // Must be either a request, response, or notification
        const hasMethod = typeof obj.method === 'string';
        const hasResult = obj.hasOwnProperty('result');
        const hasError = obj.hasOwnProperty('error');
        const hasId = obj.hasOwnProperty('id');

        // Request: has method and id
        // Notification: has method but no id
        // Response: has result or error, and id
        if (hasMethod) {
            // Request or notification
            return true;
        } else if ((hasResult || hasError) && hasId) {
            // Response
            return true;
        }

        return false;
    }

    /**
     * Process validated MCP message
     */
    private processMessage(message: MCPMessage): void {
        if (!message.method) {
            this.sendError(message.id, MCPErrorCode.INVALID_REQUEST, 'Missing method');
            return;
        }

        switch (message.method) {
            case 'initialize': // 6.3
                this.handleInitialize(message);
                break;
            case 'tools/list': // 6.4
                this.handleToolsList(message);
                break;
            case 'tools/call': // 6.5
                this.handleToolsCall(message);
                break;
            default: // 6.8
                this.sendError(
                    message.id,
                    MCPErrorCode.METHOD_NOT_FOUND,
                    `Method '${message.method}' not implemented`
                );
        }
    }

    private handleInitialize(message: MCPMessage): void {
        const result = { tools };
        this.sendResponse(message.id, result);
    }

    private handleToolsList(message: MCPMessage): void {
        const result = { tools };
        this.sendResponse(message.id, result);
    }

    private handleToolsCall(message: MCPMessage): void {
        const params: ToolCallParams | undefined = message.params;
        if (!params || typeof params !== 'object' || typeof params.name !== 'string') {
            this.sendError(message.id, MCPErrorCode.INVALID_PARAMS, 'Invalid tools/call params'); // 6.10
            return;
        }
        if (params.name !== CONSTELLATION_EXAMPLE_TOOL.name) {
            this.sendError(message.id, MCPErrorCode.METHOD_NOT_FOUND, `Tool '${params.name}' not found`);
            return;
        }
        const result: ToolCallResult = {
            content: [{ type: 'text', text: 'Hello, World from Constellation!' }]
        };
        this.sendResponse(message.id, result); // 6.6
    }

    /**
     * Send response message to stdout
     */
    private sendResponse(id: string | number | null | undefined, result: any): void {
        const response: MCPMessage = {
            jsonrpc: "2.0",
            id,
            result
        };

        this.writeMessage(response);
    }

    /**
     * Send error message to stdout
     */
    private sendError(
        id: string | number | null | undefined,
        code: MCPErrorCode,
        message: string,
        data?: any
    ): void {
        const response: MCPMessage = {
            jsonrpc: "2.0",
            id,
            error: {
                code,
                message,
                data
            }
        };

        this.writeMessage(response);
    }

    /**
     * Write message to stdout
     */
    private writeMessage(message: MCPMessage): void {
        try {
            const jsonString = JSON.stringify(message);
            process.stdout.write(jsonString + '\n');
        } catch (error) {
            const errorResponse = {
                jsonrpc: "2.0",
                id: message.id,
                error: {
                    code: MCPErrorCode.INTERNAL_ERROR,
                    message: "Failed to serialize response"
                }
            } as MCPMessage;
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
    }

    /**
     * Shutdown the server gracefully
     */
    private shutdown(): void {
        this.rl.close();
        process.exit(0);
    }

    /**
     * Start the server
     */
    public start(): void {
        // Server is ready to receive messages
        // In a real implementation, we might send an initialization message
        // For now, just wait for incoming messages
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new StdioMCPServer();
    server.start();
}

export { StdioMCPServer };