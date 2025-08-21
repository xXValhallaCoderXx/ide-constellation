# Project Structure

## Root Directory Layout
```
kiro-constellation/
├── src/                    # Source code
│   ├── extension.ts        # Main extension entry point
│   └── test/              # Test files
│       └── extension.test.ts
├── dist/                  # Compiled output (generated)
├── node_modules/          # Dependencies (generated)
├── .kiro/                 # Kiro-specific configuration
├── .vscode/               # VS Code workspace settings
├── package.json           # Project manifest and dependencies
├── tsconfig.json          # TypeScript configuration
├── eslint.config.mjs      # ESLint configuration
├── esbuild.js             # Build script
└── README.md              # Project documentation
```

## Source Organization

### Main Extension (`src/extension.ts`)
- **Entry Point**: Primary extension activation logic
- **Command Registration**: VS Code command implementations
- **Lifecycle Management**: `activate()` and `deactivate()` functions
- **Context Management**: Extension context and subscriptions

### Testing (`src/test/`)
- Test files mirror source structure
- Use `.test.ts` suffix for test files
- Mocha-based testing framework

## Key Conventions

### File Naming
- TypeScript source files: `.ts` extension
- Test files: `.test.ts` suffix
- Configuration files: Use appropriate extensions (`.json`, `.mjs`, `.js`)

### Import Patterns
- VS Code API: `import * as vscode from 'vscode'`
- Use ES6 module syntax throughout
- Follow camelCase/PascalCase naming for imports

### Extension Structure
- Commands defined in `package.json` under `contributes.commands`
- Command implementations in `extension.ts`
- Extension activates on startup (`onStartupFinished`)
- All disposables registered with extension context

## Build Artifacts
- **Source**: `src/` directory
- **Output**: `dist/extension.js` (single bundled file)
- **Tests**: Compiled to `out/` directory during testing