/**
 * Overlay domain model types for Graph Constellation (Milestone 2)
 * Focus & Heatmap overlays share a common lifecycle and are composed
 * into a derived render model without mutating the immutable base graph.
 */

export type OverlayId = 'focus' | 'heatmap' | string;

/** Base shape for all overlays */
export interface BaseOverlay {
  /** Stable overlay identifier (unique within overlay map) */
  id: OverlayId;
  /** Discriminator for overlay kind */
  kind: string;
  /** ISO timestamp when overlay was first created */
  createdAt: string;
  /** ISO timestamp when overlay was last updated */
  updatedAt: string;
  /** Optional correlation id passed through from extension layer for diagnostics */
  correlationId?: string;
}

/** Focus overlay filters nodes/edges to a depth-limited subgraph */
export interface FocusOverlay extends BaseOverlay {
  kind: 'focus';
  /** Root node id chosen by user / instruction */
  targetNodeId: string;
  /** Depth (>=0) traversal from target */
  depth: number;
  /** Include incoming edges & their sources */
  includeIncoming?: boolean;
  /** Include outgoing edges & their targets */
  includeOutgoing?: boolean;
}

export interface HeatmapValue {
  nodeId: string;
  score: number; // Raw numeric score (higher = more intense)
  color: string; // Final resolved color (no palette logic here)
  /** Optional bag of metrics used to derive score (not rendered directly) */
  metrics?: Record<string, any>;
}

/** Heatmap overlay decorates visible nodes with style intensity */
export interface HeatmapOverlay extends BaseOverlay {
  kind: 'heatmap';
  /** Ordered array of node metrics (input order preserved) */
  values: HeatmapValue[];
  /** Optional center node for radial / distance based overlays (future) */
  centerNode?: string;
  /** Optional distribution metadata (shape depends on producer) */
  distribution?: any;
}

export type OverlayData = FocusOverlay | HeatmapOverlay; // Future overlays extend this union

/** Render model returned by composition function */
export interface ComposedRenderModel {
  /** Nodes to display (possibly filtered) */
  nodes: any[]; // Using any pending existing graph canvas node shape – refined later
  /** Edges to display (subset consistent with nodes) */
  edges: any[]; // Using any until existing edge view model type extracted
  /** Optional style metadata (overlay produced) */
  styles?: Record<string, unknown>;
}

// NOTE: We intentionally keep types lightweight here to avoid premature coupling
// with GraphCanvas internal node normalization. A later milestone can formalize
// a shared view-model interface once overlay pipeline stabilizes.

/**
 * Helper to create a new overlay object with timestamps.
 * Accepts a partial overlay payload providing all non-audit fields.
 */
export function createOverlay<T extends Omit<BaseOverlay, 'createdAt' | 'updatedAt'> & { kind: string }>(
  input: T
): T & { createdAt: string; updatedAt: string } {
  const now = new Date().toISOString();
  return { ...input, createdAt: now, updatedAt: now };
}

export function isFocusOverlay(o: OverlayData): o is FocusOverlay {
  return o.kind === 'focus';
}

export function isHeatmapOverlay(o: OverlayData): o is HeatmapOverlay {
  return o.kind === 'heatmap';
}

