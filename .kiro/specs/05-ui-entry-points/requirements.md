# Requirements Document

## Introduction

This feature establishes the primary user entry points for Kiro Constellation by creating a discoverable sidebar icon and command palette integration. The goal is to provide both visual and keyboard-driven access to the main Visual Canvas functionality, making the extension easily discoverable and accessible to all user types.

## Requirements

### Requirement 1: Activity Bar Integration

**User Story:** As a developer, I want to see a Constellation icon in my VS Code activity bar, so that I can easily discover and access the tool's features.

#### Acceptance Criteria

1. WHEN the extension is activated THEN the system SHALL display a Constellation icon in the VS Code Activity Bar
2. WHEN a user clicks the Activity Bar icon THEN the system SHALL open a sidebar panel with Constellation controls
3. IF the sidebar is already open THEN clicking the Activity Bar icon SHALL toggle the sidebar visibility

### Requirement 2: Sidebar Panel Functionality

**User Story:** As a developer, I want to click a button in the sidebar view, so that I can quickly launch the main Visual Canvas.

#### Acceptance Criteria

1. WHEN the sidebar panel is opened THEN the system SHALL display a heading "Kiro Constellation"
2. WHEN the sidebar panel is opened THEN the system SHALL display a button labeled "Show Codebase Map"
3. WHEN a user clicks the "Show Codebase Map" button THEN the system SHALL execute the command to open the Visual Canvas
4. WHEN the sidebar UI is rendered THEN the system SHALL use Preact as the UI framework

### Requirement 3: Command Palette Integration

**User Story:** As a power user, I want to use the command palette (Ctrl/Cmd+Shift+P) to open the Visual Canvas, so that I can use a keyboard-first workflow.

#### Acceptance Criteria

1. WHEN a user opens the command palette THEN the system SHALL provide a command titled "Constellation: Show Codebase Map"
2. WHEN a user executes the "Constellation: Show Codebase Map" command THEN the system SHALL open the main Visual Canvas
3. WHEN the command is executed THEN the system SHALL preserve all existing Visual Canvas functionality

### Requirement 4: Extension Manifest Updates

**User Story:** As a developer, I want the extension to properly register its UI contributions, so that VS Code can display the sidebar and commands correctly.

#### Acceptance Criteria

1. WHEN the extension is installed THEN the system SHALL register a viewContainer for the Activity Bar icon
2. WHEN the extension is installed THEN the system SHALL register a corresponding view for the sidebar panel
3. WHEN the extension is installed THEN the system SHALL register the "kiro-constellation.showGraph" command
4. WHEN the extension is installed THEN the system SHALL NOT register any legacy "helloWorld" commands

### Requirement 5: Code Refactoring and Cleanup

**User Story:** As a developer, I want the codebase to be clean and maintainable, so that future development is not hindered by legacy code.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the system SHALL use "kiro-constellation.showGraph" as the command ID
2. WHEN the refactoring is complete THEN the system SHALL NOT contain any references to "showPanel" command
3. WHEN the refactoring is complete THEN the system SHALL NOT contain any "helloWorld" command code or tests
4. WHEN the refactoring is complete THEN the system SHALL maintain all existing Visual Canvas functionality

### Requirement 6: Message Passing System

**User Story:** As a developer, I want the sidebar UI to communicate with the extension host, so that button clicks can trigger VS Code commands.

#### Acceptance Criteria

1. WHEN the sidebar UI is initialized THEN the system SHALL establish a message-passing channel between Preact components and the extension host
2. WHEN a user clicks the "Show Codebase Map" button THEN the system SHALL send a message to execute the showGraph command
3. WHEN the extension host receives the message THEN the system SHALL execute the corresponding VS Code command
4. IF message passing fails THEN the system SHALL handle errors gracefully without crashing the extension