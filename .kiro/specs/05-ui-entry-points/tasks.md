# Implementation Plan

- [x] 1. Update extension manifest for Activity Bar integration
  - Add viewsContainers contribution for Activity Bar icon with "graph" icon
  - Add views contribution for sidebar webview panel
  - Remove helloWorld command contribution completely
  - Rename showPanel command to showGraph with updated title "Constellation: Show Codebase Map"
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.4_

- [x] 2. Create sidebar view provider infrastructure
  - Create ConstellationSidebarProvider class implementing WebviewViewProvider interface
  - Implement resolveWebviewView method with webview configuration and message handling
  - Set up CSP policy and local resource roots for Preact bundle
  - Create message handling system for sidebar-to-extension communication
  - _Requirements: 2.1, 6.1, 6.3_

- [x] 3. Implement Preact sidebar UI components
  - Create SidebarPanel root component with heading "Kiro Constellation"
  - Create ShowMapButton component with "Show Codebase Map" label
  - Implement click handler that sends showGraph message to extension host
  - Add CSS styling using VS Code theme variables for consistency
  - _Requirements: 2.2, 2.3, 2.4, 6.2_

- [x] 4. Build sidebar webview content generation
  - Create getWebviewContent method in sidebar provider
  - Generate HTML template with Preact bundle script inclusion
  - Set up nonce-based CSP for security
  - Configure webview URI resolution for bundled assets
  - _Requirements: 2.1, 2.2_

- [x] 5. Update extension activation and command registration
  - Register ConstellationSidebarProvider with VS Code API
  - Update showPanel command registration to showGraph command ID
  - Remove helloWorld command registration and handler completely
  - Preserve existing webviewManager integration for main panel
  - _Requirements: 3.1, 3.2, 5.1, 5.2, 5.3, 5.4_

- [x] 6. Implement message passing between sidebar and extension
  - Handle showGraph message in sidebar provider onDidReceiveMessage
  - Execute kiro-constellation.showGraph command when message received
  - Add error handling for command execution failures
  - Implement graceful fallback if message passing fails
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 7. Update build configuration for sidebar bundle
  - Modify esbuild configuration to bundle sidebar Preact components
  - Ensure sidebar bundle is included in dist output
  - Configure proper entry points for sidebar webview code
  - Test bundle generation and asset resolution
  - _Requirements: 2.2_

- [x] 8. Create unit tests for sidebar provider
  - Test ConstellationSidebarProvider webview content generation
  - Test message handling and command execution logic
  - Mock VS Code API calls for webview registration
  - Verify error handling scenarios and fallback behavior
  - _Requirements: 6.4_

- [x] 9. Create unit tests for Preact sidebar components
  - Test SidebarPanel component rendering and structure
  - Test ShowMapButton click event handling and message sending
  - Mock vscode.postMessage API for component testing
  - Verify component styling and accessibility
  - _Requirements: 2.3, 2.4_

- [x] 10. Integration testing for end-to-end functionality
  - Test Activity Bar icon registration and visibility
  - Test sidebar panel opening and content loading
  - Test button click triggering main Visual Canvas panel
  - Test command palette execution of showGraph command
  - Verify cleanup and disposal of sidebar resources
  - _Requirements: 1.1, 2.4, 3.1, 5.4_