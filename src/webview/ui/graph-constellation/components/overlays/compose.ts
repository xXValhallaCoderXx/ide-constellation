import { IConstellationGraph } from '@/types/graph.types';
import { OverlayState } from './overlay.state';
import { isFocusOverlay, isHeatmapOverlay, ComposedRenderModel } from './overlay.types';
import { computeFocusSubgraph } from './focus.adapter';
import { decorateHeatmap } from './heatmap.adapter';

/**
 * Compose an immutable base graph with active overlays into a render model.
 * Deterministic: given identical baseGraph + overlay map state, returns identical
 * structure (Task 13.3 requirement). No side effects or logging inside.
 * Future (Task 11.3): overlay priority layering can be introduced without
 * violating existing order-agnostic assumptions for focus->decorate phases.
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
// NOTE(Task 11.3): Future priority layering or overlay precedence could be implemented by
// introducing an ordered category list here without altering individual overlay adapters.
