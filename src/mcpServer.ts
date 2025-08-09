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

// Logging utility functions for structured logging
interface LogContext {
    requestId?: string;
    port?: number;
    query?: string;
    matchCount?: number;
    errorCode?: string;
    duration?: number;
    [key: string]: any;
}

/**
 * Structured logging utility for server lifecycle events
 */
function logServerEvent(event: string, level: 'info' | 'warn' | 'error', message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const prefix = '🚀 KIRO-CONSTELLATION';
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';

    const logMessage = `${prefix}: [${level.toUpperCase()}] [${event}] ${message}${contextStr}`;

    switch (level) {
        case 'error':
            console.error(logMessage);
            break;
        case 'warn':
            console.warn(logMessage);
            break;
        default:
            console.log(logMessage);
    }
}

/**
 * Structured logging utility for request/response events with sanitized details
 */
function logRequest(phase: 'start' | 'success' | 'error', requestId: string, method: string, url: string, context?: LogContext): void {
    const sanitizedContext = context ? {
        ...context,
        // Sanitize sensitive information
        query: context.query ? (context.query.length > 100 ? `${context.query.substring(0, 100)}...` : context.query) : undefined,
        // Remove any potential sensitive data
        body: undefined,
        headers: undefined
    } : {};

    const eventName = `REQUEST_${phase.toUpperCase()}`;
    const message = `${method} ${url}`;

    logServerEvent(eventName, phase === 'error' ? 'error' : 'info', message, {
        requestId,
        ...sanitizedContext
    });
}

/**
 * Structured logging utility for error events with appropriate context
 */
