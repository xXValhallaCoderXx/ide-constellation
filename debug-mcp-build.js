#!/usr/bin/env node

console.log('Debugging MCP server build...');

// Try to require the compiled server
try {
    const mcpServer = require('./out/mcp-server.js');
    console.log('✅ MCP server loaded successfully');
    console.log('Exported keys:', Object.keys(mcpServer));
    
    // Try to find the server class
    if (mcpServer.MCPStdioServer) {
        console.log('✅ MCPStdioServer class found');
        const server = new mcpServer.MCPStdioServer();
        console.log('✅ Server instance created');
    } else {
        console.log('❌ MCPStdioServer class not found');
    }
} catch (error) {
    console.error('❌ Error loading MCP server:', error.message);
}

// Check file stats
const fs = require('fs');
const stats = fs.statSync('./out/mcp-server.js');
console.log(`File size: ${stats.size} bytes`);
console.log(`Last modified: ${stats.mtime}`);

// Check first few lines
const content = fs.readFileSync('./out/mcp-server.js', 'utf8');
const lines = content.split('\n').slice(0, 10);
console.log('First 10 lines:');
lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));

// Search for key strings
const hasConstellation = content.includes('constellation');
const hasMCP = content.includes('MCP');
const hasServer = content.includes('Server');
console.log(`Contains 'constellation': ${hasConstellation}`);
console.log(`Contains 'MCP': ${hasMCP}`);
console.log(`Contains 'Server': ${hasServer}`);