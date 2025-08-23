import * as fs from 'fs';
import * as path from 'path';
import { IConstellationGraph, ICacheValidationResult } from '../types/graph.types';

/**
 * Service for handling graph cache persistence and validation
 */
export class GraphCache {
  private static readonly CACHE_DIR = '.constellation-cache';
  private static readonly CACHE_FILE = 'graph-v1.json';
  private static readonly KEY_FILES = ['package.json', 'pnpm-lock.yaml', 'tsconfig.json'];

  /**
   * Save graph to local cache
   */
  static async save(graph: IConstellationGraph, workspaceRoot: string): Promise<void> {
    try {
      await this.ensureCacheDirectory(workspaceRoot);
      const cachePath = this.getCachePath(workspaceRoot);
      
      const cacheData = JSON.stringify(graph, null, 2);
      fs.writeFileSync(cachePath, cacheData, 'utf8');
      
      console.log(`[GraphCache] Saved graph to cache: ${cachePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[GraphCache] Failed to save cache: ${errorMessage}`);
      // Don't throw - caching is optional, continue without it
    }
  }

  /**
   * Load graph from cache if valid
   */
  static async load(workspaceRoot: string): Promise<IConstellationGraph | null> {
    try {
      const validation = await this.validateCache(workspaceRoot);
      
      if (!validation.isValid) {
        console.log(`[GraphCache] Cache invalid: ${validation.reason}`);
        return null;
      }

      const cachePath = this.getCachePath(workspaceRoot);
      const cacheData = fs.readFileSync(cachePath, 'utf8');
      const graph = JSON.parse(cacheData) as IConstellationGraph;
      
      // Validate loaded graph structure
      if (!this.isValidGraphStructure(graph)) {
        console.warn('[GraphCache] Cache file has invalid structure, ignoring');
        return null;
      }

      console.log(`[GraphCache] Loaded graph from cache: ${cachePath}`);
      return graph;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[GraphCache] Failed to load cache: ${errorMessage}`);
      
      // If cache is corrupted, try to delete it
      try {
        const cachePath = this.getCachePath(workspaceRoot);
        if (fs.existsSync(cachePath)) {
          fs.unlinkSync(cachePath);
          console.log('[GraphCache] Deleted corrupted cache file');
        }
      } catch (deleteError) {
        const deleteErrorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.warn(`[GraphCache] Failed to delete corrupted cache file: ${deleteErrorMessage}`);
        
        // Provide helpful error message for common issues
        if (deleteErrorMessage.includes('EACCES') || deleteErrorMessage.includes('EPERM')) {
          console.warn('[GraphCache] Permission denied - check file permissions for .constellation-cache directory');
        }
      }
      
      return null;
    }
  }

  /**
   * Check if cache is valid by comparing timestamps
   */
  static async validateCache(workspaceRoot: string): Promise<ICacheValidationResult> {
    const cachePath = this.getCachePath(workspaceRoot);
    
    // Check if cache file exists
    if (!fs.existsSync(cachePath)) {
      return {
        isValid: false,
        reason: 'Cache file does not exist'
      };
    }

    try {
      // Get cache file timestamp
      const cacheStats = fs.statSync(cachePath);
      const cacheTimestamp = cacheStats.mtime;

      // Get key file timestamps
      const keyFileTimestamps = await this.getKeyFileTimestamps(workspaceRoot);
      
      // Find the newest key file
      const newestKeyFileTimestamp = keyFileTimestamps.reduce((newest, current) => {
        return current > newest ? current : newest;
      }, new Date(0));

      // Cache is valid if it's newer than all key files
      if (cacheTimestamp >= newestKeyFileTimestamp) {
        return {
          isValid: true,
          cacheTimestamp,
          keyFileTimestamp: newestKeyFileTimestamp
        };
      } else {
        return {
          isValid: false,
          reason: `Cache is older than key files (cache: ${cacheTimestamp.toISOString()}, newest key file: ${newestKeyFileTimestamp.toISOString()})`,
          cacheTimestamp,
          keyFileTimestamp: newestKeyFileTimestamp
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        reason: `Error validating cache: ${errorMessage}`
      };
    }
  }

  /**
   * Get the full path to the cache file
   */
  private static getCachePath(workspaceRoot: string): string {
    return path.join(workspaceRoot, this.CACHE_DIR, this.CACHE_FILE);
  }

  /**
   * Get timestamps of key files that can invalidate the cache
   */
  private static async getKeyFileTimestamps(workspaceRoot: string): Promise<Date[]> {
    const timestamps: Date[] = [];
    
    for (const keyFile of this.KEY_FILES) {
      const keyFilePath = path.join(workspaceRoot, keyFile);
      
      try {
        if (fs.existsSync(keyFilePath)) {
          const stats = fs.statSync(keyFilePath);
          timestamps.push(stats.mtime);
        }
      } catch (error) {
        // If we can't read a key file, assume it doesn't exist
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[GraphCache] Could not read key file ${keyFile}: ${errorMessage}`);
        
        // Provide helpful context for common file system errors
        if (errorMessage.includes('EACCES')) {
          console.warn(`[GraphCache] Permission denied accessing ${keyFile} - check file permissions`);
        } else if (errorMessage.includes('ENOENT')) {
          console.log(`[GraphCache] Key file ${keyFile} does not exist (this is normal)`);
        }
      }
    }
    
    // If no key files exist, return epoch time so cache is always valid
    return timestamps.length > 0 ? timestamps : [new Date(0)];
  }

  /**
   * Ensure cache directory exists
   */
  private static async ensureCacheDirectory(workspaceRoot: string): Promise<void> {
    const cacheDir = path.join(workspaceRoot, this.CACHE_DIR);
    
    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`[GraphCache] Created cache directory: ${cacheDir}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create cache directory: ${errorMessage}`);
    }
  }

  /**
   * Validate that loaded graph has the expected structure
   */
  private static isValidGraphStructure(graph: any): graph is IConstellationGraph {
    if (!graph || typeof graph !== 'object') {
      return false;
    }

    // Check required properties
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !graph.metadata) {
      return false;
    }

    // Check metadata structure
    const metadata = graph.metadata;
    if (!metadata.timestamp || !metadata.workspaceRoot || !metadata.scanPath) {
      return false;
    }

    // Validate nodes structure (sample check)
    if (graph.nodes.length > 0) {
      const firstNode = graph.nodes[0];
      if (!firstNode.id || !firstNode.path || !firstNode.label) {
        return false;
      }
    }

    // Validate edges structure (sample check)
    if (graph.edges.length > 0) {
      const firstEdge = graph.edges[0];
      if (!firstEdge.source || !firstEdge.target) {
        return false;
      }
    }

    return true;
  }
}