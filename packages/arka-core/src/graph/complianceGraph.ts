/**
 * Global Compliance Graph (GCG)
 *
 * Graph-based representation of compliance relationships between
 * entities, rules, jurisdictions, and decisions (Enhancement #18).
 */

import type { GraphNode, GraphEdge } from '@arka-protocol/types';

/**
 * Node types in the compliance graph
 */
export type ComplianceNodeType =
  | 'ENTITY'
  | 'RULE'
  | 'JURISDICTION'
  | 'DECISION'
  | 'EVENT'
  | 'REGULATION'
  | 'RISK_FACTOR'
  | 'PATTERN';

/**
 * Edge types in the compliance graph
 */
export type ComplianceEdgeType =
  | 'APPLIES_TO'       // Rule -> Entity
  | 'EVALUATED_BY'     // Event -> Rule
  | 'RESULTED_IN'      // Evaluation -> Decision
  | 'GOVERNS'          // Jurisdiction -> Rule
  | 'IMPLEMENTS'       // Rule -> Regulation
  | 'RELATED_TO'       // Any -> Any
  | 'DEPENDS_ON'       // Rule -> Rule
  | 'CONFLICTS_WITH'   // Rule -> Rule
  | 'OWNED_BY'         // Entity -> Entity
  | 'TRIGGERED'        // Event -> Event
  | 'INDICATES'        // Pattern -> Risk Factor
  | 'MITIGATED_BY';    // Risk Factor -> Rule

/**
 * Compliance graph node
 */
export interface ComplianceGraphNode extends Omit<GraphNode, 'nodeType'> {
  /** Node type */
  nodeType: ComplianceNodeType;

  /** Node label */
  label: string;

  /** Properties */
  properties: Record<string, unknown>;

  /** Timestamps */
  createdAt: string;
  updatedAt?: string;

  /** Validity period */
  validFrom?: string;
  validTo?: string;
}

/**
 * Compliance graph edge
 */
export interface ComplianceGraphEdge extends Omit<GraphEdge, 'edgeType'> {
  /** Edge type */
  edgeType: ComplianceEdgeType;

  /** Source node ID (alias for fromNodeId) */
  sourceId: string;

  /** Target node ID (alias for toNodeId) */
  targetId: string;

  /** Weight/strength of relationship */
  weight?: number;

  /** Properties */
  properties?: Record<string, unknown>;

  /** When this relationship was established */
  establishedAt: string;

  /** Validity period */
  validFrom?: string;
  validTo?: string;
}

/**
 * Graph query result
 */
export interface GraphQueryResult {
  nodes: ComplianceGraphNode[];
  edges: ComplianceGraphEdge[];
  paths?: GraphPath[];
}

/**
 * Path in the graph
 */
export interface GraphPath {
  nodes: string[]; // Node IDs
  edges: string[]; // Edge IDs
  length: number;
  totalWeight?: number;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  avgDegree: number;
  maxDegree: number;
  connectedComponents: number;
}

/**
 * Compliance Graph implementation
 */
export class ComplianceGraph {
  private nodes: Map<string, ComplianceGraphNode> = new Map();
  private edges: Map<string, ComplianceGraphEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map(); // nodeId -> set of edge IDs
  private reverseAdjacency: Map<string, Set<string>> = new Map(); // nodeId -> set of incoming edge IDs

