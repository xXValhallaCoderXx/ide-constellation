# Requirements Document

## Introduction

This feature establishes a secure, authenticated connection to the OpenRouter API from within the VS Code extension. The implementation will use environment variables for API key management and provide a test mechanism to verify successful connectivity. This foundational capability will enable the extension to leverage Large Language Models through OpenRouter's service.

## Requirements

### Requirement 1

**User Story:** As a developer using the extension, I want to securely configure my OpenRouter API key, so that the extension can authenticate with the OpenRouter service without exposing my credentials.

#### Acceptance Criteria

1. WHEN the extension starts THEN the system SHALL load API credentials from a .env file in the project root
2. WHEN the .env file contains OPENROUTER_API_KEY THEN the system SHALL make this available to the LLM service
3. WHEN the .env file is created THEN the system SHALL ensure it is excluded from version control via .gitignore
4. IF the API key is missing or invalid THEN the system SHALL handle the error gracefully without crashing

### Requirement 2

**User Story:** As a developer, I want to test my OpenRouter API connection, so that I can verify my credentials and network connectivity are working correctly.

#### Acceptance Criteria

1. WHEN I execute the test connection command THEN the system SHALL make a POST request to https://openrouter.ai/api/v1/chat/completions
2. WHEN making the API request THEN the system SHALL include proper Authorization headers with the Bearer token
3. WHEN the API responds successfully THEN the system SHALL display the response content to the user
4. WHEN the API request fails THEN the system SHALL display an appropriate error message
5. WHEN testing the connection THEN the system SHALL use a simple hardcoded prompt to minimize token usage

### Requirement 3

**User Story:** As a developer, I want the LLM functionality to be encapsulated in a dedicated service, so that API interactions are organized and reusable throughout the extension.

#### Acceptance Criteria

1. WHEN the extension initializes THEN the system SHALL provide an LLMService class for API interactions
2. WHEN the LLMService is instantiated THEN the system SHALL have access to a testConnection method
3. WHEN the testConnection method is called THEN the system SHALL return the API response content
4. WHEN making API calls THEN the system SHALL use the fetch API for HTTP requests
5. WHEN handling API responses THEN the system SHALL parse JSON and extract the message content

### Requirement 4

**User Story:** As a developer, I want a VS Code command to trigger the connection test, so that I can easily verify my API setup from within the editor.

#### Acceptance Criteria

1. WHEN the extension activates THEN the system SHALL register a constellation.testLlmConnection command
2. WHEN I execute the constellation.testLlmConnection command THEN the system SHALL call the LLMService testConnection method
3. WHEN the test completes successfully THEN the system SHALL show the API response using VS Code's information message
4. WHEN the test fails THEN the system SHALL show an error message with details about the failure
5. WHEN the command is executed THEN the system SHALL log relevant information to the Debug Console for troubleshooting