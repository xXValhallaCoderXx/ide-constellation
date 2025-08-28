# Product Requirements Document (PRD)

Title: Constellation Unified Routing & View Architecture (Sidebar Router + Panel Registry)
Version: 1.0
Status: Draft (Pending Review / Approval)
Author: Auto-generated from architectural proposal + peer feedback
Date: 2025-08-28

## 0. Executive Summary
We will implement a unified routing architecture for the Kiro Constellation VS Code extension consisting of:
1. A single contributed sidebar webview view with a lightweight **client-side router** for multiple logical mini-views (Overview, Actions, Health Summary, etc.).
2. A centralized **Panel Registry** for full editor-area panels (Dependency Graph, Health Dashboard, Future Panels) invoked via typed message contracts or VS Code commands.
3. Strongly-typed **message contracts** between webview contexts (sidebar + panels) and the extension host, eliminating stringly-typed drift and improving developer velocity.

This architecture accelerates feature development during the hackathon while laying a scalable foundation. We will deliver an MVP subset first, deferring non-essential optimizations (code splitting, telemetry, generalized message bus) until after MVP lockdown.

## 1. Goals & Success Criteria
### Primary Goals
- Enable fast addition of new sidebar logical views without modifying `package.json`.
- Provide a uniform mechanism for opening and managing full-screen panels.
- Improve reliability & safety of webview↔extension communication using TypeScript discriminated unions.
- Reduce coupling and duplicated logic in the current webview management path.

### Success Metrics (Hackathon Scope)
| Metric | Target by Submission | Notes |
|--------|----------------------|-------|
| Time to add a new sidebar tab | < 5 min (scaffold + route entry) | Measured adding a new placeholder view |
| Time to add a new panel | < 10 min (registry + index + build entry) | Excludes complex UI logic |
| Webview message runtime errors (routing layer) | 0 during demo | Tracked via output channel logs |
| Bundle isolation | Graph & Health panels not loaded until opened | Confirm via devtools network / size |
| Developer onboarding clarity | Peers rate doc >= "Clear" | Via internal review form |

### Stretch (Post-MVP / Optional)
- Panel hot reload metrics.
- Telemetry instrumentation for panel open frequency.

## 2. Non-Goals (Explicitly Out of MVP Scope)
| Item | Reason |
|------|--------|
| Code splitting (ESM + dynamic import) | Added complexity; low immediate ROI |
| Generic message bus abstraction layer | YAGNI for MVP; keep direct handlers |
| Extensive test matrix for legacy flows | Focus on new architecture critical paths only |
| Full telemetry pipeline | Privacy + time constraints |
| Multi-root workspace adaptation | Single-root assumption acceptable for MVP |

## 3. User Personas & Stories
### Personas
- **Developer (Internal / Hackathon)**: Needs to quickly extend UI.
- **Power User**: Wants to open graph & health dashboard seamlessly from a unified UX.
- **Future Analyst**: Will use added panels (risk, recommendations) later.

### Core User Stories (MVP)
| ID | Story | Priority |
|----|-------|----------|
| US1 | As a user I can click the extension icon and see a sidebar with multiple logical tabs. | P0 |
| US2 | As a user I can open the dependency graph panel from a sidebar action. | P0 |
| US3 | As a user I can open the health dashboard panel from a sidebar action. | P0 |
| US4 | As a developer I can add a new sidebar tab by adding one entry in a routes config + component. | P0 |
| US5 | As a developer I can add a new panel by adding one registry entry + build entry. | P0 |
| US6 | As a developer I get compile-time errors if I mistype a message command. | P0 |
| US7 | As a user my last active sidebar tab is restored after reload. | P1 |
| US8 | As a user opening a panel does not re-download unrelated bundles. | P1 |
| US9 | As a user I can highlight files in the graph from another panel (foundation prepared, basic stub). | P2 |