function logError(errorType: string, error: any, context?: LogContext): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logServerEvent('ERROR', 'error', errorMessage, {
        ...context,
        errorType,
        stack: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined // Limit stack trace length
    });
}

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
        logError('STRING_MATCHING_ERROR', error, {
            query: query.substring(0, 100), // Limit query length in logs
            modulePath: modulePath.substring(0, 200), // Limit path length in logs
            errorCode: 'STRING_MATCHING_FAILED'
        });
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
        logServerEvent('QUERY_PROCESSING', 'warn', 'Graph data is null/undefined, returning empty results', {});
        return [];
    }

    if (!graphData.modules) {
        logServerEvent('QUERY_PROCESSING', 'warn', 'Graph data has no modules property, returning empty results', {});
        return [];
    }

    if (!Array.isArray(graphData.modules)) {
        const error = 'Invalid graph data structure: modules is not an array';
        logError('QUERY_PROCESSING_ERROR', error, {
            modulesType: typeof graphData.modules,
            errorCode: 'INVALID_MODULES_STRUCTURE'
        });
        throw new Error(error);
    }

    // Handle edge case: empty modules array
    if (graphData.modules.length === 0) {
        logServerEvent('QUERY_PROCESSING', 'info', 'Graph data contains no modules, returning empty results', { moduleCount: 0 });
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
                logError('MODULE_MATCHING_ERROR', matchError, {
                    modulePath: module.source?.substring(0, 200), // Limit path length in logs
                    query: query.substring(0, 100), // Limit query length in logs
                    errorCode: 'MODULE_MATCH_FAILED'
                });
                return false;
            }
        });

        // Log statistics about the filtering process
        if (invalidModuleCount > 0) {
            logServerEvent('QUERY_PROCESSING', 'warn', 'Found invalid modules during processing', {
                invalidModuleCount,
                validModuleCount,
                totalModules: invalidModuleCount + validModuleCount
            });
        }

        logServerEvent('QUERY_PROCESSING', 'info', 'Module filtering completed', {
            validModuleCount,
            matchingModules: matchingModules.length,
            invalidModuleCount
        });

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
                logServerEvent('QUERY_PROCESSING', 'warn', 'Found invalid path during deduplication', {
                    invalidPath: String(path),
                    pathType: typeof path
                });
                return false;
            }
            return path.trim().length > 0;
        });

        const duplicatesRemoved = filePaths.length - uniqueFilePaths.length;
        if (duplicatesRemoved > 0) {
            logServerEvent('QUERY_PROCESSING', 'info', 'Removed duplicate paths', {
                duplicatesRemoved,
                originalCount: filePaths.length,
                uniqueCount: uniqueFilePaths.length
            });
        }

        return uniqueFilePaths;

    } catch (error) {
        // Handle any unexpected errors during filtering
        logError('QUERY_PROCESSING_CRITICAL_ERROR', error, {
            query: query.substring(0, 100), // Limit query length in logs
            hasModules: !!graphData.modules,
            moduleCount: graphData.modules ? graphData.modules.length : 0,
            hasSummary: !!graphData.summary,
            errorCode: 'CRITICAL_PROCESSING_ERROR'
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
        logServerEvent('SERVER_RESTART', 'info', 'Server already running, stopping first', { port });
        await stopServer();
    }

    logServerEvent('SERVER_START', 'info', 'Initializing MCP server', { port });

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

            // Add request logging middleware with structured logging
            app.use((req: Request, res: Response, next) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                const startTime = Date.now();

                // Log incoming request with sanitized details
                logRequest('start', requestId, req.method, req.url, {
                    userAgent: req.get('User-Agent')?.substring(0, 100), // Limit user agent length
                    contentType: req.get('Content-Type'),
                    contentLength: req.get('Content-Length')
                });

                // Add request ID and start time to request object for tracking
                (req as any).requestId = requestId;
                (req as any).startTime = startTime;

                // Override res.json to log successful responses
                const originalJson = res.json.bind(res);
                res.json = function (body: any) {
                    const duration = Date.now() - startTime;
                    logRequest('success', requestId, req.method, req.url, {
                        statusCode: res.statusCode,
                        duration,
                        responseSize: JSON.stringify(body).length
                    });
                    return originalJson(body);
                };

                // Override res.status to capture error responses
                const originalStatus = res.status.bind(res);
                res.status = function (code: number) {
                    if (code >= 400) {
                        const duration = Date.now() - startTime;
                        logRequest('error', requestId, req.method, req.url, {
                            statusCode: code,
                            duration
                        });
                    }
                    return originalStatus(code);
                };

                next();
            });

            // Define POST /query endpoint
            app.post('/query', (req: Request, res: Response) => {
                const requestId = (req as any).requestId || Math.random().toString(36).substring(2, 15);
                const startTime = (req as any).startTime || Date.now();

                logServerEvent('QUERY_START', 'info', 'Processing query request', { requestId });

                try {
                    // Validate request body exists
                    if (!req.body) {
                        const error = 'Request body is required';
                        logError('VALIDATION_ERROR', error, { requestId, errorCode: 'MISSING_BODY' });
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
                        logError('VALIDATION_ERROR', error, { requestId, errorCode: 'MISSING_QUERY' });
                        return res.status(400).json({
                            error,
                            code: 'MISSING_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (typeof query !== 'string') {
                        const error = `Query parameter must be a string, received: ${typeof query}`;
                        logError('VALIDATION_ERROR', error, { requestId, errorCode: 'INVALID_QUERY_TYPE', queryType: typeof query });
                        return res.status(400).json({
                            error: 'Query parameter must be a string',
                            code: 'INVALID_QUERY_TYPE',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    if (query.trim().length === 0) {
                        const error = 'Query parameter cannot be empty';
                        logError('VALIDATION_ERROR', error, { requestId, errorCode: 'EMPTY_QUERY' });
                        return res.status(400).json({
                            error,
                            code: 'EMPTY_QUERY',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Validate query length to prevent potential DoS
                    if (query.length > 1000) {
                        const error = 'Query parameter is too long (maximum 1000 characters)';
                        logError('VALIDATION_ERROR', error, { requestId, errorCode: 'QUERY_TOO_LONG', queryLength: query.length });
                        return res.status(400).json({
                            error,
                            code: 'QUERY_TOO_LONG',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Get current graph data from provider with comprehensive error handling
                    let graphData: DependencyGraph;
                    try {
                        logServerEvent('DATA_PROVIDER_CALL', 'info', 'Calling data provider', { requestId });
                        graphData = graphDataProvider();

                        if (!graphData) {
                            logServerEvent('DATA_PROVIDER_WARNING', 'warn', 'Data provider returned null/undefined, using empty graph', { requestId });
                            graphData = {
                                modules: [],
                                summary: {
                                    totalDependencies: 0,
                                    violations: []
                                }
                            };
                        } else {
                            logServerEvent('DATA_PROVIDER_SUCCESS', 'info', 'Data provider returned graph data', {
                                requestId,
                                moduleCount: graphData.modules?.length || 0,
                                totalDependencies: graphData.summary?.totalDependencies || 0
                            });
                        }
                    } catch (providerError) {
                        const error = 'Failed to retrieve dependency graph data';
                        logError('DATA_PROVIDER_ERROR', providerError, { requestId, errorCode: 'DATA_PROVIDER_ERROR' });
                        return res.status(500).json({
                            error,
                            code: 'DATA_PROVIDER_ERROR',
                            timestamp: new Date().toISOString()
                        } as ErrorResponse);
                    }

                    // Implement query processing and filtering logic with error handling
                    let matches: string[];
                    try {
                        const sanitizedQuery = query.length > 50 ? `${query.substring(0, 50)}...` : query;
                        logServerEvent('QUERY_PROCESSING', 'info', 'Processing query against dependency graph', {
                            requestId,
                            query: sanitizedQuery,
                            moduleCount: graphData.modules?.length || 0
                        });

                        matches = processQuery(query, graphData);

                        logServerEvent('QUERY_SUCCESS', 'info', 'Query processing completed', {
                            requestId,
                            matchCount: matches.length,
                            query: sanitizedQuery,
                            duration: Date.now() - startTime
                        });
                    } catch (queryError) {
                        const error = 'Failed to process query against dependency graph';
                        logError('QUERY_PROCESSING_ERROR', queryError, { requestId, errorCode: 'QUERY_PROCESSING_ERROR', query: query.substring(0, 50) });
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

                    logServerEvent('QUERY_COMPLETE', 'info', 'Request completed successfully', {
                        requestId,
                        matchCount: matches.length,
                        totalDuration: Date.now() - startTime
                    });

                    res.json(response);

                } catch (error) {
                    logError('UNEXPECTED_ERROR', error, {
                        requestId,
                        errorCode: 'INTERNAL_SERVER_ERROR',
                        duration: Date.now() - startTime
                    });

                    res.status(500).json({
                        error: 'Internal server error while processing query',
                        code: 'INTERNAL_SERVER_ERROR',
                        timestamp: new Date().toISOString()
                    } as ErrorResponse);
                }
            });

            // Add comprehensive error handling middleware with structured logging
            app.use((err: any, req: Request, res: Response, _next: any) => {
                const errorId = Math.random().toString(36).substring(2, 15);
                const requestId = (req as any).requestId || 'unknown';

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

                logError('MIDDLEWARE_ERROR', err, {
                    errorId,
                    requestId,
                    errorCode,
                    statusCode,
                    url: req.url,
                    method: req.method,
                    userAgent: req.get('User-Agent')?.substring(0, 100)
                });

                // Don't send error response if headers already sent
                if (res.headersSent) {
                    logServerEvent('ERROR_HEADERS_SENT', 'warn', 'Cannot send error response, headers already sent', { errorId, requestId });
                    return _next(err);
                }

                res.status(statusCode).json({
                    error: 'Internal server error',
                    code: errorCode,
                    timestamp: new Date().toISOString()
                } as ErrorResponse);
            });

            // Add 404 handler for undefined routes with structured logging
            app.use((req: Request, res: Response) => {
                const requestId = (req as any).requestId || 'unknown';
                logServerEvent('ROUTE_NOT_FOUND', 'warn', 'Route not found', {
                    requestId,
                    method: req.method,
                    url: req.originalUrl,
                    userAgent: req.get('User-Agent')?.substring(0, 100)
                });

                res.status(404).json({
                    error: 'Route not found',
                    code: 'ROUTE_NOT_FOUND',
                    timestamp: new Date().toISOString()
                } as ErrorResponse);
            });

            // Attempt to start server on specified port with structured logging
            const tryStartServer = (currentPort: number, maxAttempts: number = 10): void => {
                if (maxAttempts <= 0) {
                    const error = new Error(`Failed to start MCP server: all ports from ${port} to ${port + 9} are in use`);
                    logError('SERVER_START_FAILED', error, {
                        originalPort: port,
                        lastAttemptedPort: currentPort - 1,
                        errorCode: 'ALL_PORTS_IN_USE'
                    });
                    reject(error);
                    return;
                }

                serverInstance = app!.listen(currentPort, '127.0.0.1', () => {
                    logServerEvent('SERVER_STARTED', 'info', 'MCP server started successfully', {
                        port: currentPort,
                        host: '127.0.0.1',
                        url: `http://127.0.0.1:${currentPort}`,
                        attemptsUsed: 11 - maxAttempts
                    });
                    resolve();
                });

                serverInstance.on('error', (error: any) => {
                    if (error.code === 'EADDRINUSE') {
                        logServerEvent('PORT_IN_USE', 'warn', 'Port in use, trying next port', {
                            port: currentPort,
                            nextPort: currentPort + 1,
                            attemptsRemaining: maxAttempts - 1
                        });
                        serverInstance = null;
                        tryStartServer(currentPort + 1, maxAttempts - 1);
                    } else {
                        logError('SERVER_START_ERROR', error, {
                            port: currentPort,
                            errorCode: error.code || 'UNKNOWN_ERROR'
                        });
                        serverInstance = null;
                        reject(error);
                    }
                });
            };

            tryStartServer(port);

        } catch (error) {
            logError('SERVER_INIT_ERROR', error, { port, errorCode: 'INITIALIZATION_FAILED' });
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
            logServerEvent('SERVER_STOP', 'info', 'Server is not running, nothing to stop', {});
            resolve();
            return;
        }

        const currentPort = getServerPort();
        logServerEvent('SERVER_STOP', 'info', 'Initiating server shutdown', { port: currentPort || undefined });

        const shutdownStartTime = Date.now();

        serverInstance.close((error) => {
            const shutdownDuration = Date.now() - shutdownStartTime;

            if (error) {
                logError('SERVER_STOP_ERROR', error, {
                    port: currentPort || undefined,
                    shutdownDuration,
                    errorCode: 'GRACEFUL_SHUTDOWN_FAILED'
                });
                reject(error);
            } else {
                logServerEvent('SERVER_STOPPED', 'info', 'Server stopped successfully', {
                    port: currentPort || undefined,
                    shutdownDuration
                });
                serverInstance = null;
                app = null;
                resolve();
            }
        });

        // Force close after timeout to prevent hanging
        setTimeout(() => {
            if (serverInstance) {
                const shutdownDuration = Date.now() - shutdownStartTime;
                logServerEvent('SERVER_FORCE_CLOSE', 'warn', 'Force closing server after timeout', {
                    port: currentPort || undefined,
                    shutdownDuration,
                    timeoutMs: 5000
                });

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