# Kiro Constellation (Post-Cleanup Architecture)

Refactored VS Code extension with unified webview architecture (graph constellation, health dashboard, sidebar), centralized panel registry, MCP stdio server, and worker-based dependency scanning. Evolved from the original POC into a cleaner, alias-driven structure.

## Overview

Current pillars:
1. **Extension Core & Panel Registry** – Stable activation and centralized panel opens.
2. **Unified Webview Layer** – Three Preact apps under `src/webview/ui/*` with shared messaging & styles. Shared UI components live in `src/webview/components/` containing cross-app UI primitives (layout, feedback, theme). Promote only broadly reusable pieces there; app‑specific components remain co-located under each app's `components/` folder.
3. **MCP Provider & Server** – Standard MCP provider with bundled stdio server (`out/mcp-server.js`). Provider registration is always attempted on activation; dev (`NODE_ENV=development`) emits `[POC]` diagnostic logs while production keeps output minimal.
4. **Worker-Based Graph Scan** – Worker thread computes dependency graph (`dist/workers/scanWorker.mjs`).
5. **Health Analysis Dashboard** – Risk scoring & recommendations panel.

## Features

- 🎯 Commands: `constellation.showGraph`, `constellation.healthDashboard`, `constellation.scanProject`
- 🧭 Panel Registry mediated lifecycle
- �️ Dependency graph (Cytoscape) + heatmap overlay
- 📊 Health dashboard metrics & recommendations
- 🔄 Active editor → graph highlight sync (debounced)
- 🤖 MCP stdio server + provider (dev-gated POC logs)
- 🧵 Worker-powered scan + caching
- 🧪 Visual instruction pattern scaffold (dual payload parsing + debounce)
- 🛡️ Consistent CSP + workspace path guards
- � Path aliases (`@/*`, `@webview/*`) replacing deep relative imports

## Installation & Development

### Prerequisites

