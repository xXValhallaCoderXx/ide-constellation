#!/usr/bin/env node

/**
 * Simple test script for the MCP server POST /query endpoint
 * Run this after starting the VS Code extension in development mode
 */

const http = require('http');

const SERVER_URL = 'http://127.0.0.1:6170';

function makeRequest(path, method, data) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runTests() {
    console.log('🧪 Testing MCP Server POST /query endpoint...\n');

    const tests = [
        {
            name: 'Valid query request',
            data: { query: 'test' },
            expectedStatus: 200
        },
        {
            name: 'Missing query parameter',
            data: {},
            expectedStatus: 400
        },
        {
            name: 'Invalid query type (number)',
            data: { query: 123 },
            expectedStatus: 400
        },
        {
            name: 'Empty query string',
            data: { query: '' },
            expectedStatus: 400
        },
        {
            name: 'Whitespace-only query',
            data: { query: '   ' },
            expectedStatus: 400
        }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing: ${test.name}`);
            const response = await makeRequest('/query', 'POST', test.data);

            const success = response.status === test.expectedStatus;
            const statusIcon = success ? '✅' : '❌';

            console.log(`${statusIcon} Status: ${response.status} (expected: ${test.expectedStatus})`);

            try {
                const responseData = JSON.parse(response.body);
                console.log('Response:', JSON.stringify(responseData, null, 2));
            } catch (e) {
                console.log('Response body:', response.body);
            }

            console.log('---\n');
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            console.log('---\n');
        }
    }

    // Test missing body
    try {
        console.log('Testing: Missing request body');
        const response = await makeRequest('/query', 'POST', null);
        console.log(`Status: ${response.status}`);
        console.log('Response:', response.body);
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

// Check if server is running first
async function checkServer() {
    console.log('🔍 Checking if MCP server is running on http://127.0.0.1:6170...');

    try {
        const response = await makeRequest('/query', 'POST', { query: 'test' });
        console.log('✅ Server is running and responding');
        console.log(`   Response status: ${response.status}`);
        return true;
    } catch (error) {
        console.log('❌ Server is not running or not responding.');
        console.log(`   Error: ${error.message}`);
        console.log('');
        console.log('📋 To start the server:');
        console.log('   1. Open the ide-constellation project in VS Code');
        console.log('   2. Press F5 to launch Extension Development Host');
        console.log('   3. Check the Debug Console for "MCP server started" message');
        console.log('   4. Run this test script again');
        return false;
    }
}

async function main() {
    const serverRunning = await checkServer();
    if (serverRunning) {
        await runTests();
    }
}

main().catch(console.error);