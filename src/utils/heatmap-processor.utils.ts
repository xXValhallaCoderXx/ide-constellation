/**
 * Optimized heatmap processing utilities for large graphs
 */

import { BatchProcessor, LRUCache, PerformanceMonitor, partitionNodesByViewport, ViewportBounds } from './performance.utils';
import { HeatmapNode } from '../webview/ui/graph-constellation/components/GraphCanvas';

export interface HeatmapProcessingOptions {
  batchSize?: number;
  animationDuration?: number;
  animationEasing?: string;
  enableViewportCulling?: boolean;
  viewportMargin?: number;
  maxCacheSize?: number;
  enablePerformanceMonitoring?: boolean;
}

export interface ProcessedHeatmapNode extends HeatmapNode {
  position: { x: number; y: number };
  isVisible: boolean;
  priority: number; // 0 = highest priority (visible), 1 = lower priority (hidden)
}

export interface HeatmapProcessingResult {
  processedNodes: ProcessedHeatmapNode[];
  visibleCount: number;
  hiddenCount: number;
  estimatedRenderTime: number;
  cacheHitRate: number;
}

/**
 * Optimized heatmap processor with batching, caching, and viewport culling
 */
export class OptimizedHeatmapProcessor extends BatchProcessor<ProcessedHeatmapNode> {
  private cy: cytoscape.Core | null = null;
  private styleCache = new LRUCache<string, any>(1000);
  private performanceMonitor = new PerformanceMonitor();
  private options: Required<HeatmapProcessingOptions>;
  private onBatchComplete?: (batch: ProcessedHeatmapNode[]) => void;
  private onProcessingComplete?: (result: HeatmapProcessingResult) => void;
  
  private processingStats = {
    totalNodes: 0,
    processedNodes: 0,
    visibleNodes: 0,
    hiddenNodes: 0,
    cacheHits: 0,
    cacheMisses: 0
  };

  constructor(
    cytoscapeInstance: cytoscape.Core,
    options: HeatmapProcessingOptions = {}
  ) {
    const defaultOptions: Required<HeatmapProcessingOptions> = {
      batchSize: 50,
      animationDuration: 300,
      animationEasing: 'ease-out',
      enableViewportCulling: true,
      viewportMargin: 100,
      maxCacheSize: 1000,
      enablePerformanceMonitoring: true
    };

    super(options.batchSize || defaultOptions.batchSize, 16); // 60 FPS = 16ms per frame
    
    this.cy = cytoscapeInstance;
    this.options = { ...defaultOptions, ...options };
    
    // Initialize cache with new size limit
    this.styleCache = new LRUCache<string, any>(this.options.maxCacheSize);
  }

  /**
   * Process heatmap data with optimizations
   */
  async processHeatmapData(heatmapNodes: HeatmapNode[]): Promise<HeatmapProcessingResult> {
    if (!this.cy || !heatmapNodes.length) {
      return {
        processedNodes: [],
        visibleCount: 0,
        hiddenCount: 0,
        estimatedRenderTime: 0,
        cacheHitRate: 0
      };
    }

    const startTime = this.performanceMonitor.startRender();
    
    // Reset processing stats
    this.processingStats = {
      totalNodes: heatmapNodes.length,
      processedNodes: 0,
      visibleNodes: 0,
      hiddenNodes: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Get current viewport for culling
    const viewport = this.options.enableViewportCulling ? this.getCurrentViewport() : null;
    
    // Process and prioritize nodes
    const processedNodes = await this.preprocessNodes(heatmapNodes, viewport);
    
    // Sort by priority (visible nodes first)
    processedNodes.sort((a, b) => a.priority - b.priority);
    
    // Add to batch processor
    this.add(processedNodes);
    
    const renderTime = this.performanceMonitor.endRender(startTime);
    const cacheHitRate = this.processingStats.totalNodes > 0 ? 
      this.processingStats.cacheHits / this.processingStats.totalNodes : 0;

    const result: HeatmapProcessingResult = {
      processedNodes,
      visibleCount: this.processingStats.visibleNodes,
      hiddenCount: this.processingStats.hiddenNodes,
      estimatedRenderTime: renderTime,
      cacheHitRate
    };

    // Notify completion
    if (this.onProcessingComplete) {
      this.onProcessingComplete(result);
    }

    return result;
  }

  /**
   * Preprocess nodes with viewport culling and caching
   */
  private async preprocessNodes(
    heatmapNodes: HeatmapNode[], 
    viewport: ViewportBounds | null
  ): Promise<ProcessedHeatmapNode[]> {
    const processedNodes: ProcessedHeatmapNode[] = [];

    for (const heatmapNode of heatmapNodes) {
      try {
        const node = this.cy!.getElementById(heatmapNode.nodeId);
        if (node.empty()) {
          continue;
        }

        const position = node.position();
        const isVisible = viewport ? 
          this.isNodeInViewport(position, viewport) : true;
        
        // Check cache for existing style data
        const cacheKey = `${heatmapNode.nodeId}-${heatmapNode.score}-${heatmapNode.color}`;
        let cachedStyle = this.styleCache.get(cacheKey);
        
        if (cachedStyle) {
          this.processingStats.cacheHits++;
        } else {
          this.processingStats.cacheMisses++;
          
          // Generate style data - create temporary processed node for style generation
          const tempProcessedNode: ProcessedHeatmapNode = {
            ...heatmapNode,
            position,
            isVisible,
            priority: isVisible ? 0 : 1
          };
          cachedStyle = this.generateNodeStyle(tempProcessedNode);
          this.styleCache.set(cacheKey, cachedStyle);
        }

        const processedNode: ProcessedHeatmapNode = {
          ...heatmapNode,
          position,
          isVisible,
          priority: isVisible ? 0 : 1
        };

        processedNodes.push(processedNode);
        
        if (isVisible) {
          this.processingStats.visibleNodes++;
        } else {
          this.processingStats.hiddenNodes++;
        }
        
        this.processingStats.processedNodes++;
      } catch (error) {
        console.warn(`[HeatmapProcessor] Error processing node ${heatmapNode.nodeId}:`, error);
      }
    }

    return processedNodes;
  }

  /**
   * Process batch of nodes with optimized animations
   */
  protected processBatchItems(batch: ProcessedHeatmapNode[]): void {
    if (!this.cy || this.cy.destroyed()) {
      return;
    }

    const animationPromises: Promise<void>[] = [];

    for (const processedNode of batch) {
      try {
        const node = this.cy.getElementById(processedNode.nodeId);
        if (node.empty()) {
          continue;
        }

        // Store risk data for tooltips
        node.data('riskData', processedNode);
        node.addClass('heatmap-node');

        // Generate optimized style
        const style = this.generateNodeStyle(processedNode);
        
        // Apply animation with staggered timing for smooth effect
        const animationDelay = batch.indexOf(processedNode) * 2; // 2ms stagger
        
        const animationPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            if (this.cy && !this.cy.destroyed()) {
              node.animate({
                style
              }, {
                duration: this.options.animationDuration,
                easing: this.options.animationEasing as any, // Cytoscape easing type
                complete: () => resolve()
              });
            } else {
              resolve();
            }
          }, animationDelay);
        });

