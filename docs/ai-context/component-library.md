# Kiro Constellation Component Library Guide

> Goal: Ensure every new UI component (e.g. Button, Tag, Badge, Panel, Toolbar item) is consistent, theme-aware, accessible, and instantly usable across ALL webviews (graph panel, sidebar, health dashboard) without rework.

---

## 1. Design Principles

- **Single Source of Style Truth**: Reusable components derive base styling from `src/webview/styles/component-styles.css` only (never redefine in `main.css` or panel-specific CSS).
- **Theme Native**: Always use VS Code CSS variables (`--vscode-*`)—no hardcoded colors.
- **Composable**: Base class + optional modifier classes (BEM-like or suffix pattern, e.g. `.kc-button--secondary`).
- **No Inline Styling (Except Dynamic)**: Inline styles allowed only for dynamic runtime values (e.g. size, calculated layout) — _never_ for static colors, spacing, fonts.
- **Accessible by Default**: Keyboard focus, ARIA labels for icon-only components, role semantics where necessary.
- **Performance Friendly**: Keep CSS selectors shallow; avoid layout thrash (e.g. `:not()` chains). Use transitions sparingly.

---

## 2. File & Folder Conventions

```
src/
  webview/
    components/
      molecules/
        Button/
          Button.tsx       # Preact component
    styles/
      component-styles.css # Canonical reusable component classes
```

If a component has complex variants or many related classes, you can optionally create a colocated `*.css` file **only if** the styles are unique to that component. If styles might be reused later, promote them into `component-styles.css`.

---

## 3. Adding a New Component (Checklist)

1. Create the component file under an appropriate level (`atoms`, `molecules`, `organisms` if you introduce those). Example: `src/webview/components/molecules/Tag/Tag.tsx`.
2. Define a TypeScript interface for props with strict typing— no `any`.
3. Add a JSDoc block summarizing intent + props.
4. Use `preact` imports: `import { h } from 'preact';` and `ComponentChildren` where needed.
5. Choose a base class name, prefix optional: `kc-` (e.g. `.kc-tag`). Add it to `component-styles.css`.
6. Add variants as modifier classes: `.kc-tag--info`, `.kc-tag--warning`.
7. Ensure focus styles: use `outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px;` for interactive elements.
8. Avoid margins inside the component unless intrinsic (chips, badges). Let parents control layout.
9. Export the component via an index barrel if you create one (optional): `src/webview/components/molecules/index.ts`.
10. If component will render inside **sidebar webview** or **health dashboard**, confirm those providers link `component-styles.css` (already configured; just verify in future changes).

---

## 4. Styling Rules (component-styles.css)

Add new rules at the bottom of the file under a clear heading:

```css
/* === Tag Component === */
.kc-tag {
  /* base styles */
}
.kc-tag--info {
  /* variant */
}
.kc-tag--warning {
  /* variant */
}
```

Guidelines:

- Use spacing scale consistent with existing UI (4px base: 4 / 8 / 12 / 16).
- Font size: derive from `var(--vscode-font-size)` or a fraction (`calc(var(--vscode-font-size) * 0.85)`).
- Colors: Use semantic VS Code variables when possible (examples):
  - Foreground: `var(--vscode-foreground)`
  - Accent / primary: `var(--vscode-button-background)`
  - Subtle background: `var(--vscode-editor-inactiveSelectionBackground)`
  - Border: `var(--vscode-panel-border)`
  - Warnings: `var(--vscode-inputValidation-warningBackground)`
  - Errors: `var(--vscode-inputValidation-errorBackground)`
- Transitions: keep to `transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;`

---

## 5. Accessibility Checklist

| Requirement                  | Why                             | How                                                                                                   |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Keyboard focus visible       | WCAG 2.4.7                      | Add `.component:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }` |
| Icon-only buttons need label | Screen reader clarity           | Provide `aria-label` prop                                                                             |
| Role semantics               | Non-native interactive elements | Add `role="button"` (only if not a `<button>`)                                                        |
| Color not sole meaning       | Colorblind users                | Pair color with icon/text (e.g. ⚠ Warning)                                                            |

---

## 6. Import & Usage Pattern

Example using the `Button` component:

```tsx
import { Button } from "@/webview/components/molecules/Button";

<Button onClick={handleClick} ariaLabel="Refresh data">
  Refresh
</Button>;
```

No explicit stylesheet import needed in individual components—the webview HTML already pulls in `component-styles.css`.

---

## 7. Webview Integration Notes

Each VS Code webview is sandboxed. To ensure styles apply:

