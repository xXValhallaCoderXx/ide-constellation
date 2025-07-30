# Kiro Constellation

The stellar developer toolkit extension for Kiro IDE and VS Code. A comprehensive code intelligence system that provides semantic search, automated documentation generation, and AI-powered development assistance.

## Features

### 🔍 Semantic Code Search
- **Local Vector Database**: Uses Xenova transformers for local embedding generation
- **Intelligent Code Discovery**: Find code by semantic similarity, not just text matching
- **Real-time Indexing**: Automatically indexes TypeScript/JavaScript files on save
- **Performance Optimized**: Background processing with intelligent file filtering

### 📚 Automated Documentation
- **JSDoc Integration**: Automatically generates comprehensive documentation from code
- **Markdown Output**: Professional formatting with structured documentation
- **Sync Management**: Keeps documentation synchronized with code changes
- **File Deletion Handling**: Automatically removes documentation for deleted files

### 🤖 AI-Powered Development
- **OpenRouter Integration**: Connect to various LLM providers for code analysis
- **JSDoc Generation**: AI-assisted documentation creation
- **Agent Prompts**: Pre-configured prompts for knowledge management and task execution
- **Code Analysis**: Intelligent code understanding and suggestions

### 🏗️ Code Intelligence
- **AST Parsing**: Complete structural analysis of TypeScript/JavaScript files
- **Symbol Extraction**: Functions, classes, interfaces, and variables with metadata
- **Manifest Generation**: Centralized symbol registry with location data
- **Error Recovery**: Robust handling of syntax errors and parsing failures

### ⚡ Performance & Reliability
- **Modular Architecture**: Clean separation of concerns for maintainability
- **Comprehensive Error Handling**: Graceful failure recovery
- **Performance Monitoring**: Detailed timing logs and optimization warnings
- **Background Processing**: Non-blocking file operations

## Commands

- `Constellation: Test Vector Search` - Test the semantic search functionality
- `Hello World` - Basic extension functionality test

## Usage

### Getting Started
1. Install the extension in VS Code or Kiro IDE
2. Open a TypeScript/JavaScript project
3. Save files to trigger automatic indexing
4. Use the Command Palette to access Constellation features

### Semantic Search
The extension automatically indexes your code as you work. Use the vector search command to find code by semantic meaning rather than exact text matches.

### Documentation Generation
Documentation is automatically generated and updated as you modify your code. The system parses JSDoc comments and creates structured markdown documentation.

## Configuration

The extension supports various configuration options through VS Code settings and environment variables for API keys and service endpoints.

## Development

This extension is built with TypeScript and uses Vite for building.

### Setup
```bash
npm install
npm run watch
```

### Testing
```bash
npm run test
```

### Building
```bash
npm run compile
npm run package
```

## Architecture

- **Controllers**: Handle command execution and user interactions
- **Services**: Core functionality including parsing, embedding, and LLM integration
- **Utils**: Configuration management and error handling
- **Types**: TypeScript definitions for the entire system

## Dependencies

- **@xenova/transformers**: Local ML model execution for embeddings
- **@lancedb/lancedb**: Vector database for semantic search
- **@babel/parser & @babel/traverse**: AST parsing for code analysis
- **dotenv**: Environment configuration management

## Requirements

- VS Code 1.90.0 or higher
- Node.js for local embedding generation
- TypeScript/JavaScript projects for full functionality
