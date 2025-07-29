## Relevant Files

- `src/controllers/PolarisController.ts` - Main controller for handling file save events and documentation processing
- `src/controllers/CommandController.ts` - Controller for managing all VSCode command registrations 
- `src/utils/ConfigurationLoader.ts` - Utility for loading environment variables with multi-path fallback
- `src/extension.ts` - Simplified extension entry point (to be refactored from ~1070 lines to <150 lines)

### Notes

- All controllers should be implemented as singleton classes with `vscode.ExtensionContext` constructor injection
- Maintain existing service instantiation patterns (per-operation for `CodeParserService`, `DocGeneratorService`)
- Preserve dynamic import patterns for `LLMService` to maintain lazy loading
- Keep all existing error handling, logging, and user notification patterns identical
- Test refactored functionality manually using existing debug commands and file save operations

## Tasks

- [x] 1.0 Create Configuration Management Infrastructure
  - [x] 1.1 Create `src/utils/ConfigurationLoader.ts` file with environment loading utility
  - [x] 1.2 Extract multi-path .env loading logic from `extension.ts` lines 780-812 into `ConfigurationLoader.loadEnvironment()` method
  - [x] 1.3 Preserve existing search paths: `.env`, `../env`, `../../.env`, `context.extensionPath/.env`
  - [x] 1.4 Maintain identical error handling and logging patterns from current implementation
  - [x] 1.5 Export a function that can be called during extension activation to set up global environment access

- [x] 2.0 Create Controllers Directory Structure  
  - [x] 2.1 Create `src/controllers/` directory
  - [x] 2.2 Ensure controllers will follow singleton pattern with context injection

- [x] 3.0 Implement PolarisController
  - [x] 3.1 Create `src/controllers/PolarisController.ts` file with class skeleton
  - [x] 3.2 Add constructor that accepts `vscode.ExtensionContext` parameter 
  - [x] 3.3 Add private `processingTasks` Map property to manage concurrent file save operations
  - [x] 3.4 Create `processFileDocumentation` method and move `processFileDocumentationAsync` logic from `extension.ts` lines 127-310
  - [x] 3.5 Preserve all existing error handling, logging, performance metrics, and user notifications
  - [x] 3.6 Maintain per-operation service instantiation patterns (`new CodeParserService()`, `new DocGeneratorService()`)
  - [x] 3.7 Preserve dynamic import patterns for `LLMService` with comprehensive error handling
  - [x] 3.8 Ensure `processingTasks` Map cleanup patterns are maintained in controller
  - [x] 3.9 Move `classifySymbols` function from `extension.ts` lines 312-327 into PolarisController as private method
  - [x] 3.10 Move `generateAIDocumentationForSymbols` function from `extension.ts` lines 333-543 into PolarisController as private method
  - [x] 3.11 Move `handleFilesDeletion` function from `extension.ts` lines 548-616 into PolarisController as public method
  - [x] 3.12 Move `deleteCorrespondingDocumentationFile` function from `extension.ts` lines 623-727 into PolarisController as private method
  - [x] 3.13 Move `formatParsedJSDocToComment` function from `extension.ts` lines 734-774 into PolarisController as private method

- [x] 4.0 Implement CommandController
  - [x] 4.1 Create `src/controllers/CommandController.ts` file with class skeleton  
  - [x] 4.2 Add constructor that accepts `vscode.ExtensionContext` parameter
  - [x] 4.3 Create `registerCommands` method to handle all command registrations
  - [x] 4.4 Move `kiro-constellation.helloWorld` command logic from `extension.ts` lines 840-844 into CommandController
  - [x] 4.5 Move `constellation.testLlmConnection` command logic from `extension.ts` lines 849-930 into CommandController
  - [x] 4.6 Move `constellation.testDocstringGeneration` command logic from `extension.ts` lines 934-1062 into CommandController  
  - [x] 4.7 Ensure all commands maintain identical functionality, error handling, and user notifications
  - [x] 4.8 Implement proper subscription management using injected context (`context.subscriptions.push()`)
  - [x] 4.9 Preserve dynamic import patterns and environment validation for LLM-related commands

- [x] 5.0 Refactor Extension Entry Point
  - [x] 5.1 Remove all business logic functions from `extension.ts` (lines 127-774 to be moved to controllers)
  - [x] 5.2 Simplify `activate` function to only handle: environment loading, controller instantiation, event registration
  - [x] 5.3 Replace environment loading logic with call to `ConfigurationLoader.loadEnvironment(context)`
  - [x] 5.4 Instantiate `PolarisController` and `CommandController` as singletons with context injection
  - [x] 5.5 Register `vscode.workspace.onDidSaveTextDocument` event listener with delegation to `PolarisController.processFileDocumentation`
  - [x] 5.6 Register `vscode.workspace.onDidDeleteFiles` event listener with delegation to `PolarisController.handleFilesDeletion`
  - [x] 5.7 Call `CommandController.registerCommands()` to set up all commands
  - [x] 5.8 Preserve `handleDocumentSave` function in `extension.ts` but delegate processing to PolarisController
  - [x] 5.9 Maintain identical error handling boundaries and logging patterns
  - [x] 5.10 Ensure `extension.ts` is reduced to under 150 lines while preserving all functionality

- [x] 6.0 Update Import Statements
  - [x] 6.1 Remove unused imports from refactored `extension.ts` (CodeParserService, DocGeneratorService imports)
  - [x] 6.2 Add imports for new controllers in `extension.ts`
  - [x] 6.3 Ensure all service imports are properly handled in controller files
  - [x] 6.4 Maintain existing imports for `documentFilter`, `contentProcessor`, and `types`

- [x] 7.0 Validate Refactoring
  - [x] 7.1 Test file save events trigger documentation processing correctly
  - [x] 7.2 Test `constellation.testLlmConnection` command functions identically  
  - [x] 7.3 Test `constellation.testDocstringGeneration` command functions identically
  - [x] 7.4 Test `kiro-constellation.helloWorld` command functions identically
  - [x] 7.5 Test file deletion events trigger documentation cleanup correctly
  - [x] 7.6 Verify concurrent file save handling works with the same performance characteristics
  - [x] 7.7 Confirm error handling, logging, and user notifications are identical to original implementation
  - [x] 7.8 Validate that environment loading works across all expected paths
  - [x] 7.9 Ensure extension activation and deactivation work correctly
  - [x] 7.10 Verify that `extension.ts` is under 150 lines and all business logic has been moved to controllers
