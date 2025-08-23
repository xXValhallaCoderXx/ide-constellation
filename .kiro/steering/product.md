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
- Extension scaffold with basic command structure (`Hello World` command)
- Startup activation configured (`onStartupFinished`)
- MCP (Model Context Protocol) integration framework established
- React-based webview infrastructure prepared
- Worker thread architecture for background processing

## Feature Development Guidelines
- **Command-driven architecture** - All user-facing features should be accessible via VS Code command palette
- **Webview-based UI** - Complex interfaces should use React components in webviews
- **Background processing** - Use worker threads for intensive operations to maintain UI responsiveness
- **MCP integration** - Leverage MCP protocol for external tool communication when applicable

## User Experience Requirements
- **Zero-configuration startup** - Extension should work immediately after installation
- **Non-intrusive operation** - Avoid blocking VS Code functionality or overwhelming users
- **Progressive disclosure** - Advanced features should be discoverable but not prominent
- **Consistent VS Code patterns** - Follow established VS Code UX conventions

## Technical Constraints
- Minimum VS Code version: 1.103.0
- Single-bundle deployment via esbuild
- TypeScript strict mode compliance required
- React for webview components only