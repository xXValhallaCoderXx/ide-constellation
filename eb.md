FEATURE/EVENT-BRIDGE


# Extension Bridge POC Success Report ("Event Bridge")

Date: 2025-09-02
Branch: `feature/event-bridge`

## 1. Executive Summary

We successfully implemented a generic **Extension Bridge** that allows the MCP server (tools) to emit real-time events into the VS Code extension runtime. The initial POC validates: a tool returns a structured dual envelope, the bridge transports a message, the extension routes it, opens the graph panel, and *renders graph data supplied exclusively by the tool* (no local scan). This delivers the “AI drives IDE UI instantly” demo beat.

## 2. Goals Achieved

| Goal | Status | Evidence |
|------|--------|----------|
| Generic message envelope w/ payload + metadata | ✅ | `bridge.types.ts` (`BridgeMessage`, `metadata`) |
| Tool returns bridge envelope | ✅ | MCP ping tool returns `{ dataForAI, bridgeMessage }` |
| Transport layer (IPC + file fallback scaffold) | ✅ (primary) / Partial (fallback) | `ipc-transport.ts`, `file-transport.ts` registered |
| Authentication (token) | ✅ | Token injected via env + handshake JSON `auth` frame |
| Message routing + handler registration | ✅ | `BridgeService.register`, handler in `extension.ts` |
| Priority + TTL support (basic) | ✅ | Queue ordering + expiry in `BridgeService` |
| Failover mechanism skeleton | ✅ (selection + detect unhealthy) | `ensureFailover()` logic |
| Ping POC opens panel | ✅ | Manual test: MCP ping tool -> panel opens |
| Inline graph data rendered (no scan) | ✅ | Synthetic 3-node chain injected & displayed |
| Graph service injection path | ✅ | `GraphService.injectGraph()` |
| Backward compatibility with visualInstruction | ✅ | Existing pattern untouched |

## 3. High-Level Architecture (POC)

```
MCP Tool -> (Stdio JSON result containing BridgeEnvelope) -> Provider parse -> BridgeService.send()
   \                                                               |
    \-- Out-of-band IPC write (server) ----------------------------/

BridgeService (extension):
  - Transports: IPC primary, File fallback (passive for now)
  - Priority queue + TTL gate
  - Handler registry (string type key)

Handler (ui:showPanel):
  - Opens panel via PanelRegistry
  - Injects supplied graph (synthetic) into GraphService
  - Posts `graph:response` directly to webview
```

## 4. Key Files Added / Modified

| File | Purpose |
|------|---------|
| `src/types/bridge.types.ts` | Core bridge type definitions & constants |
| `src/services/bridge/bridge.service.ts` | Singleton orchestrator (queue, routing, failover) |
| `src/services/bridge/transports/ipc-transport.ts` | Authenticated JSON-line Unix socket server |
| `src/services/bridge/transports/file-transport.ts` | Filesystem fallback transport implementation |
| `src/mcp/mcp-stdio.server.ts` | Ping tool modified to emit envelope & out-of-band send + synthetic graph |
| `src/extension.ts` | Bridge initialization, handler registration, environment seeding, graph injection logic |
| `src/services/graph.service.ts` | Added `injectGraph()` for direct bridge-driven graph state |
| `src/mcp/mcp.provider.ts` | Extended to parse bridge envelopes and forward messages |
| `success-event.md` | This report |

## 5. Validation Steps & Observed Behavior

1. Reload extension.
2. Trigger MCP ping tool (via chat / MCP invocation) – OR dedicated test command earlier used for initial verification.
3. IPC auth handshake succeeds (logged: `[Bridge][IPC] Listening` + `[Bridge][Client] Connected`).
4. Ping tool returns JSON envelope and also pushes out-of-band message.
5. Bridge handler receives `ui:showPanel` and opens graph panel.
6. Synthetic 3-node graph (a→b→c) appears instantly; no scan logs emitted (`GraphService loadGraph` not invoked).
7. Subsequent `graph:request` (if triggered) returns injected graph via `injectGraph` state.

Latency (qualitative): Panel open + graph render well under target (<50ms subjective). Formal measurement pending Phase 2.

## 6. Risk & Gap Assessment

