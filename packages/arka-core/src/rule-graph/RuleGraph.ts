/**
 * Rule Graph Engine
 *
 * Builds and manages a directed graph of rules with dependencies,
 * computes execution order, and detects cycles/conflicts (Enhancement #4).
 */

import type {
  ArkaRule,
  ArkaRuleWithGraph,
  RuleRelationship,
  RuleRelationshipType,
  RuleGraphAnalysis,
  RuleConflict,
} from '@arka-protocol/types';

/**
 * Node in the rule graph
 */
interface GraphNode {
  rule: ArkaRuleWithGraph;
  inEdges: Set<string>;  // Rules this depends on
  outEdges: Set<string>; // Rules that depend on this
  level: number;         // Computed dependency level
  visited: boolean;      // For traversal algorithms
  inStack: boolean;      // For cycle detection
}

/**
 * Edge in the rule graph
 */
interface GraphEdge {
  from: string;
  to: string;
  type: RuleRelationshipType;
  weight: number;
}

/**
 * Rule Graph class for managing rule dependencies and execution order
 */
export class RuleGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge[]> = new Map();
  private relationships: RuleRelationship[] = [];

  /**
   * Create a new RuleGraph from a set of rules
   */
  constructor(rules: ArkaRuleWithGraph[] = []) {
    for (const rule of rules) {
      this.addRule(rule);
    }
    this.buildEdgesFromMetadata();
  }

  /**
   * Add a rule to the graph
   */
  addRule(rule: ArkaRuleWithGraph): void {
    if (this.nodes.has(rule.id)) {
      // Update existing node
      const node = this.nodes.get(rule.id)!;
      node.rule = rule;
    } else {
      // Create new node
      this.nodes.set(rule.id, {
        rule,
        inEdges: new Set(),
        outEdges: new Set(),
        level: 0,
        visited: false,
        inStack: false,
      });
    }
  }

  /**
   * Remove a rule from the graph
   */
  removeRule(ruleId: string): boolean {
    const node = this.nodes.get(ruleId);
    if (!node) return false;

    // Remove edges
    for (const targetId of node.outEdges) {
      const target = this.nodes.get(targetId);
      if (target) {
        target.inEdges.delete(ruleId);
      }
    }

    for (const sourceId of node.inEdges) {
      const source = this.nodes.get(sourceId);
      if (source) {
        source.outEdges.delete(ruleId);
      }
    }

    this.edges.delete(ruleId);
    this.nodes.delete(ruleId);
    return true;
  }

  /**
   * Add a relationship between rules
   */
  addRelationship(relationship: RuleRelationship): void {
    const { sourceRuleId, targetRuleId, type, weight = 1 } = relationship;

    // Ensure both nodes exist
    if (!this.nodes.has(sourceRuleId) || !this.nodes.has(targetRuleId)) {
      throw new Error(`Cannot add relationship: one or both rules not found`);
    }

    // Add edge based on relationship type
    const edge: GraphEdge = {
      from: sourceRuleId,
      to: targetRuleId,
      type,
      weight,
    };

    // Store edge
    if (!this.edges.has(sourceRuleId)) {
      this.edges.set(sourceRuleId, []);
    }
    this.edges.get(sourceRuleId)!.push(edge);

    // Update node connections based on type
    const sourceNode = this.nodes.get(sourceRuleId)!;
    const targetNode = this.nodes.get(targetRuleId)!;

    if (type === 'DEPENDS_ON') {
      // Source depends on target, so target must run first
      sourceNode.inEdges.add(targetRuleId);
      targetNode.outEdges.add(sourceRuleId);
    } else if (type === 'OVERRIDES') {
      // Source can override target
      sourceNode.outEdges.add(targetRuleId);
      targetNode.inEdges.add(sourceRuleId);
    }

    this.relationships.push(relationship);
  }

  /**
   * Build edges from rule metadata (dependsOnRules, overridesRules)
   */
  private buildEdgesFromMetadata(): void {
    for (const [ruleId, node] of this.nodes) {
      const rule = node.rule;

      // Process dependencies
      if (rule.dependsOnRules) {
        for (const depId of rule.dependsOnRules) {
          if (this.nodes.has(depId)) {
            this.addRelationship({
              sourceRuleId: ruleId,
              targetRuleId: depId,
              type: 'DEPENDS_ON',
            });
          }
        }
      }

      // Process overrides
      if (rule.overridesRules) {
        for (const overId of rule.overridesRules) {
          if (this.nodes.has(overId)) {
            this.addRelationship({
              sourceRuleId: ruleId,
              targetRuleId: overId,
              type: 'OVERRIDES',
            });
          }
        }
      }
    }
  }

  /**
   * Compute execution order using topological sort (Kahn's algorithm)
   */
  computeExecutionOrder(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const order: string[] = [];

    // Initialize in-degrees
    for (const [ruleId, node] of this.nodes) {
      inDegree.set(ruleId, node.inEdges.size);
      if (node.inEdges.size === 0) {
        queue.push(ruleId);
      }
    }

    // Sort queue by priority (higher priority first)
    queue.sort((a, b) => {
      const aPriority = this.nodes.get(a)?.rule.priority ?? 0;
      const bPriority = this.nodes.get(b)?.rule.priority ?? 0;
      return bPriority - aPriority;
    });

    // Process nodes
    while (queue.length > 0) {
      const ruleId = queue.shift()!;
      order.push(ruleId);

      const node = this.nodes.get(ruleId)!;
      for (const dependentId of node.outEdges) {
        const newDegree = (inDegree.get(dependentId) ?? 0) - 1;
        inDegree.set(dependentId, newDegree);

        if (newDegree === 0) {
          queue.push(dependentId);
          // Re-sort by priority
          queue.sort((a, b) => {
            const aPriority = this.nodes.get(a)?.rule.priority ?? 0;
            const bPriority = this.nodes.get(b)?.rule.priority ?? 0;
            return bPriority - aPriority;
          });
        }
      }
    }

    return order;
  }

  /**
   * Detect cycles in the graph using DFS
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];

    // Reset visited flags
    for (const node of this.nodes.values()) {
      node.visited = false;
      node.inStack = false;
    }

    const stack: string[] = [];

    const dfs = (ruleId: string): void => {
      const node = this.nodes.get(ruleId);
      if (!node) return;

      node.visited = true;
      node.inStack = true;
      stack.push(ruleId);

      for (const neighborId of node.inEdges) {
        const neighbor = this.nodes.get(neighborId);
        if (!neighbor) continue;

        if (!neighbor.visited) {
          dfs(neighborId);
        } else if (neighbor.inStack) {
          // Found a cycle
          const cycleStart = stack.indexOf(neighborId);
          const cycle = stack.slice(cycleStart);
          cycle.push(neighborId); // Complete the cycle
          cycles.push(cycle);
        }
      }

      node.inStack = false;
      stack.pop();
    };

    for (const ruleId of this.nodes.keys()) {
      const node = this.nodes.get(ruleId)!;
      if (!node.visited) {
        dfs(ruleId);
      }
    }

    return cycles;
  }

  /**
   * Detect conflicts between rules
   */
  detectConflicts(): RuleConflict[] {
    const conflicts: RuleConflict[] = [];

    // Convert nodes to array for pairwise comparison
    const rules = Array.from(this.nodes.values()).map((n) => n.rule);

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const ruleA = rules[i];
        const ruleB = rules[j];
        if (!ruleA || !ruleB) continue;

        // Check for contradicting decisions on same conditions
        const conflict = this.checkForConflict(ruleA, ruleB);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    // Check for circular override conflicts
    const cycles = this.detectCycles();
    for (const cycle of cycles) {
      if (cycle.length > 1) {
        const hasOverrides = cycle.some((ruleId) => {
          const node = this.nodes.get(ruleId);
          return node?.rule.overridesRules?.some((overId) => cycle.includes(overId));
        });

        if (hasOverrides) {
          const firstRuleId = cycle[0] ?? '';
          const secondToLastRuleId = cycle[cycle.length - 2] ?? '';
          conflicts.push({
            ruleA: firstRuleId,
            ruleB: secondToLastRuleId,
            conflictType: 'CIRCULAR_OVERRIDE',
            description: `Circular override chain detected: ${cycle.join(' -> ')}`,
            suggestedResolution: 'Break the override chain by removing one override relationship',
            severity: 'HIGH',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two rules conflict
   */
  private checkForConflict(ruleA: ArkaRule, ruleB: ArkaRule): RuleConflict | null {
    // Both rules must be applicable to same entity/event types
    if (!this.rulesOverlap(ruleA, ruleB)) {
      return null;
    }

    // Check for contradicting decisions (same severity, different decisions)
    if (
      ruleA.severity === ruleB.severity &&
      (ruleA.severity === 'HIGH' || ruleA.severity === 'CRITICAL') &&
      ruleA.consequence.decision !== ruleB.consequence.decision
    ) {
      // Check if conditions might overlap
      const conditionsOverlap = this.conditionsMightOverlap(ruleA.condition, ruleB.condition);

      if (conditionsOverlap) {
        return {
          ruleA: ruleA.id,
          ruleB: ruleB.id,
          conflictType: 'CONTRADICTING_DECISIONS',
          description: `Rules "${ruleA.name}" and "${ruleB.name}" have conflicting decisions (${ruleA.consequence.decision} vs ${ruleB.consequence.decision}) with potentially overlapping conditions`,
          suggestedResolution: `Consider adding mutual exclusion conditions or adjusting priorities`,
          severity: ruleA.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        };
      }
    }

    return null;
  }

  /**
   * Check if two rules could apply to the same events
   */
  private rulesOverlap(ruleA: ArkaRule, ruleB: ArkaRule): boolean {
    // Check entity type overlap
    if (ruleA.appliesToEntityType && ruleB.appliesToEntityType) {
      if (ruleA.appliesToEntityType !== ruleB.appliesToEntityType) {
        return false;
      }
    }

    // Check event type overlap
    if (ruleA.appliesToEventType && ruleB.appliesToEventType) {
      if (ruleA.appliesToEventType !== ruleB.appliesToEventType) {
        return false;
      }
    }

    // Check jurisdiction overlap
    if (ruleA.jurisdiction && ruleB.jurisdiction) {
      if (ruleA.jurisdiction !== ruleB.jurisdiction) {
        return false;
      }
    }

    return true;
  }

  /**
   * Heuristic check if conditions might overlap
   */
  private conditionsMightOverlap(
    condA: ArkaRule['condition'],
    condB: ArkaRule['condition']
  ): boolean {
    // Extract fields from both conditions
    const fieldsA = this.extractFields(condA);
    const fieldsB = this.extractFields(condB);

    // If they reference some of the same fields, they might overlap
    const commonFields = fieldsA.filter((f) => fieldsB.includes(f));
    return commonFields.length > 0;
  }

  /**
   * Extract field paths from a condition tree
   */
  private extractFields(condition: ArkaRule['condition']): string[] {
    const fields: string[] = [];

    const extract = (cond: ArkaRule['condition']): void => {
      switch (cond.type) {
        case 'compare':
          fields.push(cond.field);
          break;
        case 'and':
        case 'or':
          for (const child of cond.conditions) {
            extract(child);
          }
          break;
        case 'not':
          extract(cond.condition);
          break;
      }
    };

    extract(condition);
    return fields;
  }

  /**
   * Compute dependency levels for parallel execution
   */
  computeLevels(): string[][] {
    const levels: string[][] = [];
    const assigned = new Set<string>();

    // Reset levels
    for (const node of this.nodes.values()) {
      node.level = -1;
    }

    // Assign level 0 to nodes with no dependencies
    const level0: string[] = [];
    for (const [ruleId, node] of this.nodes) {
      if (node.inEdges.size === 0) {
        node.level = 0;
        level0.push(ruleId);
        assigned.add(ruleId);
      }
    }
    if (level0.length > 0) {
      levels.push(level0);
    }

    // Assign subsequent levels
    let currentLevel = 0;
    while (assigned.size < this.nodes.size) {
      const nextLevel: string[] = [];

      for (const [ruleId, node] of this.nodes) {
        if (assigned.has(ruleId)) continue;

        // Check if all dependencies are assigned
        let allDepsAssigned = true;
        let maxDepLevel = -1;

        for (const depId of node.inEdges) {
          const depNode = this.nodes.get(depId);
          if (!depNode || !assigned.has(depId)) {
            allDepsAssigned = false;
            break;
          }
          maxDepLevel = Math.max(maxDepLevel, depNode.level);
        }

        if (allDepsAssigned && maxDepLevel === currentLevel) {
          node.level = currentLevel + 1;
          nextLevel.push(ruleId);
          assigned.add(ruleId);
        }
      }

      if (nextLevel.length > 0) {
        levels.push(nextLevel);
        currentLevel++;
      } else if (assigned.size < this.nodes.size) {
        // Cycle detected - break out
        break;
      }
    }

    return levels;
  }

  /**
   * Get full analysis of the rule graph
   */
  analyze(): RuleGraphAnalysis {
    const executionOrder = this.computeExecutionOrder();
    const cycles = this.detectCycles();
    const conflicts = this.detectConflicts();
    const levels = this.computeLevels();

    const independentRules: string[] = [];
    for (const [ruleId, node] of this.nodes) {
      if (node.inEdges.size === 0 && node.outEdges.size === 0) {
        independentRules.push(ruleId);
      }
    }

    // Calculate statistics
    let totalEdges = 0;
    let totalDependencies = 0;
    for (const node of this.nodes.values()) {
      totalEdges += node.inEdges.size;
      totalDependencies += node.inEdges.size;
    }

    const maxDepth = levels.length;
    const avgDependencies = this.nodes.size > 0 ? totalDependencies / this.nodes.size : 0;

    return {
      executionOrder,
      cycles,
      conflicts,
      independentRules,
      levels,
      stats: {
        totalRules: this.nodes.size,
        totalEdges,
        maxDepth,
        avgDependencies,
      },
    };
  }

  /**
   * Get rules in execution order
   */
  getRulesInOrder(): ArkaRuleWithGraph[] {
    const order = this.computeExecutionOrder();
    return order.map((id) => this.nodes.get(id)!.rule);
  }

  /**
   * Get all rules
   */
  getAllRules(): ArkaRuleWithGraph[] {
    return Array.from(this.nodes.values()).map((n) => n.rule);
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): ArkaRuleWithGraph | undefined {
    return this.nodes.get(ruleId)?.rule;
  }

  /**
   * Get rules that depend on a given rule
   */
  getDependents(ruleId: string): ArkaRuleWithGraph[] {
    const node = this.nodes.get(ruleId);
    if (!node) return [];

    return Array.from(node.outEdges)
      .map((id) => this.nodes.get(id)?.rule)
      .filter((r): r is ArkaRuleWithGraph => r !== undefined);
  }

  /**
   * Get rules that a given rule depends on
   */
  getDependencies(ruleId: string): ArkaRuleWithGraph[] {
    const node = this.nodes.get(ruleId);
    if (!node) return [];

    return Array.from(node.inEdges)
      .map((id) => this.nodes.get(id)?.rule)
      .filter((r): r is ArkaRuleWithGraph => r !== undefined);
  }

  /**
   * Validate the graph structure
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      errors.push(`Found ${cycles.length} cycle(s) in the rule graph`);
      for (const cycle of cycles) {
        errors.push(`  Cycle: ${cycle.join(' -> ')}`);
      }
    }

    // Check for critical conflicts
    const conflicts = this.detectConflicts();
    const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL');
    if (criticalConflicts.length > 0) {
      errors.push(`Found ${criticalConflicts.length} critical conflict(s)`);
      for (const conflict of criticalConflicts) {
        errors.push(`  ${conflict.description}`);
      }
    }

    // Check for orphan override references
    for (const [ruleId, node] of this.nodes) {
      if (node.rule.overridesRules) {
        for (const overId of node.rule.overridesRules) {
          if (!this.nodes.has(overId)) {
            errors.push(`Rule "${ruleId}" overrides non-existent rule "${overId}"`);
          }
        }
      }
      if (node.rule.dependsOnRules) {
        for (const depId of node.rule.dependsOnRules) {
          if (!this.nodes.has(depId)) {
            errors.push(`Rule "${ruleId}" depends on non-existent rule "${depId}"`);
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Export graph to DOT format for visualization
   */
  toDot(): string {
    const lines: string[] = [];
    lines.push('digraph RuleGraph {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes
    for (const [ruleId, node] of this.nodes) {
      const label = node.rule.name.replace(/"/g, '\\"');
      const color = this.getSeverityColor(node.rule.severity);
      lines.push(`  "${ruleId}" [label="${label}" color="${color}"];`);
    }

    lines.push('');

    // Add edges
    for (const [sourceId, edges] of this.edges) {
      for (const edge of edges) {
        const style = edge.type === 'DEPENDS_ON' ? 'solid' : 'dashed';
        const color = edge.type === 'OVERRIDES' ? 'red' : 'black';
        lines.push(`  "${sourceId}" -> "${edge.to}" [style="${style}" color="${color}"];`);
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'red';
      case 'HIGH':
        return 'orange';
      case 'MEDIUM':
        return 'yellow';
      case 'LOW':
        return 'green';
      default:
        return 'black';
    }
  }

  /**
   * Serialize graph to JSON
   */
  toJSON(): object {
    return {
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        rule: node.rule,
        inEdges: Array.from(node.inEdges),
        outEdges: Array.from(node.outEdges),
        level: node.level,
      })),
      edges: Array.from(this.edges.entries()).map(([from, edges]) => ({
        from,
        edges,
      })),
      relationships: this.relationships,
    };
  }

  /**
   * Create graph from JSON
   */
  static fromJSON(json: {
    nodes: Array<{ id: string; rule: ArkaRuleWithGraph }>;
    relationships: RuleRelationship[];
  }): RuleGraph {
    const graph = new RuleGraph();

    for (const node of json.nodes) {
      graph.addRule(node.rule);
    }

    for (const rel of json.relationships) {
      try {
        graph.addRelationship(rel);
      } catch {
        // Ignore missing rule references
      }
    }

    return graph;
  }
}

/**
 * Create a rule graph from an array of rules
 */
export function createRuleGraph(rules: ArkaRuleWithGraph[]): RuleGraph {
  return new RuleGraph(rules);
}

/**
 * Analyze rules and return execution plan
 */
export function analyzeRules(rules: ArkaRuleWithGraph[]): RuleGraphAnalysis {
  const graph = new RuleGraph(rules);
  return graph.analyze();
}
