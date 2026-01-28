/**
 * Query Analyzer
 *
 * Utilities for analyzing and optimizing database queries.
 */

import type {
  QueryAnalysis,
  QueryPlanNode,
  IndexRecommendation,
} from './types.js';

/**
 * Parse PostgreSQL EXPLAIN output into structured format
 */
export function parseExplainOutput(explainOutput: string): QueryAnalysis {
  const lines = explainOutput.split('\n').filter(l => l.trim());
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Parse the plan tree
  const planNodes = parsePlanNodes(lines);
  const rootNode = planNodes[0];

  // Extract top-level metrics
  const estimatedRows = rootNode?.planRows ?? 0;
  const estimatedCost = rootNode?.totalCost ?? 0;
  const actualTime = rootNode?.actualTotalTime;

  // Analyze for potential issues
  analyzeForWarnings(planNodes, warnings, suggestions);

  return {
    estimatedRows,
    estimatedCost,
    actualTime,
    planNodes,
    warnings,
    suggestions,
  };
}

/**
 * Parse plan nodes from EXPLAIN output lines
 */
function parsePlanNodes(lines: string[]): QueryPlanNode[] {
  const nodes: QueryPlanNode[] = [];
  const nodeStack: { node: QueryPlanNode; indent: number }[] = [];

  for (const line of lines) {
    const match = line.match(/^(\s*)(->)?\s*(.+)$/);
    if (!match) continue;

    const indent = match[1]?.length ?? 0;
    const content = match[3]?.trim() ?? '';

    const node = parseNodeLine(content);
    if (!node) continue;

    // Find parent based on indentation
    while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1]!.indent >= indent) {
      nodeStack.pop();
    }

    if (nodeStack.length > 0) {
      const parent = nodeStack[nodeStack.length - 1]!.node;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(node);
    } else {
      nodes.push(node);
    }

    nodeStack.push({ node, indent });
  }

  return nodes;
}

/**
 * Parse a single plan node line
 */
function parseNodeLine(line: string): QueryPlanNode | null {
  // Match patterns like: "Seq Scan on users  (cost=0.00..15.00 rows=500 width=100)"
  const baseMatch = line.match(
    /^([\w\s]+?)(?:\s+on\s+(\w+))?(?:\s+(\w+))?\s*\(cost=(\d+\.?\d*)\.\.(\d+\.?\d*)\s+rows=(\d+)\s+width=(\d+)\)/
  );

  if (!baseMatch) {
    // Try simpler pattern for actual time
    const simpleMatch = line.match(/^([\w\s]+)/);
    if (simpleMatch) {
      return {
        nodeType: simpleMatch[1]?.trim() ?? 'Unknown',
        startupCost: 0,
        totalCost: 0,
        planRows: 0,
        planWidth: 0,
      };
    }
    return null;
  }

  const node: QueryPlanNode = {
    nodeType: baseMatch[1]?.trim() ?? 'Unknown',
    relationName: baseMatch[2],
    alias: baseMatch[3],
    startupCost: parseFloat(baseMatch[4] ?? '0'),
    totalCost: parseFloat(baseMatch[5] ?? '0'),
    planRows: parseInt(baseMatch[6] ?? '0', 10),
    planWidth: parseInt(baseMatch[7] ?? '0', 10),
  };

  // Parse actual time if present (from EXPLAIN ANALYZE)
  const actualMatch = line.match(
    /actual time=(\d+\.?\d*)\.\.(\d+\.?\d*)\s+rows=(\d+)\s+loops=(\d+)/
  );
  if (actualMatch) {
    node.actualStartupTime = parseFloat(actualMatch[1] ?? '0');
    node.actualTotalTime = parseFloat(actualMatch[2] ?? '0');
    node.actualRows = parseInt(actualMatch[3] ?? '0', 10);
    node.actualLoops = parseInt(actualMatch[4] ?? '0', 10);
  }

  // Parse index info
  const indexMatch = line.match(/Index (?:Scan|Only Scan) using (\w+)/);
  if (indexMatch) {
    node.indexName = indexMatch[1];
  }

  const indexCondMatch = line.match(/Index Cond: (.+?)(?:\)|$)/);
  if (indexCondMatch) {
    node.indexCondition = indexCondMatch[1];
  }

  const filterMatch = line.match(/Filter: (.+?)(?:\)|$)/);
  if (filterMatch) {
    node.filter = filterMatch[1];
  }

  return node;
}

