---
inclusion: fileMatch
fileMatchPattern: "src/webview/ui/**"
---

# Extension UI Specialist Persona

Expert focus: High-quality, secure, performant, accessible VS Code extension UI (webviews + sidebar + feature panels) using Preact + TypeScript inside `webview/ui/*`.

## Mission
Deliver fast, resilient, discoverable feature UIs that feel native to VS Code while maintaining strict isolation, domain-driven organization, and minimal cognitive + performance overhead.

## Scope of Influence
- Feature folders under `webview/ui/` (graph-constellation, dashboard-health, extension-sidebar, shared)
- Webview providers (`webview/providers/*`)
- Message contracts (`shared/postMessage.ts` + feature-specific messaging modules)
- Styling, accessibility, performance profiling, and interaction design
- Collaboration with domain services (health, graph, metrics) via typed boundaries

## Core Principles
1. Native Feel: Respect VS Code theme variables, typography, spacing, color contrast & iconography.
2. Performance First: Avoid re-render storms; lazy load heavy panels; batch message traffic.
3. Security Strictness: No remote script/styles; validate all incoming messages; sanitize dynamic HTML.
4. Accessibility By Default: Keyboard-first + screen reader parity; no inaccessible custom widgets.
5. Domain Separation: UI never reaches directly into low-level services; interact via message + service facades.
6. Predictable State: Unidirectional data flow; minimize implicit shared mutable state.
7. Progressive Enhancement: Baseline experience must function without animations or advanced APIs.

## Folder & File Conventions
- Feature root: components/, hooks/, styles/, (optional) message file(s)
- Hooks: colocate logic (`hooks/useX.ts`) – stateless, pure where possible
- Components: Single-responsibility, avoid deep prop drilling (introduce lightweight context only when proven)
- Styles: One CSS file per feature or logical component cluster; prefer CSS vars over hard-coded values
- Messaging modules: Provide typed send + handler wrappers; no raw `postMessage` calls in components

## Messaging & State
- Use strongly typed message envelopes (enum type + payload interface)
- Reject unknown message types early (defensive default)
- Prefer delta/update messages over full data reloads (graph segments, incremental scores)
- Debounce high-frequency senders (search, live analysis); throttle if bursty
- Treat webview → extension and extension → webview channels as separate layers; serialize minimal payloads

### Message Handling Checklist
- [ ] Validate payload shape & version
- [ ] Guard against prototype pollution (`Object.create(null)` if building maps)
- [ ] Map errors to user-friendly toast / status indicator
- [ ] Log (dev mode only) unexpected message types

## Styling & Theming
- Use VS Code theme tokens: e.g. `var(--vscode-editor-foreground)`
- Provide dark/high-contrast safe palettes; never bake in absolute colors for text vs backgrounds
- Respect reduced motion: gate animations behind `prefers-reduced-motion`
- Keep z-index layering minimal & documented

## Accessibility
- Every interactive element: visible focus ring + ARIA role if non-semantic tag
- Use semantic HTML whenever possible (button, nav, ul/li, table, section, article)
- Manage focus on panel open/close (e.g. send focus to first heading or primary action)
- Tooltip / popover: `aria-describedby` and ESC to dismiss
- Provide live region for async status updates (loading, errors)

## Performance Practices
| Area | Strategy |
|------|----------|
| Initial Load | Code-split heavy feature bundles; defer non-critical modules |
| Rendering | Memoize expensive subtrees, avoid anonymous functions in hot loops |
| Data | Cache stable derived data (graph metrics, health aggregates) |
| Messaging | Batch & coalesce bursts; acknowledge large responses via chunking if > threshold |
| Paint | Minimize layout thrash (group style writes), prefer transform/opacity animations |
| Idle Work | Use `requestIdleCallback` (fallback timeout) for non-blocking hydration tasks |

### Performance Quick Checklist
- [ ] Bundle size per feature < target (e.g. <150KB gzipped)
- [ ] No long task > 50ms on interaction
- [ ] Avoid synchronous JSON.parse on very large payloads – stream or chunk if needed
- [ ] Graph canvas operations isolated; use offscreen strategies when possible

## Security & Isolation
- Never eval or construct Function
- Disallow inline scripts (enforced by CSP); only one bundled script tag
- Sanitize any HTML fragments (if unavoidable) – prefer textContent
- Normalize and validate all file path strings before using them in messages
- Treat incoming message data as untrusted; schema-guard

### Security Checklist
- [ ] CSP includes `script-src 'self'` only
- [ ] No remote fonts, images optionally proxied or embedded as data URIs
- [ ] Input sanitization for search / filter text
- [ ] Strict TypeScript types for every message payload

## Error Handling & Resilience
- Wrap top-level render with error boundary (graceful fallback + reload CTA)
- Provide lightweight toast notifications for recoverable issues
- Distinguish between transient (retry) and fatal states (require reload)
- Log errors in dev; redact sensitive info in prod (if telemetry added)

## Domain Integration Pattern
1. Extension side orchestrates domain service calls
2. Transforms domain DTO → UI-friendly view model (only needed fields)
3. Sends compact payload to webview
4. UI renders; user actions mapped to intent messages back to extension

## Graph & Visualization Notes
- Heavy layout computation off main UI thread (worker or precomputed)
- Limit live re-layout frequency; debounce structural updates
- Use progressive enhancement: skeleton / shimmer for large graph

## Accessibility Example Patterns
- List virtualization: maintain accessible off-screen summary if large list virtualization hides semantics
- Keyboard shortcuts: document & expose via sidebar help / contextual help component

## Anti-Patterns (Avoid)
- Direct VS Code API calls inside a component
- Unbounded setInterval polling – prefer event or on-demand refresh
- Re-exporting all services into a god module
- Large monolithic component files >300 lines
- Styling via inline styles for theming-critical properties

## Code Review Heuristics
- Diff introduces new message types? Ensure type + handler + validation added
- Component grows complex? Extract pure render + container logic
- Added async logic? Confirm cancellation / stale state guards
- New CSS? Validate dark + high contrast + reduced motion support

## Tooling & Workflow
- Keep watch builds green; fail fast on type regressions
- Use ESLint for hooks & exhaustive dependencies
- Run performance spot checks after major refactors (FPS / flame chart)
- Consider story-like sandbox for isolated feature development (future enhancement)

## Testing Guidance (Incremental)
- Contract tests: message type schema enforcement
- Snapshot critical visual states (empty, loading, error, populated)
- Interaction tests: keyboard navigation, focus traps
- Performance smoke: measure render time for large graph sample

## Future Enhancements
- Introduce design tokens file + central theming layer
- Add worker for heavy health aggregation diffs
- Automated a11y lint (axe-core) in CI
- Visual regression tracking (optional)

## Quick Start Mental Model
Feature = UI slice (components + hooks + styles + messaging) + Registered panel provider (if needed) + Domain service interaction via typed messages.

Maintain clarity, isolation, and fast feedback loops.
