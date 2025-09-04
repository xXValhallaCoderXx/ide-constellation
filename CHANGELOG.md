# Change Log

All notable changes to the "kiro-constellation" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
- Resilient path resolution for `constellation_impact_analysis` tool:
	- Introduced `findNodeFuzzy` with ordered strategies (exact id, absolute path, unique suffix, unique filename)
	- Clear ambiguity detection (suffix/filename) returns actionable error reasons
	- Standardized logging: `[IMPACT_ANALYSIS] action=resolve status=<success|failure> input='<raw>' resolved='<id>' strategy='<reason>'`
	- Integrated into MCP server prior to analysis; prevents brittle "File not found" outcomes
	- Non-invasive change: no new dependencies, preserves existing pathResolution metadata downstream
- Two-way editor synchronization feature (FR1–FR20):
	- Open file from graph node (with split view via modifier key)
	- Active editor -> graph node highlight with auto-pan & zoom heuristic
	- Status bar feedback for files not in graph
	- Secure path resolution & workspace containment guard
	- Debounced editor change handling to reduce chatter
	- Resilience improvements (guarded messaging, unhandled rejection logging)
- visualInstruction Pattern (Task 4): dual payload tool response contract with optional UI routing
	- Dual interfaces (VisualInstruction, DualToolResponse, ParsedToolEnvelope)
	- Summary tool refactored to emit dual payload + placeholder action
	- Provider-level parsing, debounce (50ms), size guard (1MB), truncation (5000 chars)
	- Panel auto-creation & reveal for visual instructions
	- Resilient logging & non-blocking error handling

### Changed
- Project Cleanup & Structure Optimization (FR1–FR20):
	- Unified webview structure under `src/webview/ui/*` (graph, health, sidebar) – removed legacy `panels/` & `sidebar/`.
	- Introduced single `PanelRegistry` instance with standardized logs `[timestamp] [LEVEL]`.
	- Replaced deep relative imports with path aliases (`@/*`, `@webview/*`).
	- Consolidated CSS imports into `styles/main.css`; removed legacy panel style paths.
	- Updated root & webview README docs (architecture, FR outcomes, scripts, future enhancements).
	- Ensured worker bundle `dist/workers/scanWorker.mjs` resilience; validated scan in standalone Node context.
	- MCP server bundle confirmed (`out/mcp-server.js`) with path resolution via provider.
	- Security: path guards intact; CSP unchanged across providers.
	- Logging consistency audit complete (INFO/WARN/ERROR unified format).
	- Added outcome summary table (README) referencing FR coverage.
	- Performance baseline & alias refactor produced no build breakages (timing variance check pending final measurement in Section 16).

### Initial
- Initial release