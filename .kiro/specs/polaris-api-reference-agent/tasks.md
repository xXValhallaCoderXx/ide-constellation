# Implementation Plan

- [x] 1. Enhance CodeSymbol interface and CodeParserService for source text extraction
  - Modify the CodeSymbol interface in `src/types.ts` to include optional `sourceText` property
  - Update CodeParserService extractors to capture raw source text for each symbol
  - Modify symbol extraction methods to include the complete source code of functions/classes
  - _Requirements: 1.1, 5.2_

- [x] 2. Create DocGeneratorService for markdown documentation generation
  - Create new `src/services/DocGeneratorService.ts` with file-level documentation generation
  - Implement `generateFileDoc(filePath: string, symbols: CodeSymbol[]): string` method
  - Create markdown templates for functions, classes, interfaces, and other symbol types
  - Add utility methods for formatting parameters, return values, and source code sections
  - _Requirements: 1.1, 3.1, 3.2, 3.3_

- [x] 3. Implement JSDoc parsing capabilities in LLMService
  - Add `parseRawDocstring(rawString: string): ParsedJSDoc` method to LLMService
  - Create ParsedJSDoc interface to structure extracted JSDoc components
  - Implement parsing logic to extract description, @param tags, @returns tags from raw strings
  - Add validation and error handling for malformed JSDoc strings
  - _Requirements: 2.3, 5.4_

- [x] 4. Create file-level documentation workflow in extension.ts
  - Modify the `handleDocumentSave` function to implement the new file-level workflow
  - Add logic to parse entire files and extract all symbols using CodeParserService
  - Implement symbol classification to separate documented from undocumented symbols
  - Create documentation directory structure (`/docs/api/`) if it doesn't exist
  - _Requirements: 1.1, 1.2, 1.3, 5.1_

- [ ] 5. Implement AI-powered documentation generation for undocumented symbols
  - Add concurrent processing of undocumented symbols using Promise.all and LLMService
  - Integrate the JSDoc parser to convert raw LLM output into structured format
  - Merge AI-generated documentation with existing JSDoc comments
  - Update CodeSymbol objects with the structured documentation data
  - _Requirements: 2.1, 2.2, 2.3, 5.4_

- [ ] 6. Integrate DocGeneratorService into the main workflow
  - Call DocGeneratorService.generateFileDoc() with the complete symbol list
  - Implement file path mapping from source files to documentation files
  - Write generated markdown content to appropriate files in `/docs/api/` directory
  - Add error handling for file system operations and directory creation
  - _Requirements: 1.1, 1.3, 1.4, 3.4_

- [ ] 7. Implement professional markdown templates and formatting
  - Enhance DocGeneratorService with detailed function documentation sections
  - Create markdown tables for parameters and return values using proper formatting
  - Add source code sections with TypeScript syntax highlighting
  - Implement proper header hierarchy and section organization
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 8. Add file deletion handler for documentation synchronization
  - Register `vscode.workspace.onDidDeleteFiles` event listener in extension.ts
  - Implement logic to calculate corresponding documentation file paths
  - Add file deletion functionality using `vscode.workspace.fs.delete()`
  - Include error handling for cases where documentation files don't exist
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 9. Add comprehensive error handling and logging
  - Implement error boundaries around each service call to prevent workflow failures
  - Add detailed logging for debugging documentation generation issues
  - Create fallback mechanisms when LLM service is unavailable
  - Add performance monitoring and timeout handling for large files
  - _Requirements: 2.4, 5.3, 5.4_

- [ ] 10. Create unit tests for new services and enhanced functionality
  - Write tests for DocGeneratorService markdown generation with various symbol types
  - Create tests for LLMService JSDoc parsing with edge cases and malformed input
  - Add tests for CodeParserService source text extraction accuracy
  - Implement integration tests for the complete file-level documentation workflow
  - _Requirements: 5.1, 5.2, 5.3, 5.4_