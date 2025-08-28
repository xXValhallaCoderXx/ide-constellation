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