- Node.js (v20.x or later)
- VS Code (v1.103.0 or later)
- npm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run compile
   ```

3. **Run in VS Code:**
   - Open this project in VS Code
   - Press `F5` to launch a new Extension Development Host window
   - The extension will activate, register the MCP provider, and expose tools

### Available Scripts

| Script | Purpose |
|--------|---------|
| `compile` | Type check, lint, build all bundles (extension, webviews, MCP, worker) |
| `compile:extension` | Build extension host only |
| `compile:webview` | Build all webview bundles |
| `compile:mcp` | Build MCP stdio server bundle |
| `watch` | Parallel type + esbuild watch |
| `check-types` | TypeScript noEmit validation |
| `lint` | ESLint over `src` |

## Usage

### 1. Open Panels

- Graph Panel: Command Palette → "Constellation: Show Codebase Map"
- Health Dashboard: Command Palette → "Constellation: Open Health Dashboard"
- Sidebar: Auto-registered activity bar view.

### 2. Run a Scan

Use "Constellation: Scan Project" to trigger worker-based analysis. Graph + health features consume emitted data.

### 3. MCP Provider

In development (`NODE_ENV=development`), POC logs (`[POC]`) validate provider registration; production suppresses them.

## Architecture

### High-Level Layers

| Layer | Key Elements |
|-------|--------------|
| Extension Host | `extension.ts`, PanelRegistry, command wiring, MCP provider gating |
| MCP | `mcp/` provider + `mcp-stdio.server.ts` bundle (stdio protocol) |
| Worker | `workers/scan-project.worker.ts` → `dist/workers/scanWorker.mjs` |
| Webviews | `webview/ui/*` apps + `webview.service.ts` orchestration |
| Graph & Health Services | `services/graph.service.ts`, transformers, caches, analysis |
| Utilities | path, performance, debounce, heatmap processor |

### Unified Webview Structure
See `src/webview/README.md` for detailed layout and bundle mapping.

### Messaging & Panel Architecture

Constellation uses a centralized outbound messaging layer (see `docs/graph-architecture-refactor.md` for full details):

- `PanelRegistry` (`src/services/panel-registry.service.ts`) is the ONLY entry point for opening/focusing panels. External code must not call `WebviewManager.createOrShowPanel()` directly.
- `WebviewMessenger` (`src/webview/webview.messenger.ts`) encapsulates all extension → webview messages with size guards (1MB), structured logs, and typed helper methods.
- Direct `panel.webview.postMessage` calls are forbidden outside the messenger except for a handful of temporary, clearly `TODO(remove-legacy-postMessage)`-tagged legacy paths (dashboard highlight, visualInstruction dispatch, export result callbacks). These are scheduled for removal in a subsequent milestone when inbound routing is unified.

Log format (parse-friendly):
```
[ISO_TIMESTAMP] [INFO] messenger:send command=<command> size=<bytes>
[ISO_TIMESTAMP] [WARN] messenger:drop command=<command> reason=<reason> size=<bytes?>
[ISO_TIMESTAMP] [ERROR] messenger:send command=<command> error=<message>
```

#### Adding a New Outbound Message
1. Define / extend the discriminated union in `src/types/messages.types.ts`.
2. Add a typed convenience method in `WebviewMessenger` returning the boolean result of `send()`.
3. Replace scattered direct sends with the new method.
4. Update documentation if the message is user-observable.

#### Origin Naming Convention
Origins annotate why a panel was opened or an action triggered. Pattern:

```
<namespace>:<action>
```

Current namespaces:
- `sidebar:*` user clicks in sidebar UI (see `ORIGIN.SIDEBAR.*`).
- `mcp:*` automated machine/provider actions (see `ORIGIN.MCP.*`).
- `command:*` invoked via VS Code command palette (`ORIGIN.COMMAND.*`).
- `system:*` internal fallback / automatic flows (`ORIGIN.SYSTEM.*`).

When adding a new origin, extend `ORIGIN` in `routing.types.ts` and (optionally) document it inline—avoid anonymous string literals scattered throughout the code.

#### Grep Audit (Post-Refactor Invariant)
Only these are allowed to contain `panel.webview.postMessage`:
1. `webview.messenger.ts` (internal send call).
2. Explicit TODO-tagged legacy fallback lines.
3. Webview (front-end) code posting back to extension (not part of this grep pattern, different context).

To verify:
```bash
grep -R "panel.webview.postMessage" src | grep -v "TODO(remove-legacy-postMessage)" | grep -v "webview.messenger"
```
Should return 0 lines (temporary exceptions will be removed in next milestone).

#### Overlay Messages (Milestone 1 Placeholder)
`graph:overlay:apply` / `graph:overlay:clear` are defined but have no UI implementation yet; they reserve contract space for a future interactive layering feature.

### Build & Bundling

- esbuild multi-context builds (extension, 3 webviews, MCP server, worker)
- TypeScript strict + Preact automatic JSX
- Production (`--production`) enables minification

### API Endpoints

No HTTP endpoints. Communication uses MCP over stdio.

## Cleanup / Optimization Outcomes (FR Summary)

| Focus | Outcome |
|-------|---------|
| FR1 Panel Registry | Single instance; all opens centralized |
| FR2 Structure | Unified `ui/*` apps; legacy folders removed |
| FR4/FR19 Imports | Deep relative paths replaced with aliases |
| FR5 Config | Minimal env-gated POC logging |
| FR10 Performance | Baseline + post-change timing (see tasks file) |
| FR11 Logging | ISO timestamps + level tags standardized |
| FR13 Security | Path guards + CSP unchanged |
| FR17 Worker | Worker bundle resilient path resolution |
| FR20 CSS | Legacy imports removed; consolidated main.css |

## Troubleshooting

### Server Won't Start
- Check if port 31337 is available
- Extension will try fallback ports (31338, 31339, etc.)
- Check VS Code Developer Console for error messages

### Webview Not Loading
- Ensure both extension and webview builds completed successfully
- Check browser console in webview for JavaScript errors
- Verify CSS and JavaScript files are accessible

### Status Check Fails
- Verify MCP server is running (check extension logs)
- Test server directly: `curl http://127.0.0.1:31337/status`
- Run validation script: `node validate-kiro-integration.js`

## Development Notes

### Key Paths (Post-Cleanup)
```
src/
├── extension.ts
├── services/
│   ├── panel-registry.service.ts
│   ├── graph.service.ts
│   └── ...
├── webview/
│   ├── webview.service.ts
│   ├── components/           # Shared UI components (primitives, layout, feedback, theming)
│   ├── providers/
│   └── ui/
│       ├── graph-constellation/
│       ├── dashboard-health/
│       ├── extension-sidebar/
│       └── shared/
├── mcp/
│   ├── mcp.provider.ts
│   └── mcp-stdio.server.ts
├── workers/
│   └── scan-project.worker.ts
├── utils/
└── types/
```

### Key Technologies
- **TypeScript** - Type-safe development
- **Preact** - Lightweight React alternative
- **VS Code MCP API** - Server definition provider
- **esbuild** - Fast bundling and compilation
- **VS Code Extension API** - Platform integration

## Future Enhancements (Deferred / Optional)
- Alias lint enforcement rule
- PanelRegistry + worker path unit tests
- Telemetry for panel usage
- Component-level CSS modules migration

## Documentation

- Webview structure: `src/webview/README.md`
- Visual instruction pattern: `docs/visual-instruction-pattern.md`
- Task execution log: `tasks/tasks-project-cleanup-structure-optimization.md`

## License

This is a proof of concept for internal development and testing purposes.