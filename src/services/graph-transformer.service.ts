import * as path from 'path';
import { IConstellationGraph, IConstellationNode, IConstellationEdge } from '../types/graph.types';

/**
 * Service for transforming raw dependency-cruiser output into clean graph domain model
 */
export class GraphTransformer {
  /**
   * Transform raw dependency-cruiser output into graph domain model
   */
  static transform(rawData: any, workspaceRoot: string, scanPath: string): IConstellationGraph {
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('Invalid dependency-cruiser output: data is null or not an object');
    }

    // dependency-cruiser output structure can vary, check for modules array
    const modules = rawData.modules || rawData.output?.modules || [];
    if (!Array.isArray(modules)) {
      throw new Error('Invalid dependency-cruiser output: missing or invalid modules array');
    }

    const nodes: IConstellationNode[] = [];
    const edges: IConstellationEdge[] = [];
    const processedNodes = new Set<string>();

    // Process each module from dependency-cruiser
    for (const module of modules) {
      try {
        // Skip external npm packages - they don't start with ./ or / and don't contain file extensions
        if (this.isExternalPackage(module.source)) {
          continue;
        }

        // Create node for this module
        const node = this.createNode(module, workspaceRoot);
        if (node && !processedNodes.has(node.id)) {
          nodes.push(node);
          processedNodes.add(node.id);
        }

        // Create edges for this module's dependencies (also filter external packages)
        const moduleEdges = this.createEdges(module, workspaceRoot);
        edges.push(...moduleEdges);
      } catch (error) {
        // Log warning but continue processing other modules
        console.warn(`Failed to process module ${module.source || 'unknown'}:`, error);
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        timestamp: new Date().toISOString(),
        workspaceRoot,
        scanPath
      }
    };
  }

  /**
   * Create a constellation node from a dependency-cruiser module
   */
  private static createNode(module: any, workspaceRoot: string): IConstellationNode | null {
    if (!module || !module.source) {
      return null;
    }

    const absolutePath = path.resolve(workspaceRoot, module.source);
    const id = this.normalizeId(module.source, workspaceRoot);
    const label = path.basename(module.source);
    const packageName = this.extractPackageName(module.source, workspaceRoot);

    const node: IConstellationNode = {
      id,
      path: absolutePath,
      label
    };

    if (packageName) {
      node.package = packageName;
    }

    return node;
  }

  /**
   * Create constellation edges from a dependency-cruiser module's dependencies
   */
  private static createEdges(module: any, workspaceRoot: string): IConstellationEdge[] {
    if (!module || !module.source || !Array.isArray(module.dependencies)) {
      return [];
    }

    // Skip if source is external package
    if (this.isExternalPackage(module.source)) {
      return [];
    }

    const sourceId = this.normalizeId(module.source, workspaceRoot);
    const edges: IConstellationEdge[] = [];

    for (const dependency of module.dependencies) {
      if (dependency && dependency.resolved) {
        // Skip external package dependencies
        if (this.isExternalPackage(dependency.resolved)) {
          continue;
        }

        const targetId = this.normalizeId(dependency.resolved, workspaceRoot);
        edges.push({
          source: sourceId,
          target: targetId
        });
      }
    }

    return edges;
  }

  /**
   * Normalize file path to workspace-relative ID
   */
  private static normalizeId(filePath: string, workspaceRoot: string): string {
    // Handle both absolute and relative paths
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
    
    // Convert to workspace-relative path
    const relativePath = path.relative(workspaceRoot, absolutePath);
    
    // Normalize path separators to forward slashes for consistency
    return relativePath.replace(/\\/g, '/');
  }

  /**
   * Check if a module path represents an external npm package
   */
  private static isExternalPackage(modulePath: string): boolean {
    if (!modulePath) {
      return false;
    }

    // External packages typically:
    // 1. Don't start with ./ or / (relative/absolute paths)
    // 2. Don't have file extensions
    // 3. Are npm package names like 'react', 'vite', '@vitejs/plugin-react'
    
    // Check if it starts with relative or absolute path indicators
    if (modulePath.startsWith('./') || modulePath.startsWith('../') || modulePath.startsWith('/')) {
      return false;
    }

    // Check if it has a file extension (local files usually do)
    if (/\.(js|jsx|ts|tsx|mjs|cjs|css|json)$/i.test(modulePath)) {
      return false;
    }

    // Check if it contains node_modules in the path
    if (modulePath.includes('node_modules')) {
      return true;
    }

    // If it doesn't start with path indicators and has no extension, it's likely an npm package
    // Examples: 'react', 'vite', '@vitejs/plugin-react', 'vitest'
    return true;
  }

  /**
   * Extract package name for monorepo structures
   */
  private static extractPackageName(filePath: string, workspaceRoot: string): string | undefined {
    try {
      const relativePath = this.normalizeId(filePath, workspaceRoot);
      
      // Common monorepo patterns
      const monorepoPatterns = [
        /^packages\/([^\/]+)\//,  // packages/package-name/
        /^apps\/([^\/]+)\//,      // apps/app-name/
        /^libs\/([^\/]+)\//,      // libs/lib-name/
        /^modules\/([^\/]+)\//,   // modules/module-name/
        /^services\/([^\/]+)\//   // services/service-name/
      ];

      for (const pattern of monorepoPatterns) {
        const match = relativePath.match(pattern);
        if (match) {
          return match[1];
        }
      }

      // Try to find package.json in parent directories to determine package name
      const pathParts = relativePath.split('/');
      for (let i = pathParts.length - 1; i > 0; i--) {
        const potentialPackageDir = pathParts.slice(0, i).join('/');
        const packageJsonPath = path.join(workspaceRoot, potentialPackageDir, 'package.json');
        
        try {
          const fs = require('fs');
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.name && typeof packageJson.name === 'string') {
              return packageJson.name;
            }
          }
        } catch (error) {
          // Continue searching if package.json is invalid or unreadable
          console.warn(`[GraphTransformer] Failed to read package.json at ${packageJsonPath}:`, error);
          continue;
        }
      }

      return undefined;
    } catch (error) {
      console.warn(`[GraphTransformer] Error extracting package name for ${filePath}:`, error);
      return undefined;
    }
  }
}