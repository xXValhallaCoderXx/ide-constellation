## Purpose of This Document

Summarize external libraries / services the extension relies on and their architectural role.

## Overview

The project is self-contained (no external network SaaS dependencies) but integrates several open-source libraries for graph analysis, visualization, and protocol tooling.

## Libraries & Roles

### `dependency-cruiser`

- Purpose: Static analysis of workspace dependencies to produce a raw module graph.
- Usage: Invoked via worker thread inside `GraphService.performScan()` (indirect through scan worker script) feeding transformation pipeline.

### `cytoscape`

- Purpose: Client-side graph visualization / layouting.
- Role: Underpins the main dependency graph panel rendering & interactive animations.

### `@modelcontextprotocol/sdk`

- Purpose: Implements MCP server capabilities (stdio transport, tool schemas).
- Role: Exposes tooling (graph summary, health report, impact analysis) to AI model clients.

### `preact`

- Purpose: Lightweight UI component framework for webview content.
- Role: Health dashboard and future composite UI panels.

### Node.js Core (worker_threads, crypto, events)

- Worker Threads: Offload dependency scans to avoid blocking extension host.
- Crypto: Hash graph metadata for cache keys (HealthAnalyzer & GraphCache validation flows).
- Events: Option B event bridge for visual instruction emission.

## Local Git (via `GitAnalyzer`)

- Interacts with the local `.git` repository to derive churn metrics (commit counts per file). No external API calls; purely shell / filesystem based access.

## No External Cloud Services

- No calls to payment processors, email APIs, or cloud storage present.
- All analysis purely local to user workspace.

## Security / Privacy Considerations

- All dependency and complexity analysis occurs locally; no file contents transmitted externally by these integrations.
- Potential future risk: adding remote telemetry would require explicit opt-in & sanitization.

## Future Integration Opportunities

- Code coverage ingestion (e.g., LCOV parser) to enhance health scoring.
- Security vulnerability feeds (advisory DB) cross-referenced to dependency graph.
- Language server protocol (LSP) metrics to enrich node attributes (diagnostics density).
