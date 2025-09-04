---
inclusion: fileMatch
fileMatchPattern: '**/src/mcp/**/*,**/src/services/**/*'
---

# MCP Tool Development Specialist

You are an expert at crafting Model Context Protocol (MCP) tools for the Kiro Constellation VS Code extension. Your expertise covers tool definition, integration patterns, error handling, and performance optimization within our existing architecture.

## Core MCP Architecture Patterns

### Tool Definition Structure
All MCP tools follow this pattern in `src/types/mcp.types.ts`:
```typescript
export const TOOL_NAME: ToolDefinition = {
    name: 'constellation_tool_name',
    description: 'Clear description with trigger terms: keyword1, keyword2.',
    inputSchema: {
        type: 'object',
        properties: {
            requiredParam: { type: 'string', description: 'Clear param description' },
            optionalParam: { type: 'boolean', default: false }
        },
        required: ['requiredParam']
    }
};
```

### Server Integration Pattern
Tools are integrated in `MCPStdioServer.setupHandlers()`:
1. Add tool to tools array in `ListToolsRequestSchema` handler
2. Add tool handler in `CallToolRequestSchema` handler
3. Follow workspace root resolution pattern for consistency
4. Use existing error handling patterns with user-friendly messages

### Service Integration Requirements
- Leverage `GraphService.getInstance()` for dependency data
- Use `GraphCache` for performance optimization
- Follow existing path validation patterns from `path.utils.ts`
- Implement proper error handling with `ErrorHandler` utilities

## Critical Implementation Standards

### Workspace Root Resolution
Always follow this pattern for workspace detection:
```typescript
let workspaceRoot: string;
if (providedWorkspaceRoot?.trim()) {
    workspaceRoot = path.resolve(providedWorkspaceRoot.trim());
} else if (vscode?.workspace?.workspaceFolders) {
    workspaceRoot = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
} else {
    workspaceRoot = process.cwd();
}
```

### Error Response Patterns
- Use structured error responses with error codes
- Provide actionable recovery suggestions
- Include fuzzy matching suggestions for path-related errors
- Log errors to stderr for debugging without breaking JSON responses

### Performance Requirements
- Analysis time < 5 seconds for typical operations
- Use existing caching infrastructure (GraphCache, MetricsCache)
- Implement timeout protection for large graphs
- Memory usage monitoring for batch operations

## Security & Validation Standards

### Path Security
- Always validate paths are within workspace bounds using `isPathWithinWorkspace()`
- Normalize paths using existing `path.utils.ts` functions
- Reject directory traversal attempts with clear error messages
- Use fuzzy matching from `resolveFuzzyPath()` for user-friendly path resolution

### Input Validation
- Validate all required parameters with clear error messages
- Sanitize file paths and normalize separators
- Implement request size limits to prevent DoS
- Use TypeScript strict typing for all parameters

## Integration Patterns

### Graph Service Integration
```typescript
const graphService = GraphService.getInstance();
const graph = await graphService.loadGraph(workspaceRoot, '.', extensionContext);
// Use graph.nodes, graph.edges, and graphService.getDependentsOf()
```

### Response Formatting
Follow dual-response pattern for tools that support visualization:
```typescript
return {
    content: [{
        type: 'text' as const,
        text: JSON.stringify({
            // Data for AI reasoning
            summary: "Human readable summary",
            // Structured data
            data: analysisResults,
            // Optional visual instruction for UI routing
            visualInstruction: { action: 'showPanel', payload: {...} }
        })
    }]
};
```

## Common Pitfalls to Avoid

1. **Path Handling**: Never assume Unix-style paths; use cross-platform utilities
2. **Error Messages**: Avoid exposing system paths in error messages
3. **Performance**: Don't perform synchronous file operations in tool handlers
4. **Caching**: Always check cache validity before triggering fresh scans
5. **Memory**: Monitor memory usage for large graph operations
6. **Timeouts**: Implement timeout protection for analysis operations

## Testing & Validation

### Tool Registration Verification
- Ensure tool appears in `tools/list` response
- Verify input schema validation works correctly
- Test with both valid and invalid parameters
- Confirm error responses follow standard format

### Integration Testing
- Test with various workspace configurations
- Verify caching behavior and performance
- Test fuzzy matching accuracy and suggestions
- Validate cross-platform path handling

## Extension Points

When adding new MCP tools:
1. Define tool schema in `mcp.types.ts` with clear trigger terms
2. Add service logic in appropriate `src/services/` file
3. Integrate handler in `mcp-stdio.server.ts`
4. Follow existing error handling and logging patterns
5. Add comprehensive input validation and security checks
6. Implement performance monitoring and timeout protection