  /**
   * Add a node to the graph
   */
  addNode(node: ComplianceGraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, new Set());
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: ComplianceGraphEdge): void {
    if (!this.nodes.has(edge.sourceId) || !this.nodes.has(edge.targetId)) {
      throw new Error('Source or target node not found');
    }

    this.edges.set(edge.id, edge);

    const outgoing = this.adjacencyList.get(edge.sourceId) ?? new Set();
    outgoing.add(edge.id);
    this.adjacencyList.set(edge.sourceId, outgoing);

    const incoming = this.reverseAdjacency.get(edge.targetId) ?? new Set();
    incoming.add(edge.id);
    this.reverseAdjacency.set(edge.targetId, incoming);
  }

  /**
   * Get node by ID
   */
  getNode(nodeId: string): ComplianceGraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get edge by ID
   */
  getEdge(edgeId: string): ComplianceGraphEdge | undefined {
    return this.edges.get(edgeId);
  }

  /**
   * Remove a node and all connected edges
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) return false;

    // Remove outgoing edges
    const outgoing = this.adjacencyList.get(nodeId) ?? new Set();
    for (const edgeId of outgoing) {
      const edge = this.edges.get(edgeId);
      if (edge) {
        const targetIncoming = this.reverseAdjacency.get(edge.targetId);
        targetIncoming?.delete(edgeId);
      }
      this.edges.delete(edgeId);
    }

    // Remove incoming edges
    const incoming = this.reverseAdjacency.get(nodeId) ?? new Set();
    for (const edgeId of incoming) {
      const edge = this.edges.get(edgeId);
      if (edge) {
        const sourceOutgoing = this.adjacencyList.get(edge.sourceId);
        sourceOutgoing?.delete(edgeId);
      }
      this.edges.delete(edgeId);
    }

    this.adjacencyList.delete(nodeId);
    this.reverseAdjacency.delete(nodeId);
    this.nodes.delete(nodeId);

    return true;
  }

  /**
   * Get neighbors of a node
   */
  getNeighbors(nodeId: string, direction: 'out' | 'in' | 'both' = 'both'): ComplianceGraphNode[] {
    const neighbors = new Set<string>();

    if (direction === 'out' || direction === 'both') {
      const outgoing = this.adjacencyList.get(nodeId) ?? new Set();
      for (const edgeId of outgoing) {
        const edge = this.edges.get(edgeId);
        if (edge) neighbors.add(edge.targetId);
      }
    }

    if (direction === 'in' || direction === 'both') {
      const incoming = this.reverseAdjacency.get(nodeId) ?? new Set();
      for (const edgeId of incoming) {
        const edge = this.edges.get(edgeId);
        if (edge) neighbors.add(edge.sourceId);
      }
    }

    return Array.from(neighbors)
      .map((id) => this.nodes.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get edges for a node
   */
  getEdgesForNode(
    nodeId: string,
    direction: 'out' | 'in' | 'both' = 'both'
  ): ComplianceGraphEdge[] {
    const edges: ComplianceGraphEdge[] = [];

    if (direction === 'out' || direction === 'both') {
      const outgoing = this.adjacencyList.get(nodeId) ?? new Set();
      for (const edgeId of outgoing) {
        const edge = this.edges.get(edgeId);
        if (edge) edges.push(edge);
      }
    }

    if (direction === 'in' || direction === 'both') {
      const incoming = this.reverseAdjacency.get(nodeId) ?? new Set();
      for (const edgeId of incoming) {
        const edge = this.edges.get(edgeId);
        if (edge) edges.push(edge);
      }
    }

    return edges;
  }

  /**
   * Find shortest path between nodes
   */
  findShortestPath(sourceId: string, targetId: string): GraphPath | null {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      return null;
    }

    // BFS
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
      { nodeId: sourceId, path: [sourceId], edges: [] },
    ];

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;

      if (nodeId === targetId) {
        return {
          nodes: path,
          edges,
          length: path.length - 1,
        };
      }

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoing = this.adjacencyList.get(nodeId) ?? new Set();
      for (const edgeId of outgoing) {
        const edge = this.edges.get(edgeId);
        if (edge && !visited.has(edge.targetId)) {
          queue.push({
            nodeId: edge.targetId,
            path: [...path, edge.targetId],
            edges: [...edges, edgeId],
          });
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between nodes (up to maxLength)
   */
  findAllPaths(
    sourceId: string,
    targetId: string,
    maxLength: number = 5
  ): GraphPath[] {
    const paths: GraphPath[] = [];

    const dfs = (currentId: string, path: string[], edges: string[], visited: Set<string>): void => {
      if (path.length > maxLength + 1) return;

      if (currentId === targetId) {
        paths.push({
          nodes: [...path],
          edges: [...edges],
          length: path.length - 1,
        });
        return;
      }

      const outgoing = this.adjacencyList.get(currentId) ?? new Set();
      for (const edgeId of outgoing) {
        const edge = this.edges.get(edgeId);
        if (edge && !visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          path.push(edge.targetId);
          edges.push(edgeId);
          dfs(edge.targetId, path, edges, visited);
          path.pop();
          edges.pop();
          visited.delete(edge.targetId);
        }
      }
    };

    const visited = new Set<string>([sourceId]);
    dfs(sourceId, [sourceId], [], visited);

    return paths;
  }

  /**
   * Query nodes by type and properties
   */
  queryNodes(query: {
    type?: ComplianceNodeType;
    properties?: Record<string, unknown>;
    validAt?: string;
  }): ComplianceGraphNode[] {
    let results = Array.from(this.nodes.values());

    if (query.type) {
      results = results.filter((n) => n.nodeType === query.type);
    }

    if (query.properties) {
      results = results.filter((n) => {
        for (const [key, value] of Object.entries(query.properties!)) {
          if (n.properties[key] !== value) return false;
        }
        return true;
      });
    }

    if (query.validAt) {
      const queryTime = new Date(query.validAt).getTime();
      results = results.filter((n) => {
        if (n.validFrom && new Date(n.validFrom).getTime() > queryTime) return false;
        if (n.validTo && new Date(n.validTo).getTime() < queryTime) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * Query edges by type
   */
  queryEdges(query: {
    type?: ComplianceEdgeType;
    sourceType?: ComplianceNodeType;
    targetType?: ComplianceNodeType;
    validAt?: string;
  }): ComplianceGraphEdge[] {
    let results = Array.from(this.edges.values());

    if (query.type) {
      results = results.filter((e) => e.edgeType === query.type);
    }

    if (query.sourceType) {
      results = results.filter((e) => {
        const source = this.nodes.get(e.sourceId);
        return source?.nodeType === query.sourceType;
      });
    }

    if (query.targetType) {
      results = results.filter((e) => {
        const target = this.nodes.get(e.targetId);
        return target?.nodeType === query.targetType;
      });
    }

    if (query.validAt) {
      const queryTime = new Date(query.validAt).getTime();
      results = results.filter((e) => {
        if (e.validFrom && new Date(e.validFrom).getTime() > queryTime) return false;
        if (e.validTo && new Date(e.validTo).getTime() < queryTime) return false;
        return true;
      });
    }

    return results;
  }

  /**
   * Get subgraph around a node
   */
  getSubgraph(centerNodeId: string, depth: number = 2): GraphQueryResult {
    const nodeIds = new Set<string>([centerNodeId]);
    const edgeIds = new Set<string>();

    let frontier = new Set<string>([centerNodeId]);

    for (let d = 0; d < depth; d++) {
      const newFrontier = new Set<string>();

      for (const nodeId of frontier) {
        const edges = this.getEdgesForNode(nodeId);
        for (const edge of edges) {
          edgeIds.add(edge.id);

          if (!nodeIds.has(edge.sourceId)) {
            nodeIds.add(edge.sourceId);
            newFrontier.add(edge.sourceId);
          }
          if (!nodeIds.has(edge.targetId)) {
            nodeIds.add(edge.targetId);
            newFrontier.add(edge.targetId);
          }
        }
      }

      frontier = newFrontier;
    }

    return {
      nodes: Array.from(nodeIds).map((id) => this.nodes.get(id)!).filter(Boolean),
      edges: Array.from(edgeIds).map((id) => this.edges.get(id)!).filter(Boolean),
    };
  }

  /**
   * Get graph statistics
   */
  getStats(): GraphStats {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    let totalDegree = 0;
    let maxDegree = 0;

    for (const node of this.nodes.values()) {
      nodesByType[node.nodeType] = (nodesByType[node.nodeType] ?? 0) + 1;

      const degree =
        (this.adjacencyList.get(node.id)?.size ?? 0) +
        (this.reverseAdjacency.get(node.id)?.size ?? 0);
      totalDegree += degree;
      maxDegree = Math.max(maxDegree, degree);
    }

    for (const edge of this.edges.values()) {
      edgesByType[edge.edgeType] = (edgesByType[edge.edgeType] ?? 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodesByType,
      edgesByType,
      avgDegree: this.nodes.size > 0 ? totalDegree / this.nodes.size : 0,
      maxDegree,
      connectedComponents: this.countConnectedComponents(),
    };
  }

  /**
   * Export to JSON
   */
  toJSON(): { nodes: ComplianceGraphNode[]; edges: ComplianceGraphEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /**
   * Import from JSON
   */
  static fromJSON(data: {
    nodes: ComplianceGraphNode[];
    edges: ComplianceGraphEdge[];
  }): ComplianceGraph {
    const graph = new ComplianceGraph();

    for (const node of data.nodes) {
      graph.addNode(node);
    }

    for (const edge of data.edges) {
      graph.addEdge(edge);
    }

    return graph;
  }

  private countConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    const dfs = (nodeId: string): void => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const neighbors = this.getNeighbors(nodeId);
      for (const neighbor of neighbors) {
        dfs(neighbor.id);
      }
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        components++;
        dfs(nodeId);
      }
    }

    return components;
  }
}

/**
 * Create a compliance graph
 */
export function createComplianceGraph(): ComplianceGraph {
  return new ComplianceGraph();
}
