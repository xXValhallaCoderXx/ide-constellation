import * as crypto from 'crypto';
import { IConstellationGraph, IConstellationNode } from '../types/graph.types';
import { 
  HealthAnalysis, 
  FileMetrics, 
  RiskScore, 
  RISK_WEIGHTS, 
  RISK_THRESHOLDS, 
  RISK_COLORS 
} from '../types/health-analysis.types';
import { ComplexityAnalyzer } from './complexity-analyzer.service';
import { GitAnalyzer } from './git-analyzer.service';
import { MetricsCache } from './metrics-cache.service';
import { RecommendationsEngine } from './recommendations-engine.service';
import { GraphService } from './graph.service';
import { ErrorHandler, GracefulDegradation, PerformanceMonitor } from '../utils/error-handling.utils';

/**
 * Core health analysis service that orchestrates codebase health assessment
 * 
 * Singleton service that coordinates complexity analysis, git churn analysis,
 * and risk score calculation to provide comprehensive health insights.
 * Integrates with existing GraphService infrastructure and caching patterns.
 */
export class HealthAnalyzer {
  private static instance: HealthAnalyzer | null = null;
  private complexityAnalyzer: ComplexityAnalyzer;
  private gitAnalyzer: GitAnalyzer;
  private metricsCache: MetricsCache;
  private recommendationsEngine: RecommendationsEngine;
  private workspaceRoot: string;

