# Core Services

## Overview

IDE Constellation's core functionality is implemented through a service-oriented architecture with two primary services: `CodeParserService` for AST parsing and symbol extraction, and `FileSystemService` for file operations. These services provide the foundation for the structural indexing system.

## CodeParserService

### Purpose and Responsibilities

The `CodeParserService` is responsible for parsing TypeScript code using Abstract Syntax Tree (AST) analysis and extracting meaningful code symbols. It serves as the core intelligence of the indexing system.

**Location**: `src/services/CodeParserService.ts`

**Key Responsibilities**:
- Parse TypeScript source code into AST
- Traverse AST to identify code symbols
- Extract metadata (position, documentation, type information)
- Handle parsing errors gracefully
- Support multiple symbol types (functions, classes, methods, variables)

### Core API

#### Main Parsing Method

```typescript
static parse(filePath: string, code: string): CodeSymbol[]
```

**Parameters**:
- `filePath`: Workspace-relative path (used for symbol ID generation)
- `code`: TypeScript source code to parse

**Returns**: Array of `CodeSymbol` objects representing extracted symbols

**Example Usage**:
```typescript
const code = `
/**
 * Calculates user statistics
 */
function calculateStats(users: User[]): Stats {
  return users.reduce((stats, user) => ({
    total: stats.total + 1,
    active: stats.active + (user.isActive ? 1 : 0)
  }), { total: 0, active: 0 });
}

class UserManager {
  /**
   * Adds a new user to the system
   */
  addUser(user: User): void {
    this.users.push(user);
  }
}
`;

const symbols = CodeParserService.parse('src/user-service.ts', code);
// Returns: [
//   { id: 'src/user-service.ts#calculateStats', name: 'calculateStats', kind: 'function', ... },
//   { id: 'src/user-service.ts#UserManager', name: 'UserManager', kind: 'class', ... },
//   { id: 'src/user-service.ts#UserManager.addUser', name: 'addUser', kind: 'method', ... }
// ]
```

### Supported Symbol Types

#### 1. Function Declarations

**AST Node**: `FunctionDeclaration`

**Extraction Logic**:
- Requires named functions (anonymous functions skipped)
- Extracts function name from `node.id.name`
- Captures complete function body position
- Processes JSDoc comments from `leadingComments`

**Example**:
```typescript
/**
 * Processes user data
 * @param userData Raw user information
 * @returns Processed user object
 */
function processUserData(userData: RawUser): ProcessedUser {
  return {
    id: userData.id,
    name: userData.name.trim(),
    email: userData.email.toLowerCase()
  };
}
```

**Extracted Symbol**:
```typescript
{
  id: 'src/user.ts#processUserData',
  name: 'processUserData',
  kind: 'function',
  filePath: 'src/user.ts',
  position: { start: { line: 4, character: 0 }, end: { line: 10, character: 1 } },
  docstring: '/**\n * Processes user data\n * @param userData Raw user information\n * @returns Processed user object\n */'
}
```

#### 2. Class Declarations

**AST Node**: `ClassDeclaration`

**Extraction Logic**:
- Extracts class name from `node.id.name`
- Captures entire class definition position
- Processes class-level JSDoc comments
- Skips anonymous classes

**Example**:
```typescript
/**
 * Manages user authentication and authorization
 */
class AuthenticationManager {
  private users: Map<string, User> = new Map();
  
  constructor(private config: AuthConfig) {}
  
  authenticate(credentials: Credentials): Promise<User | null> {
    // Implementation
  }
}
```

#### 3. Class Methods

**AST Node**: `ClassMethod`

**Extraction Logic**:
- Extracts method name from `node.key.name`
- Skips constructor methods
- Includes parent class name in symbol ID
- Supports static and instance methods
- Handles access modifiers (public, private, protected)

**Example**:
```typescript
class DataProcessor {
  /**
   * Validates input data structure
   */
  private validateData(data: unknown): data is ValidData {
    return typeof data === 'object' && data !== null;
  }
  
  /**
   * Processes validated data
   */
  public processData(data: ValidData): ProcessedData {
    // Implementation
  }
}
```

**Extracted Symbols**:
```typescript
[
  {
    id: 'src/processor.ts#DataProcessor.validateData',
    name: 'validateData',
    kind: 'method',
    // ... other properties
  },
  {
    id: 'src/processor.ts#DataProcessor.processData',
    name: 'processData',
    kind: 'method',
    // ... other properties
  }
]
```

#### 4. Variables and Arrow Functions

**AST Node**: `VariableDeclarator`

