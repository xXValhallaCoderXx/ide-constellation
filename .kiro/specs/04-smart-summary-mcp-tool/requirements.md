# Requirements Document

## Introduction

The Smart Summary MCP Tool feature implements a single, intelligent MCP tool called `constellation_get_graph_summary` that provides actionable insights about the codebase. This tool replaces a previously planned two-step process by automatically determining whether to use cached data or trigger a fresh scan, creating a seamless conversational experience for Kiro agents. The tool returns rich, pre-digested summaries with key metrics and architectural insights, completing Phase 1B of the roadmap.

## Requirements

### Requirement 1: MCP Tool Registration and Interface

**User Story:** As a Kiro AI Agent, I want to call a single tool to get an up-to-date summary of the codebase, so that I can answer user questions about the project's structure without a complex, multi-step process.

#### Acceptance Criteria

1. WHEN the MCP server starts THEN the system SHALL register a new tool named `constellation_get_graph_summary`
2. WHEN the tool is called THEN the system SHALL accept an optional JSON object with a single boolean property `forceRefresh`
3. WHEN `forceRefresh` is omitted or false THEN the system SHALL default to using cached data when available
4. WHEN the tool is invoked THEN the system SHALL return a rich JSON response containing summary, metrics, insights, and metadata
5. WHEN the tool registration occurs THEN the system SHALL provide proper tool schema definition for MCP clients

### Requirement 2: Smart Cache Logic Implementation

**User Story:** As a Kiro AI Agent, I want the tool to automatically use the most appropriate data source, so that I get fast responses when possible and fresh data when needed.

#### Acceptance Criteria

1. WHEN `constellation_get_graph_summary` is called with `forceRefresh: false` THEN the system SHALL first check if the graph cache is valid using the GraphCache service
2. WHEN the cache is valid and `forceRefresh` is false THEN the system SHALL load the graph from cache and generate the summary response
3. WHEN `forceRefresh` is true OR the cache is invalid/missing THEN the system SHALL automatically trigger the full scan-transform-cache workflow
4. WHEN the scan workflow completes THEN the system SHALL generate and return the summary of the newly scanned graph
5. WHEN cache validation occurs THEN the system SHALL use the same invalidation logic as the existing caching system

### Requirement 3: Rich Summary Response Schema

**User Story:** As a Kiro AI Agent, I want to receive pre-digested, actionable insights about the codebase, so that I can provide intelligent and immediate responses to users.

#### Acceptance Criteria

1. WHEN the tool returns successfully THEN the response SHALL include a `summary` field with a human-readable narrative about the codebase analysis
2. WHEN the response is generated THEN the `metrics` object SHALL include `fileCount`, `dependencyCount`, and `fileTypeBreakdown` properties
3. WHEN the response includes insights THEN the `insights` object SHALL contain `topHubs`, `circularDependencies`, and `orphanFiles` arrays
4. WHEN metadata is included THEN it SHALL contain `scanDurationMs` and `cacheUsed` boolean properties
5. WHEN circular dependencies are detected THEN they SHALL be represented as arrays showing the dependency cycle path

### Requirement 4: Architectural Insights Generation

**User Story:** As a Kiro AI Agent, I want to have access to high-value architectural insights, so that I can highlight potential issues and important structural information to users.

#### Acceptance Criteria

1. WHEN analyzing the graph THEN the system SHALL identify the top hub files based on connection count
2. WHEN processing dependencies THEN the system SHALL detect circular dependency patterns
3. WHEN analyzing file relationships THEN the system SHALL identify orphan files with no incoming or outgoing dependencies
4. WHEN generating file type breakdown THEN the system SHALL categorize files by extension and count them
5. WHEN calculating metrics THEN the system SHALL measure and report the total scan duration

### Requirement 5: Error Handling and Robustness

**User Story:** As a Kiro AI Agent, I want the tool to handle errors gracefully, so that I can provide meaningful feedback to users when issues occur.

#### Acceptance Criteria

1. WHEN the scan process fails THEN the system SHALL return an appropriate error response with diagnostic information
2. WHEN the cache is corrupted THEN the system SHALL automatically fall back to a fresh scan
3. WHEN dependency-cruiser encounters errors THEN the system SHALL capture and include error details in the response
4. WHEN the tool encounters unexpected errors THEN the system SHALL log detailed error information for debugging
5. WHEN partial data is available despite errors THEN the system SHALL return what insights can be generated with appropriate warnings