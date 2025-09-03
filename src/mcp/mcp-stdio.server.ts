#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types';
import { CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL, CONSTELLATION_GET_GRAPH_SUMMARY_TOOL, CONSTELLATION_HEALTH_REPORT_TOOL, CONSTELLATION_IMPACT_ANALYSIS_TOOL } from '../types/mcp.types';
import { GraphService } from '../services/graph.service';
import { GraphCache } from '../services/graph-cache.service';
import { SummaryGenerator } from '../services/summary-generator.service';
import { ImpactAnalyzerService } from '../services/impact-analyzer.service';
import { DualToolResponse } from '../types/visual-instruction.types';
import { executeHealthReport, generateHealthSummary } from './tools/health-report.tool';
import * as path from 'path';
import * as net from 'net';
import { BridgeMessage } from '../types/bridge.types';

// Conditional vscode import - only available in extension context
let vscode: any = null;
try {
    // This will only work when running within VS Code extension host
    vscode = require('vscode');
} catch (error) {
    // Running as standalone server - vscode module not available
    console.error('[MCP DEBUG] Running in standalone mode - vscode module not available');
}



/**
 * MCP Server implementation for VS Code Standard Provider POC
 * This server implements the Model Context Protocol using stdio transport
 * for communication with VS Code/Kiro IDE
 */
export class MCPStdioServer {
    private server: Server;
    private isRunning = false;
    private extensionContext: any = null;
    private providerInstance: any = null;
    private bridgeSocket: net.Socket | null = null;
    private bridgeReady = false;
    private bridgeAuthToken: string | null = null;
    private bridgeConnectTimer: NodeJS.Timeout | null = null;

