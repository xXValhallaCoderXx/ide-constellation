# Architecture Overview

## System Overview

IDE Constellation is designed as a VS Code extension that provides intelligent code indexing and analysis capabilities. The system follows a service-oriented architecture with clear separation of concerns, making it maintainable, testable, and extensible.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌──────────────────┐               │
│  │   Extension     │    │   Command        │               │
│  │   Activation    │───▶│   Handlers       │               │
│  │   (extension.ts)│    │   (UI Actions)   │               │
│  └─────────────────┘    └──────────────────┘               │
│           │                       │                        │
│           ▼                       ▼                        │
│  ┌─────────────────────────────────────────────────────────┤
│  │              Service Layer                              │
│  ├─────────────────────────────────────────────────────────┤
│  │                                                         │
│  │  ┌──────────────────┐    ┌──────────────────┐          │
│  │  │  CodeParser      │    │  FileSystem      │          │
│  │  │  Service         │    │  Service         │          │
│  │  │                  │    │                  │          │
│  │  │ • AST Parsing    │    │ • File I/O       │          │
│  │  │ • Symbol Extract │    │ • Error Handling │          │
│  │  │ • Docstring      │    │ • Path Management│          │
│  │  └──────────────────┘    └──────────────────┘          │
│  │                                                         │
│  └─────────────────────────────────────────────────────────┤
│                           │                                │
│                           ▼                                │
│  ┌─────────────────────────────────────────────────────────┤
│  │                 Data Layer                              │
│  ├─────────────────────────────────────────────────────────┤
│  │                                                         │
│  │  ┌──────────────────┐    ┌──────────────────┐          │
│  │  │   TypeScript     │    │    Manifest      │          │
│  │  │   Interfaces     │    │    Storage       │          │
│  │  │   (types.ts)     │    │ (.constellation) │          │
│  │  └──────────────────┘    └──────────────────┘          │
│  │                                                         │
│  └─────────────────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    External Dependencies                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐    ┌──────────────────┐              │
│  │   Babel Parser   │    │   VS Code API    │              │
│  │                  │    │                  │              │
│  │ • AST Generation │    │ • File System    │              │
│  │ • TypeScript     │    │ • Events         │              │
│  │ • Traversal      │    │ • Commands       │              │
│  └──────────────────┘    └──────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Extension Entry Point (`src/extension.ts`)

**Purpose**: Main extension lifecycle management and VS Code integration.

**Responsibilities**:
- Extension activation and deactivation
- Command registration and handling
- Event listener setup (future: file save events)
- Service coordination

**Key Functions**:
- `activate()`: Registers commands and initializes extension
- `deactivate()`: Cleanup on extension shutdown
- Command handlers for UI interactions

### Type System (`src/types.ts`)

**Purpose**: Centralized TypeScript interfaces and type definitions.

**Core Types**:

```typescript
interface CodeSymbol {
  id: string;           // Unique identifier: "filePath#symbolName"
  name: string;         // Symbol name (function, class, etc.)
  kind: 'function' | 'class' | 'method' | 'variable';
  filePath: string;     // Workspace-relative path
  position: {           // VS Code position format
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  docstring: string | null; // JSDoc/comment content
}

interface Manifest {
  [filePath: string]: CodeSymbol[]; // File-grouped symbols
}
```

### Service Layer

#### CodeParserService (`src/services/CodeParserService.ts`)

**Purpose**: Abstract Syntax Tree (AST) parsing and code symbol extraction.

**Core Functionality**:
- Parses TypeScript code using Babel parser
- Traverses AST to identify code symbols
- Extracts metadata (position, documentation, type)
- Handles parsing errors gracefully

**Supported Symbol Types**:
- **Functions**: Named function declarations
- **Classes**: Class declarations with methods
- **Methods**: Class methods (excluding constructors)
- **Variables**: Variable declarations and arrow functions

**AST Processing Strategy**:
```typescript
// Parser configuration
const ast = parse(code, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
});

// Targeted AST node visitors
traverse(ast, {
  FunctionDeclaration(path) { /* Extract functions */ },
  ClassDeclaration(path) { /* Extract classes */ },
  ClassMethod(path) { /* Extract methods */ },
  VariableDeclarator(path) { /* Extract variables/arrows */ }
});
```

