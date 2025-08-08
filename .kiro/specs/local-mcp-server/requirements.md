# Requirements Document

## Introduction

The Local MCP Server feature will implement a lightweight Express.js server within the Kiro Constellation VS Code extension that acts as a bridge, exposing an API endpoint for querying the workspace's dependency graph data. This server will enable external tools and services to programmatically access the extension's dependency analysis results through a simple HTTP interface.

## Requirements

### Requirement 1

**User Story:** As a developer using external tools, I want to query the dependency graph data through an HTTP API, so that I can integrate Kiro Constellation's analysis results into my development workflow and toolchain.

#### Acceptance Criteria

1. WHEN the extension is activated THEN the system SHALL start a local Express.js server on port 6170
2. WHEN the extension is deactivated THEN the system SHALL gracefully stop the local server
3. WHEN a POST request is made to `/query` endpoint with a valid query parameter THEN the system SHALL return matching file paths from the dependency graph
4. WHEN the server receives an invalid request THEN the system SHALL return appropriate error responses with proper HTTP status codes

### Requirement 2

**User Story:** As a developer, I want the MCP server to provide real-time access to the latest dependency analysis, so that external queries always return current project state information.

#### Acceptance Criteria

1. WHEN a file is saved and dependency analysis is triggered THEN the system SHALL update the server's internal graph data state
2. WHEN a query is made to the server THEN the system SHALL use the most recently analyzed dependency graph data
3. WHEN no analysis has been performed yet THEN the system SHALL return an empty result set rather than failing
4. WHEN the dependency graph is being updated THEN the system SHALL continue serving queries with the previous graph state

### Requirement 3

**User Story:** As a developer, I want to search for files by name or path patterns, so that I can quickly locate specific files or groups of files in the dependency graph.

#### Acceptance Criteria

1. WHEN a query contains a file name or path fragment THEN the system SHALL perform case-insensitive matching against module paths
2. WHEN multiple files match the query THEN the system SHALL return all matching file paths as an array
3. WHEN no files match the query THEN the system SHALL return an empty array
4. WHEN the query parameter is missing or invalid THEN the system SHALL return an error response

### Requirement 4

**User Story:** As a system administrator, I want the MCP server to handle errors gracefully and provide proper logging, so that I can troubleshoot issues and ensure reliable operation.

#### Acceptance Criteria

1. WHEN the server fails to start THEN the system SHALL log the error and continue extension activation without the server
2. WHEN the server port is already in use THEN the system SHALL attempt to use an alternative port or log an appropriate error
3. WHEN a request processing error occurs THEN the system SHALL return a 500 status code with error details
4. WHEN the server is stopped THEN the system SHALL ensure all connections are properly closed

### Requirement 5

**User Story:** As a developer, I want the MCP server to be decoupled from the analysis engine, so that the server can operate independently and the system remains maintainable.

#### Acceptance Criteria

1. WHEN the server is initialized THEN the system SHALL accept a data provider callback function rather than direct access to analysis state
2. WHEN the server needs graph data THEN the system SHALL call the provider function to get the latest data
3. WHEN the analysis engine updates its state THEN the system SHALL not require direct coupling to the server module
4. WHEN the server module is tested THEN the system SHALL allow mocking of the data provider for unit testing