# Implementation Plan

- [x] 1. Create core type definitions and interfaces
  - Define impact analysis types, enums, and interfaces for the tool
  - Create animation-specific type definitions for visual instructions
  - Establish data structures for impact analysis results and risk scoring
  - _Requirements: 1.1, 2.1, 4.1, 6.1_

- [ ] 2. Implement impact analyzer service
  - [x] 2.1 Create ImpactAnalyzer service class with dependency traversal logic
    - Write core ImpactAnalyzer class with GraphService integration
    - Implement dependency traversal algorithm with depth limiting
    - Add circular dependency detection and handling
    - _Requirements: 1.1, 2.1, 7.1, 7.2_

  - [x] 2.2 Implement risk score calculation algorithm
    - Write risk scoring function using direct/secondary/tertiary impact weights
    - Add change type multipliers for different modification types
    - Implement score normalization to 0-10 scale
    - _Requirements: 4.1_

  - [x] 2.3 Create recommendation engine for safeguards
    - Write recommendation generation based on risk score thresholds
    - Implement specific recommendations for high-risk scenarios
    - Add test coverage recommendations prioritized by impact level
    - _Requirements: 5.1, 5.2_

- [ ] 3. Create MCP tool implementation
  - [x] 3.1 Implement trace-impact.tool.ts with input validation
    - Write main tool function with parameter validation and error handling
    - Integrate with ImpactAnalyzer service for analysis execution
    - Implement dual-response structure for AI and visual consumption
    - _Requirements: 6.1, 6.2, 1.1_

  - [x] 3.2 Add tool registration to MCP server
    - Define CONSTELLATION_TRACE_IMPACT_TOOL in mcp.types.ts
    - Add tool handler case in mcp-stdio.server.ts CallToolRequestSchema
    - Implement tool execution with workspace root resolution
    - _Requirements: 6.1, 6.2_

- [ ] 4. Implement visual animation system
  - [x] 4.1 Create impact animation instruction types
    - Define ImpactAnimationInstruction interface extending VisualInstruction
    - Create AnimatedNode interface for node-specific animation data
    - Add animation configuration types for timing and easing
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.2 Extend webview message types for impact animations
    - Add impact animation message types to messages.types.ts
    - Define message structure for graph canvas animation commands
    - Create response types for animation completion feedback
    - _Requirements: 3.1, 3.2_

- [ ] 5. Create graph canvas animation handler
  - [x] 5.1 Implement ImpactAnimationHandler component
    - Write React component for handling impact animation visual instructions
    - Implement ripple effect animation starting from target node
    - Add color-coding logic based on impact levels (Critical: Red, High: Orange, Medium: Yellow, Low: Green)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Integrate animation handler with existing graph canvas
    - Modify existing GraphCanvas component to include ImpactAnimationHandler
    - Add animation timing logic with staggered delays (100ms, 200ms, 300ms)
    - Implement animation cleanup and reset functionality
    - _Requirements: 3.3, 3.4_

- [ ] 6. Add webview message routing for impact animations
  - [x] 6.1 Extend WebviewManager with impact animation handling
    - Add case for 'applyImpactAnimation' in visual instruction processor
    - Implement message routing from MCP tool to graph canvas
    - Add error handling and fallback for animation failures
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Create animation message handlers in graph webview
    - Add message listener for impact animation commands in graph UI
    - Implement animation trigger logic when messages are received
    - Add animation state management and cleanup
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 7. Implement comprehensive error handling
  - [x] 7.1 Add input validation and workspace security
    - Implement file path validation using existing resolveWorkspacePath utility
    - Add parameter validation for changeType enum and depth limits
    - Create graceful error messages for invalid inputs
    - _Requirements: 1.1, 6.1, 7.1_

  - [x] 7.2 Add graph service integration error handling
    - Handle cases where graph data is not available or corrupted
    - Implement fallback analysis for missing dependency information
    - Add timeout protection for large graph traversals
    - _Requirements: 7.1, 7.2_

- [ ] 8. Create formatted response generation
  - [x] 8.1 Implement markdown summary formatter for AI consumption
    - Write summary generation with emoji indicators and clear sections
    - Create structured output with impact levels, risk scores, and recommendations
    - Add pro tips and actionable insights for demonstration value
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.2 Create visual instruction payload generation
    - Generate visual instruction with impact animation data
    - Create animated node data with proper timing and color coding
    - Implement correlation ID and timestamp for instruction tracking
    - _Requirements: 3.1, 3.2, 6.1_

- [ ] 9. Add performance optimizations
  - [x] 9.1 Implement traversal limits and caching
    - Add maximum depth enforcement (5 levels) and node count limits
    - Implement early termination for very large impact sets
    - Add caching for repeated analysis of same files
    - _Requirements: 7.1, 7.2_

  - [x] 9.2 Optimize animation performance
    - Limit animated nodes to maximum of 100 for performance
    - Implement debouncing for rapid successive tool calls
    - Add memory cleanup for animation resources
    - _Requirements: 3.1, 3.2_

- [ ] 10. Integration testing and validation
  - [ ] 10.1 Test MCP tool registration and basic functionality
    - Verify tool appears in MCP tools list when server starts
    - Test basic tool execution with valid parameters
    - Validate error handling for invalid inputs
    - _Requirements: 6.1, 6.2_

  - [ ] 10.2 Test end-to-end impact analysis flow
    - Test complete flow from MCP call to visual animation
    - Verify risk score calculation accuracy with known test cases
    - Test animation rendering and cleanup in graph canvas
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_