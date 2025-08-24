// Lightweight CLI to execute graph scan + health analysis outside VS Code host.
// Run: npx ts-node scripts/run-health-analysis.ts (dev) or compile then node build output if configured.
// Intentionally imports source (not dist) to bypass the extension's dependency on 'vscode' APIs.

import path from 'path';
import { GraphService } from '../src/services/graph.service';
import { HealthAnalyzer } from '../src/services/health-analyzer.service';

async function main() {
  const workspaceRoot = process.cwd();
  console.log(`[health-cli] Workspace root: ${workspaceRoot}`);
  const graphService = GraphService.getInstance();
  await graphService.loadGraph(workspaceRoot, '.');
  const analyzer = HealthAnalyzer.getInstance(workspaceRoot);
  const analysis = await analyzer.analyzeCodebase();
  const { distribution, totalFiles, healthScore } = analysis;
  console.log(JSON.stringify({ distribution, totalFiles, healthScore }, null, 2));
}

main().catch(err => {
  console.error('[health-cli] Failed:', err);
  process.exit(1);
});
