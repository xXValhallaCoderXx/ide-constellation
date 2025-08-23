#!/usr/bin/env node

console.log('Testing imports...');

try {
    // Test if we can import the types
    const types = require('./src/types/mcp.types.ts');
    console.log('Types imported:', Object.keys(types));
} catch (error) {
    console.error('Error importing types:', error.message);
}

// Try with TypeScript compilation
const { execSync } = require('child_process');
try {
    execSync('npx tsc src/types/mcp.types.ts --outDir temp --target es2020', { stdio: 'inherit' });
    const compiledTypes = require('./temp/types/mcp.types.js');
    console.log('Compiled types:', Object.keys(compiledTypes));
} catch (error) {
    console.error('Error with TypeScript compilation:', error.message);
}