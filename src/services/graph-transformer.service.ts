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
    if (!module || !module.source || typeof module.source !== 'string') {
      return null;
    }

    try {
      const id = this.normalizeId(module.source, workspaceRoot);
      const absolutePath = path.isAbsolute(module.source) ? 
        module.source : 
        path.resolve(workspaceRoot, module.source);
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
    } catch (error) {
      console.warn(`[GraphTransformer] Failed to create node for module ${module.source}:`, error);
      return null;
    }
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

    try {
      const sourceId = this.normalizeId(module.source, workspaceRoot);
      const edges: IConstellationEdge[] = [];

      for (const dependency of module.dependencies) {
        if (dependency && dependency.resolved && typeof dependency.resolved === 'string') {
          try {
            // Skip external package dependencies
            if (this.isExternalPackage(dependency.resolved)) {
              continue;
            }

            const targetId = this.normalizeId(dependency.resolved, workspaceRoot);
            edges.push({
              source: sourceId,
              target: targetId
            });
          } catch (error) {
            console.warn(`[GraphTransformer] Failed to create edge for dependency ${dependency.resolved}:`, error);
            // Continue processing other dependencies
          }
        }
      }

      return edges;
    } catch (error) {
      console.warn(`[GraphTransformer] Failed to create edges for module ${module.source}:`, error);
      return [];
    }
  }

  /**
   * Normalize file path to workspace-relative ID with security validation
   */
  private static normalizeId(filePath: string, workspaceRoot: string): string {
    if (!filePath || !workspaceRoot) {
      throw new Error('Invalid file path or workspace root provided to normalizeId');
    }

    try {
      // Resolve to absolute path first
      const absolutePath = path.isAbsolute(filePath) ? 
        path.resolve(filePath) : 
        path.resolve(workspaceRoot, filePath);
      
      // Security check: ensure the resolved path is within workspace bounds
      const normalizedWorkspaceRoot = path.resolve(workspaceRoot);
      const relativePath = path.relative(normalizedWorkspaceRoot, absolutePath);
      
      // Check for path traversal attempts
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        console.warn(`[GraphTransformer] Path outside workspace bounds: ${filePath} -> ${absolutePath}`);
        // For security, use the original filePath as-is rather than the resolved path
        return filePath.replace(/\\/g, '/');
      }
      
      // Normalize path separators to forward slashes for consistency across platforms
      return relativePath.replace(/\\/g, '/');
    } catch (error) {
      console.warn(`[GraphTransformer] Error normalizing path ${filePath}:`, error);
      // Fallback: return the original path with normalized separators
      return filePath.replace(/\\/g, '/');
    }
  }

  /**
   * Check if a module path represents an external npm package
   */
  private static isExternalPackage(modulePath: string): boolean {
    if (!modulePath) {
      return false;
    }

    // Check if it contains node_modules in the path (definitely external)
    if (modulePath.includes('node_modules')) {
      return true;
    }

    // Check if it's an absolute path (local file on any platform)
    if (path.isAbsolute(modulePath)) {
      return false;
    }

    // Check if it starts with relative path indicators (local file)
    if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
      return false;
    }

    // Check if it has a file extension (likely a local file)
    if (/\.(js|jsx|ts|tsx|mjs|cjs|css|json)$/i.test(modulePath)) {
      return false;
    }

    // Check for "bare" specifiers (npm package names)
    // These are module names that don't start with ./ ../ or / and have no extension
    // Examples: 'react', 'vite', '@vitejs/plugin-react', 'vitest'
    // This regex matches bare specifiers: starts with letter/@ and contains only valid npm name chars
    if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i.test(modulePath)) {
      return true;
    }

    // Default to false for safety - include unknown patterns rather than exclude them
    return false;
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