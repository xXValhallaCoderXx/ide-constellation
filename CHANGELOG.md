# Change Log

All notable changes to the "kiro-constellation" extension will be documented in this file.

## [2025-07-28]

- **Implemented structural indexing on file save**: Added complete AST parsing functionality that automatically extracts structural metadata (functions, classes, interfaces, variables) from TypeScript/JavaScript files when saved. The system creates and maintains a centralized manifest.json file containing symbol information with JSDoc comments and location data.
- **Enhanced file filtering system**: Implemented intelligent document filtering that processes .ts/.js/.tsx/.jsx files while excluding node_modules and configuration files for optimal performance.
- **Added comprehensive error handling**: Built robust error recovery that gracefully handles syntax errors and parsing failures without crashing the extension.
- **Integrated performance monitoring**: Added detailed timing logs and performance warnings to ensure responsive file save operations with background processing.

## [2025-01-28]

- Completed design specification for file-save event listener feature. The design defines a modular architecture for monitoring workspace file saves with intelligent filtering to determine which files should trigger Polaris functionality.