  private constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.metricsCache = new MetricsCache();
    this.complexityAnalyzer = new ComplexityAnalyzer(this.metricsCache);
    this.gitAnalyzer = new GitAnalyzer(this.metricsCache, workspaceRoot);
    this.recommendationsEngine = new RecommendationsEngine();
  }

  /**
   * Get singleton instance of HealthAnalyzer
   * @param workspaceRoot Workspace root path (required for first initialization)
   * @returns HealthAnalyzer instance
   */
  static getInstance(workspaceRoot?: string): HealthAnalyzer {
    if (!HealthAnalyzer.instance) {
      if (!workspaceRoot) {
        throw new Error('HealthAnalyzer requires workspaceRoot for first initialization');
      }
      HealthAnalyzer.instance = new HealthAnalyzer(workspaceRoot);
    }
    return HealthAnalyzer.instance;
  }

  /**
   * Analyze complete codebase health using constellation graph data
   * @param graph Optional constellation graph (will use GraphService if not provided)
   * @returns Promise resolving to comprehensive health analysis
   */
  async analyzeCodebase(graph?: IConstellationGraph): Promise<HealthAnalysis> {
    // Get graph from GraphService if not provided
    let targetGraph = graph;
    if (!targetGraph) {
      const graphService = GraphService.getInstance();
      const graphFromService = graphService.getGraph();
      
      if (!graphFromService) {
        throw new Error('No graph data available. Please scan the project first using GraphService.');
      }
      
      targetGraph = graphFromService;
    }

    // Validate graph data
    if (!this.isValidGraph(targetGraph)) {
      throw new Error('Invalid graph data structure. Please re-scan the project.');
    }

    const operationId = `health-analysis-${Date.now()}`;
    PerformanceMonitor.startTimer(operationId);
    
    console.log(`[HealthAnalyzer] Starting health analysis for ${targetGraph.nodes.length} files`);

    try {
      // Check system resources before starting
      const resourceCheck = GracefulDegradation.checkSystemResources();
      if (resourceCheck.suggestions.length > 0) {
        console.warn('[HealthAnalyzer] Resource warnings:', resourceCheck.suggestions);
      }

      // Check if we have cached analysis for this graph
      const graphHash = this.generateGraphHash(targetGraph);
      const cachedAnalysis = this.metricsCache.getAnalysis<HealthAnalysis>(graphHash);
      
      if (cachedAnalysis) {
        const duration = PerformanceMonitor.endTimer(operationId, 0);
        console.log(`[HealthAnalyzer] Using cached analysis (${duration}ms)`);
        return cachedAnalysis;
      }

      // Analyze all files in batches for performance
      const allMetrics = await this.analyzeAllFiles(targetGraph);
      
      // Calculate risk scores with percentile-based normalization
      const riskScores = this.calculateAllRiskScores(allMetrics);
      
      // Create comprehensive health analysis
      const analysis = this.createHealthAnalysis(riskScores);
      
      // Cache the results
      this.metricsCache.setAnalysis(graphHash, analysis);
      
      const duration = PerformanceMonitor.endTimer(operationId);
      console.log(`[HealthAnalyzer] Completed health analysis in ${duration}ms`);
      
      return analysis;
    } catch (error) {
      PerformanceMonitor.endTimer(operationId, 0);
      
      return ErrorHandler.handle<HealthAnalysis>(
        error,
        {
          service: 'HealthAnalyzer',
          operation: 'analyzeCodebase',
          additionalInfo: { fileCount: targetGraph.nodes.length }
        },
        {
          logLevel: 'error',
          includeStack: true,
          fallbackValue: GracefulDegradation.createFallbackHealthAnalysis(targetGraph.nodes.length)
        }
      );
    }
  }

  /**
   * Analyze metrics for a single file
   * @param node Constellation node representing the file
   * @param dependencyCount Number of dependencies for this file
   * @returns Promise resolving to file metrics
   */
  async analyzeFile(node: IConstellationNode, dependencyCount: number): Promise<FileMetrics> {
    try {
      // Get complexity and churn metrics in parallel
      const [complexity, churn] = await Promise.all([
        this.complexityAnalyzer.analyzeFile(node.path),
        this.gitAnalyzer.getFileChurn(node.path)
      ]);

      return {
        nodeId: node.id,
        path: node.path,
        complexity,
        churn,
        dependencies: dependencyCount
      };
    } catch (error) {
      return ErrorHandler.handle<FileMetrics>(
        error,
        {
          service: 'HealthAnalyzer',
          operation: 'analyzeFile',
          filePath: node.path,
          additionalInfo: { nodeId: node.id, dependencies: dependencyCount }
        },
        {
          logLevel: 'warn',
          fallbackValue: GracefulDegradation.createMinimalFileMetrics(node.id, node.path)
        }
      );
    }
  }

  /**
   * Analyze all files in the graph with batch processing
   * @param graph Constellation graph data
   * @returns Promise resolving to array of file metrics
   */
  private async analyzeAllFiles(graph: IConstellationGraph): Promise<FileMetrics[]> {
    let BATCH_SIZE = 50;
    let batches = this.createBatches(graph.nodes, BATCH_SIZE);
    const allMetrics: FileMetrics[] = [];

    console.log(`[HealthAnalyzer] Processing ${graph.nodes.length} files in ${batches.length} batches`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[HealthAnalyzer] Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);
      
      try {
        // Monitor memory usage
        if (i % 5 === 0) {
          PerformanceMonitor.checkMemory(`batch-${i + 1}`);
        }

        const batchMetrics = await Promise.all(
          batch.map(node => {
            const dependencyCount = this.getDependencyCount(node, graph);
            return this.analyzeFile(node, dependencyCount);
          })
        );
        
        allMetrics.push(...batchMetrics);
        
        // Allow garbage collection between batches
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      } catch (error) {
        const action = ErrorHandler.handleBatchProcessingError(error, {
          batchIndex: i,
          batchSize: BATCH_SIZE,
          totalBatches: batches.length
        });

        if (action === 'reduce_batch_size' && BATCH_SIZE > 10) {
          // Reduce batch size and recreate batches for remaining files
          BATCH_SIZE = Math.max(10, Math.floor(BATCH_SIZE / 2));
          const remainingNodes = graph.nodes.slice(i * batches[0].length);
          batches = [
            ...batches.slice(0, i),
            ...this.createBatches(remainingNodes, BATCH_SIZE)
          ];
          console.log(`[HealthAnalyzer] Reduced batch size to ${BATCH_SIZE}, continuing...`);
        } else if (action === 'abort') {
          console.error('[HealthAnalyzer] Aborting batch processing due to critical error');
          break;
        }
        // Continue with next batch for 'continue' action
      }
    }

    return allMetrics;
  }

  /**
   * Calculate risk scores for all files using percentile-based normalization
   * @param allMetrics Array of file metrics
   * @returns Array of risk scores
   */
  private calculateAllRiskScores(allMetrics: FileMetrics[]): RiskScore[] {
    console.log(`[HealthAnalyzer] Calculating risk scores for ${allMetrics.length} files`);
    
    return allMetrics.map(metrics => this.calculateRiskScore(metrics, allMetrics));
  }

  /**
   * Calculate risk score for a single file using percentile-based approach
   * @param file File metrics to score
   * @param allFiles All file metrics for percentile calculation
   * @returns Risk score with category and color
   */
  private calculateRiskScore(file: FileMetrics, allFiles: FileMetrics[]): RiskScore {
    // Extract values for percentile calculation
    const complexityValues = allFiles
      .map(f => f.complexity.cyclomaticComplexity || 0)
      .filter(v => v > 0);
    const churnValues = allFiles.map(f => f.churn.commitCount);
    const dependencyValues = allFiles.map(f => f.dependencies);

    // Calculate percentiles (0-100)
    const complexityPercentile = complexityValues.length > 0 
      ? this.getPercentile(file.complexity.cyclomaticComplexity || 0, complexityValues)
      : 0;
    const churnPercentile = this.getPercentile(file.churn.commitCount, churnValues);
    const dependencyPercentile = this.getPercentile(file.dependencies, dependencyValues);

    // Calculate weighted risk score (0-100)
    const weightedScore = 
      (complexityPercentile * RISK_WEIGHTS.complexity) +
      (churnPercentile * RISK_WEIGHTS.churn) +
      (dependencyPercentile * RISK_WEIGHTS.dependencies);

    // Determine risk category
    const category = this.getCategory(weightedScore);
    
    // Get color for visualization
    const color = this.scoreToColor(weightedScore);

    return {
      nodeId: file.nodeId,
      score: weightedScore / 100, // Normalize to 0-1
      percentile: Math.round(weightedScore),
      category,
      color,
      metrics: file
    };
  }

  /**
   * Calculate percentile rank for a value within a dataset
   * @param value Value to rank
   * @param values Array of all values
   * @returns Percentile rank (0-100)
   */
  private getPercentile(value: number, values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    
    const sortedValues = [...values].sort((a, b) => a - b);
    const index = sortedValues.findIndex(v => v >= value);
    
    if (index === -1) {
      return 100;
    }
    if (index === 0) {
      return 0;
    }
    
    return Math.round((index / sortedValues.length) * 100);
  }

  /**
   * Determine risk category based on percentile score
   * @param percentile Percentile score (0-100)
   * @returns Risk category
   */
  private getCategory(percentile: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentile >= RISK_THRESHOLDS.high) {
      return 'critical';
    }
    if (percentile >= RISK_THRESHOLDS.medium) {
      return 'high';
    }
    if (percentile >= RISK_THRESHOLDS.low) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Convert risk score to color for visualization
   * @param percentile Percentile score (0-100)
   * @returns Hex color code
   */
  private scoreToColor(percentile: number): string {
    if (percentile >= RISK_THRESHOLDS.high) {
      return RISK_COLORS.critical;
    }
    if (percentile >= RISK_THRESHOLDS.medium) {
      return RISK_COLORS.high;
    }
    if (percentile >= RISK_THRESHOLDS.low) {
      return RISK_COLORS.medium;
    }
    return RISK_COLORS.low;
  }

  /**
   * Create comprehensive health analysis from risk scores
   * @param riskScores Array of calculated risk scores
   * @returns Complete health analysis
   */
  private createHealthAnalysis(riskScores: RiskScore[]): HealthAnalysis {
    // Calculate distribution
    const distribution = {
      low: riskScores.filter(s => s.category === 'low').length,
      medium: riskScores.filter(s => s.category === 'medium').length,
      high: riskScores.filter(s => s.category === 'high').length,
      critical: riskScores.filter(s => s.category === 'critical').length
    };

    // Calculate overall health score (inverse of average risk)
    const averageRisk = riskScores.reduce((sum, s) => sum + s.score, 0) / riskScores.length;
    const healthScore = Math.round((1 - averageRisk) * 100);

    // Get top 5 highest risk files
    const topRisks = [...riskScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Generate recommendations
    const analysis: HealthAnalysis = {
      timestamp: new Date().toISOString(),
      totalFiles: riskScores.length,
      healthScore,
      riskScores,
      distribution,
      topRisks,
      recommendations: [] // Will be filled below
    };

    // Generate recommendations using the engine
    analysis.recommendations = this.recommendationsEngine.generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Get dependency count for a node from the graph
   * Uses GraphService's reverse dependency index for better performance
   * @param node Node to count dependencies for
   * @param graph Complete constellation graph
   * @returns Number of dependencies (incoming + outgoing)
   */
  private getDependencyCount(node: IConstellationNode, graph: IConstellationGraph): number {
    try {
      const graphService = GraphService.getInstance();
      
      // Use GraphService's optimized reverse dependency lookup if available
      const dependents = graphService.getDependentsOf(node.id);
      
      // Count outgoing dependencies (files this node depends on)
      const outgoingDeps = graph.edges.filter(edge => edge.source === node.id).length;
      
      // Total dependencies = incoming (dependents) + outgoing
      return dependents.length + outgoingDeps;
    } catch (error) {
      // Fallback to direct graph traversal if GraphService fails
      return graph.edges.filter(edge => 
        edge.source === node.id || edge.target === node.id
      ).length;
    }
  }

  /**
   * Create batches from array for batch processing
   * @param items Array to batch
   * @param batchSize Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate hash for graph data to use as cache key
   * @param graph Constellation graph
   * @returns Hash string
   */
  private generateGraphHash(graph: IConstellationGraph): string {
    const graphString = JSON.stringify({
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      timestamp: graph.metadata.timestamp,
      scanPath: graph.metadata.scanPath
    });
    
    return crypto.createHash('md5').update(graphString).digest('hex');
  }

  /**
   * Get cache statistics for monitoring
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; expiredCount: number } {
    return this.metricsCache.getStats();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * Validate graph data structure
   * @param graph Graph to validate
   * @returns True if graph is valid
   */
  private isValidGraph(graph: IConstellationGraph): boolean {
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

  /**
   * Get health analysis for specific files only
   * @param filePaths Array of file paths to analyze
   * @param graph Optional graph data
   * @returns Promise resolving to health analysis for specified files
   */
  async analyzeFiles(filePaths: string[], graph?: IConstellationGraph): Promise<HealthAnalysis> {
    // Get graph from GraphService if not provided
    let targetGraph = graph;
    if (!targetGraph) {
      const graphService = GraphService.getInstance();
      const graphFromService = graphService.getGraph();
      
      if (!graphFromService) {
        throw new Error('No graph data available. Please scan the project first using GraphService.');
      }
      
      targetGraph = graphFromService;
    }

    // Filter nodes to only include specified files
    const filteredNodes = targetGraph.nodes.filter(node => 
      filePaths.some(filePath => node.path.includes(filePath) || filePath.includes(node.path))
    );

    if (filteredNodes.length === 0) {
      throw new Error('No matching files found in the graph data.');
    }

    // Create filtered graph
    const filteredGraph: IConstellationGraph = {
      ...targetGraph,
      nodes: filteredNodes,
      edges: targetGraph.edges.filter(edge => 
        filteredNodes.some(node => node.id === edge.source) ||
        filteredNodes.some(node => node.id === edge.target)
      )
    };

    return this.analyzeCodebase(filteredGraph);
  }

  /**
   * Get health metrics for a single file
   * @param filePath Path to the file to analyze
   * @param graph Optional graph data
   * @returns Promise resolving to file metrics
   */
  async analyzeFileHealth(filePath: string, graph?: IConstellationGraph): Promise<FileMetrics | null> {
    // Get graph from GraphService if not provided
    let targetGraph = graph;
    if (!targetGraph) {
      const graphService = GraphService.getInstance();
      const graphFromService = graphService.getGraph();
      
      if (!graphFromService) {
        throw new Error('No graph data available. Please scan the project first using GraphService.');
      }
      
      targetGraph = graphFromService;
    }

    // Find the node for this file
    const node = targetGraph.nodes.find(n => 
      n.path === filePath || n.path.includes(filePath) || filePath.includes(n.path)
    );

    if (!node) {
      console.warn(`[HealthAnalyzer] File not found in graph: ${filePath}`);
      return null;
    }

    const dependencyCount = this.getDependencyCount(node, targetGraph);
    return this.analyzeFile(node, dependencyCount);
  }

  /**
   * Dispose of resources when analyzer is no longer needed
   */
  dispose(): void {
    this.metricsCache.dispose();
    HealthAnalyzer.instance = null;
  }
}