# Technology Stack

## Core Technologies

- **TypeScript**: Primary language for extension development
- **VS Code Extension API**: Core platform integration
- **Node.js**: Runtime environment
- **Vite**: Build system and bundler
- **Vitest**: Unit testing framework
- **ESLint**: Code linting with TypeScript rules

## Key Dependencies

- **dependency-cruiser**: Core dependency analysis engine
- **cytoscape**: Graph visualization library for interactive maps
- **@vscode/test-cli**: VS Code extension testing framework

## Build System

### Development Commands

```bash
# Development build with watch mode
npm run watch

# Production build
npm run compile
npm run package

# Testing
npm run test          # VS Code integration tests
npm run test:unit     # Unit tests with Vitest
npm run test:unit:watch  # Watch mode for unit tests

# Code quality
npm run lint          # ESLint checking
```

### Build Configuration

- **Vite**: Main bundler with custom plugin for asset copying
- **TypeScript**: Dual config setup (main + webview)
  - `tsconfig.json`: Main extension code
  - `tsconfig.webview.json`: Webview UI components
- **Output**: All compiled assets go to `dist/` directory

## Architecture Patterns

- **Extension Host**: Main extension logic runs in Node.js context
- **Webview**: UI components run in browser-like context with message passing
- **Dual UI**: Sidebar provider + full webview panel
- **Event-driven**: File save triggers debounced analysis
- **Error-first**: Comprehensive error handling with fallback states