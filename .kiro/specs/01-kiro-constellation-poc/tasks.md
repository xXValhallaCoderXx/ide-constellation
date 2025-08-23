# Implementation Plan

- [x] 1. Set up project dependencies and build configuration
  - Install required dependencies: preact and related type definitions
  - Configure esbuild for both extension and webview compilation
  - Update package.json scripts for dual build process
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 2. Implement MCP Server core functionality
  - [x] 2.1 Implement MCP stdio server with `initialize`/`tools/*`
    - Write MCPServer class with start/stop methods
    - Implement GET /status endpoint returning JSON with status and timestamp
    - Add proper error handling and logging
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Add server lifecycle management
    - Implement graceful shutdown handling
    - Add port conflict resolution with fallback ports
    - Create server status checking utilities
    - _Requirements: 3.5, 3.6_

- [x] 3. Update VS Code extension core
  - [x] 3.1 Modify extension activation and command registration
    - Update package.json to register "Kiro Constellation: Show Panel" command
    - Modify activate() function to initialize MCP server
    - Implement proper deactivate() function with server cleanup
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 3.2 Create webview panel management
    - Implement webview panel creation with proper title and configuration
    - Set up message passing between webview and extension
    - Handle webview disposal and cleanup
    - _Requirements: 2.1_

  - [x] 3.3 Implement webview-server communication bridge
    - Create message handler for status check requests from webview
    - Implement server status querying from extension to MCP server
    - Send status updates back to webview UI
    - _Requirements: 2.5, 2.6_

- [x] 4. Build Preact webview UI
  - [x] 4.1 Create basic Preact component structure
    - Set up main ConstellationPanel component
    - Create StatusIndicator component for displaying server status
    - Implement ServerStatusButton component for user interaction
    - _Requirements: 2.2, 2.3, 2.4, 4.1, 4.4_

  - [x] 4.2 Implement webview-extension messaging
    - Add message posting to extension when status check button is clicked
    - Handle incoming status update messages from extension
    - Update UI state based on server status responses
    - _Requirements: 2.5, 2.6_

  - [x] 4.3 Configure webview build process
    - Set up separate esbuild configuration for Preact compilation
    - Ensure proper JSX and TypeScript handling for webview code
    - Generate single JavaScript bundle for webview consumption
    - _Requirements: 4.2, 4.3_