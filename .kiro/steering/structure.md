---
inclusion: always
---

# Project Structure & Architecture

## Directory Organization

### Core Structure
```
src/
├── extension.ts           # Main entry point - extension lifecycle
├── mcp/                   # MCP (Model Context Protocol) integration
│   ├── mcp-stdio.server.ts
│   └── mcp.provider.ts
├── types/                 # TypeScript type definitions
│   ├── mcp.types.ts
│   ├── messages.types.ts
│   └── scanner.types.ts
├── webview/               # React-based UI components
│   ├── components/
│   ├── styles/
│   ├── index.tsx
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
- React-based UI with TypeScript
- Service layer for VS Code API communication
- Component-based architecture in `src/webview/components/`
- Centralized styling in `src/webview/styles/`

### Worker Pattern
- Background tasks isolated in worker threads
- Project scanning and analysis operations
- Non-blocking UI operations

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
- React components in PascalCase
- Props interfaces co-located with components
- Functional components with hooks preferred
- CSS modules or styled-components for styling

### Service Layer
- Abstract VS Code API interactions
- Provide clean interfaces for webview communication
- Handle state management and persistence
- Implement proper error boundaries

### Testing Strategy
- Unit tests mirror source structure
- Integration tests for VS Code API interactions
- Mocha framework with TypeScript support
- Test files in same directory as source (`.test.ts`)