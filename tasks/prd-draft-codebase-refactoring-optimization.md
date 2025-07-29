# DRAFT Product Requirements Document (PRD): Codebase Refactoring & Optimization

## 1. Overview

This feature involves a comprehensive architectural refactoring of the Kiro Constellation VSCode extension to transform it from a monolithic structure into a modular, scalable, and maintainable codebase. The primary goal is to separate concerns, improve testability, and establish clear architectural boundaries that will support future development and scaling as the project evolves towards Orion and stretch goals.

The refactoring addresses the current challenge where the `extension.ts` file has accumulated significant business logic and orchestration code, making it difficult to maintain, test, and extend. The solution implements a controller-service architecture pattern with clear separation between extension lifecycle management, business logic orchestration, and service-level operations.

## 2. Assumptions Made

- The extension currently functions correctly and all existing functionality must be preserved exactly as-is during refactoring
- The current file save event processing (`onDidSaveTextDocument`) and command registration patterns are the primary areas requiring architectural separation
- The existing services (`CodeParserService`, `DocGeneratorService`, `LLMService`, `ManifestService`) are architecturally sound and will remain in their current structure
- The refactoring will follow TypeScript/JavaScript best practices and maintain compatibility with the current VSCode API usage
- The `controllers/` directory structure is the preferred organizational pattern for business logic orchestration
- Unit testing will be added in future phases, so the refactored code should be designed with testability in mind
- Performance should remain identical or improve after refactoring - no degradation is acceptable
- The refactoring will be completed in a single development cycle without breaking changes to the public API
- The existing environment variable loading and error handling patterns should be preserved
- All debug commands (`constellation.testLlmConnection`, `constellation.testDocstringGeneration`) will remain functional
- The extension activation/deactivation lifecycle management will be simplified but preserved

## 3. User Stories

- **As a developer working on the codebase**, I want the extension entry point to be minimal and focused only on lifecycle management so that I can quickly understand the activation flow and easily modify startup behavior.

- **As a developer implementing new features**, I want business logic separated from infrastructure concerns so that I can work on feature logic without worrying about VSCode API registration details.

- **As a developer debugging issues**, I want clear separation between different types of operations (commands vs. file events) so that I can isolate problems more effectively.

- **As a developer writing tests**, I want individual components that can be tested in isolation so that I can write focused unit tests without mocking the entire VSCode environment.

- **As a developer maintaining the codebase**, I want each class to have a single, clear responsibility so that changes to one aspect of functionality don't impact unrelated features.

- **As a team lead planning future development**, I want a scalable architecture that supports adding new controllers and services so that the team can work on different features without merge conflicts.

## 4. Functional Requirements

### FR1. Extension Entry Point Simplification
**Acceptance Criteria:**
- Given the extension is activated, when the `activate` function is called, then it only handles environment loading, controller instantiation, and event/command registration
- Given the extension contains business logic currently, when refactoring is complete, then `extension.ts` should be under 150 lines of code
- Given the current functionality exists, when the refactor is complete, then all existing features work identically to the current implementation

### FR2. PolarisController Implementation
**Acceptance Criteria:**
- Given a file save event occurs, when the document should be processed, then the `PolarisController.onDidSaveTextDocument` method handles all file processing logic
- Given the current `handleDocumentSave` function exists, when refactoring is complete, then this logic resides in `PolarisController` with identical behavior
- Given multiple file saves occur concurrently, when processing is triggered, then the controller maintains the same concurrent processing safeguards as the current implementation

### FR3. CommandController Implementation
**Acceptance Criteria:**
- Given VSCode commands need registration, when the extension activates, then `CommandController.registerCommands` handles all command registration logic
- Given debug commands exist (`constellation.testLlmConnection`, `constellation.testDocstringGeneration`), when refactoring is complete, then these commands function identically through the new controller
- Given the `kiro-constellation.helloWorld` command exists, when accessed through Command Palette, then it functions exactly as before

