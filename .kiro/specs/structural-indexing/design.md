# Design Document

## Overview

The structural indexing system implements a code symbol extraction and persistence mechanism for VS Code extensions. The system listens for file save events, parses TypeScript files using Babel's AST parser, extracts code symbols (functions, classes, methods, variables), and maintains a persistent JSON manifest at `.constellation/manifest.json`.

The design follows a service-oriented architecture with clear separation of concerns: file system operations, code parsing, and event handling are isolated into dedicated services that can be tested and maintained independently.

## Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code       │    │   Extension      │    │  File System    │
│   Events        │───▶│   Coordinator    │───▶│   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Code Parser    │
                       │   Service        │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  manifest.json   │
                       │  (.constellation)│
                       └──────────────────┘
```

### Event Flow

1. User saves a TypeScript file
2. VS Code triggers `onDidSaveTextDocument` event
3. Extension coordinator validates file type and extracts content
4. CodeParserService parses file content into AST and extracts symbols
5. FileSystemService reads existing manifest (if exists)
6. Extension coordinator updates manifest with new symbols
7. FileSystemService writes updated manifest to disk

## Components and Interfaces

### Core Data Types

Located in `src/types.ts`:

```typescript
export interface CodeSymbol {
  id: string;           // Unique identifier: "filePath#symbolName"
  name: string;         // Symbol name
  kind: 'function' | 'class' | 'method' | 'variable';
  filePath: string;     // Relative path from workspace root
  position: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  docstring: string | null; // JSDoc/docstring content
}

export interface Manifest {
  [filePath: string]: CodeSymbol[];
}
```

### FileSystemService

Located in `src/services/FileSystemService.ts`:

**Purpose:** Abstracts all file system operations with consistent error handling and path management.

**Key Methods:**
- `readFile(uri: vscode.Uri): Promise<string>` - Reads file content with error handling
- `writeFile(uri: vscode.Uri, content: string): Promise<void>` - Writes content, ensures directory exists
- `ensureDirectoryExists(uri: vscode.Uri): Promise<void>` - Creates directory structure if needed

**Dependencies:** `vscode` API for file system operations

### CodeParserService  

Located in `src/services/CodeParserService.ts`:

**Purpose:** Handles AST parsing and symbol extraction from TypeScript code.

**Key Methods:**
- `parse(filePath: string, code: string): CodeSymbol[]` - Main parsing method

**Dependencies:** 
- `@babel/parser` - AST generation
- `@babel/traverse` - AST traversal
- `@babel/types` - Type definitions for AST nodes

**Parsing Strategy:**
- Configure parser with `sourceType: 'module'` and TypeScript plugin
- Target AST nodes: `FunctionDeclaration`, `ClassDeclaration`, `MethodDefinition`, `VariableDeclarator`
- Extract position information from node location data
- Process `leadingComments` for docstring extraction

### Extension Integration

Located in `src/extension.ts`:

**Event Handler Registration:**
- Register `vscode.workspace.onDidSaveTextDocument` listener during activation
- Filter for TypeScript files (`.ts`, `.tsx` extensions)
- Coordinate between services to update manifest

**File Filtering Logic:**
- Target files: `.ts`, `.tsx`
- Exclude: `node_modules`, `.git`, build output directories
- Use workspace-relative paths for consistency

## Data Models

### Symbol Identification

Symbol IDs follow the pattern: `{relativePath}#{symbolName}`
- Example: `src/services/api.ts#getUserData`
- Ensures uniqueness across the workspace
- Enables quick symbol lookup and navigation

### Position Tracking

Position information uses VS Code's coordinate system:
- Line numbers: 0-based
- Character positions: 0-based
- Enables direct navigation via `vscode.Position`

### Manifest Structure

```json
{
  "src/services/api.ts": [
    {
      "id": "src/services/api.ts#getUserData",
      "name": "getUserData", 
      "kind": "function",
      "filePath": "src/services/api.ts",
      "position": {
        "start": { "line": 10, "character": 0 },
        "end": { "line": 15, "character": 1 }
      },
      "docstring": "/**\n * Fetches user data from API\n */"
    }
  ]
}
```

## Error Handling

### File System Errors
- **File Not Found:** Initialize empty manifest on first run
- **Permission Errors:** Log error, continue operation without crashing
- **Directory Creation:** Ensure `.constellation` directory exists before writing

### Parsing Errors
- **Syntax Errors:** Log parsing failure, skip file, maintain existing symbols
- **Unsupported Constructs:** Gracefully skip unknown AST nodes
- **Memory Issues:** Implement file size limits for parsing

### Recovery Strategies
- Maintain backup of previous manifest during updates
- Atomic write operations to prevent corruption
- Graceful degradation when services are unavailable

## Testing Strategy

### Unit Testing
- **CodeParserService:** Test symbol extraction with various TypeScript constructs
- **FileSystemService:** Mock file system operations, test error conditions
- **Integration:** Test end-to-end flow with sample TypeScript files

### Test Data
- Sample TypeScript files with functions, classes, methods, variables
- Files with and without JSDoc comments
- Edge cases: empty files, syntax errors, large files

### Performance Testing
- Measure parsing time for files of various sizes
- Test manifest update performance with large codebases
- Memory usage monitoring during AST processing

### Integration Testing
- Test with real VS Code workspace
- Verify manifest persistence across extension reloads
- Test concurrent file saves and manifest updates