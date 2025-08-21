import express from 'express';
import { Server } from 'http';

export interface ServerStatus {
  status: "ok" | "error" | "unknown";
  timestamp: string;
  port?: number;
  error?: string;
}

export class MCPServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number = 31337;
  private isServerRunning: boolean = false;
  private fallbackPorts: number[] = [31337, 31338, 31339, 31340, 31341];

  constructor() {
    this.app = express();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  private setupRoutes(): void {
    // Status endpoint
    this.app.get('/status', (req, res) => {
      try {
        const response: ServerStatus = {
          status: "ok",
          timestamp: new Date().toISOString(),
          port: this.port
        };
        res.json(response);
      } catch (error) {
        console.error('Error in /status endpoint:', error);
        res.status(500).json({
          status: "error",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ healthy: true, timestamp: new Date().toISOString() });
    });
  }

  async start(port: number = 31337): Promise<void> {
    if (this.isServerRunning) {
      console.log('MCP Server is already running');
      return;
    }

    // Try the requested port first, then fallback ports
    const portsToTry = port === 31337 ? this.fallbackPorts : [port, ...this.fallbackPorts];
    
    for (const tryPort of portsToTry) {
      try {
        await this.tryStartOnPort(tryPort);
        return;
      } catch (error: any) {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${tryPort} is in use, trying next port...`);
          continue;
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Failed to start server on any of the attempted ports: ${portsToTry.join(', ')}`);
  }

  private async tryStartOnPort(port: number): Promise<void> {
    this.port = port;

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, '127.0.0.1', () => {
          this.isServerRunning = true;
          console.log(`MCP Server started on port ${port}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          console.error(`MCP Server error on port ${port}:`, error);
          this.isServerRunning = false;
          reject(error);
        });
      } catch (error) {
        console.error(`Failed to start MCP Server on port ${port}:`, error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    if (!this.server || !this.isServerRunning) {
      console.log('MCP Server is not running');
      return;
    }

    return new Promise((resolve) => {
      // Set a timeout for graceful shutdown
      const shutdownTimeout = setTimeout(() => {
        console.log('Forcing MCP Server shutdown after timeout');
        if (this.server) {
          this.server.closeAllConnections?.();
          this.server.close();
        }
        this.cleanup();
        resolve();
      }, 5000);

      this.server!.close(() => {
        clearTimeout(shutdownTimeout);
        console.log('MCP Server stopped gracefully');
        this.cleanup();
        resolve();
      });
    });
  }

  private cleanup(): void {
    this.isServerRunning = false;
    this.server = null;
  }

  private setupGracefulShutdown(): void {
    // Handle process termination signals
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down MCP Server gracefully...`);
        try {
          await this.stop();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      try {
        await this.stop();
      } catch (stopError) {
        console.error('Error stopping server after uncaught exception:', stopError);
      }
      process.exit(1);
    });
  }

  isRunning(): boolean {
    return this.isServerRunning;
  }

  getPort(): number {
    return this.port;
  }

  async getStatus(): Promise<ServerStatus> {
    if (!this.isRunning()) {
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: "Server is not running"
      };
    }

    try {
      // Make a request to our own status endpoint to verify it's working
      const response = await fetch(`http://127.0.0.1:${this.port}/status`);
      if (response.ok) {
        return await response.json();
      } else {
        return {
          status: "error",
          timestamp: new Date().toISOString(),
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Utility method to check if a port is available
  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = require('net').createServer();
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
      server.on('error', () => resolve(false));
    });
  }

  // Get the next available port from fallback list
  async getAvailablePort(): Promise<number> {
    for (const port of this.fallbackPorts) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error('No available ports found in fallback list');
  }
}