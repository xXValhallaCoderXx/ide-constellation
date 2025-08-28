/**
 * Performance utilities for graph rendering and heatmap operations
 */

/**
 * Batch processor for handling large operations in chunks
 */
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private processingDelay: number;

  constructor(batchSize: number = 50, processingDelay: number = 16) {
    this.batchSize = batchSize;
    this.processingDelay = processingDelay;
  }

  /**
   * Add items to the processing queue
   */
  add(items: T[]): void {
    this.queue.push(...items);
    if (!this.processing) {
      this.startProcessing();
    }
  }

  /**
   * Process items in batches using requestAnimationFrame
   */
  private startProcessing(): void {
    this.processing = true;
    this.processBatch();
  }

  private processBatch(): void {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    const batch = this.queue.splice(0, this.batchSize);
    
    // Process current batch
    this.processBatchItems(batch);

    // Schedule next batch
    requestAnimationFrame(() => {
      setTimeout(() => this.processBatch(), this.processingDelay);
    });
  }

  /**
   * Override this method to define batch processing logic
   */
  protected processBatchItems(batch: T[]): void {
    // Default implementation - override in subclass
    console.warn('BatchProcessor: processBatchItems not implemented');
  }

  /**
   * Clear the processing queue
   */
  clear(): void {
    this.queue = [];
    this.processing = false;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

/**
 * Memory-efficient cache with size limits and LRU eviction
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private accessOrder = new Map<K, number>();
  private accessCounter = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Update access order
      this.accessOrder.set(key, ++this.accessCounter);
    }
    return value;
  }

  set(key: K, value: V): void {
    // If at capacity, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, value);
    this.accessOrder.set(key, ++this.accessCounter);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    this.accessOrder.delete(key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    return this.cache.size;
  }

  private evictLRU(): void {
    let lruKey: K | undefined;
    let lruAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < lruAccess) {
        lruAccess = access;
        lruKey = key;
      }
    }

    if (lruKey !== undefined) {
      this.delete(lruKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

/**
 * Viewport culling utility for large graphs
 */
export interface ViewportBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  zoom: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Check if a node is within the viewport bounds with margin
 */
export function isNodeInViewport(
  position: NodePosition, 
  viewport: ViewportBounds, 
  margin: number = 100
): boolean {
  return (
    position.x >= viewport.x1 - margin &&
    position.x <= viewport.x2 + margin &&
    position.y >= viewport.y1 - margin &&
    position.y <= viewport.y2 + margin
  );
}

/**
 * Partition nodes into visible and hidden based on viewport
 */
export function partitionNodesByViewport<T extends { position: NodePosition }>(
  nodes: T[],
  viewport: ViewportBounds,
  margin: number = 100
): { visible: T[]; hidden: T[] } {
  const visible: T[] = [];
  const hidden: T[] = [];

  for (const node of nodes) {
    if (isNodeInViewport(node.position, viewport, margin)) {
      visible.push(node);
    } else {
      hidden.push(node);
    }
  }

  return { visible, hidden };
}

/**
 * Performance monitor for tracking render times and memory usage
 */
export class PerformanceMonitor {
  private metrics = {
    renderTimes: [] as number[],
    memoryUsage: [] as number[],
    lastRenderTime: 0,
    averageRenderTime: 0,
    renderCount: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity
  };

  private maxHistorySize = 100;

  /**
   * Start timing a render operation
   */
  startRender(): number {
    return performance.now();
  }

  /**
   * End timing a render operation and record metrics
   */
  endRender(startTime: number): number {
    const renderTime = performance.now() - startTime;
    this.recordRenderTime(renderTime);
    return renderTime;
  }

  private recordRenderTime(renderTime: number): void {
    this.metrics.renderTimes.push(renderTime);
    if (this.metrics.renderTimes.length > this.maxHistorySize) {
      this.metrics.renderTimes.shift();
    }

    this.metrics.lastRenderTime = renderTime;
    this.metrics.renderCount++;
    this.metrics.maxRenderTime = Math.max(this.metrics.maxRenderTime, renderTime);
    this.metrics.minRenderTime = Math.min(this.metrics.minRenderTime, renderTime);
    
    // Calculate rolling average
    const recentTimes = this.metrics.renderTimes.slice(-20); // Last 20 renders
    this.metrics.averageRenderTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;

    // Record memory usage if available
    if ((performance as any).memory) {
      const memUsage = (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
      this.metrics.memoryUsage.push(memUsage);
      if (this.metrics.memoryUsage.length > this.maxHistorySize) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  /**
   * Get current performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      currentMemoryMB: (performance as any).memory ? 
        (performance as any).memory.usedJSHeapSize / 1024 / 1024 : undefined
    };
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    return this.metrics.averageRenderTime > 100 || this.metrics.lastRenderTime > 500;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      renderTimes: [],
      memoryUsage: [],
      lastRenderTime: 0,
      averageRenderTime: 0,
      renderCount: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity
    };
  }
}

/**
 * Throttle function calls to improve performance
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle: boolean;
  let lastResult: any;

  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      lastResult = func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
    return lastResult;
  };

  (throttled as any).cancel = () => {
    inThrottle = false;
  };

  return throttled as T & { cancel: () => void };
}

/**
 * Enhanced debounce with immediate execution option
 */
export function enhancedDebounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  immediate: boolean = false
): T & { cancel: () => void; flush: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  let args: Parameters<T> | null = null;

  const debounced = (...newArgs: Parameters<T>) => {
    args = newArgs;
    
    if (timeout) {
      clearTimeout(timeout);
    }

    if (immediate && !timeout) {
      func.apply(null, args);
    }

    timeout = setTimeout(() => {
      timeout = null;
      if (!immediate && args) {
        func.apply(null, args);
      }
    }, delay);
  };

  (debounced as any).cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    args = null;
  };

  (debounced as any).flush = () => {
    if (timeout && args) {
      clearTimeout(timeout);
      func.apply(null, args);
      timeout = null;
      args = null;
    }
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}