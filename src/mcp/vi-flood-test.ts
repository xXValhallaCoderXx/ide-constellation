// Dev utility: Flood test visualInstruction debounce (Task 12.x)
import { KiroConstellationMCPProvider } from './mcp.provider';
import * as vscode from 'vscode';

// Minimal mocks for context/output
const fakeOut = { appendLine: (l: string) => console.log(l) } as unknown as vscode.OutputChannel;
const fakeCtx = { extensionPath: process.cwd() } as unknown as vscode.ExtensionContext;

const provider = new KiroConstellationMCPProvider(fakeCtx, fakeOut);

function dual(action: string) {
  return JSON.stringify({ dataForAI: { info: action }, visualInstruction: { action, payload: { n: action }, ts: Date.now() } });
}

async function run() {
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    provider.handleToolResult(dual('testAction' + i));
  }
  setTimeout(() => {
    console.log('[FLOOD TEST] Elapsed ms=', Date.now() - start);
  }, 200);
}
run();
