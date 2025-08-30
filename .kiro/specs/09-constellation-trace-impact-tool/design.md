# Design Document

## Overview

The constellation_trace_impact tool is an MCP tool that provides intelligent impact analysis for code changes. It leverages the existing GraphService to traverse dependency relationships and calculate the "blast radius" of proposed changes. The tool returns both AI-consumable text summaries and visual instructions for graph animation, enabling developers to understand the downstream consequences of code modifications before making them.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  MCP Server      │───▶│ Impact Analyzer │
│   (Kiro AI)     │    │  (stdio)         │    │   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │               ┌─────────────────┐
                                │               │  GraphService   │
                                │               │  (existing)     │
                                │               └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Webview Manager │    │ Dependency      │
                       │ (visual routing)│    │ Traversal       │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Graph Animation │
                       │ (ripple effect) │
                       └─────────────────┘
```

### Integration Points

1. **MCP Server Integration**: Registers as a new tool in the existing MCP stdio server
2. **GraphService Integration**: Uses existing graph data and reverse dependency index
3. **Visual Instruction System**: Leverages existing visual instruction routing to webview
4. **Webview Integration**: Extends existing graph canvas with impact animation capabilities

## Components and Interfaces

### 1. MCP Tool Registration

**File**: `src/mcp/tools/trace-impact.tool.ts`

```typescript
export interface TraceImpactInput {
  target: string;        // File path to analyze
  changeType: 'refactor' | 'delete' | 'modify' | 'add-feature';
  depth?: number;        // Traversal depth (default: 3, max: 5)
}

export interface TraceImpactOutput {
  summary: string;       // Markdown formatted summary for AI
  riskScore: number;     // 0-10 risk score
  impactedFiles: ImpactedFile[];
  recommendations: string[];
  visualInstruction: VisualInstruction;
}
```

### 2. Impact Analysis Service

**File**: `src/services/impact-analyzer/impact-analyzer.service.ts`

```typescript
export class ImpactAnalyzer {
  constructor(private graphService: GraphService) {}
  
  analyzeImpact(target: string, changeType: string, depth: number): ImpactAnalysis;
  private traverseDependencies(nodeId: string, depth: number): TraversalResult;
  private calculateRiskScore(impactedFiles: ImpactedFile[]): number;
  private generateRecommendations(analysis: ImpactAnalysis): string[];
}

export interface ImpactAnalysis {
  target: string;
  changeType: string;
  impactedFiles: ImpactedFile[];
  riskScore: number;
  circularDependencies: string[][];
  recommendations: string[];
}

export interface ImpactedFile {
  nodeId: string;
  path: string;
  impactLevel: ImpactLevel;
  distance: number;      // Hops from target
  reason: string;        // Why this file is impacted
}

export enum ImpactLevel {
  CRITICAL = 'critical',  // Direct dependency, will break
  HIGH = 'high',         // 1 hop away, likely affected  
  MEDIUM = 'medium',     // 2 hops away, may be affected
  LOW = 'low'           // 3+ hops away, unlikely affected
}
```

### 3. Visual Animation System

**File**: `src/types/impact-animation.types.ts`

```typescript
export interface ImpactAnimationInstruction extends VisualInstruction {
  action: 'applyImpactAnimation';
  payload: {
    targetNode: string;
    impactedNodes: AnimatedNode[];
    animationConfig: {
      duration: number;
      staggerDelay: number;
      easing: string;
    };
    riskScore: number;
    changeType: string;
  };
}

export interface AnimatedNode {
  nodeId: string;
  impactLevel: ImpactLevel;
  distance: number;
  delay: number;        // Animation delay in ms
  color: string;        // Color based on impact level
}
```

### 4. Graph Canvas Animation Extension

**File**: `src/webview/ui/graph-constellation/components/ImpactAnimationHandler.tsx`

```typescript
export interface ImpactAnimationHandler {
  applyImpactAnimation(instruction: ImpactAnimationInstruction): void;
  private animateRippleEffect(targetNode: string, impactedNodes: AnimatedNode[]): void;
  private applyNodeColors(nodes: AnimatedNode[]): void;
  private resetAnimation(): void;
}
```

## Data Models

### Impact Analysis Data Flow

```typescript
// Input from MCP client
TraceImpactInput → ImpactAnalyzer → GraphService.getDependentsOf()
                                 ↓
// Internal processing
DependencyTraversal → RiskCalculation → RecommendationGeneration
                                 ↓
// Output to client
ImpactAnalysis → DualToolResponse<TraceImpactOutput>
              ↓
// Visual routing
VisualInstruction → WebviewManager → GraphCanvas Animation
```

### Risk Score Calculation

```typescript
interface RiskScoreFactors {
  directImpacts: number;      // Files that import target directly
  secondaryImpacts: number;   // Files 1 hop away
  tertiaryImpacts: number;    // Files 2+ hops away
  circularDeps: number;       // Circular dependency chains
  changeTypeMultiplier: number; // Based on change type severity
}

