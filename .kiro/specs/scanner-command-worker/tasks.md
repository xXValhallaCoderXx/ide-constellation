# Implementation Plan

## CRITICAL FIXES (Must be completed first)

- [ ] 0.1 Fix build path mismatch between esbuild and runtime
  - Align esbuild output path with Worker constructor path exactly
  - Ensure worker file extension matches (.mjs for ES modules)
  - Verify build includes worker files in extension bundle
  - _Requirements: 2.1, 2.2_

- [ ] 0.2 Replace __dirname with ExtensionContext for worker path resolution
  - Update all worker path resolution to use vscode.Uri.joinPath()
  - Pass ExtensionContext through MCP tool calls
  - Add validation for missing ExtensionContext
  - _Requirements: 2.1, 2.2_

- [ ] 0.3 Add path validation security measures
  - Validate all target paths are within workspace bounds
  - Prevent directory traversal attacks with path.resolve() checks
  - Add proper error handling for invalid paths
  - _Requirements: 2.1, 2.5_

- [ ] 0.4 Fix dependency-cruiser API usage with defensive programming
  - Add checks for cruise() result structure before accessing properties
  - Properly await the async cruise() function
  - Validate result.output exists and is valid
  - _Requirements: 3.1, 3.5_

## Original Implementation Tasks

- [x] 1. Add dependency-cruiser dependency and update build configuration
  - Install dependency-cruiser as a production dependency
  - Update package.json with the new dependency
  - Verify build process includes worker thread compilation
  - _Requirements: 3.1, 3.2_

- [x] 2. Create scan worker thread implementation
  - [x] 2.1 CRITICAL: Fix scanWorker.ts dependency-cruiser integration
    - Add defensive checks for dependency-cruiser API result structure
    - Properly await the async cruise() function
    - Validate result.output exists before accessing it
    - Add proper error handling for invalid API responses
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.2 Configure dependency-cruiser with baseline settings
    - Implement default configuration that respects .gitignore
    - Target common source directories like src
    - Add exclusion patterns for node_modules and build artifacts
    - _Requirements: 3.2, 3.3, 3.4_

- [x] 3. Add worker thread management to MCP server
  - [x] 3.1 CRITICAL: Fix worker thread management in MCP server
    - Add path validation to prevent directory traversal attacks
    - Update executeScanInWorker to accept and use ExtensionContext
    - Implement secure target path validation within workspace bounds
    - Add proper error handling for invalid paths and missing workspace
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Add public scan method to MCP server
    - Create public scanProject method that can be called directly from extension
    - Connect method to worker thread execution
    - Return promise that resolves when scan completes
    - _Requirements: 1.2, 4.1, 4.2, 4.3_

- [x] 4. Add VS Code command integration
  - [x] 4.1 Register constellation.scanProject command
    - Add command definition to package.json contributes.commands
    - Update command title to "Constellation: Scan Project"
    - _Requirements: 1.1_

  - [ ] 4.2 CRITICAL: Fix command handler to pass ExtensionContext
    - Update command handler to pass ExtensionContext to MCP server
    - Ensure MCP tool call includes context for secure path resolution
    - Add proper error handling for missing context
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 5. Implement comprehensive logging and status reporting
  - [x] 5.1 Add worker thread status logging
    - Implement status message logging in MCP server
    - Add timestamp formatting for all log messages
    - Ensure all messages go to "Kiro Constellation" output channel
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 5.2 Add raw JSON result logging
    - Implement complete dependency-cruiser output logging
    - Format JSON output for readability in output channel
    - Add clear status indicators for scan completion
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [x] 6. CRITICAL: Fix build system and path resolution issues
  - [x] 6.1 Fix build path mismatch between esbuild output and runtime loading
    - Update esbuild.js to output worker to exact path expected by runtime code
    - Ensure worker file is compiled as .mjs for proper ES module support
    - Verify build output path matches the path used in new Worker() constructor
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Fix worker path resolution using ExtensionContext
    - Replace unreliable __dirname usage with vscode.Uri.joinPath()
    - Update MCP server methods to accept and use ExtensionContext
    - Update command handler to pass ExtensionContext to MCP server
    - _Requirements: 2.1, 2.2_

- [x] 7. Manual testing and validation
  - [x] 7.1 Test basic scan functionality
    - Execute constellation.scanProject command from Command Palette
    - Verify scan starts without blocking VS Code interface
    - Confirm "Scan starting" message appears in output channel
    - _Requirements: 1.1, 1.4, 2.3, 4.1_

  - [x] 7.2 Validate scan results and logging
    - Verify "Scan complete" message appears in output channel
    - Confirm raw JSON output from dependency-cruiser is logged
    - Check that output includes timestamp and status indicators
    - Test with different project structures and sizes
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 7.3 Test error handling scenarios
    - Test scan with invalid target paths
    - Verify error messages are properly logged
    - Confirm VS Code remains responsive during error conditions
    - Test worker thread cleanup after errors
    - _Requirements: 2.5, 4.3_