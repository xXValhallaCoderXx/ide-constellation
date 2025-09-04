import { HeatmapOverlay } from './overlay.types';

/**
 * Decorate node view models (currently loosely typed as any) with heatmap metadata.
 * This is a minimal placeholder; real integration will map onto existing GraphCanvas
 * node styling logic during later tasks.
 */
export function decorateHeatmap(nodes: any[], overlay: HeatmapOverlay): any[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!overlay || overlay.values.length === 0) {
    return nodes;
  }
  const scoreLookup = new Map<string, { color: string; score: number }>();
  for (const v of overlay.values) {
    if (!scoreLookup.has(v.nodeId)) {
      // Preserve first occurrence order semantics (no sorting) – Task 2.3
      scoreLookup.set(v.nodeId, { color: v.color || '#999999', score: v.score }); // fallback color – Task 2.4
    }
  }
  return nodes.map(n => {
    const meta = scoreLookup.get(n.id);
    if (!meta) {
      return n;
    }
    return { ...n, heatmap: { color: meta.color, score: meta.score } };
  });
}
