/**
 * Extension Bridge Types
 * Generic bidirectional communication channel between MCP server and extension.
 * Provides flexible message envelope supporting any payload type with priority & TTL.
 */

export type BridgePriority = 'low' | 'normal' | 'high';

export interface BridgeMessageMetadata {
  correlationId?: string;
  timestamp?: number; // epoch ms
  priority?: BridgePriority;
  ttl?: number; // ms time-to-live from timestamp
}

export interface BridgeMessage {
  type: string; // routing key e.g. 'ui:showPanel'
  payload: any; // arbitrary JSON-serialisable payload
  metadata?: BridgeMessageMetadata;
}

export interface BridgeEnvelope<TData = any> {
  dataForAI: TData;
  bridgeMessage?: BridgeMessage;
}

export interface BridgeHandlerContext {
  /** Acknowledge processing complete (reserved for future reliability features) */
  ack: () => void;
  /** Reject processing (reserved) */
  nack: (reason?: string) => void;
}

export type BridgeHandler = (msg: BridgeMessage, ctx: BridgeHandlerContext) => Promise<void> | void;

export interface BridgeTransport {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: BridgeMessage): Promise<void>;
  onMessage(cb: (msg: BridgeMessage) => void): void;
  isHealthy(): boolean;
}

export interface BridgeInitOptions {
  socketPath: string;
  fileBridgeDir: string;
  authToken: string;
  output?: { appendLine(msg: string): void };
}

export interface BridgeDiagnostics {
  activeTransport: string;
  transports: Record<string, { healthy: boolean; failures: number }>;
  queued: number;
}

// Message type constants (initial catalog)
export const BRIDGE_MESSAGE_TYPES = {
  UI_SHOW_PANEL: 'ui:showPanel',
  UI_APPLY_OVERLAY: 'ui:applyOverlay',
  STATUS_UPDATE: 'status:update',
  PROGRESS_REPORT: 'progress:report',
  ERROR_REPORT: 'error:report',
  STATE_SYNC: 'state:sync',
  COMMAND_EXECUTE: 'command:execute',
  DATA_STORE: 'data:store',
  DATA_RETRIEVE: 'data:retrieve'
} as const;

export type BridgeMessageType = typeof BRIDGE_MESSAGE_TYPES[keyof typeof BRIDGE_MESSAGE_TYPES] | `custom:${string}`;
