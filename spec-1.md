# Technical Specification: Phase 2 - Structural Indexing

## 1\. Overview

The objective of this phase is to create a persistent **"Code Manifest"** (`manifest.json`). This manifest will serve as a fast, queryable, and structured index of all key code symbols (functions, classes, etc.) within the user's workspace. This is the first layer of our Project Memory Engine, capturing the architectural "what" and "where" of the codebase.

This will be achieved by listening for file-save events, parsing the saved file's content into an Abstract Syntax Tree (AST), extracting the relevant metadata, and writing it to the manifest.

## 2\. Core Components & File Structure

  * **Service: `CodeParserService.ts`**

      * **Location:** `src/services/CodeParserService.ts`
      * **Responsibility:** Encapsulates all logic related to parsing source code into an AST and extracting symbol information.

  * **Service: `FileSystemService.ts`**

      * **Location:** `src/services/FileSystemService.ts`
      * **Responsibility:** A utility service to handle all interactions with the workspace file system, ensuring consistent pathing and error handling.

  * **Output: `manifest.json`**

      * **Location:** `[workspaceRoot]/.constellation/manifest.json`
      * **Responsibility:** The persistent JSON file that stores the indexed code symbols.

## 3\. Data Schema Definition

### `CodeSymbol` Interface

This will be our canonical representation of a single code element. It should be defined in a new file, e.g., `src/types.ts`.

```typescript
export interface CodeSymbol {
  id: string; // A unique identifier, e.g., "src/services/api.ts#getUser"
  name: string; // The name of the function or class, e.g., "getUser"
  kind: 'function' | 'class' | 'method' | 'variable'; // The type of symbol
  filePath: string; // Relative path to the file from the workspace root
  position: { // The location in the file for quick navigation
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  docstring: string | null; // The full text of the leading JSDoc or docstring comment
}
```

### `Manifest` Schema

The structure of the `manifest.json` file. It will be an object where keys are file paths, and the values are arrays of `CodeSymbol` objects found in that file.

```typescript
// Define in src/types.ts
import { CodeSymbol } from './types';

export interface Manifest {
  // Key is the relative file path, e.g., "src/services/api.ts"
  [filePath: string]: CodeSymbol[];
}
```

## 4\. Detailed Component Implementation

### A. `FileSystemService.ts`

  * **Dependencies:** `vscode`
  * **Methods:**
      * `public static async readFile(uri: vscode.Uri): Promise<string>`: Reads a file and returns its content. Handles errors gracefully.
      * `public static async writeFile(uri: vscode.Uri, content: string): Promise<void>`: Writes content to a file. It must first ensure the directory exists.
      * `private static async ensureDirectoryExists(uri: vscode.Uri): Promise<void>`: A helper to create the directory path if it doesn't exist (e.g., creating `/.constellation`).

### B. `CodeParserService.ts`

  * **Dependencies:** `vscode`, `@babel/parser`, `@babel/traverse`.
  * **Methods:**
      * `public parse(filePath: string, code: string): CodeSymbol[]`:
        1.  Takes the file path and its string content.
        2.  Uses `@babel/parser` to generate the AST. Configure it with `sourceType: 'module'` and enable relevant plugins like `typescript`.
        3.  Uses `@babel/traverse` to visit the AST. The `visitor` object should target nodes like `FunctionDeclaration`, `ClassDeclaration`, and `VariableDeclarator` (for arrow functions).
        4.  For each target node, extract the metadata and construct a `CodeSymbol` object. The `docstring` can be retrieved from `node.leadingComments`.
        5.  Return an array of all `CodeSymbol` objects found in the file.

### C. `extension.ts` (Integration Logic)

  * Instantiate your services upon activation.
  * The logic inside the `onDidSaveTextDocument` listener will be as follows:
    1.  Check if the saved document is a target file using your filter.
    2.  Get the file's content and relative path.
    3.  Call `codeParserService.parse(relativePath, content)` to get the new symbols for this file.
    4.  Define the URI for `manifest.json`.
    5.  Use `fileSystemService.readFile` to load the current manifest into a JavaScript object. If the file doesn't exist, start with an empty object `{}`.
    6.  Update the manifest object by setting the key for the saved file path to the new array of symbols: `currentManifest[relativePath] = newSymbols;`.
    7.  Use `fileSystemService.writeFile` to save the updated manifest object back to `manifest.json` after `JSON.stringify`.

## 5\. Definition of Done (Acceptance Criteria)

This phase is complete when all of the following conditions are met:

  - [ ] Saving a target source file (e.g., a `.ts` file) for the first time creates a `/.constellation/manifest.json` file.
  - [ ] The `manifest.json` file contains a key for the saved file.
  - [ ] The value for that key is an array of `CodeSymbol` objects that accurately represent the functions/classes in the saved file.
  - [ ] The metadata for each symbol (name, position, docstring) is correct.
  - [ ] Saving the file again correctly updates the entry in the manifest, removing old symbols and adding new ones for that file without affecting other file entries.
  - [ ] Saving a non-target file (e.g., `package.json`) does not trigger the process or modify the manifest.
  - [ ] The process is reasonably fast and does not noticeably lag the editor.