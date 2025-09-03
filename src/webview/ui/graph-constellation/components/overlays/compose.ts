import { IConstellationGraph } from '@/types/graph.types';
import { OverlayState } from './overlay.state';
import { isFocusOverlay, isHeatmapOverlay, ComposedRenderModel } from './overlay.types';
import { computeFocusSubgraph } from './focus.adapter';
import { decorateHeatmap } from './heatmap.adapter';

/**
 * Pure composition function combining baseGraph + overlays into a renderable model.
 * Currently minimal for focus + heatmap support.
 */
export function composeRenderable(baseGraph: IConstellationGraph | null, overlays: OverlayState): ComposedRenderModel {
  if (!baseGraph) {
    return { nodes: [], edges: [], styles: {} };
  }

  let workingNodes = baseGraph.nodes.map(n => ({ ...n }));
  let workingEdges = baseGraph.edges.map(e => ({ ...e }));

  // Focus filtering (only one focus overlay expected by id convention)
  // Order-agnostic principle: filtering stage always occurs before decoration (Task 3.6)
  for (const ov of overlays.values()) {
    if (isFocusOverlay(ov)) {
      const sub = computeFocusSubgraph(
        baseGraph,
        ov.targetNodeId,
        ov.depth,
        { includeIncoming: ov.includeIncoming ?? true, includeOutgoing: ov.includeOutgoing ?? true }
      );
      const nodeSet = sub.nodeIds;
      workingNodes = workingNodes.filter(n => nodeSet.has(n.id));
      // Edge filter: match remaining node pairs
      workingEdges = workingEdges.filter(e => nodeSet.has(e.source) && nodeSet.has(e.target));
      break; // only need first focus overlay
    }
  }

  // Heatmap decoration (applies after filtering) – decoration stage order-insensitive for current overlay set (Task 3.6)
  for (const ov of overlays.values()) {
    if (isHeatmapOverlay(ov)) {
      workingNodes = decorateHeatmap(workingNodes, ov);
      break;
    }
  }

  // styles placeholder kept for future overlay-provided style layers (Task 3.7)
  return { nodes: workingNodes, edges: workingEdges, styles: {} };
}

// TODO(Task 3.8): Add deterministic fixture-based tests validating combined focus + heatmap output.
