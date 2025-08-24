// Minimal MCP types/definitions used by this project

// Tool Definition Types
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}

// Tool Call Types
// Note: The server uses the SDK's request/response schemas directly and
// does not require local ToolCall types.

// Server Capabilities
// No additional server/client capability types required locally.







// Predefined Tools
export const CONSTELLATION_EXAMPLE_TOOL: ToolDefinition = {
    name: 'constellation_example_tool',
    description: 'Echo a text message back to the user. Trigger terms: echo, say, reply, speak, print, message.',
    inputSchema: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'Text to echo in the response (synonyms: echo, say, reply, message, text).',
                default: 'Hello from VS Code Standard MCP Provider POC'
            }
        },
        required: []
    }
};

// A minimal, deterministic tool for easy UI validation
export const CONSTELLATION_PING_TOOL: ToolDefinition = {
    name: 'constellation_ping',
    description: 'Connectivity/health check that returns "pong". Trigger terms: connectivity, health check, heartbeat, ping, status.',
    inputSchema: {
        type: 'object',
        properties: {},
        required: []
    }
};

// Smart summary tool for codebase analysis
export const CONSTELLATION_GET_GRAPH_SUMMARY_TOOL: ToolDefinition = {
    name: 'constellation_get_graph_summary',
    description: 'Get intelligent summary of codebase with architectural insights. Automatically uses cache or triggers refresh as needed. Trigger terms: summary, analyze, overview, insights, architecture, dependencies.',
    inputSchema: {
        type: 'object',
        properties: {
            forceRefresh: {
                type: 'boolean',
                description: 'Force a fresh scan instead of using cached data',
                default: false
            },
            workspaceRoot: {
                type: 'string',
                description: 'Path to the workspace root directory to analyze (defaults to current working directory)',
                default: ''
            }
        },
        required: []
    }
};

// Health report tool for dual-view health analysis
export const CONSTELLATION_HEALTH_REPORT_TOOL: ToolDefinition = {
    name: 'constellation_health_report',
    description: 'Generate comprehensive codebase health report with dual-view dashboard and heatmap visualization. Analyzes code complexity, git churn, and dependencies to identify risk areas. Trigger terms: health, report, risk, analysis, dashboard, heatmap.',
    inputSchema: {
        type: 'object',
        properties: {
            forceRefresh: {
                type: 'boolean',
                description: 'Force a fresh analysis instead of using cached data',
                default: false
            },
            workspaceRoot: {
                type: 'string',
                description: 'Path to the workspace root directory to analyze (defaults to current working directory)',
                default: ''
            }
        },
        required: []
    }
};