## 4. Functional Requirements
| Ref | Requirement | Acceptance Criteria | Priority |
|-----|-------------|---------------------|----------|
| FR1 | Single sidebar view hosts client router | Switching tabs updates displayed component w/out full reload | P0 |
| FR2 | Route definitions in a single `routes.config.ts` | Adding entry instantly appears in tab bar | P0 |
| FR3 | Panel registry drives graph & health panel creation | Calls map to existing `WebviewManager` methods | P0 |
| FR4 | Typed message contracts for outbound sidebar messages | Invalid command key fails type-check | P0 |
| FR5 | Support `panel:open` message with payload validation | Opening unknown panel logs warning; no crash | P0 |
| FR6 | Buttons in sidebar use new `panel:open` contract | No usage of legacy direct `showGraph` message in sidebar | P0 |
| FR7 | Restore last selected route on reload | After reload, previous tab active (via `getState`) | P1 |
| FR8 | Graph panel continues to request data as today | No regression in graph load behavior | P0 |
| FR9 | Health panel launched via registry | Works same as existing command path | P0 |
| FR10 | File open security unchanged | All existing protections still pass smoke tests | P0 |
| FR11 | Output logging for panel opens | Opening a panel logs structured line | P1 |
| FR12 | Minimal unit tests for routes + message types | CI passes with new tests | P1 |
| FR13 | Legacy `showGraph` command preserved | Command palette still opens graph panel | P1 |

## 5. Non-Functional Requirements
| Category | Requirement |
|----------|------------|
| Performance | Sidebar initial bundle < 50 KB gzipped (informational only) |
| Reliability | No unhandled promise rejections in routing path |
| Security | No broadening of file system access beyond current guards |
| Maintainability | Adding panel requires editing ≤ 3 files |
| DX | Message contract discoverable via IDE intellisense |

## 6. Architectural Components
### 6.1 Sidebar Router
- `routes.config.ts`: Declarative map `{ key: { label, component } }`.
- `SidebarRouter.tsx`: Renders active component; optional tab bar component.
- `SidebarPanel.tsx`: Manages `activeRoute` state + persistence via `vscode.setState`.

### 6.2 Panel Registry
```ts
// panel-registry.ts
export type PanelKey = 'graph' | 'health';
export const PANEL_REGISTRY: Record<PanelKey, () => void> = {
  graph: () => webviewManager.createOrShowPanel(ctx),
  health: () => webviewManager.createOrShowHealthDashboard()
};
```
Extension `handleWebviewMessage` dispatches to registry.

### 6.3 Typed Message Contracts
Augment `messages.types.ts` (or create `routing.types.ts`) with discriminated unions:
```ts
export type PanelOpenMessage = { command: 'panel:open'; data: { panel: 'graph' | 'health' } };
export type RouteNavigateMessage = { command: 'route:navigate'; data: { route: SidebarRouteKey } };
export type SidebarOutboundMessage = PanelOpenMessage | RouteNavigateMessage; // Extend later.
```
Helper utility:
```ts
export function postMessage<M extends SidebarOutboundMessage>(msg: M) {
  window.vscode?.postMessage(msg);
}
```

### 6.4 State Persistence
Use VS Code webview state API:
```ts
const api = acquireVsCodeApi();
const saved = api.getState();
api.setState({ activeRoute });
```

### 6.5 Backward Compatibility
- Keep `kiro-constellation.showGraph` command.
- Internally call panel registry from command handler (single source of truth).

## 7. Data & Message Flows (MVP)
### Open Graph Panel
1. User clicks button `Open Dependency Graph` in sidebar.
2. Sidebar sends `{ command: 'panel:open', data: { panel: 'graph' } }`.
3. Extension receives → registry → `createOrShowPanel`.
4. Panel HTML loads → `webview.js` renders `ConstellationPanel` → sends `graph:request` (unchanged).

### Switch Sidebar Tab
1. User clicks tab
2. Local state updates, persists via `setState`.
3. No extension round trip needed.

### Open Health Dashboard
Parallel to graph: panel key `health`.

## 8. UX / UI Notes
| Area | MVP Behavior |
|------|--------------|
| Sidebar Tab Bar | Horizontal or vertical simple list; active route visually distinct |
| Empty States | If a view not yet implemented → show placeholder with label |
| Panel Launch Buttons | Use consistent variant (primary/secondary) across views |

## 9. Rollout / Phasing
| Phase | Window (Approx) | Deliverables | Exit Criteria |
|-------|-----------------|--------------|---------------|
| 0 – Baseline | Day 0 (Aug 28) | Branch + scaffolds | PR opened with stubs |
| 1 – Core Patterns | Days 1–3 | Router, registry, typed messages; Graph & Health integrated | Graph & Health launch via `panel:open` |
| 2 – Persistence + Tests | Days 4–5 | Route persistence + minimal tests | Tests pass in CI |
| 3 – Hardening | Days 6–7 | Logging, docs updates, cleanup | All FR P0 done; FR1–FR10 validated |
| MVP Lock | Day 8 (Sep 5) | Freeze core API surface | All P0 + selected P1 complete |
| Post-Lock Stretch | Remaining days | Deferred items PRs | No regression in core flows |

