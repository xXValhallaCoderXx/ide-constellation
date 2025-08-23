# Design Document

## Overview

This design establishes the primary user entry points for Kiro Constellation through a VS Code Activity Bar integration and command palette access. The solution creates a discoverable sidebar panel with Preact-based UI components and refactors existing commands for consistency. The design leverages VS Code's native extension APIs while maintaining the existing webview architecture for the main Visual Canvas.

## Architecture

### High-Level Architecture

```
VS Code Activity Bar
    ↓
Sidebar View (WebviewViewProvider)
    ↓ (Preact UI with message passing)
Extension Host Command Handler
    ↓
Existing WebviewManager
    ↓
Main Visual Canvas Panel
```

### Component Interaction Flow

1. **Discovery**: User sees Constellation icon in Activity Bar
2. **Access**: User clicks icon to open sidebar or uses command palette
3. **Action**: User clicks "Show Codebase Map" button in sidebar
4. **Execution**: Message passed to extension host, command executed
5. **Result**: Main Visual Canvas panel opens via existing WebviewManager

## Components and Interfaces

### 1. Extension Manifest Updates (package.json)

**ViewContainer Registration**:
```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "kiro-constellation",
          "title": "Kiro Constellation",
          "icon": "$(graph)"
        }
      ]
    },
    "views": {
      "kiro-constellation": [
        {
          "id": "kiro-constellation.sidebar",
          "name": "Constellation",
          "type": "webview"
        }
      ]
    }
  }
}
```

**Command Updates**:
- Remove: `kiro-constellation.helloWorld`
- Rename: `kiro-constellation.showPanel` → `kiro-constellation.showGraph`
- Update title: "Constellation: Show Codebase Map"

### 2. Sidebar View Provider

**Class Structure**:
```typescript
export class ConstellationSidebarProvider implements vscode.WebviewViewProvider {
  constructor(private context: vscode.ExtensionContext) {}
  
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void>
  
  private getWebviewContent(): string
  private handleMessage(message: SidebarMessage): void
}
```

**Webview Configuration**:
- Enable scripts for Preact rendering
- Set up CSP for security
- Configure local resource roots for assets
- Establish message passing channel

### 3. Preact Sidebar UI Components

**Component Hierarchy**:
```
SidebarPanel (root component)
├── SidebarHeader
└── SidebarActions
    └── ShowMapButton
```

**SidebarPanel Component**:
```typescript
interface SidebarPanelProps {}

export function SidebarPanel(): JSX.Element {
  const handleShowMap = () => {
    // Send message to extension host
    vscode.postMessage({ command: 'showGraph' });
  };

  return (
    <div className="sidebar-container">
      <SidebarHeader />
      <SidebarActions onShowMap={handleShowMap} />
    </div>
  );
}
```

### 4. Message Passing Interface

**Message Types**:
```typescript
interface SidebarToExtensionMessage {
  command: 'showGraph';
}

interface ExtensionToSidebarMessage {
  command: 'statusUpdate';
  data?: any;
}
```

**Communication Flow**:
1. Preact component sends message via `vscode.postMessage()`
2. WebviewViewProvider receives message in `onDidReceiveMessage`
3. Provider executes VS Code command via `vscode.commands.executeCommand()`

### 5. Extension Host Integration

**Command Registration Updates**:
```typescript
// Remove helloWorld command registration
// Update showPanel → showGraph
const showGraphDisposable = vscode.commands.registerCommand(
  'kiro-constellation.showGraph', 
  () => {
    webviewManager?.createOrShowPanel(context);
  }
);

// Register sidebar provider
const sidebarProvider = new ConstellationSidebarProvider(context);
vscode.window.registerWebviewViewProvider(
  'kiro-constellation.sidebar',
  sidebarProvider
);
```

## Data Models

### Configuration Model
```typescript
interface SidebarConfig {
  title: string;
  buttonLabel: string;
  iconPath?: string;
}
```

### Message Models
```typescript
interface SidebarMessage {
  command: string;
  data?: unknown;
}

interface CommandExecutionResult {
  success: boolean;
  error?: string;
}
```

## Error Handling

### Message Passing Failures
- **Detection**: Timeout on command execution
- **Recovery**: Show error message in sidebar UI
- **Fallback**: Provide direct command palette instruction

### WebviewView Provider Failures
- **Detection**: Exception during view resolution
- **Recovery**: Log error and show fallback UI
- **Fallback**: Basic HTML with manual command execution

### Command Registration Failures
- **Detection**: Exception during extension activation
- **Recovery**: Log error and continue with available commands
- **Fallback**: Extension remains functional without sidebar

### Preact Rendering Failures
- **Detection**: Component render exceptions
- **Recovery**: Show fallback HTML content
- **Fallback**: Basic button with inline JavaScript

## Testing Strategy

### Manual Testing Scenarios
1. **Activity Bar Icon**: Verify icon appears and is clickable
2. **Sidebar Panel**: Confirm panel opens with correct content
3. **Button Functionality**: Test "Show Codebase Map" button execution
4. **Command Palette**: Verify command appears and executes correctly
5. **Error Scenarios**: Test behavior with invalid states


### VS Code API Compatibility
- Minimum VS Code version: 1.70.0 (current requirement)
- WebviewViewProvider API available since 1.49.0
- Activity Bar contributions supported in all target versions

### Preact Integration
- Bundle size impact: ~3KB additional for sidebar UI
- CSP compatibility: Requires script-src nonce for inline scripts
- Styling: Use VS Code CSS variables for theme consistency

### Performance Considerations
- Lazy load sidebar content to reduce activation time
- Minimize message passing frequency
- Cache webview content generation results

### Security Considerations
- Strict CSP policy for webview content
- Validate all incoming messages from webview
- Sanitize any dynamic content in HTML generation