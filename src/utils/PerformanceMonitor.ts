/**
 * Performance monitoring utility for tracking reconciliation operations and metrics
 */
export class PerformanceMonitor {
    private static timers = new Map<string, number>();
    private static metrics = new Map<string, PerformanceMetrics>();

    /**
     * Interface for performance metrics tracking
     */
    public static readonly MetricTypes = {
        RECONCILIATION: 'reconciliation',
        BATCH_DELETE: 'batch_delete',
        BATCH_UPSERT: 'batch_upsert',
        QUERY_EXISTING: 'query_existing',
        EMBEDDING_GENERATION: 'embedding_generation',
        VECTOR_STORAGE: 'vector_storage',
        SCHEMA_MIGRATION: 'schema_migration'
    } as const;

    /**
     * Start timing an operation
     * @param operationId Unique identifier for the operation
     * @param operationType Type of operation being timed
     * @param metadata Additional metadata about the operation
     */
    public static startTimer(
        operationId: string, 
        operationType: string, 
        metadata: Record<string, any> = {}
    ): void {
        const timerKey = `${operationId}:${operationType}`;
        const startTime = Date.now();
        
        this.timers.set(timerKey, startTime);
        
        console.log(`[${operationId}] ⏱️ Started timing ${operationType}`);
        
        // Log metadata if provided
        if (Object.keys(metadata).length > 0) {
            console.log(`[${operationId}] 📊 Operation metadata:`, metadata);
        }
    }

    /**
     * Stop timing an operation and record the metrics
     * @param operationId Unique identifier for the operation
     * @param operationType Type of operation being timed
     * @param success Whether the operation was successful
     * @param additionalMetrics Additional metrics to record
     */
    public static stopTimer(
        operationId: string,
        operationType: string,
        success: boolean = true,
        additionalMetrics: Record<string, number> = {}
    ): number {
        const timerKey = `${operationId}:${operationType}`;
        const startTime = this.timers.get(timerKey);
        
        if (!startTime) {
            console.warn(`[${operationId}] ⚠️ No timer found for ${operationType}`);
            return 0;
        }
        
        const duration = Date.now() - startTime;
        this.timers.delete(timerKey);
        
        // Record metrics
        this.recordMetrics(operationType, {
            duration,
            success,
            timestamp: Date.now(),
            operationId,
            ...additionalMetrics
        });
        
        console.log(`[${operationId}] ✅ Completed ${operationType} in ${duration}ms (success: ${success})`);
        
        return duration;
    }

    /**
     * Record performance metrics for an operation
     * @param operationType Type of operation
     * @param metrics Metrics to record
     */
    private static recordMetrics(operationType: string, metrics: {
        duration: number;
        success: boolean;
        timestamp: number;
        operationId: string;
        [key: string]: any;
    }): void {
        const existing = this.metrics.get(operationType) || {
            totalOperations: 0,
            successfulOperations: 0,
            failedOperations: 0,
            totalDuration: 0,
            averageDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            lastOperation: 0,
            recentOperations: []
        };

        // Update counters
        existing.totalOperations++;
        if (metrics.success) {
            existing.successfulOperations++;
        } else {
            existing.failedOperations++;
        }

        // Update duration metrics
        existing.totalDuration += metrics.duration;
        existing.averageDuration = existing.totalDuration / existing.totalOperations;
        existing.minDuration = Math.min(existing.minDuration, metrics.duration);
        existing.maxDuration = Math.max(existing.maxDuration, metrics.duration);
        existing.lastOperation = metrics.timestamp;

        // Keep recent operations for trend analysis (last 10)
        existing.recentOperations.push({
            timestamp: metrics.timestamp,
            duration: metrics.duration,
            success: metrics.success,
            operationId: metrics.operationId,
            metadata: metrics
        });

        // Keep only last 10 operations
        if (existing.recentOperations.length > 10) {
            existing.recentOperations.shift();
        }

        this.metrics.set(operationType, existing);
    }

    /**
     * Get performance metrics for a specific operation type
     * @param operationType Type of operation to get metrics for
     * @returns PerformanceMetrics or null if no metrics recorded
     */
    public static getMetrics(operationType: string): PerformanceMetrics | null {
        return this.metrics.get(operationType) || null;
    }

    /**
     * Get all recorded performance metrics
     * @returns Map of all performance metrics
     */
    public static getAllMetrics(): Map<string, PerformanceMetrics> {
        return new Map(this.metrics);
    }

    /**
     * Get summary statistics for all operations
     * @returns PerformanceSummary object
     */
    public static getSummary(): PerformanceSummary {
        const summary: PerformanceSummary = {
            totalOperations: 0,
            totalSuccessful: 0,
            totalFailed: 0,
            overallSuccessRate: 0,
            totalDuration: 0,
            operationTypes: {}
        };

        for (const [operationType, metrics] of this.metrics.entries()) {
            summary.totalOperations += metrics.totalOperations;
            summary.totalSuccessful += metrics.successfulOperations;
            summary.totalFailed += metrics.failedOperations;
            summary.totalDuration += metrics.totalDuration;

            summary.operationTypes[operationType] = {
                count: metrics.totalOperations,
                successRate: metrics.totalOperations > 0 ? 
                    (metrics.successfulOperations / metrics.totalOperations) * 100 : 0,
                averageDuration: metrics.averageDuration,
                minDuration: metrics.minDuration,
                maxDuration: metrics.maxDuration
            };
        }

        summary.overallSuccessRate = summary.totalOperations > 0 ?
            (summary.totalSuccessful / summary.totalOperations) * 100 : 0;

        return summary;
    }

