---
inclusion: always
---

# Technology Stack & Development Standards

## Core Technologies
- **TypeScript** - Primary language (ES2022 target, Node16 modules, strict mode enabled)
- **VS Code Extension API** - Core platform integration (minimum v1.70.0, types v1.103.0)
- **Node.js** - Runtime environment (v20.x types)
- **Preact** - UI framework for webview components
- **Cytoscape.js** - Graph visualization library
- **MCP SDK** - Model Context Protocol integration (@modelcontextprotocol/sdk)
- **dependency-cruiser** - Dependency analysis for graph generation

## Build System & Tooling
- **esbuild** - Fast bundling and compilation (single bundle output)
- **ESLint** - Code linting with TypeScript-specific rules
- **Mocha** - Testing framework for unit and integration tests
- **npm** - Package management and script execution

## Required Development Commands
When working with this codebase, use these npm scripts:

```bash
# Development workflow
npm run compile              # Full build: type check, lint, and bundle
npm run compile:extension    # Build extension only
npm run compile:webview      # Build webview only  
npm run compile:mcp          # Build MCP server only
npm run watch               # Development mode with file watching
npm run check-types         # TypeScript validation only
npm run lint                # Code quality analysis

# Testing
npm run test                # Execute all test suites
npm run pretest             # Complete pre-test pipeline (compile + lint)

# Production
npm run package             # Production-ready build
npm run vscode:prepublish   # Pre-publish build hook
```

## Code Quality Requirements
All code must adhere to these standards:
- **TypeScript strict mode** - No implicit any, strict null checks
- **ESLint compliance** - All rules must pass without warnings
- **Naming conventions** - camelCase for variables/functions, PascalCase for classes/interfaces
- **Semicolons required** - Explicit statement termination
- **Curly braces enforced** - Always use braces for control structures
- **Strict equality** - Use `===` and `!==` operators only

## Architecture Constraints
- **Single bundle output** - All code compiles to `dist/extension.js`
- **CommonJS target** - Node.js compatibility required
- **External vscode dependency** - VS Code API provided by host environment
- **Source maps** - Enabled in development, optional in production
- **ES6 modules** - Use import/export syntax throughout codebase

## File Organization Rules
- TypeScript files use `.ts` extension
- Preact components use `.tsx` extension
- Test files use `.test.ts` suffix
- Worker files use `.worker.ts` suffix
- Service files use `.service.ts` suffix
- Provider files use `.provider.ts` suffix
- Utility files use `.utils.ts` suffix
- Constants files use `.constants.ts` suffix
- All imports must be explicit (no implicit any)