// Centralized extension runtime configuration
// Only add flags here when there is a clearly productized behavior toggle.
// Avoid speculative flags (FR5 / scope discipline) – keeps CONFIG lean and auditable.
// USE_STANDARD_PROVIDER_POC: true only in development to surface experimental MCP flows.
// In production (NODE_ENV=production) POC logs should be suppressed by callers guarding on this flag.
export const CONFIG = {
  USE_STANDARD_PROVIDER_POC: process.env.NODE_ENV === "development",
  // Timeout (ms) for MCP server operations – safe to adjust if server latency characteristics change.
  MCP_SERVER_TIMEOUT: 30_000,
  // Visual instruction payload size ceiling (bytes) – mirrors webview manager guard.
  VISUAL_INSTRUCTION_SIZE_LIMIT: 1_048_576,
} as const;

export type ExtensionConfig = typeof CONFIG;