#### FileSystemService (`src/services/FileSystemService.ts`)

**Purpose**: Abstracted file system operations with consistent error handling.

**Core Methods**:
- `readFile(uri)`: Read file content with error handling
- `writeFile(uri, content)`: Write content with directory creation
- `ensureDirectoryExists(uri)`: Create directory structure

**Error Handling Strategy**:
- Graceful degradation on file system errors
- Descriptive error messages for debugging
- Automatic directory creation for output files

## Data Flow

### Current Implementation (Command-Based)

```
User Action (Command Palette)
           ↓
Command Handler (extension.ts)
           ↓
Service Method Call
           ↓
VS Code API Interaction
           ↓
User Feedback (Information Message)
```

### Planned Implementation (Structural Indexing)

```
File Save Event
           ↓
Event Handler (extension.ts)
           ↓
File Type Validation
           ↓
CodeParserService.parse()
           ↓
Symbol Extraction (AST)
           ↓
Manifest Update Logic
           ↓
FileSystemService.writeFile()
           ↓
Persistent Storage (.constellation/manifest.json)
```

## Design Patterns

### Service Pattern
- **Stateless Services**: All services use static methods
- **Single Responsibility**: Each service handles one concern
- **Dependency Injection**: Services can be easily mocked for testing

### Error Handling Pattern
- **Graceful Degradation**: Errors don't crash the extension
- **Logging Strategy**: Errors logged to VS Code console
- **Recovery Mechanisms**: Continue operation despite individual failures

### Event-Driven Architecture
- **VS Code Events**: File save, document change, workspace events
- **Reactive Processing**: Respond to user actions and file changes
- **Asynchronous Operations**: Non-blocking file I/O and parsing

## Technology Stack

### Core Dependencies

**Runtime Dependencies**:
- `@babel/parser`: TypeScript AST generation
- `@babel/traverse`: AST traversal and analysis
- `@babel/types`: AST node type definitions

**Development Dependencies**:
- `typescript`: TypeScript compiler and type checking
- `vitest`: Fast unit testing framework
- `@types/vscode`: VS Code API type definitions

### VS Code Integration

**Extension Manifest** (`package.json`):
- Extension metadata and configuration
- Command contributions and activation events
- Dependency declarations

**Build System**:
- TypeScript compilation (`tsc`)
- Watch mode for development
- Output to `out/` directory

## Scalability Considerations

### Performance
- **Incremental Processing**: Only parse changed files
- **File Size Limits**: Prevent memory issues with large files
- **Asynchronous Operations**: Non-blocking UI during processing

### Extensibility
- **Plugin Architecture**: Services can be extended or replaced
- **Configuration System**: Settings for user customization
- **Event System**: Additional event handlers can be added

### Maintainability
- **Clear Separation**: Services, types, and UI logic separated
- **Comprehensive Testing**: Unit tests for all service methods
- **Documentation**: Inline JSDoc and external documentation

## Security Considerations

### File System Access
- **Workspace Scoped**: Only access files within VS Code workspace
- **Path Validation**: Prevent directory traversal attacks
- **Error Boundaries**: Contain file system errors

### Code Parsing
- **Sandboxed Parsing**: Babel parser runs in isolated context
- **Input Validation**: Validate file content before parsing
- **Resource Limits**: Prevent excessive memory usage

## Future Architecture Enhancements

### Planned Features
1. **Real-time Indexing**: File save event integration
2. **Symbol Search**: Fast symbol lookup and navigation
3. **Cross-file Analysis**: Import/export relationship tracking
4. **Performance Monitoring**: Parsing time and memory usage metrics

### Architectural Evolution
- **Database Integration**: SQLite for complex queries
- **Caching Layer**: In-memory symbol cache for performance
- **Plugin System**: Third-party extensions for custom symbol types
- **Language Support**: Extend beyond TypeScript to JavaScript, Python, etc.

The current architecture provides a solid foundation for the structural indexing feature while maintaining flexibility for future enhancements and extensions.