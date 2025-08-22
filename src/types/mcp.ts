// MCP (Model Context Protocol) Types and Interfaces

// JSON-RPC 2.0 base types
export interface MCPMessage {
    jsonrpc: '2.0';
    id?: string | number | null;
    method?: string;
    params?: any;
    result?: any;
    error?: MCPError;
}

export interface MCPRequest extends MCPMessage {
    method: string;
    params?: any;
    id: string | number | null;
}

export interface MCPResponse extends MCPMessage {
    id: string | number | null;
    result?: any;
    error?: MCPError;
}

export interface MCPNotification extends MCPMessage {
    method: string;
    params?: any;
}

export interface MCPError {
    code: number;
    message: string;
    data?: any;
}

// JSON-RPC Error Codes for MCP protocol compliance
export enum MCPErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603
}

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
export interface ToolCallParams {
    name: string;
    arguments?: Record<string, any>;
}

export interface ToolCallResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}

// Server Capabilities
export interface ServerCapabilities {
    experimental?: Record<string, any>;
    logging?: {};
    prompts?: {
        listChanged?: boolean;
    };
    resources?: {
        subscribe?: boolean;
        listChanged?: boolean;
    };
    tools?: {
        listChanged?: boolean;
    };
}

// Initialize Request/Response
export interface InitializeRequest extends MCPRequest {
    method: 'initialize';
    params: {
        protocolVersion: string;
        capabilities: ClientCapabilities;
        clientInfo: {
            name: string;
            version: string;
        };
    };
}

export interface InitializeResponse extends MCPResponse {
    result: {
        protocolVersion: string;
        capabilities: ServerCapabilities;
        serverInfo: {
            name: string;
            version: string;
        };
    };
}

export interface ClientCapabilities {
    experimental?: Record<string, any>;
    sampling?: {};
}

// Tools List Request/Response
export interface ToolsListRequest extends MCPRequest {
    method: 'tools/list';
    params?: {
        cursor?: string;
    };
}

export interface ToolsListResponse extends MCPResponse {
    result: {
        tools: ToolDefinition[];
        nextCursor?: string;
    };
}

// Tool Call Request/Response
export interface ToolCallRequest extends MCPRequest {
    method: 'tools/call';
    params: ToolCallParams;
}

export interface ToolCallResponse extends MCPResponse {
    result: ToolCallResult;
}

// Predefined Tools
export const CONSTELLATION_EXAMPLE_TOOL: ToolDefinition = {
    name: 'constellation_example_tool',
    description: 'A simple example tool for VS Code Standard MCP Provider POC testing',
    inputSchema: {
        type: 'object',
        properties: {
            message: {
                type: 'string',
                description: 'Optional message to include in the response',
                default: 'Hello from VS Code Standard MCP Provider POC'
            }
        },
        required: []
    }
};

// A minimal, deterministic tool for easy UI validation
export const CONSTELLATION_PING_TOOL: ToolDefinition = {
    name: 'constellation_ping',
    description: 'Returns a fixed pong response to validate the tool pipeline',
    inputSchema: {
        type: 'object',
        properties: {},
        required: []
    }
};