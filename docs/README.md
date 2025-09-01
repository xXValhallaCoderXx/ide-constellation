# Kiro Constellation Documentation

## Overview
Kiro Constellation is a VS Code extension that provides constellation-based functionality for codebase analysis and visualization.

## Features

### Core Functionality
- **Dependency Graph Visualization**: Interactive codebase mapping with Cytoscape.js
- **Project Scanning**: Background analysis using dependency-cruiser
- **MCP Integration**: Model Context Protocol support for external tool communication
- **Real-time Synchronization**: Active editor highlighting in graph visualization

### Risk Analysis Engine
- **Codebase Health Assessment**: Comprehensive analysis of code complexity, git churn, and dependencies
- **Risk Scoring**: Percentile-based risk calculation with actionable recommendations
- **Performance Optimization**: Multi-level caching and batch processing for large codebases
- **Interactive Reports**: Rich HTML webview with detailed metrics and insights

## Documentation

### User Guides
- [Risk Analysis Engine](./risk-analysis-engine.md) - Comprehensive codebase health assessment

### Technical Documentation
- [Visual Instruction Pattern](./visual-instruction-pattern.md) - Dual payload contract for MCP tool responses
- [Scanner Improvements](./improvements.md) - Technical debt and optimization roadmap

## Quick Start
1. Install the Kiro Constellation extension
2. Open a workspace with code files
3. Run `Constellation: Scan Project` to generate dependency graph (required before health metrics)
4. Open `Constellation: Open Health Dashboard` and request analysis (panel button) for health assessment
5. Use `Constellation: Show Codebase Map` for interactive visualization (heatmap overlays when triggered from dashboard)

## Architecture
- **Extension Entry Point**: `src/extension.ts`
- **Services**: Core business logic in `src/services/`
- **Webview Components**: Preact-based UI in `src/webview/` (shared primitives in `src/webview/components/`, app-specific under `src/webview/ui/<app>/components/`)
- **MCP Integration**: Model Context Protocol in `src/mcp/`
- **Worker Threads**: Background processing in `src/workers/`

## Development
- **Build**: `npm run compile`
- **Watch Mode**: `npm run watch`
- **Type Checking**: `npm run check-types`
- **Linting**: `npm run lint`