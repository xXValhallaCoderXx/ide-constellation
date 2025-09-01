/**
 * Ping Tool (POC) – builds a dual-purpose text response that embeds a visual instruction
 * using an HTML comment marker. The visible text is AI-friendly, the embedded JSON is
 * machine-parseable by the extension.
 */

/**
 * Build the ping response text with embedded visual instruction.
 * @returns AI-visible text plus an embedded visual instruction marker
 */
export async function buildPingResponseText(): Promise<string> {
  const timestamp = new Date().toISOString();

  const mockVisualInstruction = {
    action: "applyTraceAnimation",
    correlationId: `ping-poc-${Date.now()}`,
    payload: {
      startNode: "src/extension.ts",
      tracePath: [
        "src/extension.ts",
        "src/services/graph.service.ts",
        "src/services/graph-transformer.service.ts",
      ],
      animationConfig: {
        duration: 500,
        stepDelay: 200,
        pulseColor: "#00ff00",
        pulseScale: 1.5,
      },
      narration: [
        "Starting from extension.ts...",
        "Loading graph service...",
        "Transforming dependency data...",
      ],
    },
    ts: Date.now(),
  } as const;

  const aiResponse = `🏓 Pong! Server is alive at ${timestamp}`;
  const embeddedInstruction = `\n\n<!--VISUAL_INSTRUCTION:${JSON.stringify(
    mockVisualInstruction
  )}-->`;

  return aiResponse + embeddedInstruction;
}
