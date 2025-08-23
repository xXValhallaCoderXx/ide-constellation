/**
 * Type definitions for Cytoscape.js data format transformation
 */

export interface CytoscapeNodeData {
  id: string;           // IConstellationNode.id
  label: string;        // IConstellationNode.label
  path: string;         // IConstellationNode.path
  package?: string;     // IConstellationNode.package
}

export interface CytoscapeEdgeData {
  id: string;           // Generated: `${source}-${target}`
  source: string;       // IConstellationEdge.source
  target: string;       // IConstellationEdge.target
}

export interface CytoscapeNode {
  data: CytoscapeNodeData;
}

export interface CytoscapeEdge {
  data: CytoscapeEdgeData;
}

export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

export interface SearchIndex {
  nodesByLabel: Map<string, string[]>;     // label -> nodeIds
  nodesByPath: Map<string, string[]>;      // path segments -> nodeIds
  nodesByPackage: Map<string, string[]>;   // package -> nodeIds
}