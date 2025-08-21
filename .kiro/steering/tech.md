# Technology Stack

## Core Technologies
- **TypeScript** - Primary language (ES2022 target, Node16 modules)
- **VS Code Extension API** - Core platform integration
- **Node.js** - Runtime environment (v20.x types)

## Build System & Tooling
- **esbuild** - Fast bundling and compilation
- **ESLint** - Code linting with TypeScript rules
- **Mocha** - Testing framework
- **npm** - Package management

## Development Workflow

### Common Commands
```bash
# Development
npm run compile          # Type check, lint, and build
npm run watch           # Watch mode for development
npm run check-types     # TypeScript type checking only
npm run lint            # ESLint code analysis

# Testing
npm run test            # Run all tests
npm run compile-tests   # Compile test files
npm run pretest         # Full pre-test pipeline

# Production
npm run package         # Production build
npm run vscode:prepublish # Pre-publish preparation
```

## Code Quality Standards
- Strict TypeScript configuration enabled
- ESLint with TypeScript-specific rules
- Naming conventions enforced (camelCase/PascalCase for imports)
- Semicolons required
- Curly braces enforced
- Strict equality checks (===)

## Build Configuration
- Bundle target: CommonJS for Node.js compatibility
- Source maps enabled in development
- Minification in production builds
- External dependency: `vscode` (provided by host)
- Output: Single bundled file at `dist/extension.js`