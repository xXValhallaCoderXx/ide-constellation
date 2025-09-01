import { BridgeEnvelope, BridgeHandler, BridgeInitOptions, BridgeMessage, BridgeMessageType, BridgeTransport, BRIDGE_MESSAGE_TYPES, BridgeDiagnostics } from '../../types/bridge.types';
import { IpcBridgeTransport } from './transports/ipc-transport';
import { FileBridgeTransport } from './transports/file-transport';
import * as fs from 'fs';

/**
 * BridgeService orchestrates transports, routing & reliability features.
 * Singleton – accessed via getInstance().
 */
export class BridgeService {
  private static instance: BridgeService | null = null;
  static getInstance(): BridgeService { if (!BridgeService.instance) BridgeService.instance = new BridgeService(); return BridgeService.instance; }

  private handlers = new Map<string, Set<BridgeHandler>>();
  private transports: BridgeTransport[] = [];
  private active: BridgeTransport | null = null;
  private queue: BridgeMessage[] = []; // outgoing queue (future use for reliability)
  private output?: { appendLine(msg: string): void };
  private authToken = '';
  private started = false;

  /** Initialize transports (idempotent) */
  async init(opts: BridgeInitOptions): Promise<void> {
    if (this.started) return;
    this.output = opts.output;
    this.authToken = opts.authToken;
    const ipc = new IpcBridgeTransport(opts.socketPath, opts.authToken, opts.output);
    const file = new FileBridgeTransport(opts.fileBridgeDir, opts.output);
    this.transports = [ipc, file];
    // Start primary
    try { await ipc.start(); this.active = ipc; } catch (e: any) { this.log(`IPC start failed: ${e.message}`); }
    if (!this.active) { await file.start(); this.active = file; this.log('Using file transport fallback'); }
    // Subscribe to messages from all transports
    for (const t of this.transports) { t.onMessage(msg => this.routeIncoming(msg)); }
    this.started = true;
    this.log(`Bridge initialized active=${this.active?.name}`);
  }

  /** Register a handler for a message type */
  register(type: BridgeMessageType | string, handler: BridgeHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  /** Unregister handler */
  unregister(type: string, handler: BridgeHandler): void { this.handlers.get(type)?.delete(handler); }

  /** Send a message (enqueue then attempt flush). */
  async send(message: BridgeMessage): Promise<void> {
    if (!message.metadata) message.metadata = {}; // ensure
    if (!message.metadata.timestamp) message.metadata.timestamp = Date.now();
    this.queue.push(message);
    // Simple priority ordering high -> normal -> low
    this.queue.sort((a, b) => priorityRank(b) - priorityRank(a));
    await this.flush();
  }

  /** Flush queue to active transport with TTL check */
  private async flush() {
    if (!this.active) return;
    const now = Date.now();
    const remain: BridgeMessage[] = [];
    for (const msg of this.queue) {
      const ttl = msg.metadata?.ttl;
      const ts = msg.metadata?.timestamp || now;
      if (ttl && now - ts > ttl) { this.log(`Drop expired message type=${msg.type}`); continue; }
      try { await this.active.send(msg); } catch (e: any) { this.log(`Send failed on ${this.active.name}: ${e.message}`); remain.push(msg); this.ensureFailover(); break; }
    }
    this.queue = remain;
  }

  /** Attempt transport failover */
  private ensureFailover() {
    if (!this.active || this.active.isHealthy()) return; // nothing
    for (const t of this.transports) {
      if (t.isHealthy()) { this.active = t; this.log(`Failover to ${t.name}`); this.flush(); return; }
    }
  }

  /** Incoming message dispatcher */
  private routeIncoming(msg: BridgeMessage) {
    // Validate TTL
    const now = Date.now();
    const ttl = msg.metadata?.ttl;
    const ts = msg.metadata?.timestamp || now;
    if (ttl && now - ts > ttl) { this.log(`Ignore expired inbound type=${msg.type}`); return; }
    const set = this.handlers.get(msg.type) || this.handlers.get('*');
    if (!set || set.size === 0) { this.log(`No handler for type=${msg.type}`); return; }
    for (const h of set) {
      try { Promise.resolve(h(msg, { ack: () => {}, nack: () => {} })).catch(e => this.log(`Handler error: ${e instanceof Error ? e.message : String(e)}`)); } catch (e: any) { this.log(`Handler sync error: ${e.message}`); }
    }
  }

  /** Parse BridgeEnvelope from raw text (tool response) */
  public tryParseEnvelope(text: string): BridgeEnvelope | null {
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'dataForAI') && (parsed.bridgeMessage || parsed.bridgeMessage === undefined)) {
        return parsed as BridgeEnvelope;
      }
    } catch { /* ignore */ }
    return null;
  }

  diagnostics(): BridgeDiagnostics {
    return {
      activeTransport: this.active?.name || 'none',
      transports: Object.fromEntries(this.transports.map(t => [t.name, { healthy: t.isHealthy(), failures: 0 }])),
      queued: this.queue.length
    };
  }

  private log(msg: string) { this.output?.appendLine(`[Bridge] ${msg}`); }
}

function priorityRank(msg: BridgeMessage): number {
  switch (msg.metadata?.priority) {
    case 'high': return 3;
    case 'normal': return 2;
    case 'low': return 1;
    default: return 2;
  }
}
