/**
 * Layout utility functions for Cytoscape graph layouts
 * Task 3.3: Layout configuration utilities with manual layout selection
 */

import { LAYOUT_ANIMATION_MS } from '@/constants/sync.constants';

export interface LayoutConfig {
  name: string;
  animate: boolean;
  animationDuration: number;
  fit: boolean;
  padding?: number;
  spacingFactor?: number;
  avoidOverlap?: boolean;
  idealEdgeLength?: number;
  nodeOverlap?: number;
  refresh?: number;
  randomize?: boolean;
  componentSpacing?: number;
  nodeRepulsion?: number;
  nodeSpacing?: number;
  edgeElasticity?: number;
  nestingFactor?: number;
  gravity?: number;
  numIter?: number;
  initialTemp?: number;
  coolingFactor?: number;
  minTemp?: number;
  useMultitasking?: boolean;
  // Grid specific
  rows?: number;
  cols?: number;
  // Breadthfirst specific
  directed?: boolean;
  roots?: string[];
  // Circle specific
  radius?: number;
  // Concentric specific
  concentric?: (node: any) => number;
  levelWidth?: (nodes: any[]) => number;
  minNodeSpacing?: number;
  startAngle?: number;
  sweep?: number;
  clockwise?: boolean;
}

/**
 * Get optimized layout configuration for different layout types
 * Includes performance optimizations based on graph size
 */
export function getLayoutConfig(
  layoutType: string, 
  nodeCount: number = 0,
  customOptions: Partial<LayoutConfig> = {}
): LayoutConfig {
  const baseConfig: LayoutConfig = {
    name: layoutType,
    animate: true,
    animationDuration: LAYOUT_ANIMATION_MS,
    fit: true,
    padding: 30,
    ...customOptions
  };

  // Performance optimizations for large graphs
  const isLargeGraph = nodeCount > 500;
  const isVeryLargeGraph = nodeCount > 1000;

  switch (layoutType) {
    case 'cose': // Force-directed
      return {
        ...baseConfig,
        name: 'cose',
        idealEdgeLength: isLargeGraph ? 50 : 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: isLargeGraph ? 60 : 80,
        nodeRepulsion: isLargeGraph ? 400000 : 2048,
        nodeSpacing: isLargeGraph ? 5 : 10,
        edgeElasticity: isLargeGraph ? 100 : 200,
        nestingFactor: 5,
        gravity: isLargeGraph ? 80 : 250,
        numIter: isVeryLargeGraph ? 500 : isLargeGraph ? 750 : 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
        useMultitasking: true
      };

    case 'circle':
      return {
        ...baseConfig,
        name: 'circle',
        fit: true,
        padding: 50,
        spacingFactor: isLargeGraph ? 1.2 : 1.75,
        avoidOverlap: true,
        radius: isLargeGraph ? Math.min(300, nodeCount * 0.5) : undefined
      };

    case 'grid':
      return {
        ...baseConfig,
        name: 'grid',
        fit: true,
        padding: 30,
        spacingFactor: isLargeGraph ? 1.1 : 1.5,
        avoidOverlap: true,
        // Calculate optimal grid dimensions
        rows: nodeCount > 0 ? Math.ceil(Math.sqrt(nodeCount)) : undefined,
        cols: nodeCount > 0 ? Math.ceil(Math.sqrt(nodeCount)) : undefined
      };

    case 'breadthfirst': // Hierarchical tree
      return {
        ...baseConfig,
        name: 'breadthfirst',
        fit: true,
        directed: false,
        padding: 50,
        spacingFactor: isLargeGraph ? 1.2 : 1.75,
        avoidOverlap: true,
        // For large graphs, we might want to specify roots
        roots: nodeCount > 100 ? undefined : []
      };

    case 'concentric':
      return {
        ...baseConfig,
        name: 'concentric',
        fit: true,
        padding: 50,
        spacingFactor: isLargeGraph ? 1.1 : 1.5,
        avoidOverlap: true,
        minNodeSpacing: isLargeGraph ? 20 : 30,
        startAngle: 0,
        sweep: 2 * Math.PI,
        clockwise: true,
        // Define concentric levels based on node degree
        concentric: (node: any) => {
          return node.degree() || 1;
        },
        levelWidth: (nodes: any[]) => {
          return Math.max(1, Math.ceil(nodes.length / 4));
        }
      };

    default:
      console.warn(`Unknown layout type: ${layoutType}, falling back to cose`);
      return getLayoutConfig('cose', nodeCount, customOptions);
  }
}

/**
 * Get the default layout configuration based on graph size
 * Automatically selects the best layout for performance and readability
 */
export function getDefaultLayoutConfig(nodeCount: number): LayoutConfig {
  if (nodeCount < 20) {
    return getLayoutConfig('circle', nodeCount);
  } else if (nodeCount < 100) {
    return getLayoutConfig('cose', nodeCount);
  } else if (nodeCount < 500) {
    return getLayoutConfig('cose', nodeCount);
  } else {
    // For very large graphs, use a simpler layout
    return getLayoutConfig('grid', nodeCount);
  }
}

/**
 * Validate layout configuration for common issues
 */
export function validateLayoutConfig(config: LayoutConfig): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for required properties
  if (!config.name) {
    errors.push('Layout name is required');
  }

  // Check animation duration
  if (config.animationDuration && config.animationDuration < 0) {
    errors.push('Animation duration must be positive');
  }

  if (config.animationDuration && config.animationDuration > 5000) {
    warnings.push('Animation duration over 5 seconds may impact user experience');
  }

  // Check padding
  if (config.padding && config.padding < 0) {
    errors.push('Padding must be non-negative');
  }

  // Layout-specific validations
  switch (config.name) {
    case 'grid':
      if (config.rows && config.rows < 1) {
        errors.push('Grid rows must be at least 1');
      }
      if (config.cols && config.cols < 1) {
        errors.push('Grid columns must be at least 1');
      }
      break;

    case 'cose':
      if (config.numIter && config.numIter < 1) {
        errors.push('Number of iterations must be at least 1');
      }
      if (config.nodeRepulsion && config.nodeRepulsion < 0) {
        errors.push('Node repulsion must be non-negative');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}

/**
 * Layout type mapping for external interfaces
 */
export const LAYOUT_TYPE_MAP = {
  'force-directed': 'cose',
  'circle': 'circle',
  'grid': 'grid',
  'hierarchical': 'breadthfirst',
  'concentric': 'concentric'
} as const;

/**
 * Get Cytoscape layout name from UI layout ID
 */
export function getCytoscapeLayoutName(uiLayoutId: string): string {
  return LAYOUT_TYPE_MAP[uiLayoutId as keyof typeof LAYOUT_TYPE_MAP] || 'cose';
}
