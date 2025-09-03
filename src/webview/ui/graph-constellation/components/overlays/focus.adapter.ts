import { IConstellationGraph } from '@/types/graph.types';
import { FocusOverlay } from './overlay.types';

export interface FocusTraversalFlags {
  includeIncoming: boolean;
  includeOutgoing: boolean;
}

export interface FocusSubgraph {
  nodeIds: Set<string>;
  edgeIds: Set<string>; // Placeholder; edges currently identified by index or composite key in GraphCanvas (will adapt later)
}

/**
 * Depth-limited traversal computing reachable node set from target.
 * Currently naive (BFS) without caching – optimized variants can plug in later.
 */
export function computeFocusSubgraph(
  baseGraph: IConstellationGraph,
  targetId: string,
  depth: number,
  flags: FocusTraversalFlags
): FocusSubgraph {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (!baseGraph || !targetId || depth < 0) {
    return { nodeIds, edgeIds };
  }

  const adjacencyOut = new Map<string, string[]>();
  const adjacencyIn = new Map<string, string[]>();
  for (const e of baseGraph.edges) {
    if (!adjacencyOut.has(e.source)) {
      adjacencyOut.set(e.source, []);
    }
    adjacencyOut.get(e.source)!.push(e.target);
    if (!adjacencyIn.has(e.target)) {
      adjacencyIn.set(e.target, []);
    }
    adjacencyIn.get(e.target)!.push(e.source);
  }

  const queue: Array<{ id: string; dist: number }> = [{ id: targetId, dist: 0 }];
  nodeIds.add(targetId);

  while (queue.length) {
    const current = queue.shift()!;
    if (current.dist >= depth) {
      continue;
    }
    if (flags.includeOutgoing) {
      const outs = adjacencyOut.get(current.id) || [];
      for (const n of outs) {
        if (!nodeIds.has(n)) {
          nodeIds.add(n);
          queue.push({ id: n, dist: current.dist + 1 });
        }
      }
    }
    if (flags.includeIncoming) {
      const ins = adjacencyIn.get(current.id) || [];
      for (const n of ins) {
        if (!nodeIds.has(n)) {
          nodeIds.add(n);
          queue.push({ id: n, dist: current.dist + 1 });
        }
      }
    }
  }

  // Edge inclusion: any edge whose source & target are both in nodeIds
  baseGraph.edges.forEach((e, idx) => {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      edgeIds.add(String(idx)); // Temporary key strategy; replaced once GraphCanvas exposes stable edge IDs
    }
  });

  return { nodeIds, edgeIds };
}

/** Placeholder for future caching (Task 1.4) */
export function getCachedFocusSubgraph(_overlay: FocusOverlay): FocusSubgraph | null {
  return null; // No-op cache placeholder
}
