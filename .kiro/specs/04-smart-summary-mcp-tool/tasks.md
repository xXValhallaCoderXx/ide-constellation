# Implementation Plan

- [x] 1. Create summary response types and interfaces
  - Define ISummaryResponse interface with all required fields (summary, metrics, insights, metadata)
  - Create supporting interfaces for insights (topHubs, circularDependencies, orphanFiles)
  - Add type definitions to src/types/graph.types.ts
  - _Requirements: 1.4, 3.1, 3.2, 3.3_

- [x] 2. Implement SummaryGenerator service core functionality
  - Create src/services/summary-generator.service.ts with SummaryGenerator class
  - Implement static generate() method that orchestrates all analysis
  - Add basic metrics calculation (fileCount, dependencyCount)
  - Create unit tests for core functionality
  - _Requirements: 3.1, 3.2, 4.1_

- [x] 3. Implement file type breakdown analysis
  - Add analyzeFileTypes() method to extract file extensions from graph nodes
  - Create mapping of extensions to counts for fileTypeBreakdown metric
  - Handle edge cases like files without extensions
  - Write unit tests for file type analysis
  - _Requirements: 3.2, 4.1_

- [x] 4. Implement hub analysis for top connected files
  - Add findTopHubs() method to identify files with most connections
  - Count both incoming and outgoing dependencies for each node
  - Sort and return top N hubs with connection counts
  - Write unit tests with known graph structures
  - _Requirements: 3.3, 4.1_

- [x] 5. Implement circular dependency detection algorithm
  - Add detectCircularDependencies() method using depth-first search
  - Build adjacency list from graph edges for efficient traversal
  - Implement cycle detection with path tracking to capture full cycles
  - Write comprehensive unit tests including complex cycle scenarios
  - _Requirements: 3.3, 4.1_

- [x] 6. Implement orphan file detection
  - Add findOrphanFiles() method to identify files with no dependencies
  - Check for nodes that appear in neither source nor target of any edge
  - Handle edge cases like single-file projects
  - Write unit tests for orphan detection logic
  - _Requirements: 3.3, 4.1_

- [x] 7. Implement narrative summary generation
  - Add generateNarrativeSummary() method to create human-readable summary text
  - Include key metrics, complexity assessment, and notable findings
  - Format summary to be directly usable by Kiro agents
  - Write tests for summary text generation with various graph scenarios
  - _Requirements: 3.1, 3.2_

- [x] 8. Add new MCP tool definition and registration
  - Define CONSTELLATION_GET_GRAPH_SUMMARY_TOOL in src/types/mcp.types.ts
  - Include proper tool schema with forceRefresh boolean parameter
  - Add tool to tools list in MCPStdioServer ListToolsRequestSchema handler
  - Write unit tests for tool registration
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 9. Implement smart cache logic in MCP server
  - Add executeGetGraphSummary() method to MCPStdioServer class
  - Implement cache validation check when forceRefresh is false
  - Add fallback logic for cache load failures
  - Include timing measurement for scanDurationMs metadata
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 10. Implement tool call handler integration
  - Add constellation_get_graph_summary case to CallToolRequestSchema handler
  - Extract forceRefresh parameter with proper default handling
  - Add workspace validation and error handling
  - Return properly formatted MCP tool response with JSON content
  - _Requirements: 1.4, 2.5, 5.1_

- [x] 11. Add comprehensive error handling and logging
  - Implement error handling for all failure scenarios (cache corruption, scan failures, analysis errors)
  - Add detailed logging for cache hits/misses and scan operations
  - Provide user-friendly error messages for common issues
  - Write tests for error conditions and recovery paths
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 12. Create integration tests for complete tool workflow
  - Write end-to-end tests that call the MCP tool and validate responses
  - Test both cache hit and cache miss scenarios
  - Test forceRefresh functionality
  - Validate response schema matches ISummaryResponse interface
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 13. Add performance optimizations and resource management
  - Implement response size limits for very large graphs
  - Add memory usage monitoring during analysis
  - Optimize circular dependency detection for large graphs
  - Add timeout handling for long-running analysis operations
  - _Requirements: 4.1, 5.1_