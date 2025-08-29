/**
 * Layout type definitions for graph visualization
 * Task 6.1: Component Integration and State Management
 */

/**
 * Supported layout algorithms for graph visualization
 */
export type LayoutType =
  | "force-directed"
  | "circle"
  | "grid"
  | "hierarchical"
  | "concentric";

/**
 * Layout configuration interface for Cytoscape.js
 */
export interface LayoutConfig {
  /** Cytoscape.js layout name */
  name: string;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Whether to animate layout changes */
  animate?: boolean;
  /** Additional layout-specific options */
  options?: Record<string, any>;
  /** Performance optimization settings */
  performance?: {
    /** Maximum nodes before applying optimizations */
    maxNodes?: number;
    /** Whether to enable batch operations */
    enableBatching?: boolean;
    /** Reduce animation quality for performance */
    reduceAnimations?: boolean;
  };
}

/**
 * Layout state management interface
 */
export interface LayoutState {
  /** Currently active layout type */
  currentLayout: LayoutType;
  /** Whether a layout change is in progress */
  isChanging: boolean;
  /** Timestamp of last layout change */
  lastChanged?: string;
  /** Layout change history for session */
  history?: LayoutType[];
  /** Performance metrics for layout operations */
  performanceMetrics?: {
    /** Last layout change duration in ms */
    lastChangeDuration?: number;
    /** Average layout change duration */
    averageDuration?: number;
    /** Total layout changes in session */
    totalChanges?: number;
  };
}

/**
 * Layout option for UI display
 */
export interface LayoutOption {
  id: LayoutType;
  name: string;
  description: string;
  cytoscapeLayout: string;
  /** Whether this layout is recommended for current graph size */
  recommended?: boolean;
  /** Performance considerations for this layout */
  performance?: "fast" | "medium" | "slow";
}

/**
 * Default layout configuration mapping
 */
export const DEFAULT_LAYOUT_CONFIGS: Record<LayoutType, LayoutConfig> = {
  "force-directed": {
    name: "cose",
    animationDuration: 1000,
    animate: true,
    options: {
      nodeRepulsion: 4000,
      idealEdgeLength: 100,
      nestingFactor: 1.2,
    },
    performance: {
      maxNodes: 500,
      enableBatching: true,
      reduceAnimations: false,
    },
  },
  circle: {
    name: "circle",
    animationDuration: 800,
    animate: true,
    options: {
      spacing: 40,
    },
    performance: {
      maxNodes: 1000,
      enableBatching: true,
      reduceAnimations: false,
    },
  },
  grid: {
    name: "grid",
    animationDuration: 600,
    animate: true,
    options: {
      spacing: 80,
      rows: undefined, // Auto-calculate
    },
    performance: {
      maxNodes: 1000,
      enableBatching: true,
      reduceAnimations: false,
    },
  },
  hierarchical: {
    name: "breadthfirst",
    animationDuration: 1200,
    animate: true,
    options: {
      directed: true,
      spacingFactor: 1.5,
    },
    performance: {
      maxNodes: 300,
      enableBatching: true,
      reduceAnimations: true,
    },
  },
  concentric: {
    name: "concentric",
    animationDuration: 1000,
    animate: true,
    options: {
      concentric: (node: any) => node.degree(),
      levelWidth: () => 2,
    },
    performance: {
      maxNodes: 400,
      enableBatching: true,
      reduceAnimations: false,
    },
  },
};

/**
 * Session storage key for layout persistence
 */
export const LAYOUT_STORAGE_KEY = "constellation-graph-layout";

/**
 * Default layout type for new sessions
 */
export const DEFAULT_LAYOUT_TYPE: LayoutType = "force-directed";
