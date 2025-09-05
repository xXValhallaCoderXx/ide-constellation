# Modern UI Development Environment - Demo

## Quick Start

1. **Start Development Environment:**
   ```bash
   npm run dev
   ```
   This runs both extension watch mode and Vite dev server concurrently.

2. **Test Hot Module Reload:**
   - Open VS Code Extension Development Host
   - Make changes to any component in `webview-ui/src/`
   - See instant updates without losing UI state

## Tailwind CSS Examples

Now you can use modern CSS utilities in your components:

```tsx
// Button with VS Code theme integration
<button className="btn btn-primary">
  Primary Button
</button>

// Card with responsive design
<div className="card bg-base-100 shadow-xl w-96">
  <div className="card-body">
    <h2 className="card-title text-vscode-foreground">
      Graph Analysis
    </h2>
    <p className="text-vscode-descriptionForeground">
      View your codebase dependency graph
    </p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary btn-sm">Analyze</button>
    </div>
  </div>
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Your components */}
</div>
```

## VS Code Theme Variables

The setup automatically maps VS Code CSS variables to Tailwind utilities:

- `text-vscode-foreground` - Main text color
- `bg-vscode-background` - Background colors
- `border-vscode-panel-border` - Borders
- `text-vscode-button-foreground` - Button text

## DaisyUI Components Available

- Buttons (`btn`, `btn-primary`, `btn-secondary`)
- Cards (`card`, `card-body`, `card-title`)
- Modals (`modal`, `modal-open`)
- Tabs (`tabs`, `tab`, `tab-active`)
- Form controls (`input`, `select`, `textarea`)
- And much more!

## Development Workflow

1. **Make UI Changes**: Edit files in `webview-ui/src/`
2. **See Instant Updates**: Vite HMR updates without full reload
3. **Build for Production**: `npm run package` creates optimized bundles
4. **VS Code Integration**: Everything adapts to user's theme automatically