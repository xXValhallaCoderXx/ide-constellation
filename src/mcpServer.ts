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
 * Performs case-insensitive string matching for module paths
 * 
 * @param query - The search term to match against
 * @param modulePath - The module path to check for matches
 * @returns boolean - True if the module path contains the query term (case-insensitive)
 * @throws Error - Throws error if input validation fails
 */
function matchesQuery(query: string, modulePath: string): boolean {
    // Validate input parameters
    if (typeof query !== 'string') {
        throw new Error(`Query must be a string, received: ${typeof query}`);
    }

    if (typeof modulePath !== 'string') {
        throw new Error(`Module path must be a string, received: ${typeof modulePath}`);
    }

    // Handle edge cases
    if (!query || query.trim().length === 0) {
        return false;
    }

    if (!modulePath || modulePath.trim().length === 0) {
        return false;
    }

    try {
        // Convert both strings to lowercase for case-insensitive matching
        const normalizedQuery = query.toLowerCase().trim();
        const normalizedPath = modulePath.toLowerCase();

        // Check if the module path contains the query term
        return normalizedPath.includes(normalizedQuery);
    } catch (error) {
        console.error('🚀 KIRO-CONSTELLATION: Error during string matching:', error);
        console.error('🚀 KIRO-CONSTELLATION: Query:', query);
        console.error('🚀 KIRO-CONSTELLATION: Module path:', modulePath);
        throw new Error(`String matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Processes a query against the dependency graph and returns matching file paths
 * 
 * @param query - The search term to filter modules by
 * @param graphData - The current dependency graph data
 * @returns string[] - Array of file paths that match the query
 * @throws Error - Throws error if processing fails critically
 */
function processQuery(query: string, graphData: DependencyGraph): string[] {
    // Validate input parameters
    if (!query || typeof query !== 'string') {
        throw new Error('Invalid query parameter provided to processQuery');
    }

    // Handle edge case: empty or invalid graph data
    if (!graphData) {
        console.warn('🚀 KIRO-CONSTELLATION: Graph data is null/undefined, returning empty results');
        return [];
    }

    if (!graphData.modules) {
        console.warn('🚀 KIRO-CONSTELLATION: Graph data has no modules property, returning empty results');
        return [];
    }

    if (!Array.isArray(graphData.modules)) {
        console.error('🚀 KIRO-CONSTELLATION: Graph data modules is not an array:', typeof graphData.modules);
        throw new Error('Invalid graph data structure: modules is not an array');
    }

    // Handle edge case: empty modules array
    if (graphData.modules.length === 0) {
        console.log('🚀 KIRO-CONSTELLATION: Graph data contains no modules, returning empty results');
        return [];
    }

    try {
        let validModuleCount = 0;
        let invalidModuleCount = 0;

        // Filter modules using case-insensitive string matching
        const matchingModules = graphData.modules.filter(module => {
            // Ensure module exists and has a valid source path
            if (!module) {
                invalidModuleCount++;
                return false;
            }

            if (!module.source || typeof module.source !== 'string') {
                invalidModuleCount++;
                return false;
            }

            if (module.source.trim().length === 0) {
                invalidModuleCount++;
                return false;
            }

            validModuleCount++;

            try {
                // Apply the matching logic
                return matchesQuery(query, module.source);
            } catch (matchError) {
                console.error('🚀 KIRO-CONSTELLATION: Error matching module:', module.source, matchError);
                return false;
            }
        });

        // Log statistics about the filtering process
        if (invalidModuleCount > 0) {
            console.warn(`🚀 KIRO-CONSTELLATION: Found ${invalidModuleCount} invalid modules during query processing`);
        }

        console.log(`🚀 KIRO-CONSTELLATION: Processed ${validModuleCount} valid modules, found ${matchingModules.length} matches`);

        // Extract file paths from matching modules
        const filePaths = matchingModules.map(module => {
            if (!module.source) {
                throw new Error('Module source is unexpectedly null after filtering');
            }
            return module.source;
        });

        // Remove any potential duplicates and filter out empty strings
        const uniqueFilePaths = [...new Set(filePaths)].filter(path => {
            if (!path || typeof path !== 'string') {
                console.warn('🚀 KIRO-CONSTELLATION: Found invalid path during deduplication:', path);
                return false;
            }
            return path.trim().length > 0;
        });

        const duplicatesRemoved = filePaths.length - uniqueFilePaths.length;
        if (duplicatesRemoved > 0) {
            console.log(`🚀 KIRO-CONSTELLATION: Removed ${duplicatesRemoved} duplicate paths`);
        }

        return uniqueFilePaths;

    } catch (error) {
        // Handle any unexpected errors during filtering
        console.error('🚀 KIRO-CONSTELLATION: Critical error during query processing:', error);
        console.error('🚀 KIRO-CONSTELLATION: Query was:', query);
        console.error('🚀 KIRO-CONSTELLATION: Graph data summary:', {
            hasModules: !!graphData.modules,
            moduleCount: graphData.modules ? graphData.modules.length : 0,
            hasSummary: !!graphData.summary
        });

        // Re-throw the error to be handled by the calling function
        throw new Error(`Query processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

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

            // Add JSON middleware for request body parsing with error handling
            app.use(express.json({
                limit: '10mb', // Prevent DoS attacks with large payloads
                strict: true,  // Only parse arrays and objects
                type: 'application/json'
            }));

            // Add request logging middleware
            app.use((req: Request, res: Response, next) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                console.log(`🚀 KIRO-CONSTELLATION: Incoming request ${requestId}: ${req.method} ${req.url}`);

                // Add request ID to request object for tracking
                (req as any).requestId = requestId;

                next();
            });

            // Define POST /query endpoint
            app.post('/query', (req: Request, res: Response) => {
                const requestId = (req as any).requestId || Math.random().toString(36).substring(2, 15);
                console.log(`🚀 KIRO-CONSTELLATION: Processing query request ${requestId}`);

                try {
                    // Validate request body exists
                    if (!req.body) {
                        const error = 'Request body is required';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} failed - ${error}`);
                        return res.status(400).json({
                            error,
                            code: 'MISSING_BODY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Validate query parameter presence and type
                    const { query } = req.body as QueryRequest;

                    if (query === undefined || query === null) {
                        const error = 'Query parameter is required';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} failed - ${error}`);
                        return res.status(400).json({
                            error,
                            code: 'MISSING_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (typeof query !== 'string') {
                        const error = `Query parameter must be a string, received: ${typeof query}`;
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} failed - ${error}`);
                        return res.status(400).json({
                            error: 'Query parameter must be a string',
                            code: 'INVALID_QUERY_TYPE',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (query.trim().length === 0) {
                        const error = 'Query parameter cannot be empty';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} failed - ${error}`);
                        return res.status(400).json({
                            error,
                            code: 'EMPTY_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Validate query length to prevent potential DoS
                    if (query.length > 1000) {
                        const error = 'Query parameter is too long (maximum 1000 characters)';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} failed - ${error}`);
                        return res.status(400).json({
                            error,
                            code: 'QUERY_TOO_LONG',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Get current graph data from provider with comprehensive error handling
                    let graphData: DependencyGraph;
                    try {
                        console.log(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Calling data provider`);
                        graphData = graphDataProvider();

                        if (!graphData) {
                            console.warn(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Data provider returned null/undefined`);
                            graphData = {
                                modules: [],
                                summary: {
                                    totalDependencies: 0,
                                    violations: []
                                }
                            };
                        }
                    } catch (providerError) {
                        const error = 'Failed to retrieve dependency graph data';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Data provider error:`, providerError);
                        return res.status(500).json({
                            error,
                            code: 'DATA_PROVIDER_ERROR',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Implement query processing and filtering logic with error handling
                    let matches: string[];
                    try {
                        console.log(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Processing query: "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}"`);
                        matches = processQuery(query, graphData);
                        console.log(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Found ${matches.length} matches`);
                    } catch (queryError) {
                        const error = 'Failed to process query against dependency graph';
                        console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Query processing error:`, queryError);
                        return res.status(500).json({
                            error,
                            code: 'QUERY_PROCESSING_ERROR',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Create response structure with matches array and total count
                    const response: QueryResponse = {
                        matches,
                        total: matches.length,
                        timestamp: new Date().toISOString()
                    };

                    console.log(`🚀 KIRO-CONSTELLATION: Request ${requestId} completed successfully`);
                    res.json(response);

                } catch (error) {
                    console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Unexpected error:`, error);
                    console.error(`🚀 KIRO-CONSTELLATION: Request ${requestId} - Error stack:`, error instanceof Error ? error.stack : 'No stack trace available');

                    res.status(500).json({
                        error: 'Internal server error while processing query',
                        code: 'INTERNAL_SERVER_ERROR',
                        timestamp: new Date().toISOString()
                    } as ErrorResponse);
                }
            });

            // Add comprehensive error handling middleware
            app.use((err: any, req: Request, res: Response, _next: any) => {
                const errorId = Math.random().toString(36).substring(2, 15);
                console.error(`🚀 KIRO-CONSTELLATION: MCP server error ${errorId}:`, err);
                console.error(`🚀 KIRO-CONSTELLATION: Error ${errorId} - Request URL:`, req.url);
                console.error(`🚀 KIRO-CONSTELLATION: Error ${errorId} - Request method:`, req.method);
                console.error(`🚀 KIRO-CONSTELLATION: Error ${errorId} - Error stack:`, err instanceof Error ? err.stack : 'No stack trace available');

                // Don't send error response if headers already sent
                if (res.headersSent) {
                    console.error(`🚀 KIRO-CONSTELLATION: Error ${errorId} - Headers already sent, cannot send error response`);
                    return _next(err);
                }

                // Determine appropriate error code based on error type
                let errorCode = 'INTERNAL_ERROR';
                let statusCode = 500;

                if (err.type === 'entity.parse.failed') {
                    errorCode = 'JSON_PARSE_ERROR';
                    statusCode = 400;
                } else if (err.type === 'entity.too.large') {
                    errorCode = 'REQUEST_TOO_LARGE';
                    statusCode = 413;
                } else if (err.code === 'ECONNRESET') {
                    errorCode = 'CONNECTION_RESET';
                    statusCode = 499;
                }

                res.status(statusCode).json({
                    error: 'Internal server error',
                    code: errorCode,
                    timestamp: new Date().toISOString()
                } as ErrorResponse);
            });

            // Add 404 handler for undefined routes
            app.use((req: Request, res: Response) => {
                console.warn(`🚀 KIRO-CONSTELLATION: 404 - Route not found: ${req.method} ${req.originalUrl}`);
                res.status(404).json({
                    error: 'Route not found',
                    code: 'ROUTE_NOT_FOUND',
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