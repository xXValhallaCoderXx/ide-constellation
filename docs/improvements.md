# Scanner Command & Worker - Improvements

## Current Concerns

### Large Project Data Transfer Limitations

**Issue**: The current implementation sends dependency-cruiser results via worker thread messages, which may have practical limits for large projects.

**Details**:
- Node.js worker threads serialize/deserialize messages, which can be expensive for large JSON objects
- Dependency-cruiser can generate 10MB+ JSON outputs on large codebases
- Large message passing can cause memory spikes and performance degradation
- May lead to blocking behavior or failures on very large projects

**Current Status**: Works well for small-medium projects (MVP validation), but may encounter issues on enterprise-scale codebases.

## Proposed Improvements

### 1. Size-Based Graceful Degradation (Quick Fix)
**Effort**: Low | **Impact**: Medium

- Add JSON size check before sending results
- If size exceeds threshold (e.g., 5MB):
  - Option A: Truncate results with warning message
  - Option B: Write to temporary file and send file path instead
- Prevents crashes while maintaining current simple architecture

### 2. Chunked Streaming Results (Robust Solution)
**Effort**: Medium | **Impact**: High

- Break large results into smaller chunks
- Send results progressively via multiple messages
- Implement reassembly logic in MCP server
- Add progress reporting for user feedback
- Maintains real-time streaming while handling large datasets

### 3. File-Based Result Transfer (Scalable Solution)
**Effort**: Medium | **Impact**: High

- Write dependency-cruiser results to temporary file
- Send file path via worker message
- MCP server reads file and cleans up afterward
- Eliminates message size limitations entirely
- Best for very large projects and enterprise use

### 4. Result Compression (Optimization)
**Effort**: Low | **Impact**: Medium

- Compress JSON results before sending
- Use gzip or similar compression
- Reduces message size by 70-80% typically
- Can be combined with other approaches

### 5. Selective Result Filtering (Smart Reduction)
**Effort**: Medium | **Impact**: Medium

- Allow configuration of what data to include in results
- Filter out verbose metadata for large projects
- Provide summary-only mode for initial scans
- Full details available on-demand for specific modules

## Recommended Implementation Order

1. **Phase 1 (MVP+)**: Size-based graceful degradation (#1)
2. **Phase 2 (Production)**: File-based transfer (#3) + Compression (#4)
3. **Phase 3 (Enterprise)**: Selective filtering (#5) + Chunked streaming (#2)

## Additional Considerations

- **Memory Management**: Monitor worker thread memory usage
- **Error Handling**: Improve error messages for large project failures
- **User Experience**: Add progress indicators for long-running scans
- **Configuration**: Allow users to set size limits and behavior preferences
- **Monitoring**: Add metrics for scan performance and result sizes