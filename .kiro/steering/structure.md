# Project Structure

## Root Directory

- **src/**: Main source code
- **dist/**: Compiled output (generated)
- **media/**: Static assets (icons, images)
- **docs/**: Documentation
- **tasks/**: Project management and PRD files
- **sample-project/**: Test workspace for development
- **test-workspace/**: Additional testing environment

## Source Code Organization (`src/`)

### Core Extension Files
- **extension.ts**: Main extension entry point and activation logic
- **analyzer.ts**: Dependency analysis engine using dependency-cruiser

### UI Components (`src/ui/`)
- **webview/**: Full-screen architecture map panel
  - `WebviewManager.ts`: Panel lifecycle and messaging
  - `webview.html/css/ts`: UI implementation
- **sidebar/**: Compact sidebar panel
  - `SidebarProvider.ts`: Sidebar webview provider
  - `sidebar.html/css/ts`: Sidebar UI
- **shared/**: Common types and utilities
  - `types.ts`: Shared TypeScript interfaces

### Supporting Modules
- **commands/**: VS Code command implementations
- **services/**: Business logic and utilities
- **types/**: TypeScript type definitions
- **polaris/**: Additional feature modules
- **test/**: Unit and integration tests
  - `integration/suite/`: VS Code integration tests
  - `mocks/`: Test utilities and mocks

## Configuration Files

- **package.json**: Extension manifest and dependencies
- **tsconfig.json**: Main TypeScript configuration
- **tsconfig.webview.json**: Webview-specific TypeScript config
- **vite.config.mjs**: Build system configuration
- **vitest.config.ts**: Unit test configuration
- **eslint.config.mjs**: Code style and linting rules

## Naming Conventions

- **Files**: kebab-case for config files, PascalCase for TypeScript classes
- **Directories**: lowercase with hyphens
- **TypeScript**: PascalCase for classes/interfaces, camelCase for functions/variables
- **Constants**: UPPER_SNAKE_CASE for module-level constants