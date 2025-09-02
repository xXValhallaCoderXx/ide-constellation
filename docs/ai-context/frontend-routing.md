## Purpose of This Document

Describe how the extension's webview UI is organized: panel types, component entry points, and message-driven navigation patterns.

## High-Level Structure

The project delivers a VS Code extension with one or more webview panels rather than a traditional SPA router. Logical "routes" are represented by:

- Distinct panels (Graph Panel, Health Dashboard)
- Component sub-mounts within a single webview root (React/Preact style composition)
- Message commands (`panel:open`, `graph:highlightNode`, etc.)

## Entry Points & Panel Types

- `webview.service.ts` – Manages creation and lifecycle of the primary Constellation panel.
- Dashboard provider (`webview/providers/health-dashboard.provider.ts`) – Dedicated panel for health metrics UI.
- Sidebar provider (`webview/providers/sidebar.provider.ts`) – Contributes a view to the activity bar container.

## UI Directory Layout (`src/webview/ui`)

- `dashboard-health/` – Components & hooks for the health dashboard view.
- `graph-constellation/` – Graph visualization assets (styles, components) layered atop Cytoscape.
- `extension-sidebar/` – Sidebar-specific UI (launch, feature toggles, quick actions).
- `shared/` – Shared messaging helpers (`postMessage.ts`).

## Implicit Routing Flow

Navigation is event/message based:

1. Sidebar or dashboard posts `panel:open` with a target key.
2. `PanelRegistry` (via `WebviewManager`) opens/creates the appropriate panel instance.
3. Focus and state hydration performed on reveal (e.g., graph requests `graph:request`).

## Message-Oriented View Switching

The graph panel responds to commands:

- `graph:applyHeatmap` – Applies heatmap layer & optional focus node.
- `graph:highlightNode` – Visual highlight for active editor link sync.

Health dashboard responds to:

- `health:response` – Renders entire analysis payload.
- `dashboard:highlightRisk` (sent from graph) – Cross-panel focus.

## Visual Instruction Dispatch

Option B event bridge emits `visualInstruction` → translated to `test:visualEvent` (prototype) → front-end can interpret and animate (e.g., impact ripple, heatmap overlay).

## Styling Organization

Styles separated by domain under each feature folder (`graph-constellation/styles/*`, etc.) and imported via the root webview HTML for consistent CSP compliance.

## Future Routing Enhancements

- Introduce an internal client-side state machine to coordinate multi-step visualization sequences.
- Add URL fragment simulation (hash-based) to preserve panel sub-state across reloads.
- Consider virtualization for large node sets (progressive render / skeleton states).