    /**
     * Log performance summary to console
     * @param operationId Operation ID for logging context
     */
    public static logSummary(operationId: string): void {
        const summary = this.getSummary();
        
        console.log(`[${operationId}] 📊 Performance Summary:`);
        console.log(`[${operationId}]   - Total operations: ${summary.totalOperations}`);
        console.log(`[${operationId}]   - Success rate: ${summary.overallSuccessRate.toFixed(2)}%`);
        console.log(`[${operationId}]   - Total duration: ${summary.totalDuration}ms`);
        
        console.log(`[${operationId}] 📋 Operation breakdown:`);
        for (const [type, metrics] of Object.entries(summary.operationTypes)) {
            console.log(`[${operationId}]   - ${type}: ${metrics.count} ops, ${metrics.successRate.toFixed(1)}% success, avg ${metrics.averageDuration.toFixed(1)}ms`);
        }
    }

    /**
     * Monitor memory usage for an operation
     * @param operationId Operation ID for logging
     * @param operationType Type of operation
     * @param beforeCallback Function to call before measuring memory
     * @param afterCallback Function to call after measuring memory
     */
    public static async monitorMemoryUsage<T>(
        operationId: string,
        operationType: string,
        operation: () => Promise<T>
    ): Promise<{
        result: T;
        memoryUsage: {
            before: NodeJS.MemoryUsage;
            after: NodeJS.MemoryUsage;
            delta: {
                heapUsed: number;
                heapTotal: number;
                external: number;
                rss: number;
            };
        };
    }> {
        // Force garbage collection if available (for more accurate measurements)
        if (global.gc) {
            global.gc();
        }

        const memoryBefore = process.memoryUsage();
        console.log(`[${operationId}] 💾 Memory before ${operationType}: ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB heap`);

        const result = await operation();

        // Force garbage collection again
        if (global.gc) {
            global.gc();
        }

        const memoryAfter = process.memoryUsage();
        const delta = {
            heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            external: memoryAfter.external - memoryBefore.external,
            rss: memoryAfter.rss - memoryBefore.rss
        };

        console.log(`[${operationId}] 💾 Memory after ${operationType}: ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB heap`);
        console.log(`[${operationId}] 📈 Memory delta: heap ${Math.round(delta.heapUsed / 1024 / 1024)}MB, rss ${Math.round(delta.rss / 1024 / 1024)}MB`);

        // Record memory metrics
        this.recordMetrics(`${operationType}_memory`, {
            duration: 0, // Not applicable for memory metrics
            success: true,
            timestamp: Date.now(),
            operationId,
            heapUsedDelta: delta.heapUsed,
            heapTotalDelta: delta.heapTotal,
            externalDelta: delta.external,
            rssDelta: delta.rss,
            heapUsedBefore: memoryBefore.heapUsed,
            heapUsedAfter: memoryAfter.heapUsed
        });

        return {
            result,
            memoryUsage: {
                before: memoryBefore,
                after: memoryAfter,
                delta
            }
        };
    }

    /**
     * Clear all recorded metrics (useful for testing)
     */
    public static clearMetrics(): void {
        this.metrics.clear();
        this.timers.clear();
        console.log('🧹 Performance metrics cleared');
    }

    /**
     * Get performance trends for an operation type
     * @param operationType Type of operation
     * @returns Performance trend analysis
     */
    public static getTrends(operationType: string): PerformanceTrends | null {
        const metrics = this.metrics.get(operationType);
        if (!metrics || metrics.recentOperations.length < 2) {
            return null;
        }

        const recent = metrics.recentOperations;
        const durations = recent.map(op => op.duration);
        const successRates = recent.map(op => op.success ? 1 : 0);

        // Calculate trends
        const avgDurationRecent = durations.reduce((a, b) => a + b, 0) / durations.length;
        const successRateRecent = (successRates.reduce((a: number, b: number) => a + b, 0) / successRates.length) * 100;

        // Compare with overall averages
        const durationTrend = avgDurationRecent > metrics.averageDuration ? 'slower' : 'faster';
        const successTrend = successRateRecent > (metrics.successfulOperations / metrics.totalOperations) * 100 ? 'improving' : 'declining';

        return {
            operationType,
            recentAverageDuration: avgDurationRecent,
            recentSuccessRate: successRateRecent,
            durationTrend,
            successTrend,
            sampleSize: recent.length
        };
    }
}

/**
 * Interface for performance metrics
 */
export interface PerformanceMetrics {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    lastOperation: number;
    recentOperations: Array<{
        timestamp: number;
        duration: number;
        success: boolean;
        operationId: string;
        metadata: Record<string, any>;
    }>;
}

/**
 * Interface for performance summary
 */
export interface PerformanceSummary {
    totalOperations: number;
    totalSuccessful: number;
    totalFailed: number;
    overallSuccessRate: number;
    totalDuration: number;
    operationTypes: Record<string, {
        count: number;
        successRate: number;
        averageDuration: number;
        minDuration: number;
        maxDuration: number;
    }>;
}

/**
 * Interface for performance trends
 */
export interface PerformanceTrends {
    operationType: string;
    recentAverageDuration: number;
    recentSuccessRate: number;
    durationTrend: 'faster' | 'slower';
    successTrend: 'improving' | 'declining';
    sampleSize: number;
}
