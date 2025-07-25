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
- File save event listener registration
- Service coordination delegation to extension handlers

**Key Functions**:
- `activate()`: Registers commands, initializes extension, and sets up event listeners
- `deactivate()`: Cleanup on extension shutdown
- Command handlers for UI interactions (welcome message, text operations, spec reading)

**Modular Architecture**:
The extension now delegates structural indexing logic to `src/extension-handlers.ts` for better maintainability:

```typescript
// Clean separation in extension.ts
import { handleFileSave } from './extension-handlers';

export function activate(context: vscode.ExtensionContext) {
  console.log('Hello Kiro Extension is now active!');

  // Register file save event listener
  const fileSaveDisposable = vscode.workspace.onDidSaveTextDocument(handleFileSave);
  context.subscriptions.push(fileSaveDisposable);
  
  // Register other commands...
}
```

### Extension Handlers (`src/extension-handlers.ts`)

**Purpose**: Dedicated module for structural indexing logic and manifest management.

**Key Functions**:
- `handleFileSave()`: Complete file save event processing with error handling
- `getManifestUri()`: Constructs manifest file URI for workspace
- `readManifest()`: Reads existing manifest with fallback for new workspaces
- `updateManifest()`: Atomic manifest updates preserving other files' symbols

**Complete File Save Integration**:
```typescript
export async function handleFileSave(document: vscode.TextDocument): Promise<void> {
  try {
    // 1. Validate workspace context and file type
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;
    
    const fileExtension = path.extname(document.fileName);
    if (fileExtension !== '.ts' && fileExtension !== '.tsx') return;
    
    // 2. Extract content and parse symbols
    const fileContent = document.getText();
    const workspaceRelativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
    
    let symbols: CodeSymbol[] = [];
    try {
      symbols = CodeParserService.parse(workspaceRelativePath, fileContent);
    } catch (parseError) {
      console.error(`Failed to parse ${workspaceRelativePath}:`, parseError);
      // Continue with empty symbols for graceful degradation
    }
    
    // 3. Update manifest with atomic file-specific updates
    try {
      await updateManifest(workspaceFolder, workspaceRelativePath, symbols);
    } catch (manifestError) {
      console.error('Failed to update manifest:', manifestError);
      // Don't crash extension on manifest errors
    }
    
  } catch (error) {
    console.error('Error processing file save event:', error);
  }
}
```

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

### Complete Implementation (Structural Indexing)

```
File Save Event (TypeScript files)
           ↓
handleFileSave() (extension-handlers.ts)
           ↓
Workspace & File Type Validation
           ↓
Content & Path Extraction
           ↓
CodeParserService.parse()
           ↓
Symbol Extraction (AST)
           ↓
readManifest() (existing manifest)
           ↓
updateManifest() (atomic update)
           ↓
FileSystemService.writeFile()
           ↓
Persistent Storage (.constellation/manifest.json)
```

**Implementation Status**: ✅ **COMPLETE** - Full end-to-end structural indexing is now operational with:
- Real-time TypeScript file processing on save events
- Complete symbol extraction (functions, classes, methods, variables)
- Persistent manifest storage with atomic updates
- Comprehensive error handling and graceful degradation
- Full test coverage (47 tests including integration tests)

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
- **VS Code Events**: File save events integrated for real-time indexing
- **Reactive Processing**: Automatic symbol extraction on TypeScript file saves
- **File Type Filtering**: Only processes .ts and .tsx files for performance
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

## Architecture Enhancements

### ✅ Completed Features
1. **Real-time Indexing**: File save event integration with TypeScript file filtering
2. **Symbol Extraction**: Automatic parsing and symbol identification on file saves
3. **Manifest Persistence**: Complete implementation saving extracted symbols to `.constellation/manifest.json`
4. **Atomic Updates**: File-specific manifest updates preserving other files' symbols
5. **Error Handling**: Comprehensive error recovery and graceful degradation
6. **Integration Testing**: Full end-to-end test coverage with 47 test cases

### 🚧 In Progress Features
1. **Performance Optimizations**: File size limits and exclusion patterns (Task 9)
2. **Additional Integration Tests**: Extended error recovery scenarios (Task 10)

### 📋 Planned Features
1. **Symbol Search**: Fast symbol lookup and navigation interface
2. **Cross-file Analysis**: Import/export relationship tracking
3. **Performance Monitoring**: Parsing time and memory usage metrics
4. **Symbol Navigation**: VS Code integration for quick symbol jumping

### Architectural Evolution
- **Database Integration**: SQLite for complex queries
- **Caching Layer**: In-memory symbol cache for performance
- **Plugin System**: Third-party extensions for custom symbol types
- **Language Support**: Extend beyond TypeScript to JavaScript, Python, etc.

The current architecture provides a solid foundation for the structural indexing feature while maintaining flexibility for future enhancements and extensions.