### FR4. Service Layer Preservation
**Acceptance Criteria:**
- Given existing services function correctly, when refactoring is complete, then no changes are made to `CodeParserService`, `DocGeneratorService`, `LLMService`, or `ManifestService`
- Given services are used by controllers, when the refactor is complete, then services are properly imported and instantiated by the controllers that need them
- Given services may need different lifecycles, when controllers use services, then proper instantiation patterns are maintained (per-operation vs. singleton)

### FR5. Error Handling Preservation
**Acceptance Criteria:**
- Given the current implementation has comprehensive error handling, when refactoring is complete, then all error handling, logging, and user notifications work identically
- Given errors can occur at different levels, when exceptions happen, then they are handled at the appropriate architectural level (service, controller, or extension)
- Given user feedback is provided for errors, when problems occur, then the same user-facing error messages and notifications are displayed

### FR6. Performance Maintenance
**Acceptance Criteria:**
- Given the current implementation has specific performance characteristics, when refactoring is complete, then file save processing time remains within 5% of current performance
- Given memory usage patterns exist, when the refactor is complete, then memory consumption does not increase by more than 10%
- Given concurrent processing works currently, when refactored, then the same concurrency patterns and performance characteristics are maintained

## 5. Out of Scope (Non-Goals)

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

## 6. Technical Considerations (Optional)

- **Import Strategy**: Controllers will use dynamic imports for services when needed to maintain current lazy-loading patterns for LLMService
- **Instance Management**: Services that are currently instantiated per-operation (like `CodeParserService`) should maintain that pattern in controllers
- **Environment Loading**: The current multi-path environment variable loading logic in `activate` should be preserved
- **VSCode Context**: Controllers may need access to `vscode.ExtensionContext` for certain operations - this should be passed as a constructor parameter
- **Disposal Patterns**: The current subscription management (`context.subscriptions.push`) pattern should be maintained in the new architecture
- **Concurrent Processing**: The existing `processingTasks` Map for handling concurrent file saves should be encapsulated within `PolarisController`
- **TypeScript Compatibility**: All refactored code must maintain strict TypeScript compliance with the current `tsconfig.json` configuration

## 7. Success Metrics

- **Code Organization**: Extension entry point reduced to under 150 lines (currently ~1070 lines)
- **Functional Preservation**: 100% of existing functionality works identically after refactoring (validated through manual testing)
- **Architecture Compliance**: Clear separation achieved where `extension.ts` handles only lifecycle, controllers handle orchestration, and services handle specific tasks

## 8. Open Questions

1. **Controller Lifecycle Management**: Should controllers be instantiated as singletons during extension activation, or created per-operation? The current implementation suggests singleton pattern for event listeners. - They should be singletons.

2. **Error Handling Strategy**: Where should the boundary be between controller-level error handling and extension-level error handling, particularly for the current comprehensive error logging in `handleDocumentSave`? - I think handleDocumentSave can be kept in extension.ts and we can just import the controlls into there.

3. **Service Dependency Injection**: Should controllers instantiate their own services or should services be injected via constructor? Current code shows direct instantiation within functions. What do you think is best for this? you can propose in the next analysis.

4. **Context Parameter Strategy**: How should `vscode.ExtensionContext` be made available to controllers that need to register subscriptions or access extension-specific resources? - We can keep it simple maybe and just pass it ?

5. **File Save Event Ownership**: Should the `onDidSaveTextDocument` event registration happen in `extension.ts` with delegation to `PolarisController`, or should `PolarisController` own the entire event registration process? - I think we eep it in extension.ts

6. **Processing Tasks Map Scope**: Should the `processingTasks` Map for handling concurrent file saves be a class property of `PolarisController`, or should it remain module-level but moved to the controller file? - After your next analysis you can propose the best.

7. **Environment Loading Timing**: Should environment variable loading remain in `extension.ts` activate function, or should it be moved to a dedicated configuration service/controller? If we can make it global lets do that.

8. **Debug Command Categorization**: Should test/debug commands (`constellation.testLlmConnection`, `constellation.testDocstringGeneration`) be in a separate `DebugController` or remain in the general `CommandController`? - I will fix the tests later
