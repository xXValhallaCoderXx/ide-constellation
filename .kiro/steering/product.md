---
inclusion: always
---

# Product Context & Development Guidelines

## Project Identity
**kiro-constellation** is a VS Code extension (v0.0.1) that serves as a foundational component in the Kiro ecosystem, providing constellation-based functionality within VS Code.

## Development Principles
- **Minimal viable implementation** - Start with core functionality, expand incrementally
- **VS Code native integration** - Leverage VS Code APIs and patterns for seamless user experience
- **Kiro ecosystem compatibility** - Maintain consistency with broader Kiro tooling standards
- **Early-stage flexibility** - Architecture should support rapid iteration and feature expansion

## Current Implementation Status
- Full VS Code extension with activity bar integration and sidebar
- Multiple commands: Show Codebase Map, Scan Project, Debug MCP Launch
- MCP (Model Context Protocol) provider implementation with stdio server
- Preact-based webview infrastructure with dual-panel architecture
- Graph service with caching, transformation, and reverse-dependency indexing
- Worker thread architecture for background project scanning
- Real-time editor synchronization with graph highlighting
- Security-hardened file operations with workspace containment

## VS Code Integration Points
- **Activity Bar** - Custom "Kiro Constellation" container with graph icon
- **Sidebar View** - Dedicated webview for quick access to constellation features
- **Commands** - Three main commands accessible via command palette:
  - `Constellation: Show Codebase Map` - Opens main graph visualization panel
  - `Constellation: Scan Project` - Triggers project dependency analysis
  - `Kiro Constellation: Debug Launch MCP (stdio)` - Development debugging tool
- **MCP Server Provider** - Registers as MCP server definition provider for VS Code

## Feature Development Guidelines
- **Command-driven architecture** - All user-facing features should be accessible via VS Code command palette
- **Webview-based UI** - Complex interfaces should use Preact components in webviews
- **Background processing** - Use worker threads for intensive operations to maintain UI responsiveness
- **MCP integration** - Leverage MCP protocol for external tool communication when applicable
- **Real-time synchronization** - Active editor changes should reflect in graph highlighting
- **Security-first** - All file operations must validate workspace containment

## User Experience Requirements
- **Zero-configuration startup** - Extension should work immediately after installation
- **Non-intrusive operation** - Avoid blocking VS Code functionality or overwhelming users
- **Progressive disclosure** - Advanced features should be discoverable but not prominent
- **Consistent VS Code patterns** - Follow established VS Code UX conventions

## Technical Constraints
- Minimum VS Code version: 1.103.0
- Single-bundle deployment via esbuild
- TypeScript strict mode compliance required
- Preact for webview components only