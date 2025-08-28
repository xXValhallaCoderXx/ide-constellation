# Kiro Constellation – Feature Report and Test Plan

This document summarizes the expected features and behaviors of the current application and provides a test plan to validate functionality. Links reference relevant files or declarations in the codebase for quick navigation.

## Overview

Kiro Constellation is a VS Code extension that:

- Scans a workspace to build a dependency graph.
- Provides two primary views:
  - Dependency Graph Panel
  - Health Dashboard Panel
- Offers health analysis derived from complexity, churn, and dependency data with actionable insights and exports.

Core infrastructure:

- Graph management via [GraphService](src/services/graph.service.ts:1) with cache ([GraphCache](src/services/graph-cache.service.ts:7)) and transformation ([GraphTransformer](src/services/graph-transformer.service.ts:6)).
- Risk Analysis Engine via [HealthAnalyzer](src/services/health-analyzer.service.ts:25), using [ComplexityAnalyzer](src/services/complexity-analyzer.service.ts:13), [GitAnalyzer](src/services/git-analyzer.service.ts:17), [MetricsCache](src/services/metrics-cache.service.ts:9), and [RecommendationsEngine](src/services/recommendations-engine.service.ts:10).
- Health Dashboard panel provider [HealthDashboardProvider](src/webview/providers/health-dashboard.provider.ts:13) and Preact UI [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx:1).
- Central panel orchestration via [PanelRegistry.open()](src/services/panel-registry.service.ts:11).
- MCP tool generates graph summaries leveraging [SummaryGenerator](src/services/summary-generator.service.ts:13).

Note: Legacy platform events removed — folder [events](src/services/events/events.types.ts) was unused and has been deleted.

## Commands

- Open Health Dashboard:
  - Command id: constellation.healthDashboard
  - Path: [extension.ts](src/extension.ts:139)
  - Registry delegation: [PanelRegistry.open()](src/services/panel-registry.service.ts:11)
- Analyze Health (flows through Health Dashboard and logs summary):
  - Command id(s): constellation.analyzeHealth (and legacy aliases as defined in package.json)
  - Core flow: [extension.ts](src/extension.ts:139)
- Scan Project:
  - Command id: constellation.scanProject
  - Triggered by webview message project:scan in [WebviewManager.handleWebviewMessage()](src/webview/webview.service.ts:97)

Acceptance:

- Executing constellation.healthDashboard opens or reveals the Health Dashboard via [WebviewManager.createOrShowHealthDashboard()](src/webview/webview.service.ts:736).
- Executing constellation.analyzeHealth runs analysis using [HealthAnalyzer.getInstance()](src/services/health-analyzer.service.ts:46) and displays the dashboard with results.

## Panels and Routing

- Panel Registry resolves panel keys to implementations:
  - dependencyGraph → [WebviewManager.createOrShowPanel()](src/webview/webview.service.ts:41)
  - healthDashboard → [WebviewManager.createOrShowHealthDashboard()](src/webview/webview.service.ts:736)
- Entry point for typed open messages: [PanelRegistry.open()](src/services/panel-registry.service.ts:11)

Acceptance:

- panel:open messages with key healthDashboard or dependencyGraph correctly open the destination panel and log origin context.

## Health Dashboard (Webview) – Features

Entry points and composition:

- UI component: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx:1)
- Hook managing state and messages: [useHealthAnalysis()](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts:43)
- Message helpers: [health.postMessage.ts](src/webview/ui/dashboard-health/health.postMessage.ts:1)
- Components:
  - [ScoreHeader.tsx](src/webview/ui/dashboard-health/components/ScoreHeader.tsx:12)
  - [DistributionGrid.tsx](src/webview/ui/dashboard-health/components/DistributionGrid.tsx:20)
  - [RiskList.tsx](src/webview/ui/dashboard-health/components/RiskList.tsx:21)
  - [Recommendations.tsx](src/webview/ui/dashboard-health/components/Recommendations.tsx:7)

Behavior:

- On mount, dashboard requests analysis (health:request).
- Provider resolves graph (cache-first) and runs [HealthAnalyzer.analyzeCodebase()](src/services/health-analyzer.service.ts:61), then posts health:response.
- Actions bar (currently inline; to be extracted into ActionsBar):
  - Refresh analysis (health:refresh → provider recomputes fresh).
  - Export JSON/CSV (health:export).
  - Show Heatmap (health:showHeatmap) and Focus Node (health:focusNode).