    constructor(extensionContext?: any) {
        // Store extension context if provided (when running in extension mode)
        this.extensionContext = extensionContext;
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
                    '- constellation_get_graph_summary: provides intelligent codebase analysis with architectural insights.',
                    '- constellation_health_report: generates comprehensive health analysis with dual-view dashboard and heatmap visualization.',
                    '- constellation_impact_analysis: analyzes the impact of changes to a specific file by identifying dependencies and dependents.',
                    'Prefer using tools when asked to validate MCP connectivity, echo a message, analyze the codebase, generate health reports, or assess change impact.'
                ].join('\n')
            }
        );

        this.setupHandlers();
        this.setupProcessHandlers();
    this.initBridgeClient();
    }

    /**
     * Set up MCP protocol handlers
     */
    private setupHandlers(): void {
        // Handle tools/list requests
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            console.error('[MCP DEBUG] Received tools/list request');
            return {
                tools: [CONSTELLATION_EXAMPLE_TOOL, CONSTELLATION_PING_TOOL, CONSTELLATION_GET_GRAPH_SUMMARY_TOOL, CONSTELLATION_HEALTH_REPORT_TOOL, CONSTELLATION_IMPACT_ANALYSIS_TOOL],
            };
        });

        // Handle tools/call requests
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            console.error('[MCP DEBUG] Received tools/call request', JSON.stringify(request));
            const { name, arguments: args } = request.params;

            if (name === CONSTELLATION_PING_TOOL.name) {
                console.error('[MCP DEBUG] PING tool executed');
                const envelope = { dataForAI: 'pong', bridgeMessage: { type: 'ui:showPanel', payload: { panel: 'dependencyGraph' }, metadata: { correlationId: `ping-${Date.now()}`, timestamp: Date.now(), priority: 'high' } } };
                // Also attempt out-of-band send
                this.sendBridgeMessage(envelope.bridgeMessage as BridgeMessage);
                return { content: [{ type: 'text' as const, text: JSON.stringify(envelope) }] };
            }

            if (name === CONSTELLATION_GET_GRAPH_SUMMARY_TOOL.name) {
                console.error('[MCP DEBUG] GRAPH SUMMARY tool executed');
                const forceRefresh = (args?.forceRefresh as boolean) || false;
                const providedWorkspaceRoot = (args?.workspaceRoot as string) || '';
                
                // Determine the workspace root to analyze
                let workspaceRoot: string;
                
                if (providedWorkspaceRoot && providedWorkspaceRoot.trim()) {
                    // Use provided workspace root (most reliable when called from external tools like Kiro)
                    workspaceRoot = path.resolve(providedWorkspaceRoot.trim());
                    console.error(`[SUMMARY] Using provided workspace root: ${workspaceRoot}`);
                } else if (vscode && vscode.workspace && vscode.workspace.workspaceFolders) {
                    // Extension mode - use VS Code workspace API
                    workspaceRoot = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
                    if (!workspaceRoot) {
                        throw new Error('No workspace folder open - cannot generate graph summary');
                    }
                    console.error(`[SUMMARY] Using VS Code workspace root: ${workspaceRoot}`);
                } else {
                    // Standalone mode fallback - use current working directory as workspace root
                    workspaceRoot = process.cwd();
                    console.error(`[SUMMARY] Using current working directory as workspace root: ${workspaceRoot}`);
                }
                
                // Validate workspace root exists
                const fs = require('fs');
                if (!fs.existsSync(workspaceRoot)) {
                    throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
                }
                
                // Use stored extension context from constructor (may be null for standalone mode)
                return await this.executeGetGraphSummary(workspaceRoot, forceRefresh, this.extensionContext);
            }

            if (name === CONSTELLATION_HEALTH_REPORT_TOOL.name) {
                console.error('[MCP DEBUG] HEALTH REPORT tool executed');
                const forceRefresh = (args?.forceRefresh as boolean) || false;
                const providedWorkspaceRoot = (args?.workspaceRoot as string) || '';
                
                // Determine the workspace root to analyze
                let workspaceRoot: string;
                
                if (providedWorkspaceRoot && providedWorkspaceRoot.trim()) {
                    // Use provided workspace root (most reliable when called from external tools like Kiro)
                    workspaceRoot = path.resolve(providedWorkspaceRoot.trim());
                    console.error(`[HEALTH_REPORT] Using provided workspace root: ${workspaceRoot}`);
                } else if (vscode && vscode.workspace && vscode.workspace.workspaceFolders) {
                    // Extension mode - use VS Code workspace API
                    workspaceRoot = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
                    if (!workspaceRoot) {
                        throw new Error('No workspace folder open - cannot generate health report');
                    }
                    console.error(`[HEALTH_REPORT] Using VS Code workspace root: ${workspaceRoot}`);
                } else {
                    // Standalone mode fallback - use current working directory as workspace root
                    workspaceRoot = process.cwd();
                    console.error(`[HEALTH_REPORT] Using current working directory as workspace root: ${workspaceRoot}`);
                }
                
                // Validate workspace root exists
                const fs = require('fs');
                if (!fs.existsSync(workspaceRoot)) {
                    throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
                }
                
                // Execute health report with dual-view response
                return await this.executeHealthReport(workspaceRoot, forceRefresh, this.extensionContext);
            }

            if (name === CONSTELLATION_IMPACT_ANALYSIS_TOOL.name) {
                console.error('[MCP DEBUG] IMPACT ANALYSIS tool executed');
                const filePath = args?.filePath as string;
                const changeType = args?.changeType as string;
                const providedWorkspaceRoot = (args?.workspaceRoot as string) || '';

                // Validate required parameters
                if (!filePath || typeof filePath !== 'string') {
                    throw new Error('filePath parameter is required and must be a string');
                }

                // Determine the workspace root to analyze
                let workspaceRoot: string;

                if (providedWorkspaceRoot && providedWorkspaceRoot.trim()) {
                    // Use provided workspace root (most reliable when called from external tools like Kiro)
                    workspaceRoot = path.resolve(providedWorkspaceRoot.trim());
                    console.error(`[IMPACT_ANALYSIS] Using provided workspace root: ${workspaceRoot}`);
                } else if (vscode && vscode.workspace && vscode.workspace.workspaceFolders) {
                    // Extension mode - use VS Code workspace API
                    workspaceRoot = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
                    if (!workspaceRoot) {
                        throw new Error('No workspace folder open - cannot perform impact analysis');
                    }
                    console.error(`[IMPACT_ANALYSIS] Using VS Code workspace root: ${workspaceRoot}`);
                } else {
                    // Standalone mode fallback - use current working directory as workspace root
                    workspaceRoot = process.cwd();
                    console.error(`[IMPACT_ANALYSIS] Using current working directory as workspace root: ${workspaceRoot}`);
                }

                // Validate workspace root exists
                const fs = require('fs');
                if (!fs.existsSync(workspaceRoot)) {
                    throw new Error(`Workspace root does not exist: ${workspaceRoot}`);
                }

                // Execute impact analysis
                return await this.executeImpactAnalysis(filePath, workspaceRoot, changeType, this.extensionContext);
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

    /** Execute ping logic directly (used by test command) */
    public async executePing(): Promise<{ envelope: any }> {
        const envelope = { dataForAI: 'pong', bridgeMessage: { type: 'ui:showPanel', payload: { panel: 'dependencyGraph' }, metadata: { correlationId: `ping-${Date.now()}`, timestamp: Date.now(), priority: 'high' } } };
        this.sendBridgeMessage(envelope.bridgeMessage as BridgeMessage);
        return { envelope };
    }

    /** Initialize bridge client (IPC) */
    private initBridgeClient() {
        const socketPath = process.env.BRIDGE_SOCKET_PATH;
        const authToken = process.env.BRIDGE_AUTH_TOKEN;
        if (!socketPath || !authToken) {
            console.error('[Bridge][Client] Missing socket path or auth token; bridge disabled');
            return;
        }
        this.bridgeAuthToken = authToken;
        const connect = () => {
            try {
                this.bridgeSocket = net.createConnection(socketPath, () => {
                    console.error('[Bridge][Client] Connected');
                    // auth
                    this.bridgeSocket?.write(JSON.stringify({ type: 'auth', token: authToken }) + '\n');
                    this.bridgeReady = true;
                });
                this.bridgeSocket.on('error', (e) => {
                    console.error('[Bridge][Client] Error', e.message);
                    this.bridgeReady = false;
                    this.scheduleReconnect();
                });
                this.bridgeSocket.on('close', () => {
                    console.error('[Bridge][Client] Closed');
                    this.bridgeReady = false;
                    this.scheduleReconnect();
                });
            } catch (e: any) {
                console.error('[Bridge][Client] Connect exception', e.message);
                this.scheduleReconnect();
            }
        };
        connect();
    }

    private scheduleReconnect() {
        if (this.bridgeConnectTimer) {
            return;
        }
        this.bridgeConnectTimer = setTimeout(() => {
            this.bridgeConnectTimer = null;
            this.initBridgeClient();
        }, 1500);
    }

    private sendBridgeMessage(msg: BridgeMessage | null | undefined) {
        if (!msg || !this.bridgeReady || !this.bridgeSocket) {
            return;
        }
        try {
            this.bridgeSocket.write(JSON.stringify(msg) + '\n');
        } catch {
            /* ignore */
        }
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
     * Execute scan using GraphService with caching support
     * Works in both extension and standalone modes
     */
    private async executeScanWithGraphService(targetPath: string = '.', extensionContext: any): Promise<any> {
        try {
            // Extension context is optional - GraphService handles both extension and standalone modes

            // Get workspace root and validate it exists
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {
                throw new Error('No workspace folder open - cannot perform scan');
            }

            // Validate and secure target path to prevent directory traversal attacks
            const resolvedTargetPath = path.resolve(workspaceRoot, targetPath);
            if (!resolvedTargetPath.startsWith(workspaceRoot)) {
                throw new Error('Target path must be within workspace bounds - directory traversal not allowed');
            }

            console.error(`[SCAN DEBUG] Workspace root: ${workspaceRoot}`);
            console.error(`[SCAN DEBUG] Target path: ${resolvedTargetPath}`);

            // Use GraphService to load graph (with caching)
            const graphService = GraphService.getInstance();
            const graph = await graphService.loadGraph(workspaceRoot, targetPath, extensionContext);

            console.error(`[SCAN COMPLETE] Loaded graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
            
            // Count reverse-dependency index entries
            let indexSize = 0;
            const allNodes = graph.nodes.map(n => n.id);
            for (const nodeId of allNodes) {
                const dependents = graphService.getDependentsOf(nodeId);
                if (dependents.length > 0) {
                    indexSize++;
                }
            }
            console.error(`[SCAN COMPLETE] Reverse-dependency index built for ${indexSize} files`);

            return {
                content: [{
                    type: 'text' as const,
                    text: `Scan completed successfully. Graph loaded with ${graph.nodes.length} nodes and ${graph.edges.length} edges. Reverse-dependency index built for ${indexSize} files. Results cached for future use.`
                }]
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[SCAN ERROR]', errorMessage);
            throw new Error(`Scan failed: ${errorMessage}`);
        }
    }



    /**
     * Execute graph summary with smart cache logic
     * Works in both extension and standalone modes
     */
    private async executeGetGraphSummary(
        workspaceRoot: string, 
        forceRefresh: boolean, 
        extensionContext: any
    ): Promise<any> {
        const startTime = Date.now();
        let cacheUsed = false;
        let graph: any;

        try {
            // Validate inputs
            if (!workspaceRoot || typeof workspaceRoot !== 'string') {
                throw new Error('Invalid workspace root provided');
            }

            // Extension context is optional - GraphService will handle both modes
            console.error(`[SUMMARY] Extension context available: ${!!extensionContext}`);
            console.error(`[SUMMARY] Starting graph summary (forceRefresh: ${forceRefresh})`);
            console.error(`[SUMMARY] Workspace: ${workspaceRoot}`);

            if (!forceRefresh) {
                // Try cache first
                console.error('[SUMMARY] Checking cache validity');
                try {
                    const validation = await GraphCache.validateCache(workspaceRoot);
                    
                    if (validation.isValid) {
                        console.error('[SUMMARY] Cache is valid, attempting to load');
                        const cachedGraph = await GraphCache.load(workspaceRoot);
                        if (cachedGraph) {
                            console.error('[SUMMARY] Successfully loaded cached graph data');
                            graph = cachedGraph;
                            cacheUsed = true;
                        } else {
                            // Cache validation passed but load failed - fall back to scan
                            console.error('[SUMMARY] Cache load failed despite valid cache, performing fresh scan');
                            graph = await this.performFreshScan(workspaceRoot, extensionContext);
                        }
                    } else {
                        console.error(`[SUMMARY] Cache invalid: ${validation.reason}`);
                        graph = await this.performFreshScan(workspaceRoot, extensionContext);
                    }
                } catch (cacheError) {
                    const cacheErrorMessage = cacheError instanceof Error ? cacheError.message : String(cacheError);
                    console.error(`[SUMMARY] Cache operation failed: ${cacheErrorMessage}`);
                    console.error('[SUMMARY] Falling back to fresh scan');
                    graph = await this.performFreshScan(workspaceRoot, extensionContext);
                }
            } else {
                console.error('[SUMMARY] Force refresh requested, skipping cache');
                graph = await this.performFreshScan(workspaceRoot, extensionContext);
            }

            // Validate graph data
            if (!graph || !graph.nodes || !graph.edges) {
                throw new Error('Invalid graph data received - missing nodes or edges');
            }

            console.error(`[SUMMARY] Graph loaded: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

            // Check for very large graphs and warn
            if (graph.nodes.length > 5000) {
                console.error(`[SUMMARY] Large graph detected (${graph.nodes.length} nodes) - some analysis may be limited for performance`);
            }

            // Generate summary with timeout protection
            const scanDurationMs = Date.now() - startTime;
            console.error('[SUMMARY] Generating summary with insights');
            
            const summaryStartTime = Date.now();
            const summary = SummaryGenerator.generate(graph, scanDurationMs, cacheUsed);
            const summaryDuration = Date.now() - summaryStartTime;
            
            console.error(`[SUMMARY] Summary generation took ${summaryDuration}ms`);

            console.error(`[SUMMARY COMPLETE] Generated summary in ${scanDurationMs}ms (cache: ${cacheUsed})`);
            console.error(`[SUMMARY COMPLETE] Summary length: ${summary.summary.length} chars`);
            console.error(`[SUMMARY COMPLETE] Insights: ${summary.insights.topHubs.length} hubs, ${summary.insights.circularDependencies.length} cycles, ${summary.insights.orphanFiles.length} orphans`);

            // Dual payload response (FR2/FR3) with placeholder visualInstruction
            const dualPayload: DualToolResponse<typeof summary> = {
                dataForAI: summary,
                visualInstruction: {
                    action: 'placeholderOverlay',
                    payload: { note: 'placeholder', summarySize: summary.summary.length },
                    ts: Date.now()
                }
            };

            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(dualPayload)
                }]
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            
            console.error('[SUMMARY ERROR]', errorMessage);
            if (errorStack) {
                console.error('[SUMMARY ERROR STACK]', errorStack);
            }

            // Provide user-friendly error messages for common issues
            let userFriendlyMessage = errorMessage;
            if (errorMessage.includes('No workspace folder open')) {
                userFriendlyMessage = 'Please open a workspace folder in VS Code to generate a graph summary.';
            } else if (errorMessage.includes('Extension context')) {
                userFriendlyMessage = 'Graph summary functionality requires VS Code extension context.';
            } else if (errorMessage.includes('Worker thread')) {
                userFriendlyMessage = 'Failed to analyze project dependencies. Please check that the project contains valid source files.';
            } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
                userFriendlyMessage = 'Permission denied accessing project files. Please check file permissions.';
            } else if (errorMessage.includes('dependency-cruiser')) {
                userFriendlyMessage = 'Failed to analyze project dependencies. The project structure may not be supported.';
            }

            throw new Error(`Graph summary failed: ${userFriendlyMessage}`);
        }
    }

    /**
     * Perform fresh scan using GraphService with enhanced error handling
     */
    private async performFreshScan(workspaceRoot: string, extensionContext: any): Promise<any> {
        try {
            console.error('[SUMMARY] Starting fresh dependency scan');
            const graphService = GraphService.getInstance();
            const graph = await graphService.loadGraph(workspaceRoot, '.', extensionContext);
            
            if (!graph) {
                throw new Error('GraphService returned null graph');
            }
            
            console.error(`[SUMMARY] Fresh scan completed: ${graph.nodes?.length || 0} nodes, ${graph.edges?.length || 0} edges`);
            return graph;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[SUMMARY] Fresh scan failed: ${errorMessage}`);
            
            // Re-throw with more context
            throw new Error(`Failed to perform fresh dependency scan: ${errorMessage}`);
        }
    }

    /**
     * Execute health report with dual-view response structure
     * Works in both extension and standalone modes
     */
    private async executeHealthReport(
        workspaceRoot: string,
        forceRefresh: boolean,
        extensionContext: any
    ): Promise<any> {
        try {
            console.error(`[HEALTH_REPORT] Starting health report analysis`);
            console.error(`[HEALTH_REPORT] Workspace: ${workspaceRoot}`);
            console.error(`[HEALTH_REPORT] Force refresh: ${forceRefresh}`);

            // Execute health report using the tool function
            const healthReportResponse = await executeHealthReport(workspaceRoot, forceRefresh, extensionContext);
            
            // Generate summary text for AI consumption
            const summaryText = generateHealthSummary(healthReportResponse.dataForAI);
            
            console.error(`[HEALTH_REPORT] Generated health report with ${healthReportResponse.dataForAI.totalFiles} files analyzed`);
            console.error(`[HEALTH_REPORT] Health score: ${healthReportResponse.dataForAI.healthScore}/100`);
            console.error(`[HEALTH_REPORT] Visual instruction generated for dual-view rendering`);

            // Create the response structure
            const responseData = {
                // Summary for AI reasoning
                summary: summaryText,
                // Dashboard data for dashboard view
                dashboardData: {
                    healthScore: healthReportResponse.dataForAI.healthScore,
                    distribution: healthReportResponse.dataForAI.distribution,
                    topRisks: healthReportResponse.dataForAI.topRisks,
                    recommendations: healthReportResponse.dataForAI.recommendations,
                    totalFiles: healthReportResponse.dataForAI.totalFiles
                },
                // Visual instruction for webview routing
                visualInstruction: healthReportResponse.visualInstruction
            };

            const responseText = JSON.stringify(responseData);

            // Route visual instruction if we have a provider instance
            if (this.providerInstance && healthReportResponse.visualInstruction) {
                console.error(`[HEALTH_REPORT] Routing visual instruction: ${healthReportResponse.visualInstruction.action}`);
                try {
                    // Create a dual response structure for routing
                    const dualResponse = JSON.stringify({
                        dataForAI: healthReportResponse.dataForAI,
                        visualInstruction: healthReportResponse.visualInstruction
                    });
                    this.providerInstance.handleToolResult(dualResponse);
                } catch (routingError) {
                    console.error(`[HEALTH_REPORT] Visual instruction routing failed: ${routingError instanceof Error ? routingError.message : String(routingError)}`);
                }
            }

            // Return dual payload response structure
            return {
                content: [{
                    type: 'text' as const,
                    text: responseText
                }]
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[HEALTH_REPORT ERROR]', errorMessage);
            
            // Provide user-friendly error messages
            let userFriendlyMessage = errorMessage;
            if (errorMessage.includes('No workspace folder open')) {
                userFriendlyMessage = 'Please open a workspace folder in VS Code to generate a health report.';
            } else if (errorMessage.includes('Failed to load graph data')) {
                userFriendlyMessage = 'Unable to analyze project structure. Please scan the project first using the "Scan Project" command.';
            } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
                userFriendlyMessage = 'Permission denied accessing project files. Please check file permissions.';
            }

            throw new Error(`Health report failed: ${userFriendlyMessage}`);
        }
    }

    /**
     * Execute impact analysis for a specific file
     * Works in both extension and standalone modes
     */
    private async executeImpactAnalysis(
        filePath: string,
        workspaceRoot: string,
        changeType: string | undefined,
        extensionContext: any
    ): Promise<any> {
        try {
            console.error(`[IMPACT_ANALYSIS] action=start file=${filePath}`);
            console.error(`[IMPACT_ANALYSIS] action=context workspace=${workspaceRoot} changeType=${changeType || 'not_specified'}`);

            // Ensure we have graph data available
            const graphService = GraphService.getInstance();
            let graph = graphService.getGraph();

            if (!graph) {
                console.error('[IMPACT_ANALYSIS] action=loadGraph reason=notCached');
                graph = await graphService.loadGraph(workspaceRoot, '.', extensionContext);
            }

            if (!graph) {
                throw new Error('Failed to load graph data for impact analysis');
            }

            console.error(`[IMPACT_ANALYSIS] action=graphReady nodes=${graph.nodes.length} edges=${graph.edges.length}`);

            // Perform impact analysis
            const result = await ImpactAnalyzerService.analyze(graph, filePath, workspaceRoot, changeType);

            // Check if result is an error response
            if ('errorCode' in result) {
                console.error(`[IMPACT_ANALYSIS] Analysis failed: ${result.error}`);
                throw new Error(result.error);
            }

            console.error(`[IMPACT_ANALYSIS] action=analysisComplete`);
            console.error(`[IMPACT_ANALYSIS] action=counts dependents=${result.dependents.length} dependencies=${result.dependencies.length}`);
            console.error(`[IMPACT_ANALYSIS] action=pathResolution type=${result.pathResolution.fuzzyMatched ? 'fuzzy' : 'exact'}`);
            const correlationId = `impact-${Date.now()}`;
            console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} summary dependents=${result.dependents.length} dependencies=${result.dependencies.length}`);
            // Trigger graph panel open via provider (MVP visual reaction) BEFORE responding
            try {
                if (this.providerInstance && typeof this.providerInstance.triggerGraphPanelOpen === 'function') {
                    console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=triggerPanelOpen`);
                    this.providerInstance.triggerGraphPanelOpen();
                } else {
                    console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=triggerPanelOpen status=providerUnavailable`);
                }
            } catch (triggerErr) {
                console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=triggerPanelOpen status=error error=${triggerErr instanceof Error ? triggerErr.message : String(triggerErr)}`);
            }

            // Simplified response per PRD: only key summary fields
            const simplified = {
                impactSummary: result.impactSummary,
                dependentCount: result.dependents.length,
                dependencyCount: result.dependencies.length,
                dependents: result.dependents,
                dependencies: result.dependencies,
                pathResolution: result.pathResolution
            };
            // Bridge message for UI auto-open (parity with ping tool) to ensure panel opens even if provider trigger failed
            const bridgeEnvelope = { bridgeMessage: { type: 'ui:showPanel', payload: { panel: 'dependencyGraph' }, metadata: { correlationId, timestamp: Date.now(), priority: 'high' } }, dataForAI: simplified };
            // Attempt out-of-band send via bridge socket
            this.sendBridgeMessage(bridgeEnvelope.bridgeMessage as BridgeMessage);
            // Dispatch focus message via provider helper (non-blocking)
            try {
                const resolvedTarget = result.pathResolution.resolvedPath;
                if (resolvedTarget && this.providerInstance && typeof this.providerInstance.sendGraphSetFocus === 'function') {
                    console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=dispatchFocus target=${resolvedTarget}`);
                    this.providerInstance.sendGraphSetFocus(resolvedTarget, correlationId);
                } else if (!resolvedTarget) {
                    console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=dispatchFocus status=skip reason=unresolvedPath`);
                } else {
                    console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=dispatchFocus status=skip reason=providerUnavailable`);
                }
            } catch (focusErr) {
                console.error(`[IMPACT_ANALYSIS] correlationId=${correlationId} action=dispatchFocus status=error error=${focusErr instanceof Error ? focusErr.message : String(focusErr)}`);
            }
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(bridgeEnvelope)
                }]
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[IMPACT_ANALYSIS ERROR]', errorMessage);

            // Provide user-friendly error messages
            let userFriendlyMessage = errorMessage;
            if (errorMessage.includes('No workspace folder open')) {
                userFriendlyMessage = 'Please open a workspace folder in VS Code to perform impact analysis.';
            } else if (errorMessage.includes('Failed to load graph data')) {
                userFriendlyMessage = 'Unable to analyze project structure. Please scan the project first using the "Scan Project" command.';
            } else if (errorMessage.includes('filePath parameter is required')) {
                userFriendlyMessage = 'A file path is required to perform impact analysis.';
            } else if (errorMessage.includes('File not found')) {
                userFriendlyMessage = 'The specified file was not found in the project. Please check the file path.';
            } else if (errorMessage.includes('Permission denied') || errorMessage.includes('EACCES')) {
                userFriendlyMessage = 'Permission denied accessing project files. Please check file permissions.';
            }

            throw new Error(`Impact analysis failed: ${userFriendlyMessage}`);
        }
    }

    /**
     * Set the provider instance for visual instruction routing
     */
    setProviderInstance(provider: any): void {
        this.providerInstance = provider;
    }

    /**
     * Public method to scan project (called directly from extension)
     * Works in both extension and standalone modes
     */
    async scanProject(targetPath: string = '.', extensionContext?: any): Promise<void> {
        try {
            // Extension context is optional - GraphService handles both extension and standalone modes
            await this.executeScanWithGraphService(targetPath, extensionContext);
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