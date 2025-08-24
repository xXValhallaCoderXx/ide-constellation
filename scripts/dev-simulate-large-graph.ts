/**
 * Developer utility: Simulate loading a large graph into GraphService to test
 * large dataset warning logic (Tasks 7.3 / 7.4). Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/dev-simulate-large-graph.ts
 * This bypasses the worker scan and directly injects a fabricated graph.
 */
import { GraphService } from '../src/services/graph.service';

(async () => {
  const graphService = GraphService.getInstance();
  // @ts-ignore accessing private for test injection
  graphService.clear();
  const NODE_COUNT = 5500; // exceed threshold 5000
  const nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
    id: `src/fake/file_${i}.ts`,
    path: `/abs/path/src/fake/file_${i}.ts`,
    label: `file_${i}.ts`
  }));
  const edges = [] as any[];
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    if (i % 3 === 0) {
      edges.push({ source: nodes[i].id, target: nodes[i + 1].id });
    }
  }
  const graph = {
    nodes,
    edges,
    metadata: { timestamp: new Date().toISOString(), workspaceRoot: process.cwd(), scanPath: '.' }
  };
  // Inject directly
  // @ts-ignore private field injection for dev test only
  graphService.graph = graph;
  console.log(`[dev-simulate-large-graph] Injected graph with ${graph.nodes.length} nodes, ${graph.edges.length} edges.`);
})();
