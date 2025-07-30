# Kiro Constellation Product Overview

Kiro Constellation is a VS Code/Kiro IDE extension that provides AI-powered code intelligence and documentation automation for TypeScript/JavaScript projects.

## Core Features

- **Semantic Code Search**: Local vector database using Xenova transformers for finding code by meaning, not just text matching
- **Automated Documentation**: JSDoc integration with markdown output, synchronized with code changes
- **AI-Powered Development**: OpenRouter LLM integration for code analysis and documentation generation
- **Code Intelligence**: AST parsing with symbol extraction for functions, classes, interfaces, and variables
- **Real-time Indexing**: Background processing with automatic file indexing on save

## Target Users

Developers working with TypeScript/JavaScript codebases who need intelligent code discovery, automated documentation generation, and AI-assisted development workflows.

## Key Value Propositions

1. **Local-First**: Uses local embedding generation for privacy and performance
2. **Graceful Degradation**: Continues core functionality even if AI services fail
3. **Performance Optimized**: Background processing with intelligent file filtering
4. **Comprehensive Error Handling**: Robust failure recovery and user feedback