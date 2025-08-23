import { 
  IConstellationGraph, 
  ISummaryResponse, 
  ISummaryMetrics, 
  ISummaryInsights, 
  ISummaryMetadata,
  ITopHub 
} from '../types/graph.types';

/**
 * Service for generating intelligent summaries of codebase graphs with architectural insights
 */
export class SummaryGenerator {
  /**
   * Generate comprehensive summary with metrics, insights, and narrative
   */
  static generate(
    graph: IConstellationGraph, 
    scanDurationMs: number, 
    cacheUsed: boolean
  ): ISummaryResponse {
    // Performance monitoring
    const startTime = Date.now();
    
    // Validate input graph size and apply limits if necessary
    const processedGraph = this.validateAndLimitGraph(graph);
    
    // Calculate basic metrics
    const metrics = this.calculateMetrics(processedGraph);
    
    // Analyze architecture for insights with timeout protection
    const insights = this.analyzeArchitectureWithTimeout(processedGraph);
    
    // Generate human-readable narrative
    const summary = this.generateNarrativeSummary(processedGraph, metrics, insights);
    
    // Prepare metadata
    const processingTime = Date.now() - startTime;
    const metadata: ISummaryMetadata = {
      scanDurationMs,
      cacheUsed
    };

    console.log(`[SummaryGenerator] Processing completed in ${processingTime}ms`);

    return {
      summary,
      metrics,
      insights,
      metadata
    };
  }

  /**
   * Validate graph size and apply limits for performance
   */
  private static validateAndLimitGraph(graph: IConstellationGraph): IConstellationGraph {
    const MAX_NODES = 10000;
    const MAX_EDGES = 50000;
    
    if (graph.nodes.length > MAX_NODES) {
      console.warn(`[SummaryGenerator] Large graph detected (${graph.nodes.length} nodes), limiting to ${MAX_NODES} for performance`);
      return {
        ...graph,
        nodes: graph.nodes.slice(0, MAX_NODES),
        edges: graph.edges.filter(edge => 
          graph.nodes.slice(0, MAX_NODES).some(n => n.id === edge.source) &&
          graph.nodes.slice(0, MAX_NODES).some(n => n.id === edge.target)
        )
      };
    }
    
    if (graph.edges.length > MAX_EDGES) {
      console.warn(`[SummaryGenerator] Large edge count detected (${graph.edges.length} edges), limiting to ${MAX_EDGES} for performance`);
      return {
        ...graph,
        edges: graph.edges.slice(0, MAX_EDGES)
      };
    }
    
    return graph;
  }

  /**
   * Analyze architecture with timeout protection
   */
  private static analyzeArchitectureWithTimeout(graph: IConstellationGraph): ISummaryInsights {
    const TIMEOUT_MS = 30000; // 30 second timeout
    const startTime = Date.now();
    
    try {
      const topHubs = this.findTopHubs(graph);
      
      // Check timeout before expensive operations
      if (Date.now() - startTime > TIMEOUT_MS / 3) {
        console.warn('[SummaryGenerator] Timeout approaching, skipping circular dependency detection');
        return {
          topHubs,
          circularDependencies: [],
          orphanFiles: this.findOrphanFiles(graph)
        };
      }
      
      const circularDependencies = this.detectCircularDependencies(graph);
      const orphanFiles = this.findOrphanFiles(graph);

      return {
        topHubs,
        circularDependencies,
        orphanFiles
      };
    } catch (error) {
      console.error('[SummaryGenerator] Analysis error, returning partial results:', error);
      return {
        topHubs: this.findTopHubs(graph),
        circularDependencies: [],
        orphanFiles: []
      };
    }
  }

  /**
   * Calculate basic metrics about the graph structure
   */
  private static calculateMetrics(graph: IConstellationGraph): ISummaryMetrics {
    const fileCount = graph.nodes.length;
    const dependencyCount = graph.edges.length;
    const fileTypeBreakdown = this.analyzeFileTypes(graph);

    return {
      fileCount,
      dependencyCount,
      fileTypeBreakdown
    };
  }

  /**
   * Analyze file types and create breakdown by extension
   */
  private static analyzeFileTypes(graph: IConstellationGraph): Record<string, number> {
    const breakdown: Record<string, number> = {};

    for (const node of graph.nodes) {
      let extension = this.extractFileExtension(node.label);
      breakdown[extension] = (breakdown[extension] || 0) + 1;
    }

    return breakdown;
  }

  /**
   * Extract file extension from filename with proper edge case handling
   */
  private static extractFileExtension(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return 'unknown';
    }

    // Handle hidden files that start with dot (e.g., .gitignore, .env)
    if (filename.startsWith('.') && filename.indexOf('.', 1) === -1) {
      return 'dotfile';
    }

