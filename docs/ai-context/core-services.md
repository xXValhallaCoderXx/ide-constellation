## Purpose of This Document

High-level overview of core analytical and orchestration services that power the Constellation VS Code extension. Provides future AI agents a map of major service responsibilities and their interplay.

## Overview

Constellation centers around building a dependency graph of the workspace, enriching it with health + risk metrics, and routing insights/visual instructions to webviews. Services are predominantly singleton-style for stateful caches (graph, metrics, analysis).

## Service Catalog

### GraphService (`src/services/graph.service.ts`)

- Role: Loads and transforms project dependency data into an in‑memory graph (`nodes`, `edges`).
- Features: Cache-first load via `GraphCache`; worker-thread scanning; builds reverse dependency index for O(1) inbound lookup; clears state on each fresh load.
- Key Methods: `loadGraph()`, `getGraph()`, `getDependentsOf()`, `clear()`.

### GraphCache (`src/services/graph-cache.service.ts`)

- Role: Persist / retrieve serialized graph artifacts under a workspace cache directory to avoid redundant scans.
- Used By: `GraphService` (optimistic load, validation) and summary/health tool flows.

### GraphTransformer (`src/services/graph-transformer.service.ts`)

- Role: Normalizes raw scan output into the canonical `IConstellationGraph` shape; applies path normalization & metadata annotation.

### ComplexityAnalyzer (`src/services/complexity-analyzer.service.ts`)

- Role: Computes cyclomatic complexity & related metrics per file. Consumed during health analysis.

### GitAnalyzer (`src/services/git-analyzer.service.ts`)

- Role: Derives churn / commit frequency metrics for files (historical volatility indicator).
- Caching: Shares a `MetricsCache` instance to avoid repeated git calls.

### MetricsCache (`src/services/metrics-cache.service.ts`)

- Role: In-memory TTL / result store for computed metrics & analysis outputs (complexity, churn, health analysis).
- Benefits: Reduces recomputation cost for large codebases.

### HealthAnalyzer (`src/services/health-analyzer.service.ts`)

- Role: Orchestrates holistic health scoring: gathers complexity, churn, dependency degree; calculates normalized risk percentiles; aggregates distribution & recommendations.
- Flow: (1) Acquire graph (direct or via `GraphService`), (2) batch analyze files, (3) compute risk scores, (4) build overall HealthAnalysis structure.
- Optimizations: Batch processing with adaptive batch size reduction; resource checks; caching by graph hash.

### RecommendationsEngine (`src/services/recommendations-engine.service.ts`)

- Role: Converts risk profile & distribution into actionable remediation suggestions.

### PanelRegistry (`src/services/panel-registry.service.ts`)

- Role: Central lookup / lifecycle management for multiple VS Code webview panels (graph, health dashboard, future panels).

### SummaryGenerator (`src/services/summary-generator.service.ts`)

- Role: Produces human/LLM friendly textual summaries & structural insights (hubs, cycles, orphans) from the dependency graph.

### Impact Analyzer (composed under `src/services/impact-analyzer/`)

- Role: Performs change impact propagation given a target file + change type + depth; returns impacted file set & visual instruction payload for animation.

### Bridge Services (`src/services/bridge/*`)

- Role: Experimental transports (IPC, file) for future cross-process event routing (post Option A failure); potential backbone for standardized visual instruction event bridge.

## Cross-Service Data Flow

1. Scan Initiation → `GraphService.loadGraph()` (worker thread) → graph cached.
2. Health Report → `HealthAnalyzer.analyzeCodebase()` → uses graph + complexity + git → `RecommendationsEngine` → webview visualization via visual instruction.
3. Impact Trace → Impact analyzer service → returns dual payload (AI text + visual instruction) → event emission / provider routing → webview.
4. Summaries → `SummaryGenerator.generate()` packaged for AI consumption & potential overlay.

## State & Caching Strategy

- Graph: Single active instance per workspace load; replaced on each scan.
- Metrics: Cached by file path & analysis hash to accelerate iterative queries.
- Health Analysis: Cached by graph structural hash (node/edge counts & metadata) to reuse when code unchanged.

## Error & Resilience Patterns

- Worker thread isolation for scans (keeps UI responsive).
- Graceful degradation utilities (fallback metrics, reduced batch size) in health analysis path.
- Defensive path validation ensures scan/impact target remains inside workspace root.

## Extension Interaction

- Commands trigger scans and dashboards.
- Event-driven or provider-based routing delivers visual instructions to `WebviewManager`.
- Webviews request data (graph/health) on demand; services respond via messaging layer.

## Not In Scope Here

Authentication, external API integrations, database or persistent storage: none present in repository.

## Future Considerations

- Add persistent disk cache invalidation heuristics (mtime hashing).
- Introduce pluggable metric providers (security, coverage) feeding into HealthAnalyzer.
- Unify event bridge transport selection (IPC vs file) under a single strategy interface.
