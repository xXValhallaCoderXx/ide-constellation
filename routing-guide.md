# Constellation Routing & View Architecture Guide

Author: Draft (auto-generated)
Status: Proposed
Version: 1.0
Scope: All UI view & navigation patterns for the Kiro Constellation VS Code extension (sidebar webview views + full editor panels).

---
## 1. Goals
Provide a coherent, extensible, and testable routing + view architecture that:
- Supports a single Activity Bar icon with a sidebar container.
- Allows multiple logical "mini-views" (tabs/panels) inside the sidebar without declaring each separately in `package.json`.
- Enables launching full-screen (editor area) panels (e.g., dependency graph, health dashboard) from sidebar actions.
- Centralizes message contracts between: Sidebar (webview view) ↔ Extension Host ↔ Full Panels.
- Keeps bundle boundaries clean: small sidebar bundle, heavier graph/health bundles lazy-loaded only when opened.
- Facilitates future additions (e.g., Recommendations, Insights, MCP Interactions) with minimal boilerplate.
- Enforces security & workspace containment for file access.

---
## 2. High-Level Navigation Model
```
+-----------------------------+               +-----------------------------+
|  Activity Bar Icon          |               |  Editor Area Panels         |
|  (container: kiro-...)      |               |  (createWebviewPanel)       |
+--------------+--------------+               +--------------+--------------+
               |                                             ^
               v                                             |
        +--------------+                                     |
        | Sidebar Root |  -- postMessage -->  Extension  --  |
        +--------------+                                     |
         |    |    |                                         |
         |    |    | in-webview client router                |
         v    v    v                                         |
       View A  View B  View C (lightweight)                  |
                                                            (Message bus)
                                                               ^
                                                               |
                                                       +---------------+
                                                       | Graph Panel   |
                                                       | Health Panel  |
                                                       | Future Panels |
                                                       +---------------+
```

- Sidebar hosts a **single registered webview view**: `kiro-constellation.sidebar`.
- Within it, a **client-side router** swaps lightweight internal sub-views (no extra contributions needed).
- Buttons dispatch extension-level commands or message intents that open full panels as needed.
- Extension Host acts as authoritative router for *panel lifecycle*; sidebar router handles *intra-sidebar state*.

---
## 3. View Types
| Type | Location | Lifecycle Owner | Example | Notes |
|------|----------|-----------------|---------|-------|
| Sidebar Sub-View | Preact (single webview view) | Client (router) | Overview, Actions, Quick Stats | Fast switching; no extra panels |
| Full Panel | Editor tab (`createWebviewPanel`) | Extension | Dependency Graph (`ConstellationPanel`) | Heavier assets; retains context |
| Modal / Inline (future) | VS Code UI (quickPick, etc.) | Extension | Select file, choose scope | No webview needed |

---
## 4. Recommended Folder Structure (Augmenting Existing)
```
src/
  webview/
    ui/
      extension-sidebar/
        router/
          routes.config.ts        # Declarative route -> component map
          SidebarRouter.tsx       # Simple state machine / tab router
        views/
          OverviewView.tsx
          ActionsView.tsx
          HealthSummaryView.tsx
          ...
        components/
          SidebarPanel.tsx        # Hosts router + chrome
      graph-constellation/
        index.tsx                 # Already mounts ConstellationPanel
        components/...
      dashboard-health/
        index.tsx
        components/...
  types/
    routing.types.ts              # Shared route + message contracts
  services/
    messaging/                    # (Optional) abstraction layer
      message-bus.service.ts
```

---
## 5. Sidebar Client Router Design
**Minimal viable implementation:**
```ts
// routes.config.ts
export const SIDEBAR_ROUTES = {
  overview: { label: 'Overview', component: OverviewView },
  actions: { label: 'Actions', component: ActionsView },
  health: { label: 'Health', component: HealthSummaryView },
} as const;
export type SidebarRouteKey = keyof typeof SIDEBAR_ROUTES;
```
```tsx
// SidebarRouter.tsx
export function SidebarRouter({ active, onChange }: Props) {
  const route = SIDEBAR_ROUTES[active];
  const Component = route.component;
  return <Component />;
}
```
`SidebarPanel` wraps a tab bar → maintains `activeRoute` in state → passes to `SidebarRouter`.

**Why:** Avoids multiple `views` contributions; reduces activation churn and build artifacts.

---
## 6. Opening Full Panels (Graph / Health)
- Keep a thin button handler in sidebar:
  ```ts
  window.vscode.postMessage({ command: 'panel:open', data: { panel: 'graph' }});
  ```
