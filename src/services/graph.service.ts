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
        // Resolve target path within workspace bounds
        const resolvedTargetPath = path.resolve(workspaceRoot, scanPath);
        if (!resolvedTargetPath.startsWith(workspaceRoot)) {
          reject(new Error('Target path must be within workspace bounds'));
          return;
        }

        // Resolve worker path - handle both extension context and standalone modes
        let workerPath: string = '';
        
        if (extensionContext && extensionContext.extensionUri) {
          // Extension mode - use vscode.Uri API for robust path resolution
          const vscode = require('vscode');
          const workerUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'dist/workers/scanWorker.mjs');
          workerPath = workerUri.fsPath;
          console.log(`[GraphService] Using extension context worker path: ${workerPath}`);
        } else {
          // Standalone mode - resolve relative to the MCP server location, not current working directory
          const fs = require('fs');
          
          // Get the directory where the MCP server script is located
          // In standalone mode, we need to find the worker relative to where the server was started from
          let serverDir = __dirname;
          
          // If we're in the compiled bundle, __dirname might be the bundle location
          // Try to find the actual project root by looking for package.json or dist directory
          let projectRoot = serverDir;
          while (projectRoot !== path.dirname(projectRoot)) {
            if (fs.existsSync(path.join(projectRoot, 'package.json')) || 
                fs.existsSync(path.join(projectRoot, 'dist'))) {
              break;
            }
            projectRoot = path.dirname(projectRoot);
          }
          
          // Try multiple possible paths for the worker file, prioritizing paths relative to the project root
          const possiblePaths = [
            // First try relative to the detected project root
            path.resolve(projectRoot, 'dist/workers/scanWorker.mjs'),          // Most likely location
            path.resolve(projectRoot, 'out/workers/scanWorker.mjs'),           // Alternative build location
            
            // Try relative to the current file location (compiled bundle location)
            path.resolve(serverDir, '../dist/workers/scanWorker.mjs'),         // Up one level then down to dist/workers
            path.resolve(serverDir, '../../dist/workers/scanWorker.mjs'),      // Up two levels then down to dist/workers
            path.resolve(serverDir, '../workers/scanWorker.mjs'),              // Relative to current file (if workers are in same dir)
            
            // Fallback to current working directory (less reliable when called from different locations)
            path.resolve(process.cwd(), 'dist/workers/scanWorker.mjs'),        // From current working directory
            path.resolve(process.cwd(), 'out/workers/scanWorker.mjs'),         // Alternative build location from cwd
          ];
          
          let found = false;
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              workerPath = possiblePath;
              found = true;
              console.log(`[GraphService] Found worker at: ${workerPath}`);
              break;
            }
          }
          
          if (!found) {
            reject(new Error(`Worker file not found. Tried paths: ${possiblePaths.join(', ')}`));
            return;
          }
        }
        
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