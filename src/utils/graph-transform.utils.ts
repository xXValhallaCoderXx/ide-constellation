import { IConstellationGraph } from '../types/graph.types';
import { CytoscapeElements, CytoscapeNode, CytoscapeEdge } from '../types/cytoscape.types';

/**
 * Transform IConstellationGraph to Cytoscape.js elements format
 */
export function transformGraphToCytoscape(graph: IConstellationGraph): CytoscapeElements {
  if (!graph || !graph.nodes || !graph.edges) {
    throw new Error('Invalid graph data: missing nodes or edges');
  }

  // Transform nodes
  const nodes: CytoscapeNode[] = graph.nodes.map(node => ({
    data: {
      id: node.id,
      label: node.label,
      path: node.path,
      package: node.package
    }
  }));

  // Transform edges with validation
  const edges: CytoscapeEdge[] = graph.edges
    .filter(edge => {
      // Validate that source and target nodes exist
      const sourceExists = graph.nodes.some(node => node.id === edge.source);
      const targetExists = graph.nodes.some(node => node.id === edge.target);
      
      if (!sourceExists || !targetExists) {
        console.warn(`Skipping invalid edge: ${edge.source} -> ${edge.target}`);
        return false;
      }
      
      return true;
    })
    .map(edge => ({
      data: {
        id: `${edge.source}-${edge.target}`,
        source: edge.source,
        target: edge.target
      }
    }));

  return {
    nodes,
    edges
  };
}

/**
 * Validate graph data before transformation
 */
export function validateGraphData(graph: IConstellationGraph): boolean {
  if (!graph) {
    console.error('Graph validation failed: graph is null or undefined');
    return false;
  }

  if (!Array.isArray(graph.nodes)) {
    console.error('Graph validation failed: nodes is not an array');
    return false;
  }

  if (!Array.isArray(graph.edges)) {
    console.error('Graph validation failed: edges is not an array');
    return false;
  }

  // Validate node structure
  for (const node of graph.nodes) {
    if (!node.id || !node.label || !node.path) {
      console.error('Graph validation failed: node missing required fields', node);
      return false;
    }
  }

  // Validate edge structure
  for (const edge of graph.edges) {
    if (!edge.source || !edge.target) {
      console.error('Graph validation failed: edge missing required fields', edge);
      return false;
    }
  }

  return true;
}

/**
 * Get node IDs that exist in the graph
 */
export function getNodeIds(graph: IConstellationGraph): Set<string> {
  return new Set(graph.nodes.map(node => node.id));
}

/**
 * Count valid edges (where both source and target nodes exist)
 */
export function countValidEdges(graph: IConstellationGraph): number {
  const nodeIds = getNodeIds(graph);
  return graph.edges.filter(edge => 
    nodeIds.has(edge.source) && nodeIds.has(edge.target)
  ).length;
}