- Risk list:
  - Displays highest-risk files with chips: complexity (Cx), churn (commit count), authors, days since last change, deps, and category color tag.
  - Click → open file; Ctrl/Cmd+Click or Shift+Enter → open split.
  - “🎯 Focus” button → focus node in graph panel.

Acceptance:

- Loading banner on request; error banner on failure.
- Successful export shows success result (health:export:result) reflected in UI banners. Toasts are planned next.
- RiskList accessibility: row has aria-label that includes churn metadata for SR.

## Health Dashboard (Provider) – Behavior

- Provider: [HealthDashboardProvider](src/webview/providers/health-dashboard.provider.ts:13)
- Handles:
  - health:request / health:refresh → loads graph via [GraphService.loadGraph()](src/services/graph.service.ts:34) if needed and runs analysis.
  - health:export → saves JSON/CSV and replies with health:export:result.
  - health:showHeatmap / health:focusNode → cross-panel navigation via [WebviewManager.navigateFromDashboardToGraph()](src/webview/webview.service.ts:765).
  - editor:open → hardened path resolution:
    - Uses [resolveWorkspacePath()](src/utils/path.utils.ts:7).
    - Validates within workspace.
    - Checks existence and shows user-friendly warnings for module-like specifiers (e.g. react-dom/client).
    - Implementation: [HealthDashboardProvider.handleEditorOpen()](src/webview/providers/health-dashboard.provider.ts:316), fallback open in [handleFocusNode()](src/webview/providers/health-dashboard.provider.ts:287).

Acceptance:

- Clicking risk rows or using keyboard triggers editor:open with nodeId (workspace-relative), not module specifiers or absolute paths.
- Module-like ids produce a warning instead of failing with ENOENT and do not crash the provider.

## Dependency Graph Panel – Behavior

- Main panel management: [WebviewManager](src/webview/webview.service.ts:10)
- Graph load:
  - On graph:request, returns [GraphService.getGraph()](src/services/graph.service.ts:84) or loads via [GraphService.loadGraph()](src/services/graph.service.ts:34).
- Heatmap apply:
  - Receives graph:applyHeatmap with heatmap data derived from risk scores and highlights nodes (graph:highlightNode).

Acceptance:

- Cross-panel navigation from dashboard correctly opens the graph panel if needed and posts heatmap data.

## Data and Caching

- Graph caching:
  - [GraphCache.save() / load() / validateCache()](src/services/graph-cache.service.ts:16)
  - Cache invalidated when key files change.
- Metrics caching:
  - [MetricsCache](src/services/metrics-cache.service.ts:9) with TTLs for complexity, churn, and full analyses.
- Risk analysis engine:
  - [HealthAnalyzer.getInstance()](src/services/health-analyzer.service.ts:46) orchestrates analyzers and caching.
  - Recommendations via [RecommendationsEngine.generateRecommendations()](src/services/recommendations-engine.service.ts:17)

Acceptance:

- On repeated analyses without changes, results may come from cache with significantly faster timing (observed via logs).

## Security and Path Handling

- All file-open flows use workspace-relative node ids and [resolveWorkspacePath()](src/utils/path.utils.ts:7).
- Guards:
  - Block outside workspace openings.
  - Check existence and inform user for missing files.
  - Module-like (npm package) specifiers get graceful warnings.

Acceptance:

- Attempting to open “react-dom/client” from RiskList yields a friendly warning, not an exception.

## MCP Server (Summary Feature)

- Summary tool uses:
  - Cache-first graph read via [GraphCache](src/services/graph-cache.service.ts:7) and [GraphService](src/services/graph.service.ts:1).
  - Summary generation via [SummaryGenerator.generate()](src/services/summary-generator.service.ts:17).
- Entry: [mcp-stdio.server.ts](src/mcp/mcp-stdio.server.ts:11)

Acceptance:

- Requesting a graph summary returns metrics, insights, and narrative without requiring the VS Code UI.

## Removed/Unused Services