/**
 * Analyze plan for potential issues and suggestions
 */
function analyzeForWarnings(
  nodes: QueryPlanNode[],
  warnings: string[],
  suggestions: string[]
): void {
  const allNodes = flattenNodes(nodes);

  for (const node of allNodes) {
    // Sequential scan on large tables
    if (node.nodeType.includes('Seq Scan') && node.planRows > 1000) {
      warnings.push(
        `Sequential scan on ${node.relationName || 'table'} with ${node.planRows} estimated rows`
      );
      suggestions.push(
        `Consider adding an index on ${node.relationName || 'table'} for the filter columns`
      );
    }

    // Nested loops with high row counts
    if (node.nodeType.includes('Nested Loop') && node.planRows > 10000) {
      warnings.push(
        `Nested loop join producing ${node.planRows} rows - may be slow`
      );
      suggestions.push(
        'Consider restructuring the query or adding indexes to use hash/merge joins'
      );
    }

    // Hash joins using lots of memory
    if (node.nodeType.includes('Hash Join') && node.planRows > 100000) {
      warnings.push(`Large hash join with ${node.planRows} rows`);
      suggestions.push(
        'Consider increasing work_mem or restructuring the query'
      );
    }

    // Sort operations
    if (node.nodeType.includes('Sort') && node.planRows > 10000) {
      warnings.push(`Sort operation on ${node.planRows} rows`);
      suggestions.push(
        'Consider adding an index to avoid sorting'
      );
    }

    // Actual vs estimated row difference (from ANALYZE)
    if (node.actualRows !== undefined && node.planRows > 0) {
      const ratio = node.actualRows / node.planRows;
      if (ratio > 10 || ratio < 0.1) {
        warnings.push(
          `Row estimate mismatch: estimated ${node.planRows}, actual ${node.actualRows}`
        );
        suggestions.push(
          'Consider running ANALYZE on the table to update statistics'
        );
      }
    }
  }
}

/**
 * Flatten nested plan nodes
 */
function flattenNodes(nodes: QueryPlanNode[]): QueryPlanNode[] {
  const result: QueryPlanNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenNodes(node.children));
    }
  }
  return result;
}

/**
 * Generate index recommendations based on query patterns
 */
export function recommendIndexes(
  tableName: string,
  queryPatterns: QueryPattern[]
): IndexRecommendation[] {
  const recommendations: IndexRecommendation[] = [];
  const columnUsage = new Map<string, { where: number; join: number; order: number }>();

  // Analyze query patterns
  for (const pattern of queryPatterns) {
    for (const col of pattern.whereColumns) {
      const usage = columnUsage.get(col) ?? { where: 0, join: 0, order: 0 };
      usage.where += pattern.frequency;
      columnUsage.set(col, usage);
    }
    for (const col of pattern.joinColumns) {
      const usage = columnUsage.get(col) ?? { where: 0, join: 0, order: 0 };
      usage.join += pattern.frequency;
      columnUsage.set(col, usage);
    }
    for (const col of pattern.orderColumns) {
      const usage = columnUsage.get(col) ?? { where: 0, join: 0, order: 0 };
      usage.order += pattern.frequency;
      columnUsage.set(col, usage);
    }
  }

  // Generate recommendations based on usage
  for (const [column, usage] of columnUsage) {
    const totalUsage = usage.where + usage.join + usage.order;

    if (totalUsage >= 10) {
      let impact: 'low' | 'medium' | 'high' = 'low';
      if (totalUsage >= 100) impact = 'high';
      else if (totalUsage >= 50) impact = 'medium';

      const reasons: string[] = [];
      if (usage.where > 0) reasons.push(`WHERE clause (${usage.where}x)`);
      if (usage.join > 0) reasons.push(`JOIN condition (${usage.join}x)`);
      if (usage.order > 0) reasons.push(`ORDER BY (${usage.order}x)`);

      recommendations.push({
        table: tableName,
        columns: [column],
        type: 'btree',
        reason: `Frequently used in: ${reasons.join(', ')}`,
        estimatedImpact: impact,
      });
    }
  }

  // Identify composite index opportunities
  for (const pattern of queryPatterns) {
    if (pattern.whereColumns.length >= 2 && pattern.frequency >= 20) {
      recommendations.push({
        table: tableName,
        columns: pattern.whereColumns,
        type: 'btree',
        reason: `Composite index for frequent query pattern (${pattern.frequency}x)`,
        estimatedImpact: pattern.frequency >= 50 ? 'high' : 'medium',
      });
    }
  }

  return recommendations;
}

