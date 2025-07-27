# Design Document

## Overview

The file-save event listener feature will be implemented as a core component of the VS Code extension that monitors workspace file save events and applies intelligent filtering to determine which files should trigger Polaris functionality. The system uses VS Code's built-in workspace API to capture save events and implements a utility-based filtering approach for maintainability and testability.

## Architecture

The feature follows a modular architecture with clear separation of concerns:

```
Extension Activation
       ↓
Event Listener Registration
       ↓
Save Event Capture
       ↓
Document Filtering
       ↓
Content Processing & Logging
```

### Key Components:
- **Event Listener Manager**: Handles registration and disposal of the save event listener
- **Document Filter**: Utility function that determines if a document should be processed
- **Content Processor**: Handles logging and future Polaris integration

## Components and Interfaces

### 1. Event Listener Registration

The main event listener will be registered in the `activate` function using VS Code's `vscode.workspace.onDidSaveTextDocument` API.

```typescript
interface SaveEventListener {
  register(context: vscode.ExtensionContext): void;
  dispose(): void;
}
```

### 2. Document Filter Utility

A utility function that encapsulates all filtering logic:

```typescript
interface DocumentFilterOptions {
  allowedExtensions: string[];
  excludedPaths: string[];
}

interface DocumentFilter {
  shouldProcessDocument(document: vscode.TextDocument, options: DocumentFilterOptions): boolean;
  isAllowedFileType(document: vscode.TextDocument, allowedExtensions: string[]): boolean;
  isExcludedPath(document: vscode.TextDocument, excludedPaths: string[]): boolean;
}
```

### 3. Content Processor

Handles the processing of filtered documents:

```typescript
interface ContentProcessor {
  processDocument(document: vscode.TextDocument): void;
  logDocumentContent(document: vscode.TextDocument): void;
}
```

## Data Models

### Configuration Model

```typescript
interface FileSaveConfig {
  allowedExtensions: string[];
  excludedPaths: string[];
  enableLogging: boolean;
}

const DEFAULT_CONFIG: FileSaveConfig = {
  allowedExtensions: ['.ts', '.js', '.tsx', '.jsx'],
  excludedPaths: ['node_modules', '.constellation'],
  enableLogging: true
};
```

### Document Context Model

```typescript
interface DocumentContext {
  document: vscode.TextDocument;
  filePath: string;
  fileName: string;
  fileExtension: string;
  shouldProcess: boolean;
}
```

## Implementation Details

### Event Listener Setup

The event listener will be registered in the `activate` function and properly disposed of:

```typescript
export function activate(context: vscode.ExtensionContext) {
  // Existing code...
  
  const saveListener = vscode.workspace.onDidSaveTextDocument((document) => {
    handleDocumentSave(document);
  });
  
  context.subscriptions.push(saveListener);
}
```

### Filtering Logic

The filtering will be implemented as a pure function for testability:

1. **File Type Filtering**: Check if the document's file extension matches allowed types
2. **Path Filtering**: Check if the document's path contains any excluded directory patterns
3. **Combined Logic**: A document is processed only if it passes both filters

### Content Processing

For the initial implementation:
- Log the document's file path and content to the Debug Console
- Use `console.log` for debug output (visible in VS Code's Debug Console)
- Include file path for identification and full content for verification

## Error Handling

### Event Listener Errors
- Wrap the save event handler in try-catch blocks
- Log errors to the Debug Console without breaking the extension
- Continue processing other save events even if one fails

### Document Access Errors
- Handle cases where document content cannot be accessed
- Provide fallback logging that indicates the error occurred
- Ensure the extension remains stable

### Filter Function Errors
- Validate input parameters before processing
- Return safe defaults (false for shouldProcess) on errors
- Log filter errors for debugging

## Testing Strategy

### Unit Tests
- Do not write any unit tests

### Integration Tests
- Do not write any integration tests yet

### Manual Testing Scenarios
1. **Positive Test**: Save a .ts file in src/ directory → Should log content
2. **File Type Filter Test**: Save a package.json file → Should not log
3. **Path Filter Test**: Save a .ts file in node_modules/ → Should not log
4. **Mixed Test**: Save multiple files of different types → Only relevant files logged

### Verification Steps
As specified in the requirements:
- Save a .ts file → Content should be logged to Debug Console
- Save a package.json file → Nothing should be logged
- This confirms both trigger and filtering logic work correctly

## Future Extensibility

The design allows for easy extension:
- **Configuration**: Filter options can be made configurable via VS Code settings
- **Polaris Integration**: The content processor can be extended to trigger Polaris
- **Additional File Types**: New extensions can be added to the allowed list
- **Advanced Filtering**: More sophisticated path matching (regex, glob patterns)
- **Performance**: Debouncing for rapid successive saves

## Performance Considerations

- **Lightweight Filtering**: File type and path checks are O(1) operations
- **Memory Efficient**: No caching of document content, process on-demand
- **Non-blocking**: All processing happens asynchronously
- **Minimal Impact**: Only processes documents that pass initial filters