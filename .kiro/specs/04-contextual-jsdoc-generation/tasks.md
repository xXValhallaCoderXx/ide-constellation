# Implementation Plan

- [x] 1. Create generateDocstring method skeleton in LLMService
  - Add public async generateDocstring method signature that accepts codeSnippet string parameter and returns Promise<string>
  - Implement initial method body that returns hardcoded JSDoc comment: `/** A static JSDoc comment from the service. */`
  - Add comprehensive logging to match existing LLMService patterns for debugging
  - _Requirements: 3.1, 3.4_

- [x] 2. Register constellation.testDocstringGeneration command in extension
  - Add command registration in extension.ts activate function using vscode.commands.registerCommand
  - Create command handler that instantiates LLMService and calls generateDocstring with dummy string parameter
  - Implement logging of returned static JSDoc comment to Debug Console using console.log
  - Add command to context.subscriptions for proper disposal
  - _Requirements: 2.1, 2.4_

- [x] 3. Implement prompt engineering system in generateDocstring method
  - Create systemPrompt constant with expert technical writer instructions and JSDoc formatting requirements
  - Build finalPrompt by combining systemPrompt with formatted code snippet in TypeScript code blocks
  - Replace hardcoded return value with prompt construction logic
  - Add logging for prompt construction process to match existing service patterns
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Integrate OpenRouter API call with prompt system
  - Implement API request construction using existing buildRequestHeaders method
  - Create request body with model selection and messages array containing finalPrompt
  - Add fetch call to OpenRouter API endpoint following existing testConnection pattern
  - Implement response parsing using existing parseResponse method
  - Replace static return with actual API response content
  - _Requirements: 1.1, 1.2, 3.2, 3.3_

- [x] 5. Create comprehensive test function for command handler
  - Define testFunction constant with multi-line calculateAge function implementation including edge case logic
  - Update command handler to pass testFunction string to generateDocstring method instead of dummy string
  - Implement proper async/await handling for API call in command handler
  - Add error handling and user feedback messages for command execution success/failure
  - _Requirements: 2.2, 2.3_

- [x] 6. Add response validation and error handling
  - Implement JSDoc format validation to ensure response starts with /** and ends with */
  - Add content validation to check for presence of function description and required tags
  - Implement fallback handling for invalid API responses with default JSDoc template
  - Add comprehensive error logging that matches existing LLMService error handling patterns
  - _Requirements: 1.3, 1.4, 3.3_
