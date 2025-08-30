/**
 * Type definitions for constellation_trace_impact tool
 * Defines core interfaces for impact analysis, risk scoring, and recommendations
 */

/**
 * Input parameters for impact analysis
 */
export interface TraceImpactInput {
    /** File path to analyze (workspace-relative) */
    target: string;
    /** Type of change being made to the target file */
    changeType: ChangeType;
    /** Maximum depth to traverse dependencies (default: 3, max: 5) */
    depth?: number;
}

/**
 * Types of changes that can be made to a file
 */
export enum ChangeType {
    REFACTOR = 'refactor',     // Changes to interfaces/structure
    DELETE = 'delete',         // File removal
    MODIFY = 'modify',         // Implementation changes
    ADD_FEATURE = 'add-feature' // Adding new functionality
}

/**
 * Impact levels for affected files
 */
export enum ImpactLevel {
    CRITICAL = 'critical',  // Direct dependency, will break immediately
    HIGH = 'high',         // 1 hop away, likely affected
    MEDIUM = 'medium',     // 2 hops away, may be affected
    LOW = 'low'           // 3+ hops away, unlikely affected
}

/**
 * Information about a file impacted by the change
 */
export interface ImpactedFile {
    /** Node ID (workspace-relative path) */
    nodeId: string;
    /** Absolute file path */
    path: string;
    /** Level of impact this file will experience */
    impactLevel: ImpactLevel;
    /** Number of hops from the target file */
    distance: number;
    /** Human-readable reason why this file is impacted */
    reason: string;
    /** Color code for visualization */
    color: string;
}

/**
 * Complete impact analysis results
 */
export interface ImpactAnalysis {
    /** Target file that was analyzed */
    target: string;
    /** Type of change being analyzed */
    changeType: ChangeType;
    /** All files that will be impacted by the change */
    impactedFiles: ImpactedFile[];
    /** Calculated risk score (0-10) */
    riskScore: number;
    /** Detected circular dependency chains */
    circularDependencies: string[][];
    /** Generated recommendations for safe change implementation */
    recommendations: string[];
    /** Analysis metadata */
    metadata: {
        /** Timestamp when analysis was performed */
        timestamp: string;
        /** Depth used for traversal */
        depth: number;
        /** Total analysis time in milliseconds */
        analysisTimeMs: number;
    };
}

/**
 * Risk score calculation factors
 */
export interface RiskScoreFactors {
    /** Number of files that directly import the target */
    directImpacts: number;
    /** Number of files 1 hop away from target */
    secondaryImpacts: number;
    /** Number of files 2+ hops away from target */
    tertiaryImpacts: number;
    /** Number of circular dependency chains detected */
    circularDeps: number;
    /** Multiplier based on change type severity */
    changeTypeMultiplier: number;
}

/**
 * Traversal result for dependency analysis
 */
export interface TraversalResult {
    /** All nodes discovered during traversal */
    discoveredNodes: Set<string>;
    /** Mapping of node to its distance from target */
    nodeDistances: Map<string, number>;
    /** Detected circular dependency paths */
    circularPaths: string[][];
    /** Whether traversal was terminated early due to limits */
    truncated: boolean;
}

/**
 * Configuration for impact analysis
 */
export interface ImpactAnalysisConfig {
    /** Maximum depth to traverse (hard limit: 5) */
    maxDepth: number;
    /** Maximum number of nodes to analyze (performance limit) */
    maxNodes: number;
    /** Timeout for analysis in milliseconds */
    timeoutMs: number;
    /** Whether to include circular dependency detection */
    detectCircularDeps: boolean;
}

/**
 * Change type multipliers for risk calculation
 */
export const CHANGE_TYPE_MULTIPLIERS: Record<ChangeType, number> = {
    [ChangeType.DELETE]: 1.5,      // Highest risk - removes functionality
    [ChangeType.REFACTOR]: 1.2,    // High risk - changes interfaces
    [ChangeType.MODIFY]: 1.0,      // Base risk - changes implementation
    [ChangeType.ADD_FEATURE]: 0.8  // Lower risk - additive changes
};

/**
 * Impact level color mapping for visualization
 */
export const IMPACT_LEVEL_COLORS: Record<ImpactLevel, string> = {
    [ImpactLevel.CRITICAL]: '#ef4444',  // Red
    [ImpactLevel.HIGH]: '#f97316',      // Orange
    [ImpactLevel.MEDIUM]: '#eab308',    // Yellow
    [ImpactLevel.LOW]: '#22c55e'        // Green
};

/**
 * Risk score thresholds for recommendations
 */
export const RISK_THRESHOLDS = {
    FEATURE_FLAG: 7,      // Recommend feature flag deployment
    INTEGRATION_TESTS: 5, // Recommend writing integration tests first
    BREAK_INTO_SMALLER: 10 // Recommend breaking into smaller changes (file count)
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ImpactAnalysisConfig = {
    maxDepth: 3,
    maxNodes: 1000,
    timeoutMs: 5000,
    detectCircularDeps: true
};