    // Find the last dot in the filename
    const lastDotIndex = filename.lastIndexOf('.');
    
    // No extension if no dot found, or dot is at the beginning, or dot is at the end
    if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
      return 'no-extension';
    }

    // Extract extension and normalize to lowercase
    const extension = filename.substring(lastDotIndex + 1).toLowerCase();
    
    // Handle compound extensions (e.g., .test.ts, .spec.js, .d.ts)
    if (extension === 'ts' || extension === 'js') {
      const secondLastDotIndex = filename.lastIndexOf('.', lastDotIndex - 1);
      if (secondLastDotIndex > 0) {
        const compoundPart = filename.substring(secondLastDotIndex + 1, lastDotIndex).toLowerCase();
        if (['test', 'spec', 'd', 'min'].includes(compoundPart)) {
          return `${compoundPart}.${extension}`;
        }
      }
    }

    return extension;
  }

  /**
   * Perform architectural analysis to generate insights
   */
  private static analyzeArchitecture(graph: IConstellationGraph): ISummaryInsights {
    const topHubs = this.findTopHubs(graph);
    const circularDependencies = this.detectCircularDependencies(graph);
    const orphanFiles = this.findOrphanFiles(graph);

    return {
      topHubs,
      circularDependencies,
      orphanFiles
    };
  }

  /**
   * Find files with the most connections (incoming + outgoing dependencies)
   */
  private static findTopHubs(graph: IConstellationGraph): ITopHub[] {
    // Count connections for each node
    const connectionCounts = new Map<string, number>();
    
    // Initialize all nodes with 0 connections
    for (const node of graph.nodes) {
      connectionCounts.set(node.id, 0);
    }

    // Count outgoing connections (source nodes)
    for (const edge of graph.edges) {
      const sourceCount = connectionCounts.get(edge.source) || 0;
      connectionCounts.set(edge.source, sourceCount + 1);
    }

    // Count incoming connections (target nodes)
    for (const edge of graph.edges) {
      const targetCount = connectionCounts.get(edge.target) || 0;
      connectionCounts.set(edge.target, targetCount + 1);
    }

    // Convert to array and sort by connection count (descending)
    const hubs: ITopHub[] = Array.from(connectionCounts.entries())
      .map(([id, connectionCount]) => ({ id, connectionCount }))
      .filter(hub => hub.connectionCount > 0) // Only include files with connections
      .sort((a, b) => b.connectionCount - a.connectionCount);

    // Return top 10 hubs (or fewer if less than 10 exist)
    return hubs.slice(0, 10);
  }

  /**
   * Detect circular dependencies in the graph using depth-first search with performance limits
   */
  private static detectCircularDependencies(graph: IConstellationGraph): string[][] {
    // Skip circular dependency detection for very large graphs to avoid performance issues
    if (graph.nodes.length > 5000) {
      console.warn('[SummaryGenerator] Skipping circular dependency detection for large graph');
      return [];
    }

    // Build adjacency list for efficient traversal
    const adjList = this.buildAdjacencyList(graph);
    
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    const MAX_CYCLES = 20; // Limit cycles to prevent excessive processing

    // Check each node for cycles with early termination
    for (const node of graph.nodes) {
      if (cycles.length >= MAX_CYCLES) {
        console.warn('[SummaryGenerator] Maximum cycle limit reached, stopping detection');
        break;
      }
      
      if (!visited.has(node.id)) {
        this.dfsDetectCycle(
          node.id, 
          adjList, 
          visited, 
          recursionStack, 
          [], 
          cycles,
          MAX_CYCLES
        );
      }
    }

    // Remove duplicate cycles and limit to reasonable number
    return this.deduplicateCycles(cycles).slice(0, 10);
  }

  /**
   * Build adjacency list representation of the graph
   */
  private static buildAdjacencyList(graph: IConstellationGraph): Map<string, string[]> {
    const adjList = new Map<string, string[]>();
    
    // Initialize all nodes
    for (const node of graph.nodes) {
      adjList.set(node.id, []);
    }

    // Add edges
    for (const edge of graph.edges) {
      const neighbors = adjList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjList.set(edge.source, neighbors);
    }

    return adjList;
  }

  /**
   * Depth-first search to detect cycles with path tracking and limits
   */
  private static dfsDetectCycle(
    nodeId: string,
    adjList: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[],
    cycles: string[][],
    maxCycles: number = 20
  ): void {
    // Early termination if we've found enough cycles
    if (cycles.length >= maxCycles) {
      return;
    }

    // Prevent stack overflow on very deep graphs
    if (path.length > 100) {
      return;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjList.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (cycles.length >= maxCycles) {
        break;
      }
      
      if (!visited.has(neighbor)) {
        this.dfsDetectCycle(neighbor, adjList, visited, recursionStack, path, cycles, maxCycles);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle - extract the cycle path
        const cycleStartIndex = path.indexOf(neighbor);
        if (cycleStartIndex >= 0) {
          const cycle = path.slice(cycleStartIndex);
          cycle.push(neighbor); // Close the cycle
          cycles.push([...cycle]);
        }
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
  }

  /**
   * Remove duplicate cycles (same nodes in different order)
   */
  private static deduplicateCycles(cycles: string[][]): string[][] {
    const uniqueCycles: string[][] = [];
    const seenCycles = new Set<string>();

    for (const cycle of cycles) {
      // Create a normalized representation of the cycle
      const sortedCycle = [...cycle].sort();
      const cycleKey = sortedCycle.join('->');
      
      if (!seenCycles.has(cycleKey)) {
        seenCycles.add(cycleKey);
        uniqueCycles.push(cycle);
      }
    }

    return uniqueCycles;
  }

  /**
   * Find files with no incoming or outgoing dependencies
   */
  private static findOrphanFiles(graph: IConstellationGraph): string[] {
    // Track all files that appear in edges (have connections)
    const connectedFiles = new Set<string>();
    
    for (const edge of graph.edges) {
      connectedFiles.add(edge.source);
      connectedFiles.add(edge.target);
    }

    // Find nodes that don't appear in any edges
    const orphanFiles: string[] = [];
    for (const node of graph.nodes) {
      if (!connectedFiles.has(node.id)) {
        orphanFiles.push(node.id);
      }
    }

    // Sort orphan files for consistent output
    return orphanFiles.sort();
  }

  /**
   * Generate human-readable narrative summary
   */
  private static generateNarrativeSummary(
    graph: IConstellationGraph, 
    metrics: ISummaryMetrics, 
    insights: ISummaryInsights
  ): string {
    const parts: string[] = [];

    // Basic analysis overview
    const duration = (graph.metadata.timestamp) ? 
      ` in ${this.formatDuration(Date.now() - new Date(graph.metadata.timestamp).getTime())}` : '';
    
    parts.push(`Analyzed ${metrics.fileCount} files and ${metrics.dependencyCount} connections${duration}.`);

    // Complexity assessment
    const complexity = this.assessComplexity(metrics.fileCount, metrics.dependencyCount);
    parts.push(`The project appears ${complexity} complex.`);

    // Top hub information
    if (insights.topHubs.length > 0) {
      const topHub = insights.topHubs[0];
      parts.push(`'${topHub.id}' acts as a central hub with ${topHub.connectionCount} connections.`);
    }

    // Circular dependency warning
    if (insights.circularDependencies.length > 0) {
      const cycleCount = insights.circularDependencies.length;
      const cycleText = cycleCount === 1 ? 'circular dependency was' : 'circular dependencies were';
      parts.push(`${cycleCount} ${cycleText} detected, which may indicate structural issues.`);
    }

    // Orphan files note
    if (insights.orphanFiles.length > 0) {
      const orphanCount = insights.orphanFiles.length;
      const orphanText = orphanCount === 1 ? 'orphan file' : 'orphan files';
      parts.push(`${orphanCount} ${orphanText} found with no dependencies.`);
    }

    // File type diversity
    const typeCount = Object.keys(metrics.fileTypeBreakdown).length;
    if (typeCount > 1) {
      const dominantType = this.findDominantFileType(metrics.fileTypeBreakdown);
      if (dominantType) {
        parts.push(`The codebase is primarily ${dominantType.type} files (${dominantType.percentage}%).`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Assess project complexity based on size and connectivity
   */
  private static assessComplexity(fileCount: number, dependencyCount: number): string {
    const avgConnections = fileCount > 0 ? dependencyCount / fileCount : 0;

    if (fileCount < 20) {return 'small and simple';}
    if (fileCount < 100 && avgConnections < 3) {return 'moderately simple';}
    if (fileCount < 100 && avgConnections < 6) {return 'moderately complex';}
    if (fileCount < 500 && avgConnections < 8) {return 'moderately complex';}
    if (avgConnections > 10) {return 'highly interconnected and complex';}
    
    return 'large and complex';
  }

  /**
   * Find the most common file type
   */
  private static findDominantFileType(breakdown: Record<string, number>): { type: string; percentage: number } | null {
    const entries = Object.entries(breakdown);
    if (entries.length === 0) {return null;}

    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    const [dominantType, count] = entries.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );

    const percentage = Math.round((count / total) * 100);
    
    // Only report if it's a significant majority (>40%)
    return percentage > 40 ? { type: dominantType, percentage } : null;
  }

  /**
   * Format duration in human-readable format
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) {return `${ms}ms`;}
    if (ms < 60000) {return `${(ms / 1000).toFixed(1)}s`;}
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }
}