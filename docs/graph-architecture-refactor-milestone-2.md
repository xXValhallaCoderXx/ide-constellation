## Graph Architecture Refactor – Milestone 2 Overlay Summary

### Purpose
Introduce deterministic Base Graph + Overlays pipeline enabling composable filtering (focus) and decoration (heatmap) without mutating the base graph.

### Core Components
| Component | Responsibility |
|-----------|----------------|
| `overlay.types.ts` | Overlay data contracts & helpers (`createOverlay`, type guards) |
| `overlay.state.ts` | Immutable Map operations (`applyOverlay`, `clearOverlay`, `getOverlay`) |
| `compose.ts` | Pure composition (filter → decorate) returning `{ nodes, edges, styles }` |
| `focus.adapter.ts` | Depth-limited BFS subgraph extraction |
| `heatmap.adapter.ts` | Node decoration with score/color metadata |
| `overlay.logging.ts` | Dev-only diagnostics (apply / clear / compose) |

### Data Flow
```
Extension Message -> normalize payload -> createOverlay -> applyOverlay(Map clone)
  -> React state change -> useMemo(composeRenderable) -> GraphCanvas props
```

### Composition Phases
1. Focus Filtering: reduce nodes/edges to subgraph.
2. Heatmap Decoration: augment remaining node objects.

Phases separated to keep decoration cost proportional to filtered size.

### Determinism & Purity
- No logging or timing inside `composeRenderable`.
- No Date/random usage internally; overlay timestamps created outside purity boundary.
- Idempotent: repeated composition with unchanged inputs yields structurally equal outputs.

### Diagnostics
`logOverlay(event, meta)` (disabled in production) produces concise, structured lines:
```
[ISO] [overlay] event=apply id=focus kind=focus corr=abc123
[ISO] [overlay] event=compose nodes=120 edges=340 overlays=2
```

### Performance Hooks
- Dev-only `console.time('composeRenderable')` wrapper.
- Future optimization: caching focus subgraph keyed by (target, depth, flags) + baseGraph version hash.

### Legend Parity
Legend reads from active heatmap overlay (`distribution`, `totalFiles`). Clearing heatmap overlay hides legend automatically.

### Extensibility Guidelines
Add new overlay types by categorizing as:
- Filter: reduces node/edge set (run before decoration). One per category or composed in predefined order.
- Decorate: augments nodes (run after filtering). Multiple can chain safely if they do not overwrite reserved keys.

Reserved node property namespace for overlays: `node.<overlayKey>` (e.g., `node.heatmap`). Future overlays should use unique keys to avoid collisions.

### Future Enhancements (Deferred)
- Priority/weight system for multi-filter scenarios.
- Edge decoration overlays (e.g., relationship weights, change frequency).
- Overlay inspector panel & extension feedback channel.
- Base graph version hashing for cache invalidation.

### Acceptance Alignment
Supports FR1 (composition abstraction), FR4/FR5 (focus + heatmap behaviors), FR7 (diagnostics), FR8 (search operates on filtered set), FR10 (performance timing), enabling subsequent visualization layers.

---
Maintained by: Architecture Working Group (Constellation)
