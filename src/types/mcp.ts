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