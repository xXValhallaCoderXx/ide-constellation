---
inclusion: always
---

# Project Structure & Architecture

## Directory Organization

### Core Structure
```
src/
├── extension.ts              # Main entry - activate/deactivate
├── constants/
│   └── sync.constants.ts
├── mcp/                      # Model Context Protocol integration
│   ├── mcp-stdio.server.ts
│   ├── mcp.provider.ts
│   └── vi-flood-test.ts      # Load / stress test script
├── services/                 # Domain-scoped services (see below)
│   ├── graph.service.ts
│   ├── graph-cache.service.ts
│   ├── graph-transformer.service.ts
│   ├── summary-generator.service.ts
│   ├── complexity-analyzer.service.ts
│   ├── git-analyzer.service.ts
│   ├── health-analyzer.service.ts
│   ├── metrics-cache.service.ts
│   ├── recommendations-engine.service.ts
│   ├── panel-registry.service.ts
│   ├── health/
│   │   └── health.services.ts
│   └── (future: security/, quality/, performance/ ...)
├── types/
│   ├── cytoscape.types.ts
│   ├── graph.types.ts
│   ├── health-analysis.types.ts
│   ├── mcp.types.ts
│   ├── messages.types.ts
│   ├── routing.types.ts
│   ├── scanner.types.ts
│   ├── visual-instruction.types.ts
│   └── vscode-api.types.ts
├── utils/
│   ├── debounce.ts
│   ├── error-handling.utils.ts
│   ├── graph-transform.utils.ts
│   ├── heatmap-processor.utils.ts
│   ├── path.utils.ts
│   └── performance.utils.ts
├── webview/
│   ├── providers/            # Webview + sidebar providers
│   │   ├── health-dashboard.provider.ts
│   │   └── sidebar.provider.ts
│   ├── ui/                   # Feature-oriented UI (Preact)
│   │   ├── graph-constellation/
│   │   ├── dashboard-health/
│   │   ├── extension-sidebar/
│   │   └── shared/
│   ├── styles/               # Global shared styles
│   │   └── main.css
│   ├── components/               # Global shared components
│   │   └── Atomic Components
│   ├── webview.service.ts    # Bridge / messaging helper
│   └── README.md
└── workers/
    └── scan-project.worker.ts
```

### Build & Configuration
- `dist/` - Compiled extension bundle (esbuild output)
- `out/` - Test compilation output
- `package.json` - Extension manifest with VS Code contributions
- `tsconfig.json` - TypeScript configuration (ES2022, Node16 modules)
- `eslint.config.mjs` - Code quality rules

## Architecture Patterns

### Extension Lifecycle
- Entry point: `src/extension.ts` with `activate()` and `deactivate()`
- Activation event: `onStartupFinished` for immediate availability
- All disposables must be registered with extension context
- Commands defined in `package.json` under `contributes.commands`

### MCP Integration
- Server communication via stdio protocol
- Provider pattern for MCP service abstraction
- Type-safe message handling with dedicated types

### Webview Architecture
- Preact-based UI (TypeScript) grouped by feature in `webview/ui/`
- Feature folders encapsulate components, hooks, styles, messaging
- Providers separated from UI in `webview/providers/`
- Sidebar routing handled in `webview/ui/extension-sidebar/router/`
- Typed messaging helpers: shared (`shared/postMessage.ts`) + feature-specific (e.g. `dashboard-health/health.postMessage.ts`)
- Global styles under `webview/styles/`; feature-local styles live beside components

### Service Layer Architecture
- Domain-scoped: services reside at root or inside a domain subfolder (`services/<domain>/`)
- Core graph stack:
    - **GraphService** – Orchestrates graph state + reverse dependency index
    - **GraphCache** – Persistent & in-memory caching layer
    - **GraphTransformer** – Normalizes raw dependency data
- Analysis & insight:
    - **ComplexityAnalyzerService** – Complexity metrics
    - **GitAnalyzerService** – Repository activity & churn
    - **HealthAnalyzerService** – Aggregates multi-metric health scoring
    - **MetricsCacheService** – Caches computed metrics
    - **RecommendationsEngineService** – Suggests improvements
    - **SummaryGeneratorService** – Narrative summaries
- UI coordination:
    - **PanelRegistryService** – Registers & discovers feature panels
- Future domains: security, quality, performance (planned)

#### Domain Scoping Strategy
- Each domain may introduce: dedicated subfolder, facade service, internal helpers
- Keeps cross-domain contracts lean and explicit

### Worker Pattern
- Background tasks isolated in worker threads
- Current worker: project scanning + graph + metric extraction
- Designed for future specialized workers (git history, complexity) without blocking UI
- Non-blocking UI via typed message passing

## Code Conventions

### File Naming
- TypeScript: `.ts` extension
- React components: `.tsx` extension  
- Tests: `.test.ts` suffix
- Workers: `.worker.ts` suffix
- Services: `.service.ts` suffix

### Import Standards
- VS Code API: `import * as vscode from 'vscode'`
- ES6 modules throughout
- Relative imports for local modules
- camelCase/PascalCase for named imports

### Type Safety
- Strict TypeScript configuration enabled
- Dedicated type files in `src/types/`
- Interface-first design for external APIs
- Proper error handling with typed exceptions

## Development Guidelines

### Component Structure
- Preact functional components in PascalCase
- Feature-first layout (`webview/ui/<feature>/`)
- Hooks co-located under `hooks/` inside each feature
- CSS colocated per feature + shared global stylesheet

### Service Layer
- Abstract VS Code API interactions
- Provide clean interfaces for webview communication
- Handle state management and persistence
- Implement proper error boundaries

### Security & Path Handling
- **Workspace containment** - All file operations validate paths are within workspace bounds
- **Path utilities** - Centralized path resolution and security validation
- **Debounced operations** - Editor synchronization uses debouncing to prevent excessive updates
- **Error boundaries** - Proper error handling with user-friendly messages

### Performance Optimizations
- **Graph + metrics caching** for minimal recomputation
- **Incremental health scoring** where feasible
- **Worker offload** for scanning & heavy analysis
- **Reverse-dependency indexing** for O(1) dependent lookups
- **Debounced UI messaging** to reduce postMessage overhead

### Testing Strategy
- Unit tests mirror source structure
- Integration tests for VS Code API interactions
- Mocha framework with TypeScript support
- Test files in same directory as source (`.test.ts`)
- **Note**: Per persona.md directive, unit and integration tests are currently skipped

## Updated / Removed Legacy References
- Replaced legacy `webview/panels/` + `webview/sidebar/` with feature-based `webview/ui/` layout
- Added domain-scoped services & new analyzer / recommendation services
- Clarified panel registration via `PanelRegistryService`
- Added explicit messaging layer structure (shared + feature-specific)
- Included new utility modules: error handling, performance, heatmap processor

## Future Notes
- Additional domain folders (security, quality, performance) will mirror health pattern
- Potential expansion of worker set for git + complexity if performance thresholds require