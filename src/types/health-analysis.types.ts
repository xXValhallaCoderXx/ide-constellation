/**
 * Health Analysis Types
 * 
 * Core TypeScript interfaces and types for the Risk Analysis Engine.
 * Defines data structures for complexity metrics, churn analysis, risk scoring,
 * and comprehensive health analysis results.
 */

/**
 * Code complexity metrics for a single file
 */
export interface ComplexityMetrics {
  /** Total lines of code (excluding comments and blank lines) */
  linesOfCode: number;
  /** Cyclomatic complexity score (optional for MVP) */
  cyclomaticComplexity?: number;
  /** File size in bytes */
  fileSize: number;
}

/**
 * Git repository churn metrics for a single file
 */
export interface ChurnMetrics {
  /** Number of commits affecting this file in the specified time period */
  commitCount: number;
  /** Number of unique authors who modified this file in the specified time period */
  uniqueAuthors: number;
  /** Date when the file was last modified */
  lastModified: Date;
  /** Number of days since the file was last changed */
  daysSinceLastChange: number;
}

/**
 * Combined metrics for a single file including complexity, churn, and dependencies
 */
export interface FileMetrics {
  /** Unique identifier from the constellation graph */
  nodeId: string;
  /** File path relative to workspace root */
  path: string;
  /** Code complexity analysis results */
  complexity: ComplexityMetrics;
  /** Git churn analysis results */
  churn: ChurnMetrics;
  /** Number of dependencies (incoming + outgoing edges in graph) */
  dependencies: number;
}

/**
 * Risk assessment score with categorization and visualization data
 */
export interface RiskScore {
  /** Unique identifier from the constellation graph */
  nodeId: string;
  /** Normalized risk score from 0-1 */
  score: number;
  /** Percentile ranking from 0-100 */
  percentile: number;
  /** Risk category for quick assessment */
  category: 'low' | 'medium' | 'high' | 'critical';
  /** Hex color code for visualization (green to red gradient) */
  color: string;
  /** Raw metrics data for detailed tooltips and drill-down */
  metrics: FileMetrics;
}

/**
 * Comprehensive health analysis results for the entire codebase
 */
export interface HealthAnalysis {
  /** ISO timestamp when the analysis was performed */
  timestamp: string;
  /** Total number of files analyzed */
  totalFiles: number;
  /** Overall health score from 0-100 (higher is better) */
  healthScore: number;
  /** Risk scores for all analyzed files */
  riskScores: RiskScore[];
  /** Distribution of files across risk categories */
  distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Top 5 highest risk files for immediate attention */
  topRisks: RiskScore[];
  /** Actionable recommendations for improving codebase health */
  recommendations: string[];
}

/**
 * Cache entry structure for storing metrics with TTL
 */
export interface CacheEntry<T> {
  /** Cached data of generic type T */
  data: T;
  /** Unix timestamp when the entry was created */
  timestamp: number;
  /** Time-to-live in milliseconds */
  ttl: number;
}

/**
 * Cache TTL constants for different types of metrics
 * Optimized based on how frequently each type of data changes
 */
export const CACHE_TTL = {
  /** Complexity metrics cache for 1 week (code structure changes infrequently) */
  complexity: 7 * 24 * 60 * 60 * 1000,
  /** Churn metrics cache for 1 day (git history changes daily) */
  churn: 24 * 60 * 60 * 1000,
  /** Full analysis cache for 1 hour (combined results change more frequently) */
  analysis: 60 * 60 * 1000
} as const;

/**
 * Risk score calculation weights
 * Defines the relative importance of each metric in the final risk score
 */
export const RISK_WEIGHTS = {
  /** Complexity weight (40% of total score) */
  complexity: 0.4,
  /** Churn weight (40% of total score) */
  churn: 0.4,
  /** Dependencies weight (20% of total score) */
  dependencies: 0.2
} as const;

/**
 * Risk category thresholds based on percentile scores
 */
export const RISK_THRESHOLDS = {
  /** Files below 25th percentile are low risk */
  low: 25,
  /** Files between 25th-50th percentile are medium risk */
  medium: 50,
  /** Files between 50th-75th percentile are high risk */
  high: 75
  /** Files above 75th percentile are critical risk */
} as const;

/**
 * Color mapping for risk visualization
 * Maps risk scores to hex colors for consistent visualization
 */
export const RISK_COLORS = {
  low: '#22c55e',      // Green
  medium: '#eab308',   // Yellow
  high: '#f97316',     // Orange
  critical: '#ef4444'  // Red
} as const;