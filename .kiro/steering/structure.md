# Project Structure & Architecture

## Directory Organization

```
src/
├── extension.ts              # Main entry point with service initialization
├── types.ts                  # TypeScript type definitions
├── contentProcessor.ts       # Content processing utilities
├── documentFilter.ts         # File filtering logic
├── controllers/              # Command and workflow orchestration
│   ├── CommandController.ts  # VS Code command registration
│   └── PolarisController.ts  # Main documentation workflow
├── services/                 # Core business logic
│   ├── CodeParserService.ts  # AST parsing and analysis
│   ├── DocGeneratorService.ts # Documentation generation
│   ├── EmbeddingService.ts   # Local ML embeddings
│   ├── LLMService.ts         # OpenRouter API integration
│   ├── ManifestService.ts    # Symbol registry management
│   ├── VectorStoreService.ts # Vector database operations
│   └── parsers/              # Specialized parsing components
│       ├── ASTLocationHelper.ts
│       ├── JSDocExtractor.ts
│       ├── TypeAnnotationHelper.ts
│       └── extractors/       # Symbol-specific extractors
└── utils/                    # Shared utilities
    ├── ConfigurationLoader.ts # Environment and config management
    └── ErrorHandler.ts       # Centralized error handling
```

## Architecture Patterns

### Controller Pattern
- **CommandController**: Handles VS Code command registration and delegation
- **PolarisController**: Orchestrates the main documentation workflow

### Service Layer
- **Single Responsibility**: Each service handles one domain (parsing, embedding, storage)
- **Dependency Injection**: Services are initialized and passed to controllers
- **Graceful Degradation**: Core functionality continues if AI services fail

### Error Handling Strategy
- **Centralized**: ErrorHandler utility categorizes and formats errors
- **User-Friendly**: Provides actionable error messages with retry options
- **Comprehensive Logging**: Detailed operation IDs and performance metrics

## Key Conventions

### File Naming
- **PascalCase**: For classes and main components (`CodeParserService.ts`)
- **camelCase**: For utility functions and helpers (`documentFilter.ts`)
- **Descriptive**: Names clearly indicate purpose and domain

### Code Organization
- **Extractors**: Specialized classes for different symbol types (functions, classes, interfaces)
- **Helpers**: Utility classes for specific parsing tasks (AST location, type annotations)
- **Services**: Stateful components with initialization and lifecycle management

### Performance Considerations
- **Background Processing**: File operations don't block UI
- **Operation IDs**: Unique identifiers for tracking and debugging
- **Metrics Collection**: Initialization times and success rates logged