import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startServer, stopServer, isServerRunning, getServerPort, GraphDataProvider } from '../mcpServer';
import { DependencyGraph } from '../analyzer';

describe('MCP Server Error Handling', () => {
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
                    dependencies: [],
                    dependents: []
                },
                {
                    source: 'src/utils/helper.ts',
                    dependencies: [],
                    dependents: []
                }
            ],
            summary: {
                totalDependencies: 0,
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

    describe('Query Parameter Validation', () => {
        it('should return 400 for missing request body', async () => {
            await startServer(mockGraphDataProvider, 6171);

            const response = await fetch('http://127.0.0.1:6171/query', {
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
            await startServer(mockGraphDataProvider, 6172);

            const response = await fetch('http://127.0.0.1:6172/query', {
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
            await startServer(mockGraphDataProvider, 6173);

            const response = await fetch('http://127.0.0.1:6173/query', {
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
            await startServer(mockGraphDataProvider, 6174);

            const response = await fetch('http://127.0.0.1:6174/query', {
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
            await startServer(mockGraphDataProvider, 6175);

            const response = await fetch('http://127.0.0.1:6175/query', {
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
            await startServer(mockGraphDataProvider, 6176);

            const longQuery = 'a'.repeat(1001); // Exceeds 1000 character limit
            const response = await fetch('http://127.0.0.1:6176/query', {
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

            await startServer(errorProvider, 6177);

            const response = await fetch('http://127.0.0.1:6177/query', {
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

            await startServer(nullProvider, 6178);

            const response = await fetch('http://127.0.0.1:6178/query', {
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

            await startServer(undefinedProvider, 6179);

            const response = await fetch('http://127.0.0.1:6179/query', {
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
                summary: {}
            }));

            await startServer(malformedProvider, 6180);

            const response = await fetch('http://127.0.0.1:6180/query', {
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
                    { source: null, dependencies: [], dependents: [] }, // Invalid module
                    { source: 'another-valid.ts', dependencies: [], dependents: [] }
                ],
                summary: { totalDependencies: 0, violations: [] }
            }));

            await startServer(invalidModulesProvider, 6181);

            const response = await fetch('http://127.0.0.1:6181/query', {
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
    });

    describe('JSON Parsing Error Handling', () => {
        it('should return 400 for malformed JSON', async () => {
            await startServer(mockGraphDataProvider, 6182);

            const response = await fetch('http://127.0.0.1:6182/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{ invalid json'
            });

            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.code).toBe('JSON_PARSE_ERROR');
        });

        it('should return 413 for request body too large', async () => {
            await startServer(mockGraphDataProvider, 6183);

            // Create a very large payload (larger than 10MB limit)
            const largePayload = JSON.stringify({
                query: 'test',
                largeData: 'x'.repeat(11 * 1024 * 1024) // 11MB
            });

            const response = await fetch('http://127.0.0.1:6183/query', {
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
            await startServer(mockGraphDataProvider, 6184);

            const response = await fetch('http://127.0.0.1:6184/nonexistent', {
                method: 'GET'
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Route not found');
            expect(data.code).toBe('ROUTE_NOT_FOUND');
            expect(data.timestamp).toBeDefined();
        });

        it('should return 404 for wrong HTTP method on query endpoint', async () => {
            await startServer(mockGraphDataProvider, 6185);

            const response = await fetch('http://127.0.0.1:6185/query', {
                method: 'GET'
            });

            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error).toBe('Route not found');
            expect(data.code).toBe('ROUTE_NOT_FOUND');
        });
    });

    describe('Successful Query Processing', () => {
        it('should process valid queries successfully', async () => {
            await startServer(mockGraphDataProvider, 6186);

            const response = await fetch('http://127.0.0.1:6186/query', {
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

        it('should handle case-insensitive queries', async () => {
            await startServer(mockGraphDataProvider, 6187);

            const response = await fetch('http://127.0.0.1:6187/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'HELPER' })
            });

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.matches).toEqual(['src/utils/helper.ts']);
            expect(data.total).toBe(1);
        });

        it('should return empty results for no matches', async () => {
            await startServer(mockGraphDataProvider, 6188);

            const response = await fetch('http://127.0.0.1:6188/query', {
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
});