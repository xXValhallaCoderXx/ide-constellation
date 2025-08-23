# Webview UI Architecture

This directory contains all UI components and providers for the Kiro Constellation extension, organized by their purpose and scope.

## Directory Structure

```
src/webview/
├── providers/           # WebviewViewProvider implementations
│   └── sidebar.provider.ts
├── sidebar/            # Sidebar panel UI components
│   ├── components/
│   │   ├── SidebarPanel.tsx
│   │   └── ShowMapButton.tsx
│   ├── styles/
│   │   └── sidebar.css
│   └── index.tsx
├── panels/             # Full-screen webview panels
│   └── constellation/  # Main constellation panel
│       ├── components/
│       │   ├── ConstellationPanel.tsx
│       │   ├── StatusIndicator.tsx
│       │   └── ServerStatusButton.tsx
│       └── index.tsx
└── README.md
```

## Component Types

### Sidebar Components (`sidebar/`)
- **Purpose**: Small UI components that appear in the VS Code sidebar
- **Scope**: Limited space, focused actions
- **Entry Point**: `sidebar/index.tsx`
- **Build Output**: `dist/sidebar.js`

### Panel Components (`panels/`)
- **Purpose**: Full-screen webview panels for complex interfaces
- **Scope**: Full workspace area, rich interactions
- **Entry Point**: `panels/{panel-name}/index.tsx`
- **Build Output**: `dist/webview.js` (main panel)

### Providers (`providers/`)
- **Purpose**: VS Code API integration and webview management
- **Scope**: Extension host communication, webview lifecycle
- **Usage**: Imported by `src/extension.ts`

## Adding New UI Components

### New Sidebar Component
1. Create component in `sidebar/components/`
2. Add styles to `sidebar/styles/`
3. Import in `sidebar/index.tsx`

### New Full-Screen Panel
1. Create directory under `panels/{panel-name}/`
2. Add components under `panels/{panel-name}/components/`
3. Create entry point `panels/{panel-name}/index.tsx`
4. Update `esbuild.js` to build the new panel
5. Create provider in `providers/` if needed

## Build Configuration

Each UI component type has its own esbuild configuration:
- **Sidebar**: Bundles to `dist/sidebar.js`
- **Main Panel**: Bundles to `dist/webview.js`
- **Future Panels**: Will have their own bundle outputs

## Message Passing

All webview components communicate with the extension host via:
- `window.vscode.postMessage()` - Send messages to extension
- `window.addEventListener('message')` - Receive messages from extension

See `src/types/vscode-api.types.ts` for shared type definitions.