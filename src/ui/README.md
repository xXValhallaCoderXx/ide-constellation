# UI Components

This directory contains all UI-related code for the Kiro Constellation extension.

## Structure

```
ui/
├── shared/
│   ├── types.ts              # Shared TypeScript types
│   └── components/           # Reusable UI components
├── sidebar/
│   ├── SidebarProvider.ts    # Sidebar webview provider
│   ├── sidebar.html          # Sidebar HTML template
│   ├── sidebar.ts            # Sidebar TypeScript logic
│   └── sidebar.css           # Sidebar styles
└── webview/
    ├── WebviewManager.ts     # Webview panel manager
    ├── webview.html          # Webview HTML template
    ├── webview.ts            # Webview TypeScript logic
    └── webview.css           # Webview styles
```

## Future Additions

When adding new UI components:

1. Create a new folder under `ui/` (e.g., `ui/settings/`, `ui/dashboard/`)
2. Use the same pattern: Provider/Manager + HTML + TS + CSS
3. Share common types in `ui/shared/types.ts`
4. Create reusable components in `ui/shared/components/`
