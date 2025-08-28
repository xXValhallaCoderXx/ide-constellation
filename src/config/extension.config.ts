// Centralized extension runtime configuration
// Values derived from environment where appropriate
export const CONFIG = {
  USE_STANDARD_PROVIDER_POC: process.env.NODE_ENV === 'development',
  MCP_SERVER_TIMEOUT: 30_000,
  VISUAL_INSTRUCTION_SIZE_LIMIT: 1_048_576
} as const;

export type ExtensionConfig = typeof CONFIG;
