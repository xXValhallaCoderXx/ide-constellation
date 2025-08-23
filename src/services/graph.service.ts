import { IConstellationGraph } from '../types/graph.types';
import { GraphCache } from './graph-cache.service';
import { GraphTransformer } from './graph-transformer.service';
import { Worker } from 'worker_threads';
import { ScanWorkerData, ScanWorkerMessage } from '../types/scanner.types';
import * as path from 'path';

/**
 * Singleton service for managing graph data and providing reverse-dependency indexing
 */
export class GraphService {
  private static instance: GraphService | null = null;
  private graph: IConstellationGraph | null = null;
  private reverseDependencyIndex: Map<string, string[]> = new Map();

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GraphService {
    if (!GraphService.instance) {
      GraphService.instance = new GraphService();
    }
    return GraphService.instance;
  }

  /**
   * Load graph and build reverse-dependency index
   * Always calls clear() first to ensure clean state
   */
  async loadGraph(workspaceRoot: string, scanPath: string = '.', extensionContext?: any): Promise<IConstellationGraph> {
    // Clear existing state for clean operation
    this.clear();

    console.log(`[GraphService] Loading graph for workspace: ${workspaceRoot}, scanPath: ${scanPath}`);

    try {
      // First, try to load from cache
      const cachedGraph = await GraphCache.load(workspaceRoot);
      
      if (cachedGraph) {
        console.log('[GraphService] Using cached graph data');
        this.graph = cachedGraph;
        this.buildReverseDependencyIndex();
        return this.graph;
      }

      // Cache miss - perform new scan
      console.log('[GraphService] Cache miss, performing new scan');
      const rawScanData = await this.performScan(workspaceRoot, scanPath, extensionContext);
      
      // Transform raw data to graph model
      const transformedGraph = GraphTransformer.transform(rawScanData, workspaceRoot, scanPath);
      
      // Save to cache for future use
      await GraphCache.save(transformedGraph, workspaceRoot);
      
      // Store in memory and build index
      this.graph = transformedGraph;
      this.buildReverseDependencyIndex();
      
      console.log(`[GraphService] Graph loaded with ${this.graph.nodes.length} nodes and ${this.graph.edges.length} edges`);
      return this.graph;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[GraphService] Failed to load graph: ${errorMessage}`);
      throw new Error(`Graph loading failed: ${errorMessage}`);
    }
  }

  /**
   * Get dependents of a file (O(1) lookup)
   */
  getDependentsOf(fileId: string): string[] {
    return this.reverseDependencyIndex.get(fileId) || [];
  }

  /**
   * Get current graph
   */
  getGraph(): IConstellationGraph | null {
    return this.graph;
  }

  /**
   * Build reverse-dependency index from graph
   */
  private buildReverseDependencyIndex(): void {
    if (!this.graph) {
      console.warn('[GraphService] Cannot build index - no graph data available');
      return;
    }

    console.log('[GraphService] Building reverse-dependency index');
    this.reverseDependencyIndex.clear();

    // Build index from edges: target -> [sources]
    for (const edge of this.graph.edges) {
      const existingDependents = this.reverseDependencyIndex.get(edge.target) || [];
      
      // Avoid duplicates
      if (!existingDependents.includes(edge.source)) {
        existingDependents.push(edge.source);
        this.reverseDependencyIndex.set(edge.target, existingDependents);
      }
    }

    console.log(`[GraphService] Built reverse-dependency index with ${this.reverseDependencyIndex.size} entries`);
  }

  /**
   * Clear cached data
   */
  clear(): void {
    console.log('[GraphService] Clearing graph data and index');
    this.graph = null;
    this.reverseDependencyIndex.clear();
  }

  /**
   * Perform dependency scan using worker thread
   */
  private async performScan(workspaceRoot: string, scanPath: string, extensionContext?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!extensionContext) {
          reject(new Error('Extension context required for worker path resolution'));
          return;
        }

        // Resolve target path within workspace bounds
        const resolvedTargetPath = path.resolve(workspaceRoot, scanPath);
        if (!resolvedTargetPath.startsWith(workspaceRoot)) {
          reject(new Error('Target path must be within workspace bounds'));
          return;
        }

        // Use vscode.Uri API for robust worker path resolution
        const vscode = require('vscode');
        const workerUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'dist/workers/scanWorker.mjs');
        const workerPath = workerUri.fsPath;
        
        console.log(`[GraphService] Starting scan worker: ${workerPath}`);
        console.log(`[GraphService] Target path: ${resolvedTargetPath}`);

        const worker = new Worker(workerPath, {
          workerData: {
            targetPath: resolvedTargetPath,
            workspaceRoot
          } as ScanWorkerData
        });

        worker.on('message', (message: ScanWorkerMessage) => {
          this.handleWorkerMessage(message, resolve, reject, worker);
        });

        worker.on('error', (error) => {
          console.error('[GraphService] Worker error:', error.message);
          worker.terminate().catch(() => {/* noop */});
          reject(new Error(`Worker thread error: ${error.message}`));
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[GraphService] Scan setup error:', errorMessage);
        reject(new Error(`Failed to setup scan: ${errorMessage}`));
      }
    });
  }

  /**
   * Handle worker thread messages
   */
  private handleWorkerMessage(
    message: ScanWorkerMessage,
    resolve: Function,
    reject: Function,
    worker: Worker
  ): void {
    const { type, data } = message;

    switch (type) {
      case 'status':
        console.log(`[GraphService] Scan ${data.status} at ${data.timestamp}`);
        break;

      case 'result':
        console.log(`[GraphService] Scan completed at ${data.timestamp}`);
        worker.terminate().catch(() => {/* noop */});
        resolve(data.result);
        break;

      case 'error':
        console.error(`[GraphService] Scan error: ${data.error} at ${data.timestamp}`);
        worker.terminate().catch(() => {/* noop */});
        reject(new Error(data.error));
        break;
    }
  }
}