        animationPromises.push(animationPromise);
      } catch (error) {
        console.warn(`[HeatmapProcessor] Error applying style to node ${processedNode.nodeId}:`, error);
      }
    }

    // Notify batch completion
    if (this.onBatchComplete) {
      this.onBatchComplete(batch);
    }

    // Log performance for large batches
    if (batch.length > 20 && this.options.enablePerformanceMonitoring) {
      console.log(`[HeatmapProcessor] Processed batch of ${batch.length} nodes`);
    }
  }

  /**
   * Generate optimized node style based on risk data
   */
  private generateNodeStyle(node: ProcessedHeatmapNode): any {
    const score = Math.max(0, Math.min(1, node.score || 0));
    const borderWidth = Math.max(2, Math.round(score * 4)); // 2-4px based on risk
    const zIndex = Math.round(score * 10) + 5; // Higher risk nodes on top

    return {
      'background-color': node.color,
      'border-color': node.color,
      'border-width': borderWidth,
      'z-index': zIndex
    };
  }

  /**
   * Get current viewport bounds
   */
  private getCurrentViewport(): ViewportBounds | null {
    if (!this.cy) {
      return null;
    }

    try {
      const extent = this.cy.extent();
      return {
        x1: extent.x1,
        y1: extent.y1,
        x2: extent.x2,
        y2: extent.y2,
        zoom: this.cy.zoom()
      };
    } catch (error) {
      console.warn('[HeatmapProcessor] Error getting viewport:', error);
      return null;
    }
  }

  /**
   * Check if node is in viewport with margin
   */
  private isNodeInViewport(
    position: { x: number; y: number }, 
    viewport: ViewportBounds
  ): boolean {
    const margin = this.options.viewportMargin;
    return (
      position.x >= viewport.x1 - margin &&
      position.x <= viewport.x2 + margin &&
      position.y >= viewport.y1 - margin &&
      position.y <= viewport.y2 + margin
    );
  }

  /**
   * Clear all cached data and reset processor
   */
  clearCache(): void {
    this.styleCache.clear();
    this.performanceMonitor.reset();
    this.clear(); // Clear batch processor queue
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.processingStats,
      cacheStats: this.styleCache.getStats(),
      performanceMetrics: this.performanceMonitor.getMetrics(),
      queueSize: this.getQueueSize()
    };
  }

  /**
   * Update Cytoscape instance
   */
  updateCytoscapeInstance(cy: cytoscape.Core): void {
    this.cy = cy;
  }

  /**
   * Set batch completion callback
   */
  setBatchCompleteCallback(callback: (batch: ProcessedHeatmapNode[]) => void): void {
    this.onBatchComplete = callback;
  }

  /**
   * Set processing completion callback
   */
  setProcessingCompleteCallback(callback: (result: HeatmapProcessingResult) => void): void {
    this.onProcessingComplete = callback;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.clear();
    this.styleCache.clear();
    this.performanceMonitor.reset();
    this.cy = null;
  }
}

/**
 * Factory function to create optimized heatmap processor
 */
export function createOptimizedHeatmapProcessor(
  cytoscapeInstance: cytoscape.Core,
  options?: HeatmapProcessingOptions
): OptimizedHeatmapProcessor {
  return new OptimizedHeatmapProcessor(cytoscapeInstance, options);
}