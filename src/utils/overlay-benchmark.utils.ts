/**
 * Overlay Composition Benchmark Utility
 * Tasks: 10.2 (sub-30ms typical for ~2K nodes) & 10.3 (GC release guidance)
 *
 * This utility can be invoked manually from a dev console (Node / extension host)
 * to measure average composeRenderable execution time with focus + heatmap overlays.
 *
 * NOTE: No test harness added per user instruction (manual only).
 */
import { generateTestGraph } from './graph-test.utils';
import { createOverlayState, applyOverlay, clearOverlay } from '@/webview/ui/graph-constellation/components/overlays/overlay.state';
import { createOverlay, FocusOverlay, HeatmapOverlay, HeatmapValue } from '@/webview/ui/graph-constellation/components/overlays/overlay.types';
import { composeRenderable } from '@/webview/ui/graph-constellation/components/overlays/compose';

interface BenchmarkResult {
  nodeCount: number;
  edgeCount: number;
  focusDepth: number;
  heatmapValues: number;
  iterations: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export function runOverlayCompositionBenchmark(options: { nodeCount?: number; iterations?: number; focusDepth?: number } = {}): BenchmarkResult {
  const nodeCount = options.nodeCount ?? 2000; // Target size per Task 10.2
  const iterations = options.iterations ?? 25;
  const focusDepth = options.focusDepth ?? 2;
  const graph = generateTestGraph(nodeCount);

  // Prepare overlays
  let state = createOverlayState();
  const centerNode = graph.nodes[Math.floor(graph.nodes.length / 2)].id;
  const focusOv: FocusOverlay = createOverlay({
    id: 'focus',
    kind: 'focus',
    targetNodeId: centerNode,
    depth: focusDepth,
    includeIncoming: true,
    includeOutgoing: true
  }) as FocusOverlay;
  state = applyOverlay(state, focusOv);

  const heatmapValues: HeatmapValue[] = graph.nodes.slice(0, Math.min(1000, graph.nodes.length)).map(n => ({
    nodeId: n.id,
    score: Math.random(),
    color: '#ff8800'
  }));
  const heatmapOv: HeatmapOverlay = createOverlay({
    id: 'heatmap',
    kind: 'heatmap',
    values: heatmapValues,
    distribution: undefined,
    totalFiles: graph.nodes.length
  }) as HeatmapOverlay;
  state = applyOverlay(state, heatmapOv);

  // Warm-up
  composeRenderable(graph, state);

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    composeRenderable(graph, state);
    const dt = performance.now() - t0;
    samples.push(dt);
  }

  samples.sort((a, b) => a - b);
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  const p95 = samples[Math.floor(samples.length * 0.95)] ?? samples[samples.length - 1];
  const max = samples[samples.length - 1];

  // Basic GC release guidance (Task 10.3): clear overlays so large arrays can be collected
  state = clearOverlay(state, 'heatmap');
  state = clearOverlay(state, 'focus');
  // At this point, dev can capture heap snapshot via Performance tools.

  const result: BenchmarkResult = {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    focusDepth,
    heatmapValues: heatmapValues.length,
    iterations,
    avgMs: Number(avg.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    maxMs: Number(max.toFixed(2))
  };

  console.log('[OverlayBenchmark]', result);
  return result;
}

// Convenience auto-run if executed directly (e.g. ts-node / compiled script)
if (typeof process !== 'undefined' && process.env && process.env.OVERLAY_BENCHMARK === '1') {
  runOverlayCompositionBenchmark();
}

/**
 * Manual Usage:
 * import { runOverlayCompositionBenchmark } from '@/utils/overlay-benchmark.utils';
 * runOverlayCompositionBenchmark({ nodeCount: 2000, iterations: 30 });
 * Expect avgMs < 30ms (Task 10.2 acceptance). Capture heap snapshot before & after clearing overlays for Task 10.3.
 */
