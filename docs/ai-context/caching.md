## Purpose of This Document

Outline caching layers and strategies used to accelerate graph, metrics, and analysis operations.

## Caching Layers

### 1. Graph Cache (`GraphCache`)

- Scope: Entire dependency graph structure (nodes + edges + metadata).
- Storage: Workspace `.constellation-cache` directory (JSON file like `graph-v1.json`).
- Usage Flow: `GraphService.loadGraph()` attempts `GraphCache.load()` before performing fresh scan. On miss, performs scan then `GraphCache.save()`.
- Validation: (Planned / partially implemented) potential timestamp / mtime comparisons before trusting cache.

### 2. Reverse Dependency Index (In-Memory)

- Built by `GraphService.buildReverseDependencyIndex()` after graph load.
- Purpose: Fast O(1) lookup of files that depend on a given target (incoming edges) to support impact & health metrics.
- Reset: Rebuilt on each new scan (state cleared via `clear()`).

### 3. Metrics Cache (`MetricsCache`)

- Scope: Complexity metrics, git churn metrics, health analyses keyed by graph hash.
- Benefits: Avoid recomputing expensive file-level analyses across repeated dashboard requests.
- Eviction: Manual `clear()` / `dispose()`; minimal advanced eviction logic at present.

### 4. Health Analysis Hashing

- Hash Source: Graph structural metadata (`nodeCount`, `edgeCount`, `timestamp`, `scanPath`).
- Function: MD5 hash computed to generate stable cache keys for a given graph snapshot.

## Cache Invalidation Triggers

| Layer           | Invalidation Mechanism                                    |
| --------------- | --------------------------------------------------------- |
| GraphCache      | Manual re-scan (force refresh) or future validation hooks |
| Reverse Index   | Automatic rebuild after any graph load                    |
| MetricsCache    | Manual clear; new graph hash results in distinct entries  |
| Health Analysis | New graph hash invalidates prior analysis                 |

## Performance Considerations

- Worker thread scanning reduces main thread latency; cache short-circuits subsequent scans.
- Batch processing in `HealthAnalyzer` pairs well with cached complexity/churn results; only new/changed files pay cost.
- Reverse dependency index avoids repeated edge traversal in impact & dependency degree calculations.

## Risks / Limitations

- No time-based automatic eviction; long sessions could accumulate stale metric entries if many graph variants generated.
- GraphCache trust model simplistic; file modifications outside expected patterns could yield stale graph until manual refresh.

## Future Improvements

- Introduce checksum/mtime-based validation before accepting cached graph.
- Add size-based LRU to `MetricsCache` with telemetry insights.
- Persist health analyses keyed by graph hash to disk for instant dashboard load after restart.
