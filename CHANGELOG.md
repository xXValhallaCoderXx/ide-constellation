# Change Log

All notable changes to the "kiro-constellation" extension will be documented in this file.

## [2025-07-30]

- **Implemented local embedding and vector storage system**: Added comprehensive semantic code search capabilities using Xenova transformers for local embedding generation. The system creates vector representations of code symbols and stores them in a local vector database for intelligent code discovery and similarity matching.
- **Enhanced vector store management**: Built robust cleanup mechanisms that automatically remove existing embeddings when files are processed, preventing duplicate entries and maintaining data consistency across file updates and deletions.
- **Completed major architectural refactor**: Restructured the entire VSCode extension codebase into a modular architecture with clear separation of concerns, improved maintainability, and enhanced extensibility for future features.
- **Added comprehensive documentation generation system**: Implemented automated markdown documentation generation with JSDoc parsing, professional formatting, and file deletion synchronization to keep documentation in sync with code changes.
- **Integrated OpenRouter LLM service**: Added AI-powered code analysis capabilities with OpenRouter API integration, including JSDoc generation functionality and comprehensive agent prompts for knowledge management, PRD generation, and task execution.
- **Enhanced development infrastructure**: Updated TypeScript configurations, removed unused files, commented out legacy tests for future review, and improved overall code organization and build processes.

## [2025-07-28]

- **Implemented structural indexing on file save**: Added complete AST parsing functionality that automatically extracts structural metadata (functions, classes, interfaces, variables) from TypeScript/JavaScript files when saved. The system creates and maintains a centralized manifest.json file containing symbol information with JSDoc comments and location data.
- **Enhanced file filtering system**: Implemented intelligent document filtering that processes .ts/.js/.tsx/.jsx files while excluding node_modules and configuration files for optimal performance.
- **Added comprehensive error handling**: Built robust error recovery that gracefully handles syntax errors and parsing failures without crashing the extension.
- **Integrated performance monitoring**: Added detailed timing logs and performance warnings to ensure responsive file save operations with background processing.

## [2025-01-28]

- Completed design specification for file-save event listener feature. The design defines a modular architecture for monitoring workspace file saves with intelligent filtering to determine which files should trigger Polaris functionality.