- Extension Host receives `'panel:open'` → maps `'graph'` to `webviewManager.createOrShowPanel(context)`; `'health'` to `webviewManager.createOrShowHealthDashboard()`.
- Centralize in `webviewManager` a registry:
  ```ts
  type PanelKey = 'graph' | 'health';
  const PANEL_REGISTRY: Record<PanelKey, () => void> = { graph: ..., health: ... };
  ```
- Benefits: Future panels (e.g. "risk", "recommendations") need only add an entry.

---
## 7. Message Contract Strategy
Current pattern: Free-form `{ command: string, data?: any }`.
Improve with discriminated unions:
```ts
// messages.types.ts (augment)
export type SidebarOutboundMessage =
  | { command: 'panel:open'; data: { panel: 'graph' | 'health' } }
  | { command: 'graph:highlight'; data: { fileId: string } }
  | { command: 'route:navigate'; data: { route: SidebarRouteKey } };

export type ExtensionInboundMessage = SidebarOutboundMessage; // if shared
```
Pros: compile-time safety & discoverability.

Add a thin helper:
```ts
export function postMessage<M extends SidebarOutboundMessage>(msg: M) {
  window.vscode?.postMessage(msg);
}
```

---
## 8. Command vs Message Criteria
| Use | When | Example |
|-----|------|---------|
| VS Code Command (`vscode.commands.executeCommand`) | Action should be exposable to Command Palette / keybindings | Scan project, Show Graph |
| Webview `postMessage` | UI-local intent not meaningful globally | Switch sidebar tab, highlight graph node |
| Hybrid (message → command) | Webview triggers widely useful action | Open full panel |

---
## 9. Extension Host Routing Layer
Add a `handleWebviewMessage` branch:
```ts
case 'panel:open':
  switch (message.data.panel) {
    case 'graph': this.createOrShowPanel(context); break;
    case 'health': this.createOrShowHealthDashboard(); break;
  }
  break;
```
Optional: Extract to `PanelRouterService` to reduce `webview.service.ts` size.

---
## 10. Security & Hardening
| Area | Current | Proposed Enhancement |
|------|---------|---------------------|
| File open | `resolveWorkspaceFile` checks containment | Cache resolved URIs + add explicit denylist patterns |
| Message surface | Open string commands | Switch to typed unions; validate `panel` & `route` keys |
| CSP | Nonce-based script load | Keep; optionally split per-panel bundles for least privilege |
| Path traversal | Already mitigated | Add logging category "SECURITY" for audits |
| Large payloads (visual instruction) | Debounce + size limit | Stream large analyses via chunk messages if needed |

---
## 11. Performance Guidelines
- Sidebar bundle target size: < 50 KB (gz) → keep dependencies minimal.
- Heavy libraries (e.g., `cytoscape`) remain only in graph bundle.
- Use lazy message triggering: graph requested only after panel is visible.
- Consider incremental graph updates (future) via diff messages.

---
## 12. Build & Bundling Adjustments
Already present entries in `esbuild.js`:
- `graph-constellation/index.tsx` → `dist/webview.js`
- `extension-sidebar/index.tsx` → `dist/sidebar.js`
- `dashboard-health/index.tsx` → `dist/health-webview.js`

Add (if needed) new panels by appending entryPoints; keep naming convention `dist/<panel-id>.js`.

Optional improvements:
- Code splitting (esbuild currently single bundle). To introduce: switch to `splitting: true`, `format: esm` for browser bundles and update `script type="module"` usage + CSP adjustments.

---
## 13. State Management Choices
| Concern | Strategy |
|---------|----------|
| Sidebar route state | Local `useState` in `SidebarPanel` |
| Cross-panel communication (e.g., highlight node from health) | Extension Host forwards `graph:highlightNode` to graph panel webview |
| Persisted UI prefs (last active route) | `acquireVsCodeApi().setState({ ... })` in sidebar, restore on load |

---
## 14. Proposed Implementation Steps (Sequenced)
1. Define `SIDEBAR_ROUTES` and create placeholder view components.
2. Implement `SidebarRouter` + integrate into existing `SidebarPanel`.
3. Introduce typed message contracts (`messages.types.ts` augmentation).
4. Add `postMessage` helper in a shared util.
5. Extend `webview.service.ts` to handle `'panel:open'` and route to existing panel factories.
6. Refactor existing button(s) to use new message contract (`postMessage({ command: 'panel:open', data: { panel: 'graph' } })`).
7. Add a second button for Health using `'panel:open'` with `panel: 'health'`.
8. (Optional) Migrate any direct `showGraph` pathways to the new unified pattern; keep command for backward compatibility.
9. Add integration test (lightweight) to simulate sidebar message → extension → panel open (via VS Code test harness mock).
10. Update documentation (`README.md`) referencing this routing guide.

