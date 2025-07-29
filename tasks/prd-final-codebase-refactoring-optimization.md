# FINAL Product Requirements Document (PRD): Codebase Refactoring & Optimization

## 1. Overview

This feature involves a comprehensive architectural refactoring of the Kiro Constellation VSCode extension to transform it from a monolithic structure into a modular, scalable, and maintainable codebase. The primary goal is to separate concerns, improve testability, and establish clear architectural boundaries that will support future development and scaling as the project evolves towards Orion and stretch goals.

The refactoring addresses the current challenge where the `extension.ts` file has accumulated significant business logic and orchestration code, making it difficult to maintain, test, and extend. The solution implements a controller-service architecture pattern with clear separation between extension lifecycle management, business logic orchestration, and service-level operations.

## 2. User Stories

- **As a developer working on the codebase**, I want the extension entry point to be minimal and focused only on lifecycle management so that I can quickly understand the activation flow and easily modify startup behavior.

- **As a developer implementing new features**, I want business logic separated from infrastructure concerns so that I can work on feature logic without worrying about VSCode API registration details.

- **As a developer debugging issues**, I want clear separation between different types of operations (commands vs. file events) so that I can isolate problems more effectively.

- **As a developer writing tests**, I want individual components that can be tested in isolation so that I can write focused unit tests without mocking the entire VSCode environment.

- **As a developer maintaining the codebase**, I want each class to have a single, clear responsibility so that changes to one aspect of functionality don't impact unrelated features.

- **As a team lead planning future development**, I want a scalable architecture that supports adding new controllers and services so that the team can work on different features without merge conflicts.

## 3. Functional Requirements

### FR1. Extension Entry Point Simplification
**Acceptance Criteria:**
- Given the extension is activated, when the `activate` function is called, then it only handles environment loading, controller instantiation, and event/command registration with delegation to controllers
- Given the extension contains business logic currently, when refactoring is complete, then `extension.ts` should be under 150 lines of code
- Given the current functionality exists, when the refactor is complete, then all existing features work identically to the current implementation
- Given controllers need context access, when controllers are instantiated, then they receive the `vscode.ExtensionContext` as a constructor parameter

### FR2. PolarisController Implementation
**Acceptance Criteria:**
- Given a file save event occurs, when the document should be processed, then the `PolarisController.processFileDocumentation` method handles all file processing logic
- Given the current `processFileDocumentationAsync` function exists, when refactoring is complete, then this logic resides in `PolarisController` with identical behavior
- Given multiple file saves occur concurrently, when processing is triggered, then the controller maintains the same concurrent processing safeguards using the `processingTasks` Map as a class property
- Given controllers are singletons, when the `PolarisController` is instantiated during activation, then it maintains its state throughout the extension lifecycle

### FR3. CommandController Implementation  
**Acceptance Criteria:**
- Given VSCode commands need registration, when the extension activates, then `CommandController.registerCommands` handles all command registration logic including subscription management
- Given debug commands exist (`constellation.testLlmConnection`, `constellation.testDocstringGeneration`), when refactoring is complete, then these commands function identically through the new controller
- Given the `kiro-constellation.helloWorld` command exists, when accessed through Command Palette, then it functions exactly as before
- Given commands need context access, when commands are registered, then the controller uses the injected `vscode.ExtensionContext` for subscription management

### FR4. Service Layer Preservation with Enhanced Patterns
**Acceptance Criteria:**
- Given existing services function correctly, when refactoring is complete, then no changes are made to `CodeParserService`, `DocGeneratorService`, `LLMService`, or `ManifestService`
- Given services are used by controllers, when the refactor is complete, then services maintain per-operation instantiation patterns (e.g., `new CodeParserService()` per file processing operation)
- Given `LLMService` requires environment validation, when controllers use it, then dynamic imports and error handling patterns are preserved
- Given controllers manage service lifecycles, when processing operations occur, then services are instantiated within the appropriate controller methods

### FR5. Error Handling and Event Management Patterns
**Acceptance Criteria:**
- Given the current implementation has comprehensive error handling, when refactoring is complete, then all error handling, logging, and user notifications work identically
- Given `handleDocumentSave` contains critical error handling, when refactoring occurs, then this function remains in `extension.ts` and delegates to the `PolarisController`
- Given event listeners need registration, when the extension activates, then `onDidSaveTextDocument` and `onDidDeleteFiles` registration remains in `extension.ts` with delegation patterns
- Given errors can occur at different levels, when exceptions happen, then they are handled at the appropriate architectural level (service, controller, or extension)

