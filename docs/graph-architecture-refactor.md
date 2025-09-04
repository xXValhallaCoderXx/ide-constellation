## Graph Architecture Refactor (Milestone 1)

Status: In Progress (Messaging & origin standardization implemented; overlay UI deferred)

### Purpose

Centralize panel lifecycle & outbound messaging, standardize origin semantics, and lay groundwork for future overlay features while preserving existing user-visible behavior.

### Goals (Mapped to FR IDs)

| Goal                                 | FR      | Outcome                                                  |
| ------------------------------------ | ------- | -------------------------------------------------------- |
| Single panel open entry point        | FR1     | `PanelRegistry.open(panel, origin)` created & documented |
| Remove scattered postMessage calls   | FR3/FR9 | `WebviewMessenger` introduced; legacy calls tagged       |
| Structured logging                   | FR5/FR6 | Uniform `[ISO] [LEVEL] domain:action key=value` pattern  |
| Overlay message contract placeholder | FR4     | `graph:overlay:apply` & `graph:overlay:clear` added      |
| Origin naming convention             | FR8     | `<namespace>:<action>` enforced via `ORIGIN` constants   |

### Sequence Diagram (Panel Open)

```
User Action / MCP / Command
        | (origin)
        v
 PanelRegistry.open(panel, origin)
        |
        v
 WebviewManager.createOrShowPanel()  (internal)
        |
        v
 WebviewMessenger (instantiated on panel create)
        |
        v
 postMessage → Webview (graph/dashboard)
```

### Messaging Flow

```
Extension Component ──(typed call)──> WebviewMessenger ──(size check + log)──> panel.webview.postMessage(JSON)
```

Outbound message categories:

- Graph: `graph:response`, `graph:error`, `graph:highlightNode`, `graph:applyHeatmap`, `graph:clearHeatmap`, `graph:setFocus`
- Health: `health:loading`, `health:response`, `health:error`
- Dashboard: `dashboard:notification` (others still legacy: `dashboard:highlightRisk` until inbound unification)
- Overlay (placeholder): `graph:overlay:apply`, `graph:overlay:clear`
- Status/Server: `statusUpdate`, `serverInfo`

### Overlay Contracts (Placeholder)

| Command               | Shape                                                                                        | Notes                     |
| --------------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| `graph:overlay:apply` | `{ overlay: { nodes: Array<{ id: string; weight?: number; meta?: Record<string, any> }> } }` | UI rendering deferred     |
| `graph:overlay:clear` | `{ correlationId?: string }`                                                                 | Optional correlation stub |

### Origins

Pattern: `<namespace>:<action>`

Namespaces in Milestone 1:

- `sidebar:*` user initiated via sidebar UI
- `mcp:*` automated instructions / trigger / focus
- `command:*` command palette invocations
- `system:*` internal fallback flows

See `routing.types.ts` for canonical list and type exports.

### Grep Audit Commands

Pre-migration baseline stored in task file. To verify post-migration invariants:

```bash
grep -R "panel.webview.postMessage" src | grep -v "webview.messenger" | grep -v "TODO(remove-legacy-postMessage)"
```

Expect: no output (all non-messenger calls must be TODO-tagged until removed).

### Logging Grammar

```
[ISO] [INFO] messenger:send command=<command> size=<bytes>
[ISO] [WARN] messenger:drop command=<command> reason=<reason> size=<bytes?>
[ISO] [ERROR] messenger:send command=<command> error=<message>
```

Panel opens:

```
[ISO] [INFO] panel:open key=<panel> origin=<origin>
```

### Adding a New Message (Template)

1. Define interface & union member in `messages.types.ts`.
2. Add method in `WebviewMessenger`:

```ts
sendGraphFoo(data: GraphFooMessage['data']): boolean {
  const msg: GraphFooMessage = { command: 'graph:foo', data };
  return this.send(msg);
}
```

3. Replace direct calls across codebase.
4. Update doc (this file + README summary) if user-facing.

### Deferred / Next Milestone

- Replace remaining legacy dashboard highlight & export result sends with unified inbound router.
- Implement overlay rendering & layering strategy.
- Potential queue for pre-panel sends (if needed by future UX flows).
- Structured JSON log channel (optional).

### Change Log Summary (Milestone 1)

- Introduced `WebviewMessenger` with size guard.
- Centralized panel open via `PanelRegistry`.
- Added overlay message contracts.
- Standardized origin naming & documented conventions.
- Tagged all remaining legacy postMessage usages.

### Manual Verification Checklist

Use this list to validate runtime behaviors (Tasks 7.3 / 9.x):

1. Graph Panel Open (Command Palette)

   - Action: Run "Constellation: Show Codebase Map".
   - Expect: `[INFO] panel:open key=dependencyGraph origin=command:openGraph` (if origin wired) or `unknown` pending sidebar integration.
   - Expect messenger logs for initial `statusUpdate` / `graph:response` when data loads.

2. Health Dashboard Open

   - Action: Run "Constellation: Open Health Dashboard".
   - Expect: `[INFO] panel:open key=healthDashboard` log.
   - If analysis triggers: `[INFO] healthPanel:request forceRefresh=false` followed by `healthPanel:sendAnalysis`.

3. Health Refresh (Force)

   - Action: Trigger refresh (UI button) or send `health:refresh` message.
   - Expect: `healthPanel:request forceRefresh=true`, potential `graphLoad status=fresh`, then new `sendAnalysis`.

4. Heatmap Navigation

   - Action: From dashboard, "Show Heatmap".
   - Expect: Dashboard log `healthPanel:showHeatmap`, messenger `graph:applyHeatmap` send, optional `graph:highlightNode` send.

5. MCP Focus (If MCP active)

   - Action: Invoke a visual instruction that sets focus.
   - Expect: Panel open with origin `mcp:setFocus` and messenger `graph:setFocus` log.

6. Export Analysis

   - Action: Export JSON/CSV.
   - Expect: `healthPanel:export status=success format=<fmt>` and a legacy `health:export:result` (TODO-tagged) message path.

7. Error Path (Optional Simulation)

   - Temporarily break graph load to force error.
   - Expect: `healthPanel:request status=failed error=<msg>` and messenger `health:error` if messenger available.

8. Grep Audit
   - Run `scripts/grep-audit.sh` and ensure PASS.

Record any deviations and update tasks before closing milestone.

---

Maintained by: Architecture Working Group (Constellation)
