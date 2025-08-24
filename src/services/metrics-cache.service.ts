import { CacheEntry, CACHE_TTL } from '../types/health-analysis.types';

/**
 * High-performance in-memory cache service for health analysis metrics
 * 
 * Provides TTL-based caching for complexity metrics, churn data, and full analysis results.
 * Optimized for fast access with automatic expiration and cleanup.
 */
export class MetricsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Start automatic cleanup every 5 minutes
    this.startCleanupInterval();
  }

  /**
   * Store data in cache with specified TTL
   * @param key Unique cache key
   * @param data Data to cache
   * @param ttlMs Time-to-live in milliseconds
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Retrieve data from cache if not expired
   * @param key Cache key to retrieve
   * @returns Cached data or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Check if cache entry exists and is not expired
   * @param key Cache key to check
   * @returns True if entry exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Remove specific entry from cache
   * @param key Cache key to remove
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics for monitoring
   * @returns Object with cache size and expired entries count
   */
  getStats(): { size: number; expiredCount: number } {
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredCount++;
      }
    }
    
    return {
      size: this.cache.size,
      expiredCount
    };
  }

  /**
   * Remove all expired entries from cache
   * @returns Number of entries removed
   */
  cleanup(): number {
    const initialSize = this.cache.size;
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    const removedCount = initialSize - this.cache.size;
    if (removedCount > 0) {
      console.log(`[MetricsCache] Cleaned up ${removedCount} expired entries`);
    }
    
    return removedCount;
  }

  /**
   * Generate cache key for complexity metrics
   * @param filePath File path to generate key for
   * @returns Cache key string
   */
  static getComplexityKey(filePath: string): string {
    return `complexity:${filePath}`;
  }

  /**
   * Generate cache key for churn metrics
   * @param filePath File path to generate key for
   * @param days Number of days for churn analysis
   * @returns Cache key string
   */
  static getChurnKey(filePath: string, days: number = 30): string {
    return `churn:${filePath}:${days}d`;
  }

  /**
   * Generate cache key for full health analysis
   * @param graphHash Hash of the graph data
   * @returns Cache key string
   */
  static getAnalysisKey(graphHash: string): string {
    return `analysis:${graphHash}`;
  }

  /**
   * Generate cache key for file metrics
   * @param nodeId Node ID from constellation graph
   * @returns Cache key string
   */
  static getFileMetricsKey(nodeId: string): string {
    return `file-metrics:${nodeId}`;
  }

  /**
   * Convenience method to cache complexity metrics with default TTL
   * @param filePath File path
   * @param data Complexity metrics data
   */
  setComplexityMetrics<T>(filePath: string, data: T): void {
    const key = MetricsCache.getComplexityKey(filePath);
    this.set(key, data, CACHE_TTL.complexity);
  }

  /**
   * Convenience method to retrieve complexity metrics
   * @param filePath File path
   * @returns Cached complexity metrics or null
   */
  getComplexityMetrics<T>(filePath: string): T | null {
    const key = MetricsCache.getComplexityKey(filePath);
    return this.get<T>(key);
  }

  /**
   * Convenience method to cache churn metrics with default TTL
   * @param filePath File path
   * @param data Churn metrics data
   * @param days Number of days for churn analysis
   */
  setChurnMetrics<T>(filePath: string, data: T, days: number = 30): void {
    const key = MetricsCache.getChurnKey(filePath, days);
    this.set(key, data, CACHE_TTL.churn);
  }

  /**
   * Convenience method to retrieve churn metrics
   * @param filePath File path
   * @param days Number of days for churn analysis
   * @returns Cached churn metrics or null
   */
  getChurnMetrics<T>(filePath: string, days: number = 30): T | null {
    const key = MetricsCache.getChurnKey(filePath, days);
    return this.get<T>(key);
  }

  /**
   * Convenience method to cache full analysis with default TTL
   * @param graphHash Hash of the graph data
   * @param data Health analysis data
   */
  setAnalysis<T>(graphHash: string, data: T): void {
    const key = MetricsCache.getAnalysisKey(graphHash);
    this.set(key, data, CACHE_TTL.analysis);
  }

  /**
   * Convenience method to retrieve full analysis
   * @param graphHash Hash of the graph data
   * @returns Cached health analysis or null
   */
  getAnalysis<T>(graphHash: string): T | null {
    const key = MetricsCache.getAnalysisKey(graphHash);
    return this.get<T>(key);
  }

  /**
   * Check if cache entry is expired
   * @param entry Cache entry to check
   * @returns True if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Stop automatic cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Cleanup resources when cache is no longer needed
   */
  dispose(): void {
    this.stopCleanupInterval();
    this.clear();
  }
}