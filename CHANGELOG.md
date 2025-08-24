# Change Log

All notable changes to the "kiro-constellation" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added
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

### Initial
- Initial release