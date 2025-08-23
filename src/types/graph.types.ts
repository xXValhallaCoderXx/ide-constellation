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