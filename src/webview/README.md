# Webview UI Architecture (Unified Structure)

The webview layer is consolidated under a single `ui/` directory housing each application (graph constellation, health dashboard, sidebar) plus shared utilities. Legacy `panels/` & `sidebar/` folders were removed (FR2 / structural cleanup).

There is also a top-level `components/` directory (`src/webview/components`) that holds shared, framework-agnostic UI building blocks (primitives, layout patterns, feedback, theming). Individual app-specific components still live under their respective `ui/<app>/components/` folders; promote only broadly reusable pieces to the shared `components/` root to avoid churn.

## Current Directory Structure

```
src/webview/
├── providers/                 # Webview (panel/view) provider classes
│   ├── health-dashboard.provider.ts
│   └── sidebar.provider.ts
├── styles/                    # Global aggregated styles (entry: main.css)
├── ui/
│   ├── graph-constellation/   # Dependency graph webview app
│   │   ├── index.tsx          # Entry point (bundled -> dist/webview.js)
│   │   ├── components/
│   │   └── styles/
│   ├── dashboard-health/      # Health analytics dashboard
│   │   ├── index.tsx          # Bundled -> dist/health-webview.js
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── styles/
│   │   └── health.postMessage.ts
│   ├── extension-sidebar/     # Activity bar sidebar view
│   │   ├── index.tsx          # Bundled -> dist/sidebar.js
│   │   ├── components/
│   │   ├── router/
│   │   ├── views/
│   │   └── styles/
│   └── shared/                # Cross-app utilities (messaging, etc.)
├── webview.service.ts         # Central webview lifecycle/orchestration
└── README.md
```

## Build Outputs

| App                 | Entry                              | Bundle                   |
| ------------------- | ---------------------------------- | ------------------------ |
| Graph Constellation | `ui/graph-constellation/index.tsx` | `dist/webview.js`        |
| Health Dashboard    | `ui/dashboard-health/index.tsx`    | `dist/health-webview.js` |
| Sidebar             | `ui/extension-sidebar/index.tsx`   | `dist/sidebar.js`        |

All built via `esbuild.js` (multi-context). Production mode adds minification (`--production`).

## Path Aliases (FR19)

Configured in `tsconfig.json`:

- `@/*` → `src/*` (used for shared types, utils, constants)
- `@webview/*` → `src/webview/*` (optional for intra-webview referencing)

Example:

```ts
import { IConstellationGraph } from "@/types/graph.types";
import { transformGraphToCytoscape } from "@/utils/graph-transform.utils";
```

## Adding a New Webview App

1. Create folder under `src/webview/ui/<app-name>/` with `index.tsx`.
2. Add `components/`, `styles/`, etc. as needed (mirror existing apps).
3. Update `esbuild.js` with a new context entry (copy one of the existing contexts).
4. Register a provider (if needed) under `providers/` or extend `PanelRegistry`.
5. Add command wiring in `extension.ts` referencing the appropriate `PanelKey`.

## Styling

- Global aggregations in `styles/main.css` import app-specific CSS (FR20). Prefer co-located component styles inside each app's `styles/`.
- Consider future migration to CSS Modules (tracked as optional follow-up A.4).

## Messaging

Apps communicate via the VS Code webview messaging bridge:

- Outbound: `window.vscode.postMessage({ command, data })`
- Inbound: `window.addEventListener('message', handler)`

Shared helpers: `ui/shared/postMessage.ts` (if extended later) and global type declarations `src/types/vscode-api.types.ts`.

## Removed Legacy Structure (for historical reference)

The previous `panels/` and `sidebar/` directories were consolidated. All references were refactored to the unified `ui/*` layout; remaining legacy mentions were eliminated from code to reduce path churn risk.

## Maintenance Checklist

- Prefer aliases over deep relative paths (`../../../../`).
- Keep provider responsibilities minimal (panel creation, resource roots).
- Add new bundles sparingly; unify where feasible.
- Update this README when structural changes occur (FR12 governance).

## Future Enhancements (Deferred)

- Enforce folder policy via ESLint rule (Task A.1).
- Component-level CSS modularization to drop `@import` (Task A.4).
- Telemetry for panel usage (Task A.3).

---

Last updated: Project Cleanup & Structure Optimization (FR2, FR19, FR20).
