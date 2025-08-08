#!/usr/bin/env node

/**
 * Simple test script for the MCP server POST /query endpoint
 * Run this after starting the VS Code extension in development mode
 */

import http from 'http';

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

    // Basic validation tests
    const validationTests = [
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

    console.log('📋 Running validation tests...\n');

    for (const test of validationTests) {
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
        console.log('---\n');
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        console.log('---\n');
    }

    // Query processing and filtering tests
    console.log('🔍 Running query processing tests...\n');

    const queryTests = [
        {
            name: 'Case-insensitive matching (uppercase)',
            query: 'TEST',
            description: 'Should find files containing "test" regardless of case'
        },
        {
            name: 'Case-insensitive matching (mixed case)',
            query: 'TeSt',
            description: 'Should find files containing "test" regardless of case'
        },
        {
            name: 'File extension matching',
            query: '.js',
            description: 'Should find all JavaScript files'
        },
        {
            name: 'File extension matching (TypeScript)',
            query: '.ts',
            description: 'Should find all TypeScript files'
        },
        {
            name: 'Partial path matching',
            query: 'src',
            description: 'Should find files in src directory'
        },
        {
            name: 'Partial filename matching',
            query: 'mcp',
            description: 'Should find files with "mcp" in the name'
        },
        {
            name: 'Common directory name',
            query: 'test',
            description: 'Should find test-related files'
        },
        {
            name: 'Non-existent term',
            query: 'nonexistentfile12345',
            description: 'Should return empty results for non-matching terms'
        },
        {
            name: 'Single character search',
            query: 'a',
            description: 'Should find files containing the letter "a"'
        },
        {
            name: 'Special characters in search',
            query: '-',
            description: 'Should find files with hyphens in names'
        }
    ];

    for (const test of queryTests) {
        try {
            console.log(`Testing: ${test.name}`);
            console.log(`Query: "${test.query}"`);
            console.log(`Expected: ${test.description}`);

            const response = await makeRequest('/query', 'POST', { query: test.query });

            if (response.status === 200) {
                const responseData = JSON.parse(response.body);
                console.log(`✅ Status: ${response.status}`);
                console.log(`📊 Results: ${responseData.total} matches found`);

                if (responseData.matches.length > 0) {
                    console.log('📁 Matching files:');
                    responseData.matches.forEach((match, index) => {
                        console.log(`   ${index + 1}. ${match}`);
                    });
                } else {
                    console.log('📁 No matching files found');
                }

                // Verify response structure
                if (typeof responseData.total === 'number' &&
                    Array.isArray(responseData.matches) &&
                    responseData.timestamp) {
                    console.log('✅ Response structure is valid');
                } else {
                    console.log('❌ Invalid response structure');
                }
            } else {
                console.log(`❌ Unexpected status: ${response.status}`);
                console.log('Response:', response.body);
            }

            console.log('---\n');
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            console.log('---\n');
        }
    }

    // Performance test with longer query
    console.log('⚡ Running performance test...\n');
    try {
        console.log('Testing: Performance with longer search term');
        const startTime = Date.now();
        const response = await makeRequest('/query', 'POST', {
            query: 'verylongquerythatprobablywontmatchanything'
        });
        const endTime = Date.now();

        if (response.status === 200) {
            const responseData = JSON.parse(response.body);
            console.log(`✅ Status: ${response.status}`);
            console.log(`⏱️  Response time: ${endTime - startTime}ms`);
            console.log(`📊 Results: ${responseData.total} matches found`);
        }
        console.log('---\n');
    } catch (error) {
        console.log(`❌ Performance test error: ${error.message}`);
        console.log('---\n');
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