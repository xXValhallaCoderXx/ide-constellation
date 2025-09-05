export const ROUTE = {
    SIDEBAR: {
        HOME: 'home',
        GRAPH: 'graph',
        HEALTH: 'health',
        ACTIONS: 'actions',
    },
    PANEL: {
        DEPENDENCY_GRAPH: 'dependencyGraph',
        HEALTH_DASHBOARD: 'healthDashboard',
    },
} as const;

// Ergonomic aliases (kept in sync with ROUTE)
export const SIDEBAR_ROUTE_KEYS = ROUTE.SIDEBAR;
export const PANEL_KEYS = ROUTE.PANEL;

// Derived literal unions
export type SidebarRouteKey = typeof ROUTE.SIDEBAR[keyof typeof ROUTE.SIDEBAR];
export type PanelKey = typeof ROUTE.PANEL[keyof typeof ROUTE.PANEL];

// Add typed origins for consistent logging/context
/**
 * Standardized origin identifiers for panel opens / actions.
 * Pattern: <namespace>:<action>
 * Namespaces in use:
 *  - sidebar (user clicking in sidebar UI)
 *  - mcp (Machine Control Protocol automated actions)
 *  - command (invoked via VS Code command palette)
 *  - system (internal automated flows / fallbacks)
 */
export const ORIGIN = {
    SIDEBAR: {
        HOME: 'sidebar:home',
        GRAPH: 'sidebar:graph',
        HEALTH: 'sidebar:health',
        ACTIONS: 'sidebar:actions',
    },
    MCP: {
        VISUAL_INSTRUCTION: 'mcp:visualInstruction',
        TRIGGER: 'mcp:trigger',
        SET_FOCUS: 'mcp:setFocus',
        IMPACT_ANALYSIS: 'mcp:impactAnalysis', // referenced in docs / comments
    },
    COMMAND: {
        OPEN_GRAPH: 'command:openGraph',
        OPEN_HEALTH: 'command:openHealth',
    },
    SYSTEM: {
        FALLBACK: 'system:fallback',
    }
} as const;

export type SidebarOrigin = typeof ORIGIN.SIDEBAR[keyof typeof ORIGIN.SIDEBAR];
export type McpOrigin = typeof ORIGIN.MCP[keyof typeof ORIGIN.MCP];
export type CommandOrigin = typeof ORIGIN.COMMAND[keyof typeof ORIGIN.COMMAND];
export type SystemOrigin = typeof ORIGIN.SYSTEM[keyof typeof ORIGIN.SYSTEM];
export type AnyOrigin = SidebarOrigin | McpOrigin | CommandOrigin | SystemOrigin | string; // open to future custom origins

// Typed sidebar → extension messages
export type PanelOpenMessage = {
    command: 'panel:open';
    data: {
        panel: PanelKey;
        origin?: SidebarOrigin; // e.g., 'sidebar:home'
    };
};

export type RouteNavigateMessage = {
    command: 'route:navigate';
    data: {
        route: SidebarRouteKey;
    };
};

export type ProjectScanMessage = {
    command: 'project:scan';
    data?: {
        origin?: SidebarOrigin;
    };
};

export type SidebarOutboundMessage =
    | PanelOpenMessage
    | RouteNavigateMessage
    | ProjectScanMessage;

// Narrow type guards
export function isPanelOpenMessage(msg: any): msg is PanelOpenMessage {
    return (
        !!msg &&
        msg.command === 'panel:open' &&
        !!msg.data &&
        typeof msg.data.panel === 'string'
    );
}

export function isRouteNavigateMessage(msg: any): msg is RouteNavigateMessage {
    return (
        !!msg &&
        msg.command === 'route:navigate' &&
        !!msg.data &&
        typeof msg.data.route === 'string'
    );
}

export function isProjectScanMessage(msg: any): msg is ProjectScanMessage {
    return !!msg && msg.command === 'project:scan';
}
