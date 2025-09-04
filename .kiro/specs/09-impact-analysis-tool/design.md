# Design Document

## Overview

The Impact Analysis Tool provides developers with detailed "blast radius" reports for code changes by analyzing file dependencies and dependents. The system leverages the existing constellation graph infrastructure to deliver fast, accurate impact analysis through an MCP tool interface. The design emphasizes robust path handling, graceful error recovery, and efficient lookups using the existing reverse-dependency index.

## Architecture

### High-Level Flow

1. **MCP Tool Request** → `constellation_impact_analysis` tool receives file path
2. **Path Resolution** → Normalize and validate file path with fuzzy matching fallback
3. **Graph Loading** → Ensure dependency graph is available (cache or fresh scan)
4. **Impact Analysis** → Use reverse-dependency index for dependents, parse edges for dependencies
5. **Response Generation** → Format structured JSON response with summary and impact graph

### Component Integration

The impact analysis integrates with existing services:
- **GraphService**: Provides graph data and reverse-dependency index
- **GraphCache**: Ensures fast access to dependency data
- **MCP Server**: Handles tool registration and request routing
- **Path Utils**: Provides secure path resolution and validation
- **Error Handling**: Ensures graceful degradation and helpful error messages

## Components and Interfaces

### ImpactAnalyzerService

**Location**: `src/services/impact-analyzer.service.ts`

**Core Method**:
```typescript
static analyze(
  graph: IConstellationGraph, 
  filePath: string, 
  workspaceRoot: string
): ImpactAnalysisResult
```

**Responsibilities**:
- Normalize and resolve file paths with fuzzy matching
- Extract direct dependents using reverse-dependency index
- Extract direct dependencies by parsing graph edges
- Generate human-readable impact summary
- Create filtered impact graph for visualization

### MCP Tool Integration

**Tool Name**: `constellation_impact_analysis`

**Input Schema**:
```typescript
{
  filePath: string;        // Required: workspace-relative file path
  changeType?: string;     // Optional: 'addition' | 'modification' | 'deletion'
}
```

**Output Schema**:
```typescript
{
  impactSummary: string;           // Human-readable summary
  dependents: string[];            // Files that depend on target
  dependencies: string[];          // Files that target depends on
  impactGraph: IConstellationGraph; // Filtered graph subset
  pathResolution: {                // Path handling metadata
    originalPath: string;
    resolvedPath: string;
    fuzzyMatched: boolean;
    suggestions?: string[];
  };
}
```

### Path Resolution Strategy

**Normalization Pipeline**:
1. Convert backslashes to forward slashes
2. Resolve relative paths against workspace root
3. Validate path is within workspace bounds
4. Check exact match in graph nodes
5. If no exact match, perform fuzzy matching
6. Return suggestions with confidence scores

**Fuzzy Matching Algorithm**:
- Levenshtein distance for similar file names
- Partial path matching for directory changes
- File extension matching for renamed files
- Confidence scoring (0-100) for match quality

## Data Models

### ImpactAnalysisResult

```typescript
interface ImpactAnalysisResult {
  impactSummary: string;
  dependents: string[];
  dependencies: string[];
  impactGraph: IConstellationGraph;
  pathResolution: IPathResolution;
  metadata: IAnalysisMetadata;
}
```

### IPathResolution

```typescript
interface IPathResolution {
  originalPath: string;
  resolvedPath: string;
  fuzzyMatched: boolean;
  matchConfidence?: number;
  suggestions?: IPathSuggestion[];
}
```

### IPathSuggestion

```typescript
interface IPathSuggestion {
  path: string;
  confidence: number;
  reason: 'similar_name' | 'partial_path' | 'same_extension';
}
```

### IAnalysisMetadata

```typescript
interface IAnalysisMetadata {
  timestamp: string;
  analysisTimeMs: number;
  graphNodeCount: number;
  cacheUsed: boolean;
  changeType?: string;
}
```

## Error Handling

### Error Categories and Responses

**File Not Found**:
- Attempt fuzzy matching
- Return suggestions with confidence scores
- Provide helpful error message with alternatives

**Path Security Violations**:
- Reject paths outside workspace bounds
- Log security attempt for monitoring
- Return clear error about workspace containment

**Graph Unavailable**:
- Automatically trigger project scan
- Provide progress feedback to user
- Fall back to empty analysis if scan fails

**Performance Issues**:
- Timeout protection for large graphs
- Memory usage monitoring
- Graceful degradation for oversized results

### Error Response Format

```typescript
interface IErrorResponse {
  error: string;
  errorCode: 'FILE_NOT_FOUND' | 'PATH_SECURITY' | 'GRAPH_UNAVAILABLE' | 'ANALYSIS_TIMEOUT';
  suggestions?: string[];
  recoveryActions?: string[];
}
```

## Testing Strategy

### Unit Tests

**ImpactAnalyzerService Tests**:
- Path normalization and resolution
- Fuzzy matching algorithm accuracy
- Dependency extraction correctness
- Error handling for edge cases

**Path Resolution Tests**:
- Security boundary validation
- Cross-platform path handling
- Fuzzy matching confidence scoring
- Performance with large file lists

### Integration Tests

**MCP Tool Tests**:
- End-to-end tool execution
- Graph loading and caching behavior
- Error propagation and formatting
- Response schema validation

**Performance Tests**:
- Large graph analysis timing
- Memory usage under load
- Concurrent request handling
- Cache effectiveness measurement

### Test Data Requirements

- Sample projects with various dependency patterns
- Edge cases: circular dependencies, orphaned files
- Cross-platform path variations
- Large graphs (1000+ nodes) for performance testing

## Performance Considerations

### Optimization Strategies

**Reverse-Dependency Index**:
- O(1) lookup for dependents using existing GraphService index
- No additional indexing overhead required
- Memory-efficient storage in Map structure

**Graph Filtering**:
- Create minimal impact graph with only relevant nodes
- Reduce payload size for large codebases
- Maintain referential integrity in filtered graph

**Caching Strategy**:
- Leverage existing GraphCache for dependency data
- Cache fuzzy matching results for repeated queries
- Invalidate caches on file system changes

**Memory Management**:
- Stream processing for large dependency lists
- Lazy loading of graph subsets
- Garbage collection hints for large operations

### Performance Targets

- **Analysis Time**: < 100ms for typical files (< 50 dependents)
- **Memory Usage**: < 50MB additional overhead per analysis
- **Fuzzy Matching**: < 50ms for 1000+ file candidates
- **Graph Filtering**: < 200ms for graphs with 5000+ nodes

## Security Considerations

### Path Traversal Prevention

- All file paths validated against workspace bounds
- Relative path resolution secured using existing path utilities
- Rejection of absolute paths outside workspace
- Logging of security violations for monitoring

### Input Validation

- File path sanitization and normalization
- Change type parameter validation
- Request size limits to prevent DoS
- Rate limiting for repeated requests

### Data Exposure

- Only workspace-contained files included in analysis
- No sensitive file content exposed in responses
- Path information limited to workspace-relative paths
- Error messages avoid exposing system paths

## Future Enhancements

### Multi-Hop Analysis

- Transitive dependency analysis (2+ hops)
- Configurable depth limits
- Impact radius visualization
- Performance optimization for deep analysis

### Change-Type Specific Logic

- Different analysis strategies per change type
- Addition: focus on integration points
- Modification: emphasize dependent validation
- Deletion: highlight breaking change risks

### Integration Enhancements

- VS Code editor integration for inline impact display
- Git integration for commit-time impact analysis
- CI/CD pipeline integration for automated impact reports
- Team notification system for high-impact changes