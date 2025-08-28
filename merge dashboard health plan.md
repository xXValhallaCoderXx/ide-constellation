# Health Dashboard Merge Plan

Objective

- Analyze the previous attempt at refactoring in [HealthDashboard.tsx](src/webview/ui/dashboard-health copy/components/HealthDashboard.tsx) and selectively merge valuable UX and behavior into the new Health Dashboard located under [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx).
- Maintain clean separation of concerns:
  - Domain/business logic: [health.services.ts](src/services/health/health.services.ts)
  - Webview logic/state: [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - UI components only: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
- Keep files small and cohesive; extract UI sub-components where complexity warrants it.

Current baseline

- New dashboard is implemented and wired:
  - UI: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
  - Hook: [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - Domain: [health.services.ts](src/services/health/health.services.ts)
  - Provider: [health-dashboard.provider.ts](src/webview/providers/health-dashboard.provider.ts)
  - Messaging helpers: [health.postMessage.ts](src/webview/ui/dashboard-health/health.postMessage.ts)
- The new UI is functional, minimal, and inline-styled. It already supports:
  - Refresh, export JSON/CSV, open file, show heatmap, focus node via typed messages.
  - Display of header, stats, top risks (clickable), and recommendations.

Source of features to evaluate/merge

- From the older attempt:
  - Rich toasts and consistent notifications
    - Uses [ToastNotification](src/webview/ui/graph-constellation/components/ToastNotification.tsx) and [LoadingIndicator](src/webview/ui/graph-constellation/components/LoadingIndicator.tsx)
    - Includes CSS: [toast-notification.css](src/webview/ui/graph-constellation/styles/toast-notification.css) and [loading-indicator.css](src/webview/ui/graph-constellation/styles/loading-indicator.css)
  - Contextual help component
    - [ContextualHelp](src/webview/ui/graph-constellation/components/ContextualHelp.tsx)
  - Robust states and actions
    - Loading, Empty, Error states with actionable buttons and guidance
    - Keyboard and accessibility affordances
    - Ctrl/Cmd click on a risk item opens split editor
    - “View Heatmap on Graph”, “Retry Analysis”, “View Graph Only”, “Continue dashboard only”
  - Selection highlight of a risk item and cross-panel highlight integration
  - Comprehensive CSS: [health-dashboard.css](src/webview/ui/dashboard-health copy/styles/health-dashboard.css)

Design decisions for merge

- Notifications
  - Prefer reusing the already-built toast system for consistency across panels.
  - Keep InfoBanner for inline persistent messages; use toasts for ephemeral feedback.
- States
  - Adopt explicit loading, empty, and error states with clear calls to action.
  - The hook will be the single source of truth for state flags and selected risk.
- Accessibility and UX polish
  - Bring over keyboard-friendly affordances in the simplest form (focus states, skip links optional).
  - Add reduced-motion and high-contrast safeguards only if low-risk.
- Selection and interactions
  - Support Ctrl/Cmd+Click on top risk to open in split.
  - Allow selection highlight to persist; clicking “focus in graph” uses selectedRisk if set.
- Styling
  - Move a curated subset of styles from the legacy CSS into [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css) to avoid bloating.
  - Link it from provider HTML. Avoid CSS imports in TSX due to esbuild css-loader limitations in current setup.
- Scope control
  - Avoid introducing global animations that could conflict with VS Code theme or slow machines by default.
  - Keep the CSS footprint trimmed; no animation if it risks readability or performance.

Planned file changes

1. Provider: include dashboard CSS

- File: [health-dashboard.provider.ts](src/webview/providers/health-dashboard.provider.ts)
- Add another link tag to include [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css) in getWebviewContent() HTML.

2. Add or trim styling file

- File: [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css)
- Extract from [health-dashboard.css](src/webview/ui/dashboard-health copy/styles/health-dashboard.css) only the sections we need:
  - Layout containers (.health-dashboard)
  - Section headers
  - Risk list items, selection state, metrics chips
  - Action buttons minimal polish
  - Optional: focused states and reduced motion
- Keep animations subtle and respectful of reduced-motion.

3. Notifications integration

- UI: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
  - Add ToastContainer mounted once at the bottom.
- Hook: [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - Add local helpers to post ephemeral toasts via a simple message bus or expose callbacks to UI to trigger toasts on action results.
  - Optional: implement a tiny toasts context if needed, or reuse ToastContainer’s provided hooks if compatible.

4. States and actions

- Hook: [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - Add selectedRisk: RiskScore | null in local state.
  - Add onMessage handler for 'dashboard:highlightRisk' to set selectedRisk.
  - Add ensureRequested(force) already exists; enhance to set loading and clear error.
- UI: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
  - Render three distinct states:
    - Loading: show LoadingIndicator and info text
    - Error: display error with retry buttons (refresh, view graph)
    - Empty: prompt to run analysis
  - For “View Graph Only” or “Focus Selected in Graph”, wire to showHeatmap/focusNode from hook.

5. Interactions and accessibility

- UI: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
  - Top Risks:
    - On click: set selectedRisk, open file (default)
    - On Ctrl/Cmd click: open in split (pass openMode='split' to openFile)
  - Add a “Focus in Graph” affordance (icon button) per risk row; call focusNode(risk.nodeId)
  - Keyboard:
    - Give risk items tabIndex=0 and Enter key opens file; Shift+Enter opens in split

6. Domain services review

- File: [health.services.ts](src/services/health/health.services.ts)
  - Already contains pure formatting and calculations.
  - Consider adding derived flags (e.g., evaluateEmpty(analysis)) but keep simple to avoid domain bloat.

7. Message handling alignment

- Hook: [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - Handle 'dashboard:highlightRisk'
  - Already handles health:loading, health:response, health:error, health:export:result
- Provider: [health-dashboard.provider.ts](src/webview/providers/health-dashboard.provider.ts)
  - Already posts 'dashboard:highlightRisk' on some flows; verify integration.

8. Component extraction to keep files small

- New components under [dashboard-health/components](src/webview/ui/dashboard-health/components):
  - ScoreHeader.tsx
  - DistributionGrid.tsx
  - RiskList.tsx (handles keyboard + selection + file open/focus buttons)
  - Recommendations.tsx
  - ActionsBar.tsx (Refresh, Export JSON/CSV, Show Heatmap)
- HealthDashboard.tsx remains a small orchestrator reading from hook and assembling components.

9. Testing plan

- Unit-level:
  - health.services: deriveHealthStatus, exportToCSV/JSON, generateMetricsReport
  - messages guard: isHealthExportMessage, isHealthExportResultMessage
- Interaction smoke tests (manual for now):
  - Loading→Response path
  - Error→Retry path, Empty→Request path
  - Ctrl/Cmd click open split
  - Focus in graph from a risk and from selected risk
  - Export flows and notification display
  - Dashboard highlight via 'dashboard:highlightRisk'
  - CSS renders under light/dark themes without contrast issues

10. Deletion plan after merge

- After parity verified:
  - Remove [dashboard-health copy](src/webview/ui/dashboard-health copy)
  - Ensure no references remain; run npm run compile and search for “dashboard-health copy”.
  - Strip any unused CSS selectors in [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css)

Detailed step-by-step execution

Step 1: Add CSS link in provider

- Edit [health-dashboard.provider.ts](src/webview/providers/health-dashboard.provider.ts)
  - getWebviewContent(): Add a second link tag:
    - <link href="{asWebviewUri('/src/webview/ui/dashboard-health/styles/health-dashboard.css')}" rel="stylesheet">

Step 2: Create curated CSS

- Create [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css) with:
  - .health-dashboard
  - .dashboard-header, .actions, .section
  - .risk-file row styling with selection support
  - .stat-card, grid layout
  - Focus states and small transitions
- Avoid heavy animations initially; guard with prefers-reduced-motion if any.

Step 3: Introduce UI sub-components

- Create:
  - [ScoreHeader.tsx](src/webview/ui/dashboard-health/components/ScoreHeader.tsx)
  - [DistributionGrid.tsx](src/webview/ui/dashboard-health/components/DistributionGrid.tsx)
  - [RiskList.tsx](src/webview/ui/dashboard-health/components/RiskList.tsx)
  - [Recommendations.tsx](src/webview/ui/dashboard-health/components/Recommendations.tsx)
  - [ActionsBar.tsx](src/webview/ui/dashboard-health/components/ActionsBar.tsx)
- Move markup from [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx) into these components.
- Keep prop interfaces tight and only pass what is needed.

Step 4: Extend hook for selection and highlight

- Update [useHealthAnalysis.ts](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts)
  - Add selectedRisk, setSelectedRisk
  - Add handler in window message listener for 'dashboard:highlightRisk'
  - Expose actions: selectRisk(risk), openFile(fileId, mode), focusNode(nodeId)

Step 5: Keyboard and split-open behavior

- In [RiskList.tsx](src/webview/ui/dashboard-health/components/RiskList.tsx)
  - onClick uses event.ctrlKey || event.metaKey to compute 'split'
  - onKeyDown handles Enter and Shift+Enter

Step 6: Toasts integration

- UI: [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx)
  - Import and mount [ToastContainer](src/webview/ui/graph-constellation/components/ToastNotification.tsx)
  - Add simple helper in hook or component to emit showSuccess/showError, e.g. after export result, refresh start/finish, and view heatmap action

Step 7: Error and empty states

- Render actionable panels similar to the copy with minimal styles
- Buttons wire to:
  - ensureRequested(true)
  - postMessage graph:request (optional)
  - clear error state and continue

Step 8: Verify message flow and logging

- Ensure provider logs actions and posts messages consistently
- Confirm cross-panel navigation via [WebviewManager.navigateFromDashboardToGraph](src/webview/webview.service.ts)

Step 9: Manual QA and acceptance criteria

- Acceptance criteria:
  - Parity of basic UX flows with the copy: states, actions, selection
  - Keyboard support in RiskList
  - Export success/failure shows toasts; success shows a banner with URI
  - No TypeScript or ESLint warnings introduced
  - CSS respects themes and reduced-motion
- Manual checks:
  - Run “Constellation: Analyze Health”
  - Verify selection highlight and split open
  - Verify “Focus in Graph” and “View Heatmap” operations
  - Verify error/empty panels appear appropriately

Step 10: Cleanup

- With approval and after parity validation, delete:
  - [dashboard-health copy](src/webview/ui/dashboard-health copy)

## Implementation readiness addendum

This section turns the plan into concrete, code-ready tasks with contracts, acceptance criteria, and file scaffolding guidance.

1. Provider HTML and resource roots

- Inject stylesheet links in [health-dashboard.provider.ts](src/webview/providers/health-dashboard.provider.ts) head:
  - Add link for [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css)
  - Reuse shared styles from graph UI:
    - [toast-notification.css](src/webview/ui/graph-constellation/styles/toast-notification.css)
    - [loading-indicator.css](src/webview/ui/graph-constellation/styles/loading-indicator.css)
    - [contextual-help.css](src/webview/ui/graph-constellation/styles/contextual-help.css)
- Ensure localResourceRoots includes:
  - src/webview/ui/dashboard-health/styles
  - src/webview/ui/graph-constellation/styles

2. CSS curation map

- Create [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css) with only these classes (trimmed from the copy):
  - Layout/container
    - .health-dashboard
    - .dashboard-header
    - .section
    - .actions
  - Stats
    - .stat-card
    - .stats-grid
  - Risks
    - .risk-file
    - .risk-file.selected
    - .risk-badge
    - .metrics-chip
    - Focus outline utilities
  - Inline banners (used by InfoBanner in UI)
    - .info-banner
    - .info-banner.warning|.error|.success
  - Motion/accessibility (guarded)
    - @media (prefers-reduced-motion: reduce) { minimal overrides }
- Exclude heavy animations, ripples, and print rules initially; add only if required.

3. Components extraction contracts (to keep files small)

- Create these presentational components under [components/](src/webview/ui/dashboard-health/components):
  - [ScoreHeader.tsx](src/webview/ui/dashboard-health/components/ScoreHeader.tsx)
    - Props:
      - score: number
      - totalFiles: number
      - statusLabel: string
      - statusColor: string
      - timestamp?: string
      - children?: JSX.Element (for header actions e.g., help)
  - [DistributionGrid.tsx](src/webview/ui/dashboard-health/components/DistributionGrid.tsx)
    - Props:
      - distribution: { low: number; medium: number; high: number; critical: number }
      - totalFiles: number
  - [RiskList.tsx](src/webview/ui/dashboard-health/components/RiskList.tsx)
    - Props:
      - risks: import alias of HealthAnalysis['topRisks']
      - selectedId?: string
      - onSelect: (id: string) => void
      - onOpenFile: (id: string, mode: 'default' | 'split') => void
      - onFocusGraph: (id: string) => void
    - Behavior:
      - Click selects and opens default
      - Ctrl/Cmd+Click opens split
      - Keyboard:
        - Enter = open default
        - Shift+Enter = open split
        - Tab index set on each item
  - [Recommendations.tsx](src/webview/ui/dashboard-health/components/Recommendations.tsx)
    - Props:
      - items: string[]
  - [ActionsBar.tsx](src/webview/ui/dashboard-health/components/ActionsBar.tsx)
    - Props:
      - onRefresh: () => void
      - onExportJson: () => void
      - onExportCsv: () => void
      - onShowHeatmap: () => void
- [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx) becomes a thin composer.

4. Hook enhancements in [useHealthAnalysis()](src/webview/ui/dashboard-health/hooks/useHealthAnalysis.ts:1)

- Add selectedRisk: string | null
- Add selectRisk: (id: string) => void
- Update message handler to process [dashboard:highlightRisk](src/types/messages.types.ts:127)
- Keep existing actions: refresh(), export(format), openFile(fileId, mode), showHeatmap(centerNode?), focusNode(nodeId)

5. Message matrix (webview ⇄ extension)

- From UI to extension:
  - [health:request](src/types/messages.types.ts:73): optional { forceRefresh?: boolean }
  - [health:refresh](src/types/messages.types.ts:121)
  - [health:export](src/types/messages.types.ts:207): { format: 'json' | 'csv' }
  - [editor:open](src/types/messages.types.ts:51): { fileId, openMode }
  - [health:showHeatmap](src/types/messages.types.ts:104): { analysis, centerNode? }
  - [health:focusNode](src/types/messages.types.ts:113): { nodeId }
- From extension to UI:
  - [health:loading](src/types/messages.types.ts:99)
  - [health:response](src/types/messages.types.ts:81): { analysis, timestamp }
  - [health:error](src/types/messages.types.ts:90): { error, timestamp }
  - [health:export:result](src/types/messages.types.ts:215): { success, format, uri?, error? }
  - [dashboard:highlightRisk](src/types/messages.types.ts:126): { nodeId }

6. Notification plan

- Mount [ToastContainer](src/webview/ui/graph-constellation/components/ToastNotification.tsx:1) at the root of [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx:1).
- Emit toasts in these scenarios:
  - Export success/failure (map of ExtensionToWebviewMessage 'health:export:result')
  - Refresh started/finished (optional info toasts)
  - Show Heatmap navigation initiated (info)
  - File open action (optional info)
- Keep InfoBanner (inline) for persistent messages: loading/info/warning/error lines.

7. Explicit states in [HealthDashboard.tsx](src/webview/ui/dashboard-health/HealthDashboard.tsx:1)

- Loading: show [AnalysisLoadingIndicator](src/webview/ui/graph-constellation/components/LoadingIndicator.tsx:1) and a text hint
- Empty (no analysis): button to call ensureRequested(true)
- Error: show error message and these buttons:
  - Retry (refresh)
  - View Graph Only (post [graph:request](src/types/messages.types.ts:31))
  - Continue Dashboard Only (clear error)

8. Accessibility and keyboard focus

- Risk rows: add tabIndex=0, aria-label with filename and risk data
- Visible focus outline using CSS class or default browser outline
- Reduced motion support in [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css:1)

9. Acceptance criteria gates

- Gate A: Messaging
  - All message commands handled without console warnings
  - 'dashboard:highlightRisk' selects and scrolls into view the corresponding risk row
- Gate B: Interactions
  - Ctrl/Cmd click opens split
  - Enter opens default; Shift+Enter opens split
  - Focus in graph button centers the node
- Gate C: States
  - Loading→Response, Error→Retry, Empty→Request flows validated
- Gate D: Notifications
  - Export toast shows URI on success and error text on failure
- Gate E: Theme/accessibility
  - Light/dark and prefers-reduced-motion render correctly
- Gate F: Build hygiene
  - tsc, eslint, esbuild and CSP run cleanly

10. Task mapping to the todo list

- Merge Step 1: Provider resource roots + style links
- Merge Step 2: Curated CSS file
- Merge Step 3: Component extraction and refactor composer
- Merge Step 4: Hook enhancements for selection/highlight
- Merge Step 5: RiskList interactions and keyboard support
- Merge Step 6: Toasts integration
- Merge Step 7: States panels wiring
- Merge Step 8: E2E message verification
- Merge Step 9: Manual QA gates A–F
- Merge Step 10: Delete [dashboard-health copy](src/webview/ui/dashboard-health copy)

Risks and mitigations

- CSS scope and theming:
  - Use lightweight classes and VS Code theme variables
  - Avoid global resets; verify on light/dark themes
- Bundle size:
  - Limit animations; avoid heavy assets
- Accessibility regressions:
  - Add focus outlines and keyboard handlers
- Message noise:
  - Keep toast volume reasonable; use InfoBanner for persistent messages

Time/effort estimate

- CSS curation: 1–2 hours
- Subcomponent extraction: 1.5–2 hours
- Hook enhancement and selection logic: 1 hour
- Toast integration and actions polish: 1 hour
- Manual QA and refinement: 1–2 hours
- Cleanup and docs update: 0.5 hour
- Total: ~6–8 hours

Post-merge documentation

- Update [routing-guide.md](routing-guide.md)
- Update “Risk Analysis Engine” doc already scrubbed: [risk-analysis-engine.md](docs/risk-analysis-engine.md)
- Add a small README note in [dashboard-health](src/webview/ui/dashboard-health/HealthDashboard.tsx) directory on component responsibilities

Deletion readiness checklist

- “dashboard-health copy” directory references removed (code search)
- Build and lint pass cleanly
- Manual acceptance criteria met
- Approval received to remove the directory

Appendix: Quick mapping of copied features to target

- Toasts → add ToastContainer; use toasts for action feedback (export, refresh)
- Loading indicator → use [LoadingIndicator](src/webview/ui/graph-constellation/components/LoadingIndicator.tsx)
- ContextualHelp → add to header of score section
- Error/Empty retry flows → wire to ensureRequested and graph:request
- Selection and split open → implemented in RiskList
- CSS → curated subset into [health-dashboard.css](src/webview/ui/dashboard-health/styles/health-dashboard.css)
