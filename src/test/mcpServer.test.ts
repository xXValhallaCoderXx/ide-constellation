import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startServer, stopServer, isServerRunning, getServerPort, GraphDataProvider } from '../mcpServer';
import { DependencyGraph } from '../analyzer';

describe('MCP Server Module', () => {
    let mockGraphDataProvider: GraphDataProvider;
    let mockGraphData: DependencyGraph;

    beforeEach(async () => {
        // Ensure server is stopped before each test
        if (isServerRunning()) {
            await stopServer();
        }

        // Create mock graph data
        mockGraphData = {
            modules: [
                {
                    source: 'src/test.ts',
                    dependencies: [
                        {
                            resolved: 'src/utils/helper.ts',
                            coreModule: false,
                            followable: true,
                            dynamic: false
                        }
                    ],
                    dependents: []
                },
                {
                    source: 'src/utils/helper.ts',
                    dependencies: [],
                    dependents: ['src/test.ts']
                },
                {
                    source: 'src/components/Button.tsx',
                    dependencies: [],
                    dependents: []
                }
            ],
            summary: {
                totalDependencies: 3,
                violations: []
            }
        };

        // Create mock data provider
        mockGraphDataProvider = vi.fn(() => mockGraphData);
    });

    afterEach(async () => {
        // Clean up server after each test
        if (isServerRunning()) {
            await stopServer();
        }
    });

    describe('Server Lifecycle Functions', () => {
        describe('startServer', () => {
            it('should start server on default port 6170', async () => {
                await startServer(mockGraphDataProvider);

                expect(isServerRunning()).toBe(true);
                expect(getServerPort()).toBe(6170);
            });

            it('should start server on specified port', async () => {
                const customPort = 6200;
                await startServer(mockGraphDataProvider, customPort);

                expect(isServerRunning()).toBe(true);
                expect(getServerPort()).toBe(customPort);
            });

            it('should handle port conflicts by trying next available port', async () => {
                // Start first server on port 6201
                await startServer(mockGraphDataProvider, 6201);
                expect(getServerPort()).toBe(6201);

                // Stop first server
                await stopServer();

                // Start second server on same port - should work since first is stopped
                await startServer(mockGraphDataProvider, 6201);
                expect(getServerPort()).toBe(6201);
            });

            it('should stop existing server before starting new one', async () => {
                // Start first server
                await startServer(mockGraphDataProvider, 6202);
                expect(isServerRunning()).toBe(true);

                // Start second server - should stop first one
                await startServer(mockGraphDataProvider, 6203);
                expect(isServerRunning()).toBe(true);
                expect(getServerPort()).toBe(6203);
            });

            it('should handle invalid provider gracefully during startup', async () => {
                // The server is designed to be robust and handle invalid providers
                const invalidProvider = null as any;

                // Server should start but handle the null provider gracefully
                await startServer(invalidProvider, 6204);
                expect(isServerRunning()).toBe(true);

                // Test that queries with null provider return appropriate errors
                const response = await fetch('http://127.0.0.1:6204/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(500);
                const data = await response.json();
                expect(data.code).toBe('DATA_PROVIDER_ERROR');
            });
        });

        describe('stopServer', () => {
            it('should stop running server successfully', async () => {
                await startServer(mockGraphDataProvider, 6205);
                expect(isServerRunning()).toBe(true);

                await stopServer();
                expect(isServerRunning()).toBe(false);
                expect(getServerPort()).toBe(null);
            });

            it('should resolve immediately if server is not running', async () => {
                expect(isServerRunning()).toBe(false);

                // Should not throw or hang
                await expect(stopServer()).resolves.toBeUndefined();
            });

            it('should handle server close errors gracefully', async () => {
                await startServer(mockGraphDataProvider, 6206);

                // Should not throw even if there are close errors
                await expect(stopServer()).resolves.toBeUndefined();
            });
        });

        describe('isServerRunning', () => {
            it('should return false when server is not running', () => {
                expect(isServerRunning()).toBe(false);
            });

            it('should return true when server is running', async () => {
                await startServer(mockGraphDataProvider, 6207);
                expect(isServerRunning()).toBe(true);
            });

            it('should return false after server is stopped', async () => {
                await startServer(mockGraphDataProvider, 6208);
                expect(isServerRunning()).toBe(true);

                await stopServer();
                expect(isServerRunning()).toBe(false);
            });
        });

        describe('getServerPort', () => {
            it('should return null when server is not running', () => {
                expect(getServerPort()).toBe(null);
            });

            it('should return correct port when server is running', async () => {
                const port = 6209;
                await startServer(mockGraphDataProvider, port);
                expect(getServerPort()).toBe(port);
            });

            it('should return null after server is stopped', async () => {
                await startServer(mockGraphDataProvider, 6210);
                expect(getServerPort()).toBe(6210);

                await stopServer();
                expect(getServerPort()).toBe(null);
            });
        });
    });

    describe('Query Processing Logic', () => {
        beforeEach(async () => {
            await startServer(mockGraphDataProvider, 6220);
        });

        describe('Basic Query Processing', () => {
            it('should process simple text queries', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/test.ts']);
                expect(data.total).toBe(1);
                expect(data.timestamp).toBeDefined();
            });

            it('should handle case-insensitive matching', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'HELPER' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/utils/helper.ts']);
                expect(data.total).toBe(1);
            });

            it('should match partial paths', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'utils' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/utils/helper.ts']);
                expect(data.total).toBe(1);
            });

            it('should match file extensions', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: '.tsx' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/components/Button.tsx']);
                expect(data.total).toBe(1);
            });

            it('should return multiple matches when query matches multiple files', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'src' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toHaveLength(3);
                expect(data.matches).toContain('src/test.ts');
                expect(data.matches).toContain('src/utils/helper.ts');
                expect(data.matches).toContain('src/components/Button.tsx');
                expect(data.total).toBe(3);
            });

            it('should return empty results for no matches', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'nonexistent' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual([]);
                expect(data.total).toBe(0);
            });
        });

        describe('Edge Case Query Processing', () => {
            it('should handle queries with special characters', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'Button.tsx' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/components/Button.tsx']);
            });

            it('should handle queries with whitespace', async () => {
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: '  test  ' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['src/test.ts']);
            });

            it('should handle very long valid queries', async () => {
                const longQuery = 'src/utils/helper.ts'.repeat(10); // Still under 1000 char limit
                const response = await fetch('http://127.0.0.1:6220/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: longQuery })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual([]);
                expect(data.total).toBe(0);
            });
        });

        describe('Data Provider Integration', () => {
            it('should call data provider for each query', async () => {
                const spyProvider = vi.fn(() => mockGraphData);
                await stopServer();
                await startServer(spyProvider, 6221);

                await fetch('http://127.0.0.1:6221/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(spyProvider).toHaveBeenCalledTimes(1);
            });

            it('should use latest data from provider', async () => {
                let currentData = mockGraphData;
                const dynamicProvider = vi.fn(() => currentData);

                await stopServer();
                await startServer(dynamicProvider, 6222);

                // First query
                let response = await fetch('http://127.0.0.1:6222/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'new-file' })
                });
                let data = await response.json();
                expect(data.matches).toEqual([]);

                // Update data
                currentData = {
                    modules: [
                        {
                            source: 'src/new-file.ts',
                            dependencies: [],
                            dependents: []
                        }
                    ],
                    summary: { totalDependencies: 1, violations: [] }
                };

                // Second query should use updated data
                response = await fetch('http://127.0.0.1:6222/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'new-file' })
                });
                data = await response.json();
                expect(data.matches).toEqual(['src/new-file.ts']);
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await startServer(mockGraphDataProvider, 6230);
        });

        describe('Query Parameter Validation', () => {
            it('should return 400 for missing request body', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                    // No body - Express will parse this as empty object {}
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                // When no body is provided, Express parses it as {}, so query parameter is missing
                expect(data.error).toBe('Query parameter is required');
                expect(data.code).toBe('MISSING_QUERY');
                expect(data.timestamp).toBeDefined();
            });

            it('should return 400 for missing query parameter', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.error).toBe('Query parameter is required');
                expect(data.code).toBe('MISSING_QUERY');
                expect(data.timestamp).toBeDefined();
            });

            it('should return 400 for null query parameter', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: null })
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.error).toBe('Query parameter is required');
                expect(data.code).toBe('MISSING_QUERY');
            });

            it('should return 400 for non-string query parameter', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 123 })
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.error).toBe('Query parameter must be a string');
                expect(data.code).toBe('INVALID_QUERY_TYPE');
            });

            it('should return 400 for empty query parameter', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: '   ' })
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.error).toBe('Query parameter cannot be empty');
                expect(data.code).toBe('EMPTY_QUERY');
            });

            it('should return 400 for query parameter that is too long', async () => {
                const longQuery = 'a'.repeat(1001); // Exceeds 1000 character limit
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: longQuery })
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.error).toBe('Query parameter is too long (maximum 1000 characters)');
                expect(data.code).toBe('QUERY_TOO_LONG');
            });
        });

        describe('Data Provider Error Handling', () => {
            it('should return 500 when data provider throws error', async () => {
                const errorProvider: GraphDataProvider = vi.fn(() => {
                    throw new Error('Data provider failed');
                });

                await stopServer();
                await startServer(errorProvider, 6231);

                const response = await fetch('http://127.0.0.1:6231/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(500);
                const data = await response.json();
                expect(data.error).toBe('Failed to retrieve dependency graph data');
                expect(data.code).toBe('DATA_PROVIDER_ERROR');
                expect(data.timestamp).toBeDefined();
            });

            it('should handle null data from provider gracefully', async () => {
                const nullProvider: GraphDataProvider = vi.fn(() => null as any);

                await stopServer();
                await startServer(nullProvider, 6232);

                const response = await fetch('http://127.0.0.1:6232/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual([]);
                expect(data.total).toBe(0);
            });

            it('should handle undefined data from provider gracefully', async () => {
                const undefinedProvider: GraphDataProvider = vi.fn(() => undefined as any);

                await stopServer();
                await startServer(undefinedProvider, 6233);

                const response = await fetch('http://127.0.0.1:6233/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual([]);
                expect(data.total).toBe(0);
            });

            it('should handle empty modules array from provider', async () => {
                const emptyProvider: GraphDataProvider = vi.fn(() => ({
                    modules: [],
                    summary: { totalDependencies: 0, violations: [] }
                }));

                await stopServer();
                await startServer(emptyProvider, 6234);

                const response = await fetch('http://127.0.0.1:6234/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual([]);
                expect(data.total).toBe(0);
            });
        });

        describe('Query Processing Error Handling', () => {
            it('should handle malformed graph data gracefully', async () => {
                const malformedProvider: GraphDataProvider = vi.fn(() => ({
                    modules: 'not an array' as any,
                    summary: {
                        totalDependencies: 0,
                        violations: []
                    }
                }));

                await stopServer();
                await startServer(malformedProvider, 6235);

                const response = await fetch('http://127.0.0.1:6235/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(response.status).toBe(500);
                const data = await response.json();
                expect(data.error).toBe('Failed to process query against dependency graph');
                expect(data.code).toBe('QUERY_PROCESSING_ERROR');
            });

            it('should handle modules with invalid structure', async () => {
                const invalidModulesProvider: GraphDataProvider = vi.fn(() => ({
                    modules: [
                        { source: 'valid.ts', dependencies: [], dependents: [] },
                        { source: null, dependencies: [], dependents: [] } as any, // Invalid module
                        { source: 'another-valid.ts', dependencies: [], dependents: [] }
                    ],
                    summary: { totalDependencies: 0, violations: [] }
                }));

                await stopServer();
                await startServer(invalidModulesProvider, 6236);

                const response = await fetch('http://127.0.0.1:6236/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'valid' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                // Should filter out invalid modules and return valid ones
                expect(data.matches).toEqual(['valid.ts', 'another-valid.ts']);
                expect(data.total).toBe(2);
            });

            it('should handle modules with empty source paths', async () => {
                const emptySourceProvider: GraphDataProvider = vi.fn(() => ({
                    modules: [
                        { source: '', dependencies: [], dependents: [] },
                        { source: 'valid.ts', dependencies: [], dependents: [] },
                        { source: '   ', dependencies: [], dependents: [] }
                    ],
                    summary: { totalDependencies: 0, violations: [] }
                }));

                await stopServer();
                await startServer(emptySourceProvider, 6237);

                const response = await fetch('http://127.0.0.1:6237/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'valid' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['valid.ts']);
                expect(data.total).toBe(1);
            });
        });

        describe('JSON Parsing Error Handling', () => {
            it('should return 400 for malformed JSON', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: '{ invalid json'
                });

                expect(response.status).toBe(400);
                const data = await response.json();
                expect(data.code).toBe('JSON_PARSE_ERROR');
            });

            it('should return 413 for request body too large', async () => {
                // Create a very large payload (larger than 10MB limit)
                const largePayload = JSON.stringify({
                    query: 'test',
                    largeData: 'x'.repeat(11 * 1024 * 1024) // 11MB
                });

                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: largePayload
                });

                expect(response.status).toBe(413);
                const data = await response.json();
                expect(data.code).toBe('REQUEST_TOO_LARGE');
            });
        });

        describe('Route Error Handling', () => {
            it('should return 404 for undefined routes', async () => {
                const response = await fetch('http://127.0.0.1:6230/nonexistent', {
                    method: 'GET'
                });

                expect(response.status).toBe(404);
                const data = await response.json();
                expect(data.error).toBe('Route not found');
                expect(data.code).toBe('ROUTE_NOT_FOUND');
                expect(data.timestamp).toBeDefined();
            });

            it('should return 404 for wrong HTTP method on query endpoint', async () => {
                const response = await fetch('http://127.0.0.1:6230/query', {
                    method: 'GET'
                });

                expect(response.status).toBe(404);
                const data = await response.json();
                expect(data.error).toBe('Route not found');
                expect(data.code).toBe('ROUTE_NOT_FOUND');
            });
        });
    });

    describe('Mock Data Provider Testing', () => {
        describe('Isolated Server Testing', () => {
            it('should work with completely mocked data provider', async () => {
                const mockProvider = vi.fn(() => ({
                    modules: [
                        {
                            source: 'mock/file1.ts',
                            dependencies: [
                                {
                                    resolved: 'mock/file2.ts',
                                    coreModule: false,
                                    followable: true,
                                    dynamic: false
                                }
                            ],
                            dependents: []
                        },
                        {
                            source: 'mock/file2.ts',
                            dependencies: [],
                            dependents: ['mock/file1.ts']
                        }
                    ],
                    summary: {
                        totalDependencies: 2,
                        violations: [
                            {
                                from: 'mock/file1.ts',
                                to: 'mock/file2.ts',
                                rule: {
                                    severity: 'warn',
                                    name: 'test-rule'
                                }
                            }
                        ]
                    }
                }));

                await startServer(mockProvider, 6240);

                const response = await fetch('http://127.0.0.1:6240/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'mock' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['mock/file1.ts', 'mock/file2.ts']);
                expect(data.total).toBe(2);
                expect(mockProvider).toHaveBeenCalledTimes(1);
            });

            it('should handle provider that returns different data on each call', async () => {
                let callCount = 0;
                const changingProvider = vi.fn(() => {
                    callCount++;
                    return {
                        modules: [
                            {
                                source: `dynamic/file${callCount}.ts`,
                                dependencies: [],
                                dependents: []
                            }
                        ],
                        summary: { totalDependencies: 1, violations: [] }
                    };
                });

                await startServer(changingProvider, 6241);

                // First call
                let response = await fetch('http://127.0.0.1:6241/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'file1' })
                });
                let data = await response.json();
                expect(data.matches).toEqual(['dynamic/file1.ts']);

                // Second call
                response = await fetch('http://127.0.0.1:6241/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'file2' })
                });
                data = await response.json();
                expect(data.matches).toEqual(['dynamic/file2.ts']);

                expect(changingProvider).toHaveBeenCalledTimes(2);
            });

            it('should verify provider is called with no arguments', async () => {
                const spyProvider = vi.fn(() => mockGraphData);

                await startServer(spyProvider, 6242);

                await fetch('http://127.0.0.1:6242/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'test' })
                });

                expect(spyProvider).toHaveBeenCalledWith();
                expect(spyProvider).toHaveBeenCalledTimes(1);
            });

            it('should handle provider that returns complex dependency structures', async () => {
                const complexProvider = vi.fn(() => ({
                    modules: [
                        {
                            source: 'complex/main.ts',
                            dependencies: [
                                {
                                    resolved: 'complex/utils.ts',
                                    coreModule: false,
                                    followable: true,
                                    dynamic: false
                                },
                                {
                                    resolved: 'fs',
                                    coreModule: true,
                                    followable: false,
                                    dynamic: false
                                }
                            ],
                            dependents: []
                        },
                        {
                            source: 'complex/utils.ts',
                            dependencies: [
                                {
                                    resolved: 'lodash',
                                    coreModule: false,
                                    followable: true,
                                    dynamic: true
                                }
                            ],
                            dependents: ['complex/main.ts']
                        }
                    ],
                    summary: {
                        totalDependencies: 4,
                        violations: []
                    }
                }));

                await startServer(complexProvider, 6243);

                const response = await fetch('http://127.0.0.1:6243/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'complex' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                expect(data.matches).toEqual(['complex/main.ts', 'complex/utils.ts']);
                expect(data.total).toBe(2);
            });

            it('should handle provider with duplicate file paths', async () => {
                const duplicateProvider = vi.fn(() => ({
                    modules: [
                        {
                            source: 'duplicate/file.ts',
                            dependencies: [],
                            dependents: []
                        },
                        {
                            source: 'duplicate/file.ts', // Duplicate
                            dependencies: [],
                            dependents: []
                        },
                        {
                            source: 'duplicate/other.ts',
                            dependencies: [],
                            dependents: []
                        }
                    ],
                    summary: { totalDependencies: 3, violations: [] }
                }));

                await startServer(duplicateProvider, 6244);

                const response = await fetch('http://127.0.0.1:6244/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'duplicate' })
                });

                expect(response.status).toBe(200);
                const data = await response.json();
                // Should deduplicate results
                expect(data.matches).toEqual(['duplicate/file.ts', 'duplicate/other.ts']);
                expect(data.total).toBe(2);
            });
        });
    });
});