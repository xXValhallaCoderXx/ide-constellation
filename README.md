# Kiro Constellation POC

A proof of concept VS Code extension that demonstrates the integration between VS Code, a local MCP (Model Context Protocol) server, and Kiro agent communication.

## Overview

This POC validates three critical architectural pillars:
1. **VS Code Extension Integration** - Command palette integration and extension lifecycle
2. **Webview Side Panel Interface** - Modern Preact-based UI within VS Code
3. **MCP Provider** - VS Code Standard MCP provider returning a stdio server

## Features

- 🎯 VS Code command palette integration
- 🖥️ Webview side panel with Preact UI
- 🤖 MCP stdio server bundled and launched by VS Code
- �️ Tools: `constellation_example_tool`, `constellation_ping`
- 🧪 Kiro agent integration validation

## Installation & Development

### Prerequisites

- Node.js (v20.x or later)
- VS Code (v1.103.0 or later)
- npm

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the extension:**
   ```bash
   npm run compile
   ```

3. **Run in VS Code:**
   - Open this project in VS Code
   - Press `F5` to launch a new Extension Development Host window
   - The extension will activate, register the MCP provider, and expose tools

### Available Commands

- **Build extension only:** `npm run compile:extension`
- **Build webview only:** `npm run compile:webview`
- **Watch mode:** `npm run watch`
- **Type checking:** `npm run check-types`
- **Linting:** `npm run lint`
- **Full build:** `npm run compile`

## Usage

### 1. Launch the Panel

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Kiro Constellation: Show Panel"
3. Select the command to open the side panel

### 2. Validate MCP Tools

- Use the command: "Kiro Constellation: Debug Launch MCP (stdio)" to emit initialize/list/call over stdio
- Verify logs in the "Kiro Constellation" output channel for tool results (e.g., "pong")

### 3. Validate Kiro Integration

Kiro can discover the provider via the VS Code MCP API. No HTTP endpoints are required.

## Architecture

### Components

1. **Extension Core** (`src/extension.ts`)
   - Extension activation/deactivation
   - Command registration
   - MCP provider registration and debug helpers

2. **MCP stdio Server** (`src/mcp/mcpStdioServer.ts`)
   - Implements `initialize`, `tools/list`, and `tools/call`
   - Tools: `constellation_example_tool`, `constellation_ping`

3. **Webview Manager** (`src/webview/webviewManager.ts`)
   - Webview panel creation and management
   - Message passing between webview and extension
   - Server status communication bridge

4. **Preact UI** (`src/webview/components/`)
   - Modern React-like components
   - Real-time status updates
   - VS Code theme integration

### Build System

- **esbuild** for fast compilation
- **Dual build process** for extension and webview
- **TypeScript** with JSX support for Preact
- **ESLint** for code quality

### API Endpoints

No HTTP endpoints. Communication uses MCP over stdio.

## Requirements Validation

This POC addresses all specified requirements:

### ✅ Requirement 1: VS Code Extension Integration
- Command palette integration
- Automatic MCP server initialization
- Proper extension lifecycle management

### ✅ Requirement 2: Webview Side Panel Interface
- Dedicated "Kiro Constellation" panel
- Status indicator and check button
- Real-time server communication

### ✅ Requirement 3: MCP Provider
- VS Code MCP provider returns a stdio server definition
- Tools are discoverable and callable via MCP

### ✅ Requirement 4: Build System and UI Framework
- Preact framework for UI components
- esbuild compilation pipeline
- Single JavaScript bundle generation

### ✅ Requirement 5: Kiro Agent Integration Validation
- External agent communication testing
- Validation script for integration testing
- Diagnostic information for troubleshooting

## Troubleshooting

### Server Won't Start
- Check if port 31337 is available
- Extension will try fallback ports (31338, 31339, etc.)
- Check VS Code Developer Console for error messages

### Webview Not Loading
- Ensure both extension and webview builds completed successfully
- Check browser console in webview for JavaScript errors
- Verify CSS and JavaScript files are accessible

### Status Check Fails
- Verify MCP server is running (check extension logs)
- Test server directly: `curl http://127.0.0.1:31337/status`
- Run validation script: `node validate-kiro-integration.js`

## Development Notes

### File Structure
```
src/
├── extension.ts              # Main extension entry point
├── mcp/
│   └── mcpStdioServer.ts     # MCP stdio server
├── webview/
│   ├── index.tsx            # Preact app entry point
│   ├── webviewManager.ts    # VS Code webview management
│   ├── components/          # Preact components
│   └── styles/              # CSS styles
└── types/
   └── messages.ts          # TypeScript interfaces
```

### Key Technologies
- **TypeScript** - Type-safe development
- **Preact** - Lightweight React alternative
- **VS Code MCP API** - Server definition provider
- **esbuild** - Fast bundling and compilation
- **VS Code Extension API** - Platform integration

## Future Enhancements

This POC establishes the foundation for:
- Advanced MCP protocol implementation
- Multi-agent communication patterns
- Context-aware feature development
- Enhanced UI components and interactions
- Production deployment strategies

## Documentation

- visualInstruction Pattern: see `docs/visual-instruction-pattern.md` for the dual payload response contract and routing architecture.

## License

This is a proof of concept for internal development and testing purposes.