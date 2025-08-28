# Implementation Plan

- [x] 1. Create health report MCP tool with dual-view response structure
  - Implement new health report tool in `src/mcp/tools/health-report.tool.ts`
  - Add tool registration to `mcp-stdio.server.ts` with proper tool definition
  - Create dual payload response structure combining summary, dashboard data, and visual instruction
  - Integrate with existing HealthAnalyzer service to generate comprehensive analysis
  - Add proper error handling and validation for graph data input
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Enhance MCP server to handle health report tool calls
  - Add CONSTELLATION_HEALTH_REPORT_TOOL constant to `src/types/mcp.types.ts`
  - Implement tool call handler in MCPStdioServer class
  - Add workspace root resolution logic for both extension and standalone modes
  - Integrate visual instruction routing through existing MCP provider infrastructure
  - Test tool response with proper dual payload structure
  - _Requirements: 1.1, 1.4, 5.1_

- [x] 3. Create health dashboard component with graph navigation trigger
  - Create `src/webview/panels/health/components/HealthDashboard.tsx` using Preact
  - Implement dashboard actions section with "View Heatmap on Graph" button
  - Add clickable risk file list with navigation to graph and editor
  - Create dashboard state management for analysis data and user interactions
  - Style dashboard with VS Code theme variables and responsive design
  - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 4. Implement heatmap overlay system in GraphCanvas component
  - Enhance `src/webview/panels/constellation/components/GraphCanvas.tsx` with heatmap state
  - Add `applyHeatmapOverlay` method with smooth 300ms color animations
  - Implement `clearHeatmapOverlay` method to restore original node styles
  - Store risk data in Cytoscape nodes for tooltip display
  - Add enhanced tooltip system showing risk metrics on hover
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Create floating heatmap legend component
  - Implement `src/webview/panels/constellation/components/HeatmapLegend.tsx`
  - Add floating legend with risk scale gradient and interaction instructions
  - Implement toggle functionality to show/hide heatmap overlay
  - Add close button and proper positioning with backdrop blur styling
  - Include risk distribution statistics and visual feedback
  - _Requirements: 3.6, 7.2, 7.3_

- [x] 6. Implement bidirectional navigation between dashboard and graph
  - Add message handlers for dashboard → graph navigation in webview manager
  - Implement graph → dashboard synchronization with risk highlighting
  - Add file opening logic with modifier key support for split-pane mode
  - Create graph node focusing and centering functionality
  - Ensure proper state synchronization between both views
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 7. Add VS Code command integration for multiple entry points
  - Register `constellation.healthReport` command in `src/extension.ts`
  - Register `constellation.healthReportGraph` command for direct graph access
  - Register `constellation.clearHeatmap` command for overlay management
  - Implement command handlers with proper webview panel management
  - Add command palette integration with descriptive labels
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Integrate health dashboard with webview panel system
  - Create health dashboard webview provider in `src/webview/providers/health-dashboard.provider.ts`
  - Add dashboard panel management to existing WebviewManager
  - Implement message routing between extension and dashboard webview
  - Add proper panel lifecycle management and cleanup
  - Ensure dashboard can be shown independently or alongside graph panel
  - _Requirements: 2.1, 2.3, 6.1, 6.2_

- [x] 9. Implement visual instruction routing for health analysis
  - Enhance MCP provider's visual instruction dispatcher for health analysis actions
  - Add `applyHealthAnalysis` action handler in webview message system
  - Implement debounced routing with size guards for large payloads
  - Add proper error handling and fallback strategies for routing failures
  - Ensure visual instructions trigger appropriate panel creation and focus
  - _Requirements: 1.3, 1.4, 6.3, 6.4_

- [x] 10. Add comprehensive error handling and graceful degradation
  - Implement fallback strategies for missing analysis data
  - Add error recovery for graph rendering failures with dashboard-only mode
  - Create graceful heatmap overlay failure handling
  - Add user-friendly error messages and retry mechanisms
  - Implement proper cleanup and resource disposal on errors
  - _Requirements: 6.5, 7.4, 7.5_

- [x] 11. Optimize performance for large graphs and smooth animations
  - Implement batch node style updates for heatmap application
  - Add viewport culling for large graph heatmap rendering
  - Optimize animation performance with requestAnimationFrame
  - Add memory management for risk data caching
  - Implement efficient state synchronization with debouncing
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Add comprehensive styling and visual polish
  - Create `src/webview/panels/health/styles/health-dashboard.css` with VS Code theme integration
  - Add heatmap legend styling with backdrop blur and floating design
  - Implement hover states and visual feedback for all interactive elements
  - Add smooth transitions and proper easing curves for animations
  - Ensure accessibility compliance with proper contrast ratios and ARIA labels
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 13. Implement enhanced tooltips and user feedback systems
  - Add rich tooltip system for heatmap nodes with risk metrics display
  - Implement loading states and progress indicators for analysis operations
  - Add toast notifications for successful actions and error states
  - Create contextual help and interaction guidance
  - Ensure tooltips work properly in both light and dark themes
  - _Requirements: 3.4, 6.4, 7.1, 7.5_

- [ ] 14. Add comprehensive testing and validation
  - Create unit tests for health report MCP tool response structure
  - Add integration tests for dashboard → graph → editor navigation flow
  - Implement visual regression tests for heatmap color accuracy
  - Add performance tests for large graph heatmap rendering
  - Create error scenario tests for graceful degradation validation
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 15. Final integration and end-to-end testing
  - Test complete "@constellation health report" command flow
  - Validate all VS Code command palette entries work correctly
  - Ensure proper cleanup and resource management across all components
  - Test cross-panel synchronization and state management
  - Validate accessibility features and keyboard navigation
  - _Requirements: 1.1, 2.5, 4.5, 5.4, 7.5_