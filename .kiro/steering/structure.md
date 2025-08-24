---
inclusion: always
---

# Project Structure & Architecture

## Directory Organization

### Core Structure
```
src/
├── extension.ts           # Main entry point - extension lifecycle
├── constants/             # Application constants
│   └── sync.constants.ts
├── mcp/                   # MCP (Model Context Protocol) integration
│   ├── mcp-stdio.server.ts
│   └── mcp.provider.ts
├── services/              # Core business logic services
│   ├── graph-cache.service.ts
│   ├── graph-transformer.service.ts
│   ├── graph.service.ts
│   └── summary-generator.service.ts
├── types/                 # TypeScript type definitions
│   ├── cytoscape.types.ts
│   ├── graph.types.ts
│   ├── mcp.types.ts
│   ├── messages.types.ts
│   ├── scanner.types.ts
│   └── vscode-api.types.ts
├── utils/                 # Utility functions
│   ├── debounce.ts
│   ├── graph-transform.utils.ts
│   └── path.utils.ts
├── webview/               # Preact-based UI components
│   ├── panels/            # Main webview panels
│   │   └── constellation/
│   ├── providers/         # VS Code webview providers
│   │   └── sidebar.provider.ts
│   ├── sidebar/           # Sidebar-specific components
│   │   ├── components/
│   │   ├── styles/
│   │   └── index.tsx
│   ├── styles/            # Shared styles
│   │   └── main.css
│   ├── README.md
│   └── webview.service.ts
└── workers/               # Background processing
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
- Preact-based UI with TypeScript (not React)
- Service layer for VS Code API communication
- Multi-panel architecture: main constellation panel + sidebar
- Sidebar provider pattern for VS Code activity bar integration
- Component-based architecture in `src/webview/sidebar/components/`
- Centralized styling in `src/webview/styles/` and `src/webview/sidebar/styles/`

### Service Layer Architecture
- **GraphService** - Singleton service for graph data management with reverse-dependency indexing
- **GraphCache** - Persistent caching of graph data to improve performance
- **GraphTransformer** - Transforms raw dependency data into graph model
- **SummaryGenerator** - Generates project summaries and insights

### Worker Pattern
- Background tasks isolated in worker threads
- Project scanning and analysis operations using dependency-cruiser
- Non-blocking UI operations with message-based communication

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
- Preact components in PascalCase (not React)
- Props interfaces co-located with components
- Functional components with hooks preferred
- CSS files for styling with VS Code theme variables

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
- **Graph caching** - Persistent cache to avoid re-scanning unchanged projects
- **Singleton services** - Memory-efficient service management
- **Worker threads** - CPU-intensive operations isolated from main thread
- **Reverse-dependency indexing** - O(1) lookup for dependent file queries

### Testing Strategy
- Unit tests mirror source structure
- Integration tests for VS Code API interactions
- Mocha framework with TypeScript support
- Test files in same directory as source (`.test.ts`)
- **Note**: Per persona.md directive, unit and integration tests are currently skipped