- The provider must include `<link href="${componentStylesCssUri}" rel="stylesheet">`.
- Already implemented in:
  - `WebviewManager.getWebviewContent()` (main graph panel)
  - `ConstellationSidebarProvider` (sidebar)
  - `HealthDashboardProvider` (health dashboard)
    If you add a **new webview provider**, copy that pattern.

### Adding to a New Provider

```ts
const componentStylesCssUri = webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles', 'component-styles.css')
);
// In <head>
<link href="${componentStylesCssUri}" rel="stylesheet">
// In options.localResourceRoots add the styles folder
vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'styles')
```

---

## 8. Component Variants Strategy

Use additive classes so JS logic doesn’t toggle inline styles:

```tsx
const cls = variant ? `kc-badge kc-badge--${variant}` : "kc-badge";
```

Prefer enumerated prop types:

```ts
interface BadgeProps {
  variant?: "info" | "warning" | "error";
}
```

Then map variant → semantic variable in CSS.

---

## 9. Performance & Build Considerations

- Avoid large base64 assets in CSS (CSP + bloat). Use SVG inline only if tiny.
- Minimize repaint triggers: avoid animating layout (`width`, `height`); prefer `opacity`/`transform`.
- Keep component CSS flat—avoid deep descendant selectors that slow recalculation.
- Bundle strategy: CSS is **not** currently processed by a pipeline; it’s loaded raw. Keep it lean.

---

## 10. Testing a New Component

Manual quick test flow:

1. Create component + styles.
2. Reference in `HomeView` or a temporary test view.
3. Run `npm run watch` (ensures TS rebuild) and reload VS Code window.
4. Inspect in DevTools (Command Palette: Developer: Open Webview Developer Tools).
5. Toggle light/dark themes to confirm contrast.
6. Tab through to verify focus ring.

Optional: Create a `ComponentGallery` panel in future hackathon polish phase.

---

## 11. Common Pitfalls & Fixes

| Issue                                     | Cause                            | Fix                                                                  |
| ----------------------------------------- | -------------------------------- | -------------------------------------------------------------------- |
| Styles not applied                        | Missing `<link>` tag in provider | Add component-styles link + resource root                            |
| Focus ring missing                        | No :focus-visible rule           | Add shared rule or component-specific override                       |
| Button text misaligned                    | Added extra padding in parent    | Remove parent vertical padding or set `line-height: 1.2`             |
| Colors look off in high contrast          | No forced-colors rules           | Add `@media (forced-colors: active)` adaptation                      |
| Inline fallback button styled differently | Fallback HTML uses inline styles | Replace with class + minimal HTML or ignore if only for failure mode |

---

## 12. Future Enhancements (Backlog Ideas)

- Tokenize spacing + radius via custom CSS variables (`--kc-space-1`, etc.).
- Add motion-reduced variants with `prefers-reduced-motion` queries.
- Provide a small script to assert all webviews include the shared stylesheet.
- Build a pre-publish lint that rejects inline static color values.

---

## 13. Example: Creating a Tag Component

```tsx
// src/webview/components/molecules/Tag/Tag.tsx
import { h } from "preact";
import { ComponentChildren } from "preact";

interface TagProps {
  children: ComponentChildren;
  variant?: "info" | "warn" | "error";
}

export const Tag = ({ children, variant }: TagProps) => {
  const cls = variant ? `kc-tag kc-tag--${variant}` : "kc-tag";
  return <span className={cls}>{children}</span>;
};
```

```css
/* component-styles.css */
/* === Tag Component === */
.kc-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: calc(var(--vscode-font-size) * 0.75);
  border-radius: 999px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-foreground);
}
.kc-tag--info {
  background: var(--vscode-button-secondaryBackground);
}
.kc-tag--warn {
  background: var(--vscode-inputValidation-warningBackground);
}
.kc-tag--error {
  background: var(--vscode-inputValidation-errorBackground);
}
```

---

## 14. Definition of Done for New Components

- [ ] Added to proper folder with strict types
- [ ] Documented with JSDoc
- [ ] Base + variant classes in `component-styles.css`
- [ ] No inline static styles
- [ ] Theming variables only
- [ ] Focus-visible works
- [ ] Tested in dark + light themes
- [ ] Verified in at least sidebar + one panel (if applicable)

---

## 15. Why This Matters (Hackathon Impact)

Consistent, polished, theme-aware components:

- Increase perceived quality & coherence (Judge Appeal + Polish scores)
- Reduce friction adding new UI (faster iteration for demo story)
- Enable future gamification overlays (Achievements, Tooltips) with predictable structure

Own the shine: every pixel tells the story of an intelligent, unified constellation experience.

---

Prepared for the Kiro Constellation project. Iterate responsibly; keep it lean, extensible, and visually performant.
