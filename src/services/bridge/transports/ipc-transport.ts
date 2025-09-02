import * as net from 'net';
import * as fs from 'fs';
import { BridgeMessage, BridgeTransport } from '../../../types/bridge.types';

/**
 * IPC Socket transport (primary)
 * Simple JSON line protocol. First message from client must be auth:{token}.
 */
export class IpcBridgeTransport implements BridgeTransport {
  public readonly name = 'ipc';
  private server: net.Server | null = null;
  private socketPath: string;
  private authToken: string;
  private onMessageCb: ((msg: BridgeMessage) => void) | null = null;
  private healthy = false;
  private clients = new Set<net.Socket>();
  private output?: { appendLine(msg: string): void };

  constructor(socketPath: string, authToken: string, output?: { appendLine(msg: string): void }) {
    this.socketPath = socketPath;
    this.authToken = authToken;
    this.output = output;
  }

  private log(msg: string) { this.output?.appendLine(`[Bridge][IPC] ${msg}`); }

  async start(): Promise<void> {
    if (this.server) { return; }
    await new Promise<void>((resolve, reject) => {
      // Clean stale socket path if exists
      try {
        if (fs.existsSync(this.socketPath)) {
          fs.unlinkSync(this.socketPath);
        }
      } catch {/* ignore */}
      this.server = net.createServer(socket => this.handleSocket(socket));
      this.server.once('error', (err: any) => { this.log(`Server error: ${err.message}`); this.healthy = false; reject(err); });
      this.server.listen(this.socketPath, () => {
        this.healthy = true;
        this.log(`Listening on ${this.socketPath}`);
        resolve();
      });
    });
  }

  private handleSocket(socket: net.Socket) {
    this.log('Client connected');
    let authed = false;
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const obj = JSON.parse(line);
          if (!authed) {
            if (obj?.type === 'auth' && obj?.token === this.authToken) {
              authed = true;
              this.clients.add(socket);
              this.log('Client authenticated');
            } else {
              this.log('Client failed authentication');
              socket.destroy();
            }
            continue;
          }
          if (this.onMessageCb) { this.onMessageCb(obj as BridgeMessage); }
        } catch (e: any) {
          this.log(`Parse error: ${e.message}`);
        }
      }
    });
    socket.on('close', () => { this.clients.delete(socket); this.log('Client disconnected'); });
    socket.on('error', (err) => { this.log(`Socket error: ${err.message}`); });
  }

  async stop(): Promise<void> {
    for (const c of this.clients) { try { c.destroy(); } catch { /* ignore */ } }
    this.clients.clear();
    if (this.server) {
      await new Promise<void>(resolve => this.server?.close(() => resolve()));
      this.server = null;
      this.log('Stopped');
    }
    this.healthy = false;
  }

  async send(message: BridgeMessage): Promise<void> {
    const line = JSON.stringify(message) + '\n';
    for (const c of this.clients) {
      try { c.write(line); } catch { /* ignore */ }
    }
  }

  onMessage(cb: (msg: BridgeMessage) => void): void { this.onMessageCb = cb; }
  isHealthy(): boolean { return this.healthy; }
}
