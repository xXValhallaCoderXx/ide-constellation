import * as fs from 'fs';
import * as path from 'path';
import { BridgeMessage, BridgeTransport } from '../../../types/bridge.types';

/**
 * File system fallback transport.
 * Writes each outgoing message as JSON line to messages.log and watches incoming.log for new lines.
 * Simplicity > performance (only used when IPC fails).
 */
export class FileBridgeTransport implements BridgeTransport {
  public readonly name = 'file';
  private dir: string;
  private outFile: string;
  private inFile: string;
  private watcher: fs.FSWatcher | null = null;
  private onMessageCb: ((msg: BridgeMessage) => void) | null = null;
  private healthy = false;
  private output?: { appendLine(msg: string): void };

  constructor(dir: string, output?: { appendLine(msg: string): void }) {
    this.dir = dir;
    this.outFile = path.join(dir, 'bridge-out.log');
    this.inFile = path.join(dir, 'bridge-in.log');
    this.output = output;
  }

  private log(msg: string) { this.output?.appendLine(`[Bridge][File] ${msg}`); }

  async start(): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.inFile)) fs.writeFileSync(this.inFile, '');
    if (!fs.existsSync(this.outFile)) fs.writeFileSync(this.outFile, '');
    let lastSize = fs.statSync(this.inFile).size;
    this.watcher = fs.watch(this.inFile, () => {
      try {
        const stat = fs.statSync(this.inFile);
        if (stat.size > lastSize) {
          const fd = fs.openSync(this.inFile, 'r');
          const buf = Buffer.alloc(stat.size - lastSize);
            fs.readSync(fd, buf, 0, buf.length, lastSize);
            fs.closeSync(fd);
          lastSize = stat.size;
          const chunk = buf.toString('utf8');
          const lines = chunk.split(/\n/).filter(Boolean);
          for (const line of lines) {
            try { const obj = JSON.parse(line); this.onMessageCb?.(obj); } catch {/* ignore */}
          }
        }
      } catch {/* ignore */}
    });
    this.healthy = true;
    this.log('Started');
  }

  async stop(): Promise<void> {
    if (this.watcher) { this.watcher.close(); this.watcher = null; }
    this.healthy = false;
  }

  async send(message: BridgeMessage): Promise<void> {
    fs.appendFileSync(this.outFile, JSON.stringify(message) + '\n');
  }

  onMessage(cb: (msg: BridgeMessage) => void): void { this.onMessageCb = cb; }
  isHealthy(): boolean { return this.healthy; }
}
