/**
 * MCP Server Module
 * 
 * This module provides a lightweight Express.js server that runs within the
 * Kiro Constellation VS Code extension process. It exposes a REST API endpoint
 * that allows external tools and services to query the extension's dependency
 * graph data through HTTP requests.
 */

import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { DependencyGraph } from './analyzer';

// Data provider callback type - allows decoupling from analysis engine
export type GraphDataProvider = () => DependencyGraph;

// Query request interface
export interface QueryRequest {
    query: string;
}

// Query response interface
export interface QueryResponse {
    matches: string[];
    total: number;
    timestamp: string;
}

// Error response interface
export interface ErrorResponse {
    error: string;
    code: string;
    timestamp: string;
}

// Server configuration interface
export interface ServerConfig {
    port: number;
    host: string;
}

// Module-level server instance for lifecycle management
let serverInstance: Server | null = null;
let app: Express | null = null;

/**
 * Starts the MCP server with the provided data provider callback
 * 
 * @param graphDataProvider - Callback function that returns the current dependency graph
 * @param port - Optional port number (defaults to 6170)
 * @returns Promise<void> - Resolves when server starts successfully
 */
export async function startServer(
    graphDataProvider: GraphDataProvider,
    port: number = 6170
): Promise<void> {
    // If server is already running, stop it first
    if (serverInstance) {
        console.log('🚀 KIRO-CONSTELLATION: MCP server already running, stopping first...');
        await stopServer();
    }

    return new Promise((resolve, reject) => {
        try {
            // Create Express app
            app = express();

            // Add JSON middleware for request body parsing
            app.use(express.json());

            // Define POST /query endpoint
            app.post('/query', (req: Request, res: Response) => {
                try {
                    // Validate request body exists
                    if (!req.body) {
                        return res.status(400).json({
                            error: 'Request body is required',
                            code: 'MISSING_BODY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Validate query parameter presence and type
                    const { query } = req.body as QueryRequest;

                    if (!query) {
                        return res.status(400).json({
                            error: 'Query parameter is required',
                            code: 'MISSING_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (typeof query !== 'string') {
                        return res.status(400).json({
                            error: 'Query parameter must be a string',
                            code: 'INVALID_QUERY_TYPE',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (query.trim().length === 0) {
                        return res.status(400).json({
                            error: 'Query parameter cannot be empty',
                            code: 'EMPTY_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Get current graph data from provider
                    const graphData = graphDataProvider();

                    // For now, return empty matches array - filtering logic will be implemented in task 4
                    const matches: string[] = [];

                    // Create response structure with matches array and total count
                    const response: QueryResponse = {
                        matches,
                        total: matches.length,
                        timestamp: new Date().toISOString()
                    };

                    res.json(response);

                } catch (error) {
                    console.error('🚀 KIRO-CONSTELLATION: Error processing query:', error);
                    res.status(500).json({
                        error: 'Internal server error while processing query',
                        code: 'QUERY_PROCESSING_ERROR',
                        timestamp: new Date().toISOString()
                    } as ErrorResponse);
                }
            });

            // Add basic error handling middleware
            app.use((err: any, req: Request, res: Response, next: any) => {
                console.error('🚀 KIRO-CONSTELLATION: MCP server error:', err);
                res.status(500).json({
                    error: 'Internal server error',
                    code: 'INTERNAL_ERROR',
                    timestamp: new Date().toISOString()
                } as ErrorResponse);
            });

            // Attempt to start server on specified port
            const tryStartServer = (currentPort: number, maxAttempts: number = 10): void => {
                if (maxAttempts <= 0) {
                    reject(new Error(`Failed to start MCP server: all ports from ${port} to ${port + 9} are in use`));
                    return;
                }

                serverInstance = app!.listen(currentPort, '127.0.0.1', () => {
                    console.log(`🚀 KIRO-CONSTELLATION: MCP server started on http://127.0.0.1:${currentPort}`);
                    resolve();
                });

                serverInstance.on('error', (error: any) => {
                    if (error.code === 'EADDRINUSE') {
                        console.log(`🚀 KIRO-CONSTELLATION: Port ${currentPort} is in use, trying ${currentPort + 1}...`);
                        serverInstance = null;
                        tryStartServer(currentPort + 1, maxAttempts - 1);
                    } else {
                        console.error('🚀 KIRO-CONSTELLATION: Failed to start MCP server:', error);
                        serverInstance = null;
                        reject(error);
                    }
                });
            };

            tryStartServer(port);

        } catch (error) {
            console.error('🚀 KIRO-CONSTELLATION: Error initializing MCP server:', error);
            reject(error);
        }
    });
}

/**
 * Stops the MCP server gracefully
 * 
 * @returns Promise<void> - Resolves when server stops successfully
 */
export async function stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!serverInstance) {
            console.log('🚀 KIRO-CONSTELLATION: MCP server is not running');
            resolve();
            return;
        }

        console.log('🚀 KIRO-CONSTELLATION: Stopping MCP server...');

        serverInstance.close((error) => {
            if (error) {
                console.error('🚀 KIRO-CONSTELLATION: Error stopping MCP server:', error);
                reject(error);
            } else {
                console.log('🚀 KIRO-CONSTELLATION: MCP server stopped successfully');
                serverInstance = null;
                app = null;
                resolve();
            }
        });

        // Force close after timeout to prevent hanging
        setTimeout(() => {
            if (serverInstance) {
                console.log('🚀 KIRO-CONSTELLATION: Force closing MCP server after timeout');
                serverInstance.closeAllConnections?.();
                serverInstance = null;
                app = null;
                resolve();
            }
        }, 5000);
    });
}

/**
 * Gets the current server status
 * 
 * @returns boolean - True if server is running, false otherwise
 */
export function isServerRunning(): boolean {
    return serverInstance !== null && serverInstance.listening;
}

/**
 * Gets the current server port
 * 
 * @returns number | null - Port number if server is running, null otherwise
 */
export function getServerPort(): number | null {
    if (!serverInstance || !serverInstance.listening) {
        return null;
    }

    const address = serverInstance.address();
    if (typeof address === 'object' && address !== null) {
        return address.port;
    }

    return null;
}