## 10. Acceptance Criteria (Condensed)
- Adding a new route requires: component file + routes config entry only.
- Adding a new panel requires: panel code + registry entry + esbuild entry (if new bundle).
- Sidebar state (active route) survives reload.
- Legacy `showGraph` command still works.
- No runtime console errors in navigation flows during smoke test.

## 11. Risks & Mitigations
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Scope creep (gold plating) | Delayed MVP | Medium | Enforce Non-Goals; review daily |
| Type drift between front/back | Runtime failures | Low | Shared type file imported both sides |
| Panel registry misuse | Silent no-op | Low | Add dev log warn if key missing |
| Missed persistence edge cases | UX annoyance | Medium | Early implement + manual reload test |
| Build break adding new entry | Time cost | Low | Add example & doc snippet in guide |

## 12. Dependencies
| Dependency | Status | Notes |
|-----------|--------|-------|
| Existing `WebviewManager` | Stable | Reused for panel creation |
| Existing Health Dashboard provider | Stable | Registry hook-in |
| Preact | Stable | No upgrade required |

## 14. Implementation Checklist (Detailed)
- [ ] Create `routing.types.ts` (panel + route message types)
- [ ] Create `routes.config.ts`
- [ ] Create placeholder views: Overview, Actions, HealthSummary
- [ ] Implement `SidebarRouter.tsx`
- [ ] Integrate router into existing `SidebarPanel.tsx`
- [ ] Add persistence using `getState` / `setState`
- [ ] Introduce `panel-registry.ts` (graph, health)
- [ ] Update extension message handler to process `panel:open`
- [ ] Refactor sidebar buttons to use new contract
- [ ] Wrap legacy command to call registry
- [ ] Update `routing-guide.md` status if approved
- [ ] Update `README.md` architecture section
- [ ] Final review & code freeze for MVP

## 15. Out-of-Scope Validation (Deferred Worklist)
| Deferred Item | Tracking Note |
|---------------|--------------|
| Code splitting / dynamic import | Add design spike card post-hackathon |
| Generic message bus abstraction | Only if message variety > 12 unique commands |
| Telemetry pipeline | Privacy & governance first |
| Multi-root enhancement | Add workspace prefix strategy |

## 16. QA / Test Approach
- No Tests Need to be written

## 17. Documentation Artifacts
- `routing-guide.md` (architecture) – SOURCE OF TRUTH for rationale.
- `routing--prd.md` (this file) – Product & execution contract.
- `README.md` (summarized high-level section) – To be updated.

## 18. Approval Matrix
| Role | Name | Approval |
|------|------|----------|
| Tech Lead | (TBD) | Pending |
| Product / Hackathon Captain | (TBD) | Pending |
| Reviewer (Security) | (TBD) | Pending |
| Reviewer (DX) | (TBD) | Pending |

## 19. Change Control
- Minor adjustments (typos, clarifications) can be committed directly.
- Any scope changes affecting FR list or Non-Goals require reviewer acknowledgment in PR thread.

## 20. Go / No-Go Checklist (Pre-MVP Lock)
- [ ] All P0 FRs implemented & manually verified
- [ ] No critical console errors
- [ ] Graph & Health panels launch via new system
- [ ] Legacy command path operational
- [ ] Team sign-off recorded in PR

## 21. Appendix – Example Code Fragments
```ts
// panel-registry.ts
import { webviewManager } from '../singleton'; // example import
export type PanelKey = 'graph' | 'health';
export const PANEL_REGISTRY: Record<PanelKey, () => void> = {
  graph: () => webviewManager.createOrShowPanel(globalContext),
  health: () => webviewManager.createOrShowHealthDashboard(),
};
```
```ts
// handleWebviewMessage addition
case 'panel:open': {
  const key = (message as any).data?.panel as PanelKey;
  if (!PANEL_REGISTRY[key]) {
    log(`[WARN] Unknown panel key: ${key}`);
    break;
  }
  PANEL_REGISTRY[key]();
  break;
}
```
```tsx
// SidebarPanel button example
<button onClick={() => postMessage({ command: 'panel:open', data: { panel: 'graph' } })}>Open Dependency Graph</button>
```

---
**End of Document**
