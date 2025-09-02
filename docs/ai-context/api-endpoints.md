## Purpose of This Document

Summarize any public-facing API endpoints or equivalent command/tool interfaces exposed by the project. Provides future AI agents a quick reference for interaction surfaces.

## Overview

This repository is a VS Code extension (Constellation) plus a Model Context Protocol (MCP) server. It does not expose conventional HTTP/REST or GraphQL endpoints. Instead, interaction occurs through:

- VS Code Commands (command palette)
- MCP Tools (model context protocol tool invocations)
- Webview message channels (panel <-> extension)

## VS Code Commands

Defined in `package.json` under `contributes.commands`:

- `constellation.showGraph` – Open / reveal the dependency graph panel.
- `constellation.scanProject` – Trigger a project dependency scan (rebuild graph + caches).
- `constellation.healthDashboard` – Open health dashboard panel.
- `constellation.pingBridgeTest` – Development / diagnostic command for bridge connectivity.

## MCP Tools (Conceptual API Surface)

The MCP stdio server registers tools (names may include):

- `constellation_ping` – Connectivity test returning "pong".
- `constellation_example_tool` – Echo-style sample tool.
- `constellation_get_graph_summary` – Generates structural summary + insights.
- `constellation_health_report` – Produces health analysis dual payload (AI text + visual instruction).
- `constellation_trace_impact` – Performs change impact analysis and emits visual instruction for animation.

Tool invocation contract (generalized):

```
Request: { name: <toolName>, arguments?: { ... } }
Response: { content: [ { type: 'text', text: <JSON or plain string> } ] }
```

Dual-payload patterns serialize JSON that may contain:

```
{
  dataForAI: { ... },
  visualInstruction: { action: string, ... }
}
```

## Webview Messaging Channels

Messages posted via `panel.webview.postMessage` adopt a command-dispatch pattern:

- Graph related: `graph:response`, `graph:error`, `graph:highlightNode`, `graph:applyHeatmap`.
- Health dashboard: `health:response`, `health:error`, `health:loading`.
- Visual instruction routing: `visualInstruction`, `test:visualEvent` (current Option B prototype).

Inbound from webview to extension include requests: `graph:request`, `health:request`, `panel:open`, `project:scan`, etc.

## No Traditional Network API

There is no Express / Fastify / Next.js / NestJS route layer and no external network listener. All interactions are intra-process (extension host) or process-bridged via MCP stdio.

## Future Opportunities

- Optional local HTTP bridge for remote dashboards.
- GraphQL layer for headless CI analysis consumption.
- Secure websocket channel for live visualization sync across multiple IDE sessions.
