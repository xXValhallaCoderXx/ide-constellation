# Getting Started

## Overview

IDE Constellation is a VS Code extension that provides structural indexing capabilities for TypeScript codebases. The extension automatically parses and indexes code symbols (functions, classes, methods, variables) when files are saved, creating a persistent manifest for fast code navigation and analysis.

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **VS Code**: Version 1.74.0 or higher
- **TypeScript**: Version 4.9.4 or higher (included as dev dependency)

## Local Development Setup

### 1. Clone the Repository

```bash
git clone git@github.com:xXValhallaCoderXx/ide-constellation.git
cd ide-constellation
```

### 2. Install Dependencies

The project uses npm for package management:

```bash
npm install
```

This will install all required dependencies including:
- **Runtime Dependencies**: Babel parser packages for AST processing
- **Development Dependencies**: TypeScript compiler, Vitest for testing, VS Code types

### 3. Build the Extension

Compile TypeScript source code to JavaScript:

```bash
npm run compile
```

For continuous development with automatic recompilation:

```bash
npm run watch
```

### 4. Run Tests

Execute the test suite using Vitest:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch
```

### 5. Launch the Extension

#### Option A: Using VS Code Tasks (Recommended)

1. Open the project in VS Code
2. Press `F5` or go to **Run and Debug** panel
3. Select "Run Kiro Constellation" configuration
4. This will:
   - Start the TypeScript compiler in watch mode
   - Launch a new Extension Development Host window
   - Load the extension for testing

#### Option B: Manual Launch

1. Compile the extension: `npm run compile`
2. Press `F5` in VS Code
3. Select "VS Code Extension Development"

### 6. Test Extension Commands

In the Extension Development Host window:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Try these commands:
   - `Hello Kiro: Show Welcome Message` - Basic extension test
   - `Test: Read Selected Text` - Reads currently selected text
   - `Test: Write Timestamp` - Inserts current timestamp at cursor
   - `Test: Read Kiro Spec` - Reads `.kiro/spec.md` file content

## Project Structure

```
ide-constellation/
├── src/                          # Source code
│   ├── extension.ts             # Main extension entry point
│   ├── types.ts                 # Core TypeScript interfaces
│   └── services/                # Business logic services
│       ├── CodeParserService.ts # AST parsing and symbol extraction
│       ├── FileSystemService.ts # File operations with error handling
│       └── *.test.ts           # Unit tests
├── out/                         # Compiled JavaScript (generated)
├── .vscode/                     # VS Code configuration
│   ├── launch.json             # Debug configuration
│   ├── tasks.json              # Build tasks
│   └── settings.json           # Workspace settings
├── .kiro/                       # Project specifications
│   └── specs/structural-indexing/ # Feature documentation
├── package.json                 # Extension manifest and dependencies
├── tsconfig.json               # TypeScript configuration
└── vitest.config.ts            # Test configuration
```

## Development Workflow

### Making Changes

1. **Edit Source Code**: Modify files in `src/` directory
2. **Compile**: Run `npm run compile` or use watch mode
3. **Test**: Run `npm test` to verify changes
4. **Debug**: Use F5 to launch Extension Development Host

### Adding New Features

1. **Write Tests First**: Create test files in `src/services/`
2. **Implement Service Logic**: Add business logic in service classes
3. **Update Types**: Modify `src/types.ts` if new interfaces needed
4. **Integrate**: Wire up new functionality in `src/extension.ts`

### Testing Strategy

- **Unit Tests**: Test individual service methods in isolation
- **Integration Tests**: Test complete workflows end-to-end
- **Manual Testing**: Use Extension Development Host for UI testing

## Environment Variables

The extension doesn't currently use environment variables, but configuration can be added through:

- **VS Code Settings**: Workspace or user settings
- **Extension Configuration**: Defined in `package.json` contributes section
- **Kiro Configuration**: Files in `.kiro/` directory

## Troubleshooting

### Common Issues

**Extension Not Loading**
- Ensure TypeScript compilation succeeded: `npm run compile`
- Check VS Code Developer Console for errors
- Verify VS Code version compatibility (1.74.0+)

**Tests Failing**
- Run `npm install` to ensure dependencies are current
- Check Node.js version (18.0.0+ required)
- Review test output for specific failure details

**Build Errors**
- Verify TypeScript configuration in `tsconfig.json`
- Check for syntax errors in source files
- Ensure all imports are properly resolved

### Debug Console

Access debug information in VS Code:
1. **Help** → **Toggle Developer Tools**
2. Check **Console** tab for extension logs
3. Look for errors during extension activation

### File Locations

- **Compiled Output**: `out/` directory
- **Extension Logs**: VS Code Developer Console
- **Test Results**: Terminal output from `npm test`
- **Build Artifacts**: Generated in `out/` during compilation

## Next Steps

After successful setup:

1. **Read Architecture Overview** (`docs/02-architecture-overview.md`)
2. **Review Core Services** (`docs/06-core-services.md`)
3. **Understand Contributing Guidelines** (`docs/03-contributing-guidelines.md`)
4. **Explore Current Feature Development** (`.kiro/specs/structural-indexing/`)

The extension is currently implementing structural indexing functionality that will automatically parse and index TypeScript code symbols when files are saved.