- Removed: [events.types.ts](src/services/events/events.types.ts) – no references in codebase.
- Verified in-use services (do not remove):
  - [complexity-analyzer.service.ts](src/services/complexity-analyzer.service.ts:1)
  - [git-analyzer.service.ts](src/services/git-analyzer.service.ts:1)
  - [graph-cache.service.ts](src/services/graph-cache.service.ts:1)
  - [graph-transformer.service.ts](src/services/graph-transformer.service.ts:1)
  - [graph.service.ts](src/services/graph.service.ts:1)
  - [health-analyzer.service.ts](src/services/health-analyzer.service.ts:1)
  - [metrics-cache.service.ts](src/services/metrics-cache.service.ts:1)
  - [panel-registry.service.ts](src/services/panel-registry.service.ts:1)
  - [recommendations-engine.service.ts](src/services/recommendations-engine.service.ts:1)
  - [summary-generator.service.ts](src/services/summary-generator.service.ts:1)
  - [health/](src/services/health/) domain services

## Manual Test Plan

1. Health Dashboard opens and loads analysis

- Steps:
  - Run command “Kiro Constellation: Open Health Dashboard” (constellation.healthDashboard).
- Expected:
  - Panel opens via [PanelRegistry.open()](src/services/panel-registry.service.ts:11).
  - Loading info banner appears, then results render (score header, distribution, risks, recommendations).

2. Refresh analysis

- Steps:
  - Click “Refresh Analysis” in the dashboard.
- Expected:
  - health:refresh message is sent; provider performs fresh load and analysis; UI updates with new timestamp.

3. Export health analysis (JSON and CSV)

- Steps:
  - Click Export JSON, then Export CSV.
- Expected:
  - Save dialog appears; after save, success banner shows with URI; underlying handler is [HealthDashboardProvider.handleHealthExport()](src/webview/providers/health-dashboard.provider.ts:166).

4. Show Heatmap and Focus Node

- Steps:
  - Click “Show Heatmap”.
  - In a risk row, click “🎯 Focus”.
- Expected:
  - Graph panel opens (if not open) and displays heatmap or highlights the node via [WebviewManager.navigateFromDashboardToGraph()](src/webview/webview.service.ts:765).

5. Open file from RiskList – default and split

- Steps:
  - Click a risk row → opens file default.
  - Ctrl/Cmd+Click (or Shift+Enter) → opens in split view.
- Expected:
  - [editor:open](src/types/messages.types.ts:51) sent with nodeId and openMode; provider resolves and opens file.
  - Non-existent or module-like identifiers produce friendly warnings.

6. Accessibility checks

- Steps:
  - Tab into the risk list; use Enter/Shift+Enter; check SR output.
- Expected:
  - Risk rows are focusable; aria-label includes path, category, churn metrics.

7. Cache behavior (graph and health)

- Steps:
  - Run analysis twice without changes.
- Expected:
  - Logs indicate cache usage (health analyzer/graph cache) and improved timings.

8. Security and path guards

- Steps:
  - Attempt to open a module-like id (e.g., react-dom/client) from a synthetic risk row, if present.
- Expected:
  - Warning message; no ENOENT crash; audit logs show safe handling inside [handleEditorOpen()](src/webview/providers/health-dashboard.provider.ts:316).

9. MCP summary feature (optional, if MCP tool wired locally)

- Steps:
  - Invoke summary tool (constellation_get_graph_summary) as per MCP integration.
- Expected:
  - Returns narrative, metrics, and insights produced by [SummaryGenerator.generate()](src/services/summary-generator.service.ts:17).

## Non-Functional Expectations

- Performance:
  - Batch processing in [HealthAnalyzer](src/services/health-analyzer.service.ts:180).
  - Cache-first strategies for both graph and analysis.
- Stability:
  - Graceful degradation and error handling in health analyzer domain.
- Security:
  - Workspace-bound file open enforcement via [resolveWorkspacePath()](src/utils/path.utils.ts:7).
- Accessibility:
  - Keyboard and SR-friendly risk list (continues to be enhanced).

## Known Work-in-Progress Items

- Extract an [ActionsBar.tsx](src/webview/ui/dashboard-health/components/ActionsBar.tsx) and plug it into [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx:1).
- Add toasts via [ToastNotification](src/webview/ui/graph-constellation/components/ToastNotification.tsx:1) in dashboard mounting location.
- Explicit Loading/Empty/Error states using [LoadingIndicator](src/webview/ui/graph-constellation/components/LoadingIndicator.tsx:1).
- Hook enhancements: track selectedRisk, handle dashboard:highlightRisk, expose selectRisk().