| Area | Current State | Gap / Risk | Mitigation (Next Phase) |
|------|---------------|-----------|-------------------------|
| Bidirectional (extension -> server) | Not implemented | Cannot request data from server side dynamically | Add request/response correlation IDs + pending promise map |
| File fallback activation | Passive only | No automatic switch test path | Inject simulated IPC failure & assert fallback dispatch |
| Message size limits | Only visualInstruction guard (1MB) | Large `bridgeMessage` could degrade performance | Enforce max size + optional compression (Phase 2) |
| Rate limiting / flood control | Basic debounce not present for bridge | Potential UI spam | Introduce per-type token bucket & coalescing |
| Security hardening | Token auth only | No schema validation / replay protection | Add HMAC or nonce window + AJV schema checks |
| Reliability / delivery guarantees | Fire-and-forget | Message loss on crash | Add persistent queue (journal file) + retry policy |
| Telemetry / metrics | Minimal console logs | No latency data | Add timing stamps & aggregated counters |
| Partial graph diffs | Full graph only | Inefficient for large repos later | Define `graph:update` delta message type |

## 7. Lessons Learned

- Embedding the graph directly in the bridge message enables instant UI updates—far more compelling than waiting on a scan.
- The existing visualInstruction pattern can be retained for specialized UX instructions while the bridge becomes the general substrate.
- Early introduction of TTL + priority makes later performance tuning easier.
- Simplified synthetic graphs are powerful for demo storytelling; we should preserve a small curated set for narratives (e.g., “risk hotspot injection”).

## 8. Proposed Next PRD (Phase 2: Interactive Bidirectional Bridge)

### Objectives
1. Add outbound requests from extension to MCP (e.g., `data:retrieve`) with response correlation.
2. Implement progress streaming (`progress:report`) for long-running health or summary generation.
3. Add schema validation + structured error handling for bridge messages.
4. Implement automatic transport failover test harness & metrics instrumentation.
5. Introduce partial graph update (`graph:update`) and diff application path.

### Functional Additions
- `BridgeRequestMessage`/`BridgeResponseMessage` types with `requestId`.
- `progress:report` handler updating status bar + optional toast.
- `error:report` -> surfaces actionable UI notification with retry.
- `state:sync` baseline handshake (extension sends capabilities; server responds with version + feature flags).

### Non-Functional Targets
- Latency measurement: log round-trip ms for 30 sample requests.
- Sustained 100 msg/sec synthetic load test (IPC) without panel jank.
- Fallback activation test: forcibly close socket; verify file transport handles ≥5 queued messages.

### Milestones
| Day | Deliverable |
|-----|-------------|
| 1 | Request/response API + correlation map |
| 2 | Progress + error routing + schema validator |
| 3 | Partial graph diff prototype + performance metrics dump |

## 9. Demo Narrative Upside

Scriptable “AI conjures a constellation” moment: The model issues a ping-like instruction → panel appears already populated with a contextually shaped mini-graph. Next, we evolve this into progressive enrichment: initial seed graph, followed by diff overlays (health, hotspots, recommendations) through streamed progress events.

## 10. Acceptance Criteria for Phase 2 (Draft)
1. Extension can issue a `data:retrieve` request and receive response within 50ms median (local).
2. `progress:report` visually updates at most every 100ms (debounced) without flicker.
3. Supplying a malformed message logs structured validation error without throw.
4. Forced IPC failure triggers successful file fallback within 2s, with no more than one lost message.
5. Partial graph update reduces payload size by ≥70% vs full graph for scripted scenario.

## 11. Quick Reference (Current POC API)

```ts
// Envelope emitted by MCP tool
interface BridgeEnvelope<T=any> { dataForAI: T; bridgeMessage?: BridgeMessage }
interface BridgeMessage { type: string; payload: any; metadata?: { correlationId?: string; timestamp?: number; priority?: 'low'|'normal'|'high'; ttl?: number } }

// Register handler (extension)
BridgeService.getInstance().register('ui:showPanel', (msg) => { /* open panel, apply payload.graph */ });
```

## 12. Appendix: Future Ideas
- WebSocket transport (remote collaborative constellation).
- Persistent message journal for replay / time-travel debugging.
- Compression for large graph diffs (Brotli streaming).
- Security: Signed envelopes (HMAC-SHA256) + rotating tokens.
- Observability overlay: render message traffic density as an animated halo.

---
Prepared for the next PRD iteration. This document can be adapted directly into the Planning section by promoting Sections 8–10.
