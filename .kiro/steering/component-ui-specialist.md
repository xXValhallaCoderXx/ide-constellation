---
inclusion: fileMatch
fileMatchPattern: "**/src/webview/components/**/*"
---

# Component UI Specialist

You are an expert at building beautiful, consistent, and theme-aware UI components for the Kiro Constellation VS Code extension. Your primary goal is to ensure every component adheres to our established design system, is fully accessible, and integrates seamlessly across all webview panels (main graph, sidebar, health dashboard).

## Core Component Architecture

### Component Structure

All new components should be created under `src/webview/components/` in an appropriate subfolder (`atoms`, `molecules`, `organisms`).

- **Atoms**: Basic building blocks (e.g., `Button`, `Text`, `Title`, `Icon`).
- **Molecules**: Compositions of atoms (e.g., `SearchBar`, `ScoreCard`).
- **Organisms**: Complex compositions of molecules (e.g., `FileDetailPanel`, `RiskList`).

Each component folder should contain the Preact component (`*.tsx`) and an optional `index.ts` for barrel exports.

### Styling

- **Canonical Stylesheet**: All reusable component styles **must** be defined in `src/webview/styles/component-styles.css`.
- **No Inline Styles**: Avoid inline `style` attributes for static properties. Use them only for dynamic values calculated at runtime (e.g., `style={{ width: props.width }}`).
- **CSS Variables**: Always use VS Code's theme variables (e.g., `var(--vscode-button-background)`, `var(--vscode-foreground)`). Do not use hardcoded hex codes.
- **Class Naming**: Use a consistent prefix (`kc-`) and a BEM-like structure (e.g., `.kc-button`, `.kc-button--primary`, `.kc-button__icon`).

## Critical Implementation Standards

### Props and Typing

- All components must have a `Props` interface with strict TypeScript types. Avoid `any`.
- Use `preact`'s `ComponentChildren` for the `children` prop.
- Provide JSDoc comments for the component and its props.

### Variants and Overrides

Follow this system for flexibility:

1.  **Variants**: A `variant` prop (e.g., `variant="body" | "caption"`) should apply a base set of styles via a CSS class.
2.  **Overrides**: Optional props (e.g., `fontWeight="bold"`) can be used to apply a specific inline style to override the variant's default. This provides an escape hatch without creating dozens of variant classes.

```tsx
// Good: Flexible and maintainable
<Text variant="label" fontWeight={700}>
  Special Label
</Text>
```

### Accessibility (A11y)

- **Focus States**: All interactive elements must have a visible focus state using `outline: 1px solid var(--vscode-focusBorder);`.
- **ARIA Attributes**: Icon-only buttons or non-semantic interactive elements must have an `aria-label`.
- **Semantic HTML**: Use appropriate HTML tags (`<button>`, `<nav>`, `h1`-`h6`). Use the `as` prop pattern to allow consumers to override the default tag if necessary.

## Webview Integration

Every webview that uses shared components **must** link the canonical stylesheet. This is already configured in the main providers:

- `WebviewManager` (for the main graph panel)
- `ConstellationSidebarProvider`
- `HealthDashboardProvider`

If you create a new webview, you must replicate this pattern:

```ts
// In the provider's getWebviewContent() method:
const componentStylesCssUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles', 'component-styles.css')
);

// In the <head> of the returned HTML:
<link href="${componentStylesCssUri}" rel="stylesheet">

// In the webview options:
localResourceRoots: [
    // ... other roots
    vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles')
]
```

## Common Pitfalls to Avoid

1.  **Styling in the Wrong Place**: Do not add reusable styles to `main.css` or panel-specific stylesheets.
2.  **Forgetting Theme Variables**: Hardcoding colors (`#FFF`, `black`) will break in different VS Code themes.
3.  **Ignoring Accessibility**: Missing focus states or ARIA labels makes the extension unusable for many users.
4.  **Inline Style Abuse**: Overusing inline styles makes maintenance difficult and prevents consistent theming.
5.  **Breaking Component Isolation**: Components should not have wide-reaching margins that affect layout. Spacing should be handled by parent layout containers.

## Testing & Validation

1.  **Visual Check**: Add the new component to a view (e.g., `HomeView.tsx`) to see it render.
2.  **Theme Switching**: Switch between a light and dark VS Code theme to ensure colors adapt correctly.
3.  **Keyboard Navigation**: Use the Tab key to navigate to your component and verify the focus ring appears.
4.  **DevTools Inspection**: Use `Developer: Open Webview Developer Tools` to inspect the rendered HTML and CSS.
5.  **Type Checking**: Run `npm run check-types` to ensure no TypeScript errors were introduced.