---
## 15. Testing Strategy
| Layer | Test Type | Notes |
|-------|-----------|-------|
| Route config | Unit | Ensure all keys map to components |
| Sidebar -> message | Unit | Mock `window.vscode` & assert payload |
| Extension routing | Integration | Use VS Code Test API to trigger message and assert panel created |
| Graph panel load | Smoke | Panel posts `graph:request` and receives `graph:response` |
| Security | Negative | Attempt path traversal in `editor:open` and expect rejection |

---
## 16. Telemetry & Observability (Future)
Add lightweight logging wrapper:
```ts
log.event('panel_open', { panel: 'graph' });
log.route('sidebar', { from: prev, to: next });
```
Optionally funnel to output channel only in dev until privacy review.

---
## 17. Backward Compatibility Plan
| Existing Mechanism | Status | Migration |
|--------------------|--------|-----------|
| `showGraph` command | Keep | Internally call new panel router |
| Direct `webviewManager.createOrShowPanel` calls | Keep | Wrap inside panel registry |

---
## 18. Example End-to-End Flow (After Refactor)
1. User clicks Activity Bar icon → VS Code loads sidebar view.
2. Sidebar restores last route from `getState()` → renders `OverviewView`.
3. User clicks "Open Dependency Graph" → sidebar `postMessage({ command: 'panel:open', data: { panel: 'graph' } })`.
4. Extension receives → invokes graph panel creation → panel HTML loads → `webview.js` mounts `ConstellationPanel`.
5. `ConstellationPanel` requests `graph:request` → extension responds with graph data.
6. From Health Dashboard panel, user chooses "Highlight Node" → extension forwards message to graph panel webview.

---
## 19. Risks & Mitigations
| Risk | Description | Mitigation |
|------|-------------|------------|
| Command proliferation | Many ad-hoc commands | Central panel registry & typed messages |
| Message drift | Frontend & backend mismatch strings | Type unions in shared `.ts` file |
| Bundle bloat | Adding more components | Keep sidebar lightweight; lazy-load heavy panels |
| Race conditions | Posting before panel ready | Panels buffer initial request (already done via delayed graph request); can add ready ack |
| Security regressions | New message types | Validate schema per command branch |

---
## 20. Future Extensions
- Dynamic panel composition (multi-pane graph + health overlay).
- Embedded diff viewer inside panel via `vscode.diff` command bridging.
- Streaming scan progress (progress events: `graph:progress`).
- Multi-root workspace support (prefix fileIds with workspace folder name).

---
## 21. Glossary
| Term | Meaning |
|------|---------|
| Webview View | A view inside an existing VS Code container (sidebar) registered via `WebviewViewProvider`. |
| Webview Panel | Standalone editor tab created with `createWebviewPanel`. |
| Sidebar Router | Client-side mechanism to switch logical mini-views without new contributions. |
| Panel Registry | Mapping from panel key → creation function. |

---
## 22. Decision Summary
| Decision | Rationale | Status |
|----------|-----------|--------|
| Single sidebar view + internal router | Reduces contributions & complexity | Accepted |
| Typed message contracts | Safety & discoverability | Accepted |
| Central panel registry | Scales with new panels | Accepted |
| Keep legacy commands | Backward compatibility | Accepted |

---
## 23. Implementation Readiness Checklist
- [ ] `routing.types.ts` created
- [ ] `routes.config.ts` + placeholder views
- [ ] `SidebarRouter` integrated
- [ ] Message union exported & consumed by sidebar + extension
- [ ] Panel registry extracted
- [ ] Buttons migrated to `panel:open`
- [ ] Tests added (unit + integration)
- [ ] Docs updated (`README.md` reference + this guide reviewed)

---
## 24. Quick Snippets (Illustrative Only)
```ts
// routing.types.ts
export type PanelOpenMessage = { command: 'panel:open'; data: { panel: 'graph' | 'health' } };
export type SidebarRouteChange = { command: 'route:navigate'; data: { route: SidebarRouteKey } };
export type OutboundMessage = PanelOpenMessage | SidebarRouteChange; // extend as needed
```
```ts
// In webview.service.ts
case 'panel:open': {
  const key = message.data?.panel as PanelKey;
  PANEL_REGISTRY[key]?.();
  break;
}
```

---
## 25. Review Notes (For Peers)
Focus feedback on:
- Is the separation of sidebar sub-routing vs. panel lifecycle clear?
- Are message contracts sufficiently future-proof?
- Any missing security or performance concerns?
- Is the folder layout pragmatic given current size?
- Should we introduce code splitting now or defer?

---
## 26. Conclusion
This plan formalizes a scalable navigation + routing approach, reducing friction for new views while keeping the extension maintainable and secure. Implement incrementally—start with typed messages + router, then refactor panel opening, then add tests.

> After peer review, update the status header (Proposed → Approved) and lock in the initial implementation baseline.
