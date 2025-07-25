# Implementation Plan

- [x] 1. Set up project dependencies and core types
  - Install required Babel packages (@babel/parser, @babel/traverse, @babel/types)
  - Create src/types.ts with CodeSymbol and Manifest interfaces
  - Update package.json with new dependencies
  - _Requirements: 2.2, 4.1_

- [x] 2. Implement FileSystemService with error handling
  - Create src/services/FileSystemService.ts with static methods
  - Implement readFile method with graceful error handling
  - Implement writeFile method with directory creation
  - Implement ensureDirectoryExists helper method
  - Write unit tests for all FileSystemService methods
  - _Requirements: 5.1, 5.2, 5.4_

- [x] 3. Implement CodeParserService for AST parsing
  - Create src/services/CodeParserService.ts with parse method
  - Configure Babel parser with TypeScript support and module source type
  - Implement AST traversal targeting FunctionDeclaration nodes
  - Extract symbol metadata (name, position, docstring) from function nodes
  - Write unit tests for function parsing with sample TypeScript code
  - _Requirements: 1.1, 2.1, 2.2, 2.3_

- [x] 4. Extend CodeParserService for class and method parsing
  - Add ClassDeclaration visitor to AST traversal
  - Add MethodDefinition visitor for class methods
  - Implement symbol extraction for classes and methods
  - Generate unique IDs in filePath#symbolName format
  - Write unit tests for class and method parsing
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 5. Add variable and arrow function support to CodeParserService
  - Add VariableDeclarator visitor for arrow functions and variables
  - Implement logic to distinguish between variables and arrow functions
  - Extract position and docstring information for variables
  - Write unit tests for variable and arrow function parsing
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 6. Integrate file save event handling in extension.ts
  - Add onDidSaveTextDocument event listener in activate function
  - Implement file type filtering for TypeScript files (.ts, .tsx)
  - Extract file content and workspace-relative path from save events
  - Create service instances and wire up basic event flow
  - _Requirements: 1.1, 3.1, 3.2_

- [x] 7. Implement manifest reading and updating logic
  - Add logic to construct manifest.json URI in workspace .constellation directory
  - Implement manifest reading with empty object fallback for new workspaces
  - Add manifest updating logic that replaces file-specific symbol arrays
  - Ensure atomic updates that don't affect other files' entries
  - _Requirements: 1.2, 1.4, 4.2_

- [x] 8. Complete end-to-end integration and manifest persistence
  - Connect CodeParserService output to manifest update logic
  - Implement JSON serialization and file writing for updated manifest
  - Add error handling for parsing failures and file system errors
  - Test complete flow from file save to manifest update
  - _Requirements: 1.2, 1.3, 4.4, 5.3_

- [ ] 9. Add performance optimizations and filtering
  - Implement file size limits to prevent memory issues with large files
  - Add exclusion patterns for node_modules and build directories
  - Optimize manifest updates to only process changed files
  - Verify performance meets requirement for no noticeable editor lag
  - _Requirements: 3.3, 3.4_

- [ ] 10. Create comprehensive integration tests
  - Write tests that verify manifest creation on first TypeScript file save
  - Test manifest updates when files are saved multiple times
  - Verify non-target files don't trigger indexing process
  - Test error recovery and graceful degradation scenarios
  - _Requirements: 1.1, 1.2, 1.4, 3.1, 5.1, 5.2, 5.3_