/**
 * Query pattern for analysis
 */
export interface QueryPattern {
  whereColumns: string[];
  joinColumns: string[];
  orderColumns: string[];
  frequency: number;
}

/**
 * Query complexity analyzer
 */
export function analyzeQueryComplexity(sql: string): QueryComplexity {
  const normalizedSql = sql.toUpperCase();

  const metrics: QueryComplexity = {
    score: 0,
    joinCount: 0,
    subqueryCount: 0,
    aggregateCount: 0,
    hasGroupBy: false,
    hasOrderBy: false,
    hasDistinct: false,
    hasUnion: false,
    hasSubquery: false,
    estimatedComplexity: 'simple',
  };

  // Count JOINs
  const joinMatches = normalizedSql.match(/\bJOIN\b/g);
  metrics.joinCount = joinMatches?.length ?? 0;
  metrics.score += metrics.joinCount * 10;

  // Count subqueries
  const subqueryMatches = normalizedSql.match(/\(\s*SELECT\b/g);
  metrics.subqueryCount = subqueryMatches?.length ?? 0;
  metrics.hasSubquery = metrics.subqueryCount > 0;
  metrics.score += metrics.subqueryCount * 20;

  // Count aggregates
  const aggregateMatches = normalizedSql.match(/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/g);
  metrics.aggregateCount = aggregateMatches?.length ?? 0;
  metrics.score += metrics.aggregateCount * 5;

  // Check clauses
  metrics.hasGroupBy = normalizedSql.includes('GROUP BY');
  if (metrics.hasGroupBy) metrics.score += 10;

  metrics.hasOrderBy = normalizedSql.includes('ORDER BY');
  if (metrics.hasOrderBy) metrics.score += 5;

  metrics.hasDistinct = normalizedSql.includes('DISTINCT');
  if (metrics.hasDistinct) metrics.score += 5;

  metrics.hasUnion = normalizedSql.includes('UNION');
  if (metrics.hasUnion) metrics.score += 15;

  // Determine complexity level
  if (metrics.score >= 50) {
    metrics.estimatedComplexity = 'complex';
  } else if (metrics.score >= 20) {
    metrics.estimatedComplexity = 'moderate';
  }

  return metrics;
}

/**
 * Query complexity metrics
 */
export interface QueryComplexity {
  score: number;
  joinCount: number;
  subqueryCount: number;
  aggregateCount: number;
  hasGroupBy: boolean;
  hasOrderBy: boolean;
  hasDistinct: boolean;
  hasUnion: boolean;
  hasSubquery: boolean;
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Query optimization hints
 */
export function getOptimizationHints(analysis: QueryAnalysis): string[] {
  const hints: string[] = [];

  // Add all suggestions from analysis
  hints.push(...analysis.suggestions);

  // Additional general hints
  if (analysis.estimatedRows > 10000) {
    hints.push('Consider using LIMIT if you don\'t need all results');
  }

  if (analysis.estimatedCost > 1000) {
    hints.push('Query cost is high - review execution plan for bottlenecks');
  }

  return [...new Set(hints)]; // Remove duplicates
}
