/**
 * Graph domain model types for constellation project scanning and caching
 */

export interface IConstellationNode {
  /** Normalized, workspace-relative file path used as unique identifier */
  id: string;
  /** The absolute file path */
  path: string;
  /** The file name for display purposes */
  label: string;
  /** For monorepos, the name of the package this file belongs to */
  package?: string;
}

export interface IConstellationEdge {
  /** ID of the source node (the file that imports/depends on the target) */
  source: string;
  /** ID of the target node (the file being imported/depended upon) */
  target: string;
}

export interface IConstellationGraph {
  /** Array of all nodes in the dependency graph */
  nodes: IConstellationNode[];
  /** Array of all edges representing dependencies between nodes */
  edges: IConstellationEdge[];
  /** Metadata about when and how this graph was generated */
  metadata: {
    /** ISO timestamp when the graph was created */
    timestamp: string;
    /** Absolute path to the workspace root */
    workspaceRoot: string;
    /** Relative path that was scanned to generate this graph */
    scanPath: string;
  };
}

export interface ICacheValidationResult {
  /** Whether the cache is valid and can be used */
  isValid: boolean;
  /** Human-readable reason why cache is invalid (if applicable) */
  reason?: string;
  /** Timestamp of the cache file */
  cacheTimestamp?: Date;
  /** Timestamp of the newest key file that invalidated the cache */
  keyFileTimestamp?: Date;
}

/**
 * Summary response types for constellation_get_graph_summary MCP tool
 */

export interface ITopHub {
  /** File ID of the hub */
  id: string;
  /** Number of connections (incoming + outgoing dependencies) */
  connectionCount: number;
}

export interface ISummaryMetrics {
  /** Total number of files in the graph */
  fileCount: number;
  /** Total number of dependencies between files */
  dependencyCount: number;
  /** Breakdown of files by extension type */
  fileTypeBreakdown: Record<string, number>;
}

export interface ISummaryInsights {
  /** Top connected files acting as architectural hubs */
  topHubs: ITopHub[];
  /** Circular dependency chains detected in the codebase */
  circularDependencies: string[][];
  /** Files with no incoming or outgoing dependencies */
  orphanFiles: string[];
}

export interface ISummaryMetadata {
  /** Time taken to generate the summary in milliseconds */
  scanDurationMs: number;
  /** Whether cached data was used for this summary */
  cacheUsed: boolean;
}

export interface ISummaryResponse {
  /** Human-readable narrative summary of the codebase analysis */
  summary: string;
  /** Key metrics about the codebase structure */
  metrics: ISummaryMetrics;
  /** Actionable architectural insights */
  insights: ISummaryInsights;
  /** Metadata about the summary generation process */
  metadata: ISummaryMetadata;
}

/**
 * Impact analysis types for constellation_impact_analysis MCP tool
 */

export interface IPathSuggestion {
  /** Suggested file path */
  path: string;
  /** Confidence score from 0-100 indicating match quality */
  confidence: number;
  /** Reason for the suggestion */
  reason: 'similar_name' | 'partial_path' | 'same_extension';
}

export interface IPathResolution {
  /** Original path provided by the user */
  originalPath: string;
  /** Resolved workspace-relative path */
  resolvedPath: string;
  /** Whether fuzzy matching was used to find the file */
  fuzzyMatched: boolean;
  /** Confidence score for fuzzy matches (0-100) */
  matchConfidence?: number;
  /** Alternative path suggestions if exact match not found */
  suggestions?: IPathSuggestion[];
}

export interface IAnalysisMetadata {
  /** ISO timestamp when the analysis was performed */
  timestamp: string;
  /** Time taken to complete the analysis in milliseconds */
  analysisTimeMs: number;
  /** Total number of nodes in the graph used for analysis */
  graphNodeCount: number;
  /** Whether cached graph data was used */
  cacheUsed: boolean;
  /** Optional change type provided in the analysis request */
  changeType?: string;
}

export interface ImpactAnalysisResult {
  /** Human-readable summary of the impact analysis */
  impactSummary: string;
  /** Array of files that depend on the target file */
  dependents: string[];
  /** Array of files that the target file depends on */
  dependencies: string[];
  /** Filtered graph containing only the target file and its direct connections */
  impactGraph: IConstellationGraph;
  /** Path resolution metadata and suggestions */
  pathResolution: IPathResolution;
  /** Analysis execution metadata */
  metadata: IAnalysisMetadata;
}

/**
 * Error response types for robust error handling
 */

export type ImpactAnalysisErrorCode =
  | 'FILE_NOT_FOUND'
  | 'PATH_SECURITY'
  | 'GRAPH_UNAVAILABLE'
  | 'ANALYSIS_TIMEOUT'
  | 'INVALID_PATH'
  | 'WORKSPACE_BOUNDARY_VIOLATION';

export interface ImpactAnalysisErrorResponse {
  /** Error message describing what went wrong */
  error: string;
  /** Specific error code for programmatic handling */
  errorCode: ImpactAnalysisErrorCode;
  /** Suggested file paths if available (for FILE_NOT_FOUND errors) */
  suggestions?: string[];
  /** Recommended actions the user can take to resolve the error */
  recoveryActions?: string[];
  /** Additional context about the error */
  context?: {
    /** Original path that caused the error */
    originalPath?: string;
    /** Workspace root for reference */
    workspaceRoot?: string;
    /** Whether graph data was available */
    graphAvailable?: boolean;
  };
}