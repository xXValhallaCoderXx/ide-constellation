import { IConstellationGraph } from '@/types/graph.types';
import { OverlayState } from './overlay.state';
import { isFocusOverlay, isHeatmapOverlay, isImpactOverlay, ComposedRenderModel } from './overlay.types';
import { buildImpactVisibleSet } from './impact.adapter';
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

  // ---------------- Filter Phase ----------------
  // Order: Impact filtering -> Focus intersection (fallback to focus-only if empty) -> (future other filters)
  // Rationale: Impact defines blast radius; focus can further narrow or override if disjoint to avoid empty view.

  let impactSet: Set<string> | null = null;
  let focusOverlay: any | null = null; // kept for second pass, existing adapter expects full overlay

  for (const ov of overlays.values()) {
    if (isImpactOverlay(ov) && !impactSet) {
      impactSet = buildImpactVisibleSet(ov);
    } else if (isFocusOverlay(ov) && !focusOverlay) {
      focusOverlay = ov;
    }
    if (impactSet && focusOverlay) {
      break; // early exit if both discovered
    }
  }

  // Apply impact filter if present
  if (impactSet) {
    workingNodes = workingNodes.filter(n => impactSet!.has(n.id));
    workingEdges = workingEdges.filter(e => impactSet!.has(e.source) && impactSet!.has(e.target));
  }

  // Apply focus overlay (intersection with impact or standalone if disjoint)
  if (focusOverlay) {
    const sub = computeFocusSubgraph(
      baseGraph,
      focusOverlay.targetNodeId,
      focusOverlay.depth,
      { includeIncoming: focusOverlay.includeIncoming ?? true, includeOutgoing: focusOverlay.includeOutgoing ?? true }
    );
    const focusSet = sub.nodeIds;
    if (impactSet) {
      // Intersection
      const intersected: Set<string> = new Set();
      for (const id of focusSet) {
        if (impactSet.has(id)) {
          intersected.add(id);
        }
      }
      // Fallback: if intersection empty, use focus set (spec decision to prefer latest user drill-down)
      const effective = intersected.size === 0 ? focusSet : intersected;
      workingNodes = workingNodes.filter(n => effective.has(n.id));
      workingEdges = workingEdges.filter(e => effective.has(e.source) && effective.has(e.target));
    } else {
      // No impact – just apply focus filter directly
      workingNodes = workingNodes.filter(n => focusSet.has(n.id));
      workingEdges = workingEdges.filter(e => focusSet.has(e.source) && focusSet.has(e.target));
    }
  }

  // ---------------- Decoration Phase ----------------
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
