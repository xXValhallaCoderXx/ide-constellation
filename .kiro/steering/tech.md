# Technology Stack & Build System

## Core Technologies

- **TypeScript**: Primary language with ES2022 target and ESNext modules
- **VS Code Extension API**: Built on VS Code extensibility platform (v1.90.0+)
- **Node.js**: Runtime environment for local operations

## Key Dependencies

### AI/ML Stack
- **@xenova/transformers**: Local ML model execution for embeddings
- **@lancedb/lancedb**: Vector database for semantic search storage

### Code Analysis
- **@babel/parser**: AST parsing for TypeScript/JavaScript
- **@babel/traverse**: AST traversal and analysis

### Configuration
- **dotenv**: Environment variable management for API keys

## Build System

- **Vite**: Primary build tool with CommonJS output for VS Code compatibility
- **TypeScript Compiler**: Type checking and compilation
- **ESLint**: Code linting with TypeScript-specific rules

## Common Commands

### Development
```bash
npm install          # Install dependencies
npm run watch        # Development build with watch mode
npm run compile      # Production build
npm run lint         # Run ESLint
```

### Testing
```bash
npm run compile-tests    # Compile test files
npm run pretest         # Prepare tests
npm run test           # Run VS Code extension tests
```

### Packaging
```bash
npm run package        # Production build for distribution
npm run vscode:prepublish  # Pre-publish preparation
```

## Build Configuration

- **Output**: CommonJS format in `out/` directory as `extension.cjs`
- **External Dependencies**: VS Code API and Node.js modules marked as external
- **Source Maps**: Enabled for debugging
- **Module Resolution**: Bundler mode with ESNext modules