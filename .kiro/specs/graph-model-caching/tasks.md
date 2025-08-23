# Implementation Plan

- [x] 1. Create graph domain model types and interfaces
  - Define IConstellationNode, IConstellationEdge, IConstellationGraph interfaces in src/types/graph.types.ts
  - Define ICacheValidationResult interface for cache validation responses
  - Export all interfaces for use across services
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement GraphTransformer service for data transformation
  - Create src/services/graph-transformer.service.ts with static transform method
  - Implement createNode method to convert dependency-cruiser modules to IConstellationNode
  - Implement createEdges method to extract dependencies as IConstellationEdge arrays
  - Implement normalizeId method for workspace-relative path normalization
  - Implement extractPackageName method for monorepo package detection
  - Add comprehensive error handling for invalid dependency-cruiser output
  - Write unit tests for all transformation methods
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Implement GraphCache service for persistence operations
  - Create src/services/graph-cache.service.ts with static save and load methods
  - Implement validateCache method with key file timestamp comparison
  - Implement getCachePath, getKeyFileTimestamps, and ensureCacheDirectory helper methods
  - Add error handling for file system operations (permissions, missing directories)
  - Handle corrupted cache files with graceful fallback to re-scanning
  - Write unit tests for cache validation, save/load operations, and error scenarios
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Implement GraphService singleton for graph management and indexing
  - Create src/services/graph.service.ts with singleton pattern implementation
  - Implement loadGraph method that calls clear(), checks cache validity, and loads/transforms data
  - Implement buildReverseDependencyIndex method to create Map<string, string[]> from graph edges
  - Implement getDependentsOf method for O(1) reverse-dependency lookups
  - Implement getGraph method to access current graph data
  - Implement clear method to reset singleton state
  - Write unit tests for singleton behavior, index building, and lookup performance
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 5. Integrate GraphTransformer into scan worker thread
  - Modify src/workers/scan-project.worker.ts to import and use GraphTransformer
  - Update worker to transform dependency-cruiser output before sending results
  - Ensure transformed graph data is included in worker result messages
  - Update ScanWorkerMessage type to include transformed graph data
  - Test worker integration with transformation pipeline
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 6. Integrate GraphCache and GraphService into MCP server process
  - Modify src/mcp/mcp-stdio.server.ts to import GraphCache and GraphService
  - Update scanProject method to use GraphService.loadGraph() instead of direct worker execution
  - Implement cache-first loading strategy: check cache validity, load from cache or trigger new scan
  - Ensure GraphService singleton persists between scan operations in the same session
  - Add proper error handling and logging for cache operations
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

- [x] 7. Update extension lifecycle to manage GraphService singleton
  - Modify src/extension.ts deactivate() function to call GraphService.clear()
  - Ensure proper cleanup of graph data when extension is deactivated
  - Add logging for singleton lifecycle events
  - Test extension activation/deactivation cycle with graph data persistence
  - _Requirements: 3.4_

- [x] 8. Add comprehensive error handling and logging
  - Implement detailed error messages for all failure scenarios (cache corruption, file permissions, invalid data)
  - Add debug logging throughout the graph processing pipeline
  - Ensure graceful fallback to full scanning when cache operations fail
  - Add user-friendly error messages for common issues
  - Test error handling scenarios and recovery mechanisms
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

- [x] 9. Write integration tests for complete scan-to-cache workflow
  - Create test scenarios for full scan → transform → cache → load cycle
  - Test cache invalidation when key files (package.json, tsconfig.json, pnpm-lock.yaml) are modified
  - Test reverse-dependency index accuracy with various project structures
  - Verify performance requirements: cache loads under 2 seconds, O(1) dependency lookups
  - Test monorepo scenarios with package detection
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

- [x] 10. Update constellation.scanProject command to use new caching system
  - Ensure command behavior remains backward compatible
  - Verify that scan results are now cached and subsequent runs use cache when valid
  - Test command with various project types and sizes
  - Validate that reverse-dependency index is available after scan completion
  - Add performance logging to measure cache effectiveness
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3