// Risk score formula (Phase 1)
riskScore = Math.min(10, (
  (directImpacts * 100) + 
  (secondaryImpacts * 50) + 
  (tertiaryImpacts * 25) +
  (circularDeps * 200)
) * changeTypeMultiplier / 100);
```

### Change Type Multipliers

```typescript
const CHANGE_TYPE_MULTIPLIERS = {
  'delete': 1.5,      // Highest risk - removes functionality
  'refactor': 1.2,    // High risk - changes interfaces
  'modify': 1.0,      // Base risk - changes implementation
  'add-feature': 0.8  // Lower risk - additive changes
};
```

## Error Handling

### Input Validation

1. **Target File Validation**
   - Verify file exists in graph
   - Ensure path is within workspace bounds
   - Handle non-existent files gracefully

2. **Parameter Validation**
   - Validate changeType enum values
   - Clamp depth parameter (1-5 range)
   - Provide sensible defaults

### Error Recovery

1. **Graph Service Failures**
   - Fallback to basic file existence check
   - Provide limited analysis without full graph
   - Clear error messages for missing graph data

2. **Traversal Failures**
   - Handle circular dependency loops
   - Timeout protection for large graphs
   - Graceful degradation for incomplete traversals

3. **Animation Failures**
   - Continue with text-only response if visual fails
   - Log animation errors without blocking analysis
   - Provide fallback static highlighting

## Testing Strategy

### Unit Testing Approach

Following the persona.md directive, unit tests will be skipped. However, the design includes testable interfaces and clear separation of concerns to support future testing if needed.

### Integration Testing Points

1. **MCP Tool Registration**: Verify tool appears in tools list
2. **GraphService Integration**: Ensure proper dependency traversal
3. **Visual Instruction Routing**: Confirm animation messages reach webview
4. **End-to-End Flow**: Complete analysis from MCP call to visual result

### Manual Testing Scenarios

1. **Small Impact**: Modify a leaf node file
2. **Medium Impact**: Refactor a utility file with moderate dependencies
3. **High Impact**: Delete a core service file
4. **Circular Dependencies**: Analyze files involved in circular imports
5. **Large Graphs**: Test performance on projects with 1000+ files

## Performance Considerations

### Optimization Strategies

1. **Traversal Limits**
   - Maximum depth of 5 levels
   - Early termination for large impact sets
   - Circular dependency detection to prevent infinite loops

2. **Caching Strategy**
   - Leverage existing GraphService cache
   - Cache traversal results for repeated queries
   - Invalidate cache on graph changes

3. **Animation Performance**
   - Limit animated nodes to 100 maximum
   - Use CSS transforms for smooth animations
   - Debounce rapid successive calls

### Memory Management

1. **Large Graph Handling**
   - Stream processing for very large dependency sets
   - Garbage collection of temporary traversal data
   - Memory-efficient data structures

2. **Animation Cleanup**
   - Remove animation event listeners
   - Clear animation timers on component unmount
   - Reset graph state after animation completion

## Security Considerations

### Path Security

1. **Workspace Containment**
   - Use existing `resolveWorkspacePath` utility
   - Prevent directory traversal attacks
   - Validate all file paths against workspace bounds

2. **Input Sanitization**
   - Sanitize file paths and parameters
   - Validate enum values strictly
   - Prevent injection through malformed inputs

### Resource Protection

1. **DoS Prevention**
   - Limit traversal depth and breadth
   - Timeout long-running analyses
   - Rate limiting for rapid successive calls

2. **Memory Protection**
   - Cap maximum number of analyzed files
   - Prevent memory exhaustion on large graphs
   - Clean up resources after analysis

## Future Extensibility

### Phase 2 Enhancements

The design supports future enhancements without breaking changes:

1. **Function-Level Analysis**: Extend to analyze specific method impacts
2. **Cross-Repository Impact**: Support monorepo and multi-repo scenarios
3. **Historical Analysis**: Track prediction accuracy over time
4. **ML-Based Recommendations**: Replace rule-based recommendations with learned patterns

### Plugin Architecture

The modular design allows for:

1. **Custom Risk Calculators**: Pluggable risk scoring algorithms
2. **Custom Recommendation Engines**: Domain-specific safeguard suggestions
3. **Custom Animation Styles**: Different visual effects for different change types
4. **External Integrations**: Connect to CI/CD systems, issue trackers, etc.

## Implementation Dependencies

### Required Changes to Existing Code

1. **MCP Server Registration**: Add tool to `CONSTELLATION_TRACE_IMPACT_TOOL` in `mcp.types.ts`
2. **Tool Handler**: Add case in `mcp-stdio.server.ts` CallToolRequestSchema handler
3. **Webview Message Types**: Extend `messages.types.ts` with impact animation messages
4. **Graph Canvas**: Add impact animation handler to existing graph components

### New Files Required

1. `src/mcp/tools/trace-impact.tool.ts` - Main tool implementation
2. `src/services/impact-analyzer/impact-analyzer.service.ts` - Core analysis logic
3. `src/services/impact-analyzer/impact-types.ts` - Type definitions
4. `src/types/impact-animation.types.ts` - Animation type definitions
5. `src/webview/ui/graph-constellation/components/ImpactAnimationHandler.tsx` - Animation logic

### Minimal Code Changes

The design minimizes changes to existing code by:

1. Reusing existing GraphService and dependency traversal
2. Leveraging existing visual instruction routing system
3. Extending existing graph canvas rather than replacing it
4. Following established patterns for MCP tool registration