**Extraction Logic**:
- Distinguishes between regular variables and function assignments
- Identifies arrow functions via `ArrowFunctionExpression` initializer
- Identifies function expressions via `FunctionExpression` initializer
- Skips destructuring patterns (`const { name, age } = user`)
- Extracts docstring from parent `VariableDeclaration`

**Examples**:

**Arrow Function**:
```typescript
/**
 * Formats user display name
 */
const formatUserName = (user: User): string => {
  return `${user.firstName} ${user.lastName}`;
};
```

**Regular Variable**:
```typescript
/**
 * Default configuration settings
 */
const DEFAULT_CONFIG = {
  timeout: 5000,
  retries: 3,
  debug: false
};
```

**Function Expression**:
```typescript
/**
 * Event handler for user clicks
 */
const handleUserClick = function(event: MouseEvent): void {
  event.preventDefault();
  // Handle click
};
```

### AST Processing Implementation

#### Parser Configuration

```typescript
const ast = parse(code, {
  sourceType: 'module',           // Support ES6 modules
  plugins: ['typescript', 'jsx'], // TypeScript and JSX support
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
});
```

#### AST Traversal Strategy

```typescript
traverse(ast, {
  FunctionDeclaration(path) {
    // Extract function symbols
    const node = path.node;
    if (node.id?.name) {
      symbols.push(createFunctionSymbol(node, filePath));
    }
  },
  
  ClassDeclaration(path) {
    // Extract class symbols
    const node = path.node;
    if (node.id?.name) {
      symbols.push(createClassSymbol(node, filePath));
    }
  },
  
  ClassMethod(path) {
    // Extract method symbols
    const node = path.node;
    if (t.isIdentifier(node.key) && node.key.name !== 'constructor') {
      symbols.push(createMethodSymbol(node, path, filePath));
    }
  },
  
  VariableDeclarator(path) {
    // Extract variable and arrow function symbols
    const node = path.node;
    if (t.isIdentifier(node.id)) {
      symbols.push(createVariableSymbol(node, path, filePath));
    }
  }
});
```

#### Docstring Extraction

```typescript
private static extractDocstring(node: any): string | null {
  if (!node.leadingComments?.length) return null;
  
  // Look for JSDoc comments (/** ... */)
  const jsdocComment = node.leadingComments.find((comment: any) =>
    comment.type === 'CommentBlock' && comment.value.startsWith('*')
  );
  
  return jsdocComment ? `/*${jsdocComment.value}*/` : null;
}
```

### Error Handling

The service implements graceful error handling to prevent extension crashes:

```typescript
try {
  const ast = parse(code, parserConfig);
  // Process AST
} catch (error) {
  console.error(`Failed to parse file ${filePath}:`, error);
  return []; // Return empty array, don't crash
}
```

**Error Scenarios Handled**:
- **Syntax Errors**: Invalid TypeScript syntax
- **Parser Failures**: Babel parser internal errors
- **Memory Issues**: Large files causing memory problems
- **Unsupported Constructs**: Edge cases in TypeScript syntax

## FileSystemService

### Purpose and Responsibilities

The `FileSystemService` provides a consistent abstraction layer over VS Code's file system API with robust error handling and path management.

**Location**: `src/services/FileSystemService.ts`

**Key Responsibilities**:
- Read file content with error handling
- Write files with automatic directory creation
- Manage file paths and URIs consistently
- Provide descriptive error messages
- Handle file system permissions and access issues

### Core API

#### File Reading

```typescript
static async readFile(uri: vscode.Uri): Promise<string>
```

**Purpose**: Reads file content and converts to UTF-8 string

**Parameters**:
- `uri`: VS Code URI object representing the file path

**Returns**: Promise resolving to file content as string

**Error Handling**: Throws descriptive error if file cannot be read

**Example Usage**:
```typescript
const manifestUri = vscode.Uri.joinPath(workspaceUri, '.constellation', 'manifest.json');

try {
  const content = await FileSystemService.readFile(manifestUri);
  const manifest = JSON.parse(content);
  return manifest;
} catch (error) {
  console.log('Manifest not found, creating new one');
  return {};
}
```

#### File Writing

```typescript
static async writeFile(uri: vscode.Uri, content: string): Promise<void>
```

**Purpose**: Writes content to file, creating directories as needed

**Parameters**:
- `uri`: VS Code URI object representing the target file path
- `content`: String content to write to file

**Features**:
- Automatic directory creation via `ensureDirectoryExists()`
- UTF-8 encoding
- Atomic write operations
- Comprehensive error handling

**Example Usage**:
```typescript
const manifestUri = vscode.Uri.joinPath(workspaceUri, '.constellation', 'manifest.json');
const manifestContent = JSON.stringify(manifest, null, 2);

try {
  await FileSystemService.writeFile(manifestUri, manifestContent);
  console.log('Manifest updated successfully');
} catch (error) {
  console.error('Failed to update manifest:', error.message);
}
```

#### Directory Management

```typescript
static async ensureDirectoryExists(fileUri: vscode.Uri): Promise<void>
```

**Purpose**: Ensures the directory for a given file path exists

**Implementation Strategy**:
1. Extract directory path from file URI
2. Check if directory already exists
3. Create directory if it doesn't exist
4. Handle permission and access errors

**Example Usage**:
```typescript
// Automatically called by writeFile(), but can be used independently
const outputFileUri = vscode.Uri.joinPath(workspaceUri, 'output', 'data', 'results.json');
await FileSystemService.ensureDirectoryExists(outputFileUri);
// Now safe to write to results.json
```

### Error Handling Strategy

#### Descriptive Error Messages

```typescript
try {
  const fileData = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(fileData).toString('utf8');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  throw new Error(`Failed to read file ${uri.fsPath}: ${errorMessage}`);
}
```

#### Common Error Scenarios

**File Not Found**:
```typescript
// Handled gracefully in application code
try {
  const content = await FileSystemService.readFile(manifestUri);
} catch (error) {
  if (error.message.includes('Failed to read file')) {
    // Initialize with empty manifest
    return {};
  }
  throw error;
}
```

**Permission Errors**:
```typescript
// Service provides descriptive error, application decides how to handle
try {
  await FileSystemService.writeFile(uri, content);
} catch (error) {
  if (error.message.includes('permission')) {
    vscode.window.showErrorMessage('Cannot write to file: Permission denied');
  }
}
```

## Service Integration Patterns

### Real-time File Save Integration with Manifest Persistence

The services are now fully integrated with VS Code's file save events for automatic structural indexing and manifest persistence. The implementation has been modularized into `src/extension-handlers.ts` for better maintainability:

```typescript
// Complete implementation in extension-handlers.ts
export async function handleFileSave(document: vscode.TextDocument): Promise<void> {
  try {
    // Workspace validation
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      console.log('File is not in a workspace folder, skipping indexing');
      return;
    }

    // File type filtering for TypeScript files (.ts, .tsx)
    const fileExtension = path.extname(document.fileName);
    if (fileExtension !== '.ts' && fileExtension !== '.tsx') {
      return; // Skip non-TypeScript files
    }

    // Extract file content and workspace-relative path
    const fileContent = document.getText();
    const workspaceRelativePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);

    console.log(`Processing TypeScript file: ${workspaceRelativePath}`);

    // Parse code and extract symbols with error handling
    let symbols: CodeSymbol[] = [];
    try {
      symbols = CodeParserService.parse(workspaceRelativePath, fileContent);
      console.log(`Extracted ${symbols.length} symbols from ${workspaceRelativePath}`);
    } catch (parseError) {
      console.error(`Failed to parse ${workspaceRelativePath}:`, parseError);
      // Continue with empty symbols array for graceful degradation
    }

    // Update manifest with extracted symbols
    try {
      await updateManifest(workspaceFolder, workspaceRelativePath, symbols);
      
      // Log extracted symbols for debugging (only in development)
      if (process.env.NODE_ENV !== 'test') {
        symbols.forEach(symbol => {
          console.log(`Symbol: ${symbol.name} (${symbol.kind}) at line ${symbol.position.start.line + 1}`);
        });
      }
    } catch (manifestError) {
      console.error('Failed to update manifest:', manifestError);
      // Don't re-throw to prevent extension crashes
    }

  } catch (error) {
    console.error('Error processing file save event:', error);
    // Graceful degradation - don't crash the extension
  }
}
```

### Manifest Management Services

The extension now includes dedicated functions for manifest operations in `src/extension-handlers.ts`:

#### Manifest URI Construction
```typescript
export function getManifestUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
  return vscode.Uri.joinPath(workspaceFolder.uri, '.constellation', 'manifest.json');
}
```

#### Manifest Reading with Fallback
```typescript
export async function readManifest(workspaceFolder: vscode.WorkspaceFolder): Promise<Manifest> {
  try {
    const manifestUri = getManifestUri(workspaceFolder);
    const manifestContent = await FileSystemService.readFile(manifestUri);
    return JSON.parse(manifestContent) as Manifest;
  } catch (error) {
    // Return empty object fallback for new workspaces or read errors
    console.log('Manifest not found or invalid, starting with empty manifest');
    return {};
  }
}
```

