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