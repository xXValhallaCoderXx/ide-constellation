/**
 * Impact Overlay Adapter
 * Utilities to derive visible node sets and logging summaries from an ImpactOverlay.
 */
import { ImpactOverlay } from './overlay.types';

/**
 * Build a Set of all node ids that should remain visible given an impact overlay.
 * Includes: targetNodeId + direct dependencies + direct dependents.
 * Duplicates automatically removed by Set semantics.
 */
export function buildImpactVisibleSet(overlay: ImpactOverlay): Set<string> {
  const set = new Set<string>();
  if (!overlay) {
    return set;
  }
  set.add(overlay.targetNodeId);
  for (const d of overlay.dependencies) {
    if (d && d !== overlay.targetNodeId) {
      set.add(d);
    }
  }
  for (const d of overlay.dependents) {
    if (d && d !== overlay.targetNodeId) {
      set.add(d);
    }
  }
  return set;
}

/** Return simple counts for logging. */
export function summarizeImpact(overlay: ImpactOverlay): { deps: number; dependents: number; visible: number } {
  const visible = buildImpactVisibleSet(overlay).size;
  return { deps: overlay.dependencies.length, dependents: overlay.dependents.length, visible };
}
