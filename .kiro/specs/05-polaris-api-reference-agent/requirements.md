# Requirements Document

## Introduction

The Polaris API Reference Agent is an automated system that creates, updates, and synchronizes professional API reference documentation in markdown format. The system parses source code, leverages existing JSDoc comments, and uses an LLM to document un-commented functions. This represents a shift from individual symbol documentation to comprehensive file-level documentation that stays synchronized with the codebase.

## Requirements

### Requirement 1

**User Story:** As a developer, I want the system to automatically generate comprehensive API documentation for entire source files when I save them, so that I have up-to-date documentation without manual effort.

#### Acceptance Criteria

1. WHEN a source file is saved THEN the system SHALL parse the entire file and generate a single comprehensive markdown documentation file
2. WHEN generating documentation THEN the system SHALL create one markdown file per source file in the `/docs/api/` directory
3. WHEN a file is saved THEN the system SHALL overwrite any existing documentation file to ensure synchronization
4. IF a source file is `src/userService.ts` THEN the system SHALL generate documentation at `docs/api/userService.md`

### Requirement 2

**User Story:** As a developer, I want the system to automatically generate documentation for functions that lack JSDoc comments using AI, so that all functions are documented consistently.

#### Acceptance Criteria

1. WHEN parsing a source file THEN the system SHALL identify functions with existing JSDoc comments and functions without comments
2. WHEN a function lacks JSDoc comments THEN the system SHALL use an LLM to generate appropriate documentation
3. WHEN generating AI documentation THEN the system SHALL parse the raw LLM output into structured JSDoc format
4. WHEN combining documentation THEN the system SHALL merge existing JSDoc comments with AI-generated documentation into a unified format

### Requirement 3

**User Story:** As a developer, I want the generated documentation to include detailed function information and source code, so that I have comprehensive reference material.

#### Acceptance Criteria

1. WHEN generating documentation for a function THEN the system SHALL include the function description, parameters, and return value
2. WHEN formatting function documentation THEN the system SHALL present parameters and return values in markdown tables for readability
3. WHEN documenting a function THEN the system SHALL include the complete source code in a TypeScript fenced code block
4. WHEN creating file documentation THEN the system SHALL use a professional markdown template with proper headers and sections

### Requirement 4

**User Story:** As a developer, I want documentation files to be automatically removed when I delete source files, so that the documentation stays synchronized with the codebase.

#### Acceptance Criteria

1. WHEN a source file is deleted THEN the system SHALL automatically delete the corresponding documentation file
2. WHEN calculating documentation file paths THEN the system SHALL correctly map source file paths to documentation paths
3. WHEN attempting to delete documentation THEN the system SHALL handle cases where the documentation file doesn't exist gracefully
4. IF a TypeScript or JavaScript file is deleted THEN the system SHALL remove the corresponding markdown file from `/docs/api/`

### Requirement 5

**User Story:** As a developer, I want the system to leverage existing services and maintain code quality, so that the implementation is maintainable and follows established patterns.

#### Acceptance Criteria

1. WHEN implementing the agent THEN the system SHALL enhance existing CodeParserService, DocGeneratorService, and LLMService
2. WHEN parsing code symbols THEN the system SHALL include raw source text in CodeSymbol objects
3. WHEN generating documentation THEN the system SHALL use the enhanced DocGeneratorService with file-level generation capabilities
4. WHEN processing multiple undocumented functions THEN the system SHALL use concurrent processing with Promise.all for efficiency