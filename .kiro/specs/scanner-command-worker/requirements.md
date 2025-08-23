# Requirements Document

## Introduction

The Scanner Command & Worker feature extends the Kiro Constellation VS Code extension with codebase analysis capabilities. This feature introduces a new VS Code command that triggers dependency-cruiser scans within a non-blocking worker thread inside the MCP server. The primary goal is to validate the core analysis engine architecture by successfully generating and logging raw JSON output from dependency-cruiser scans, establishing the foundation for future context-aware features.

## Requirements

### Requirement 1: VS Code Command Integration

**User Story:** As a developer, I want to run a Scan Project command from the Command Palette, so that I can manually trigger codebase analysis at any time.

#### Acceptance Criteria

1. WHEN the extension is active THEN the system SHALL register a new command "constellation.scanProject" in package.json
2. WHEN the command is executed from the Command Palette THEN the system SHALL send a message to the MCP server to initiate the scan
3. WHEN the command handler executes THEN the system SHALL NOT perform any analysis directly but delegate to the MCP server
4. WHEN the scan request is sent THEN the system SHALL provide immediate feedback to the user that the scan has started

### Requirement 2: Non-Blocking Worker Thread Processing

**User Story:** As a developer, I want the scan to run in the background without freezing my IDE, so that I can continue to code and interact with VS Code while it works.

#### Acceptance Criteria

1. WHEN the MCP server receives a "scan project" request THEN the system SHALL spawn a new worker_thread to handle the analysis
2. WHEN the worker thread is created THEN the main MCP server process SHALL remain unblocked and responsive
3. WHEN the worker thread completes THEN the system SHALL communicate the results back to the main MCP server process
4. WHEN multiple scan requests are received THEN the system SHALL handle them appropriately without blocking the main thread
5. IF a worker thread fails THEN the system SHALL handle the error gracefully without crashing the main server

### Requirement 3: Dependency-Cruiser Integration

**User Story:** As a system component, I want to invoke dependency-cruiser programmatically, so that I can analyze the project's dependency structure and generate comprehensive analysis data.

#### Acceptance Criteria

1. WHEN the worker thread starts THEN the system SHALL invoke the dependency-cruiser programmatic API
2. WHEN dependency-cruiser runs THEN the system SHALL use a default baseline configuration
3. WHEN the configuration is applied THEN the system SHALL respect the project's .gitignore file
4. WHEN scanning directories THEN the system SHALL target common source directories like src
5. WHEN dependency-cruiser completes THEN the system SHALL capture the raw JSON output
6. IF dependency-cruiser encounters errors THEN the system SHALL capture and report the error details

### Requirement 4: Status Communication and Logging

**User Story:** As a developer, I want to see the progress and results of the scan, so that I can verify the analysis completed successfully and review the raw output.

#### Acceptance Criteria

1. WHEN the worker thread starts THEN the system SHALL communicate "Scan starting" status to the main MCP server process
2. WHEN the scan completes successfully THEN the system SHALL communicate "Scan complete" status with the raw JSON result
3. WHEN an error occurs THEN the system SHALL communicate "Error" status with error details
4. WHEN the MCP server receives status updates THEN the system SHALL log all messages to the dedicated "Kiro Constellation" Output channel
5. WHEN the scan produces results THEN the system SHALL log the complete raw JSON output from dependency-cruiser to the Output channel
6. WHEN logging occurs THEN the system SHALL include timestamps and clear status indicators for easy debugging