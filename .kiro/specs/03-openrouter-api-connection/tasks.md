# Implementation Plan

- [x] 1. Set up environment and security configuration
  - Install dotenv package as a dependency
  - Create .env file in project root with OPENROUTER_API_KEY placeholder
  - Update .gitignore to exclude .env file from version control
  - _Requirements: 1.1, 1.3_

- [x] 2. Create LLMService class structure
  - Create src/services/LLMService.ts file with class definition
  - Implement constructor that reads API key from environment variables
  - Add private methods for request building and response parsing
  - _Requirements: 3.1, 3.2_

- [x] 3. Implement API request functionality
  - Implement buildRequestHeaders method to create Authorization headers
  - Implement buildRequestBody method to create minimal test request payload
  - Add proper TypeScript interfaces for request and response structures
  - _Requirements: 2.2, 3.4_

- [x] 4. Implement testConnection method
  - Create testConnection method that makes POST request to OpenRouter API
  - Use fetch API to send request with proper headers and body
  - Implement parseResponse method to extract message content from API response
  - Add comprehensive error handling for network and API errors
  - _Requirements: 2.1, 2.3, 3.3_

- [x] 5. Integrate dotenv configuration in extension
  - Modify src/extension.ts to load dotenv configuration at activation
  - Add dotenv.config() call at the beginning of activate function
  - Ensure proper error handling if dotenv loading fails
  - _Requirements: 1.1, 1.2_

- [x] 6. Register VS Code command for connection testing
  - Add constellation.testLlmConnection command registration in src/extension.ts
  - Create command handler that instantiates LLMService and calls testConnection
  - Implement proper error handling and user feedback in command handler
  - _Requirements: 4.1, 4.2_

- [x] 7. Implement user feedback and error display
  - Use vscode.window.showInformationMessage for successful API responses
  - Use vscode.window.showErrorMessage for API failures and configuration errors
  - Add console.log statements for debugging and troubleshooting
  - _Requirements: 4.3, 4.4, 4.5_

- [x] 8. Add command to package.json configuration
  - Update package.json contributes.commands section to include constellation.testLlmConnection
  - Add appropriate command title for VS Code Command Palette display
  - Ensure command is properly exposed to users
  - _Requirements: 4.1_