### FR6. Environment and Configuration Management
**Acceptance Criteria:**
- Given environment variables need global access, when the extension activates, then the multi-path `.env` loading logic is preserved but abstracted into a reusable configuration utility
- Given configuration is needed across components, when controllers and services need environment access, then they can access globally loaded environment variables
- Given the current `dotenv` loading pattern works, when refactoring is complete, then the same search paths and error handling are maintained
- Given API keys are validated in multiple places, when services access them, then validation patterns remain consistent

## 4. Out of Scope (Non-Goals)

- **Service Layer Refactoring**: Existing services (`CodeParserService`, `DocGeneratorService`, `LLMService`, `ManifestService`) will not be modified
- **New Feature Development**: No new functionality will be added during this refactoring effort  
- **Unit Test Implementation**: While the refactor will enable better testing, writing actual unit tests is a separate effort
- **Configuration System Changes**: The current environment variable loading and configuration patterns will remain unchanged
- **VSCode API Updates**: No updates to VSCode API usage patterns or dependencies
- **Performance Optimization**: Beyond maintaining current performance, no specific performance improvements are targeted
- **Documentation Generation Logic Changes**: The current file-level documentation workflow will remain functionally identical
- **User Interface Changes**: No changes to Command Palette commands, notifications, or user-facing messages
- **Build System Modifications**: The current Vite build configuration and npm scripts will remain unchanged
- **Dependency Updates**: No package.json dependency changes beyond what's necessary for the refactoring

## 5. Technical Considerations

**Controller Architecture:**
- Controllers will be implemented as singleton classes instantiated during extension activation
- Each controller will receive `vscode.ExtensionContext` as a constructor parameter for subscription management
- `PolarisController` will encapsulate the `processingTasks` Map as a private class property to manage concurrent file save operations
- Controllers will use the existing per-operation service instantiation pattern found throughout the current codebase

**Service Integration Patterns:**
- Based on codebase analysis, services like `CodeParserService` and `DocGeneratorService` are instantiated per-operation (e.g., `const codeParserService = new CodeParserService()` in line 172, `const docGeneratorService = new DocGeneratorService()` in lines 235 and 249)
- `LLMService` uses dynamic imports with comprehensive error handling - this pattern will be preserved in controllers
- Services maintain their current constructor patterns and internal configuration management

**Event Management Strategy:**
- The `handleDocumentSave` function will remain in `extension.ts` but delegate processing to `PolarisController.processFileDocumentation`
- Event listener registration (`vscode.workspace.onDidSaveTextDocument`, `vscode.workspace.onDidDeleteFiles`) stays in the activation function
- This approach preserves the critical error boundary and logging infrastructure while achieving modularity

**Environment Configuration:**
- The current multi-path environment loading logic (searching `.env`, `../env`, `../../.env`, `context.extensionPath/.env`) will be extracted into a global configuration utility
- Environment variables will remain globally accessible through `process.env` after initial loading
- The existing validation patterns for `OPENROUTER_API_KEY` will be maintained across all components

**Concurrent Processing Management:**
- The `processingTasks` Map currently manages concurrent file save operations and will become a private property of `PolarisController`
- This encapsulation ensures thread-safe access while maintaining the same concurrency control behavior
- The cleanup patterns (`processingTask.finally()`) will be preserved within the controller

**Import and Disposal Patterns:**
- Controllers will maintain the existing dynamic import patterns for `LLMService` to preserve lazy loading
- The current `context.subscriptions.push()` pattern will be managed by each controller for their respective registrations
- TypeScript compatibility will be maintained with the current strict configuration

## 6. Success Metrics

- **Code Organization**: Extension entry point reduced to under 150 lines (currently ~1070 lines)
- **Functional Preservation**: 100% of existing functionality works identically after refactoring (validated through manual testing)
- **Architecture Compliance**: Clear separation achieved where `extension.ts` handles only lifecycle and delegation, controllers handle orchestration, and services handle specific tasks
- **Performance Maintenance**: File save processing time remains within 5% of current performance, memory consumption does not increase by more than 10%