#### Atomic Manifest Updates
```typescript
export async function updateManifest(
  workspaceFolder: vscode.WorkspaceFolder, 
  filePath: string, 
  symbols: CodeSymbol[]
): Promise<void> {
  try {
    // Read current manifest
    const manifest = await readManifest(workspaceFolder);

    // Replace file-specific symbol arrays without affecting other files' entries
    manifest[filePath] = symbols;

    // Write updated manifest atomically with proper JSON formatting
    const manifestUri = getManifestUri(workspaceFolder);
    const manifestContent = JSON.stringify(manifest, null, 2);
    await FileSystemService.writeFile(manifestUri, manifestContent);

    console.log(`Updated manifest with ${symbols.length} symbols for ${filePath}`);
  } catch (error) {
    console.error('Error updating manifest:', error);
    throw error;
  }
}
```

**Key Features:**
- **Atomic Updates**: Only the specific file's symbols are replaced, preserving other files' entries
- **Graceful Fallback**: Creates empty manifest if none exists
- **Proper JSON Formatting**: Uses 2-space indentation for readability
- **Error Isolation**: Manifest errors don't crash the extension

### Testing Strategy

The services now include comprehensive unit and integration testing:

#### Unit Testing
**CodeParserService Tests** (23 test cases):
```typescript
describe('CodeParserService', () => {
  it('should extract function with JSDoc', () => {
    const code = `
      /**
       * Test function
       */
      function testFunc() { return 'test'; }
    `;
    
    const symbols = CodeParserService.parse('test.ts', code);
    
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('testFunc');
    expect(symbols[0].docstring).toContain('Test function');
  });
  
  it('should handle parsing errors gracefully', () => {
    const invalidCode = 'function broken() { return "unclosed string; }';
    const symbols = CodeParserService.parse('broken.ts', invalidCode);
    expect(symbols).toEqual([]); // Graceful degradation
  });
});
```

**FileSystemService Tests** (11 test cases):
```typescript
describe('FileSystemService', () => {
  it('should handle file read errors gracefully', async () => {
    const nonExistentUri = vscode.Uri.file('/nonexistent/file.txt');
    
    await expect(FileSystemService.readFile(nonExistentUri))
      .rejects.toThrow('Failed to read file');
  });
  
  it('should create directory before writing if it does not exist', async () => {
    // Test automatic directory creation during file writes
  });
});
```

#### Integration Testing
**End-to-End Integration Tests** (`src/integration.test.ts` - 8 test cases):

```typescript
describe('End-to-End Integration Tests', () => {
  it('should create manifest on first TypeScript file save', async () => {
    // Tests complete flow: file save → parsing → manifest creation
    const testCode = `
      /**
       * Test function
       */
      function testFunction() { return 'hello'; }
      
      class TestClass {
        testMethod() { return 'world'; }
      }
    `;
    
    await handleFileSave(mockDocument);
    
    // Verify manifest creation and content
    expect(manifest['src/test.ts']).toHaveLength(3);
    expect(manifest['src/test.ts'][0].name).toBe('testFunction');
  });
  
  it('should update existing manifest when file is saved multiple times', async () => {
    // Tests atomic updates preserving other files' symbols
  });
  
  it('should handle parsing errors gracefully', async () => {
    // Tests error recovery without extension crashes
  });
  
  it('should skip non-TypeScript files', async () => {
    // Tests file type filtering
  });
});
```

**Test Coverage:**
- **47 total tests** across all services
- **Unit tests** for individual service methods
- **Integration tests** for complete workflows
- **Error handling tests** for graceful degradation
- **File type filtering tests** for performance
- **Manifest persistence tests** for data integrity

### Performance Considerations

**CodeParserService**:
- **File Size Limits**: Consider implementing limits for very large files
- **Caching**: Future enhancement for parsed AST caching
- **Incremental Parsing**: Only reparse changed sections

**FileSystemService**:
- **Batch Operations**: Group multiple file operations when possible
- **Async Operations**: All methods are async to prevent UI blocking
- **Error Recovery**: Continue operation despite individual file failures

## Future Enhancements

### Planned Service Extensions

1. **Symbol Search Service**: Fast symbol lookup and filtering
2. **Dependency Analysis Service**: Track import/export relationships
3. **Performance Monitoring Service**: Track parsing times and memory usage
4. **Configuration Service**: User settings and preferences management

### Service Architecture Evolution

- **Plugin System**: Allow third-party services to extend functionality
- **Event System**: Services can emit and listen to events
- **Caching Layer**: Shared cache for parsed symbols and file metadata
- **Database Integration**: SQLite for complex queries and relationships

The current service architecture provides a solid foundation for the structural indexing feature while maintaining flexibility for future enhancements and integrations.