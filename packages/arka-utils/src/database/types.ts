/**
 * Database Types
 *
 * Common types for database utilities.
 */

/**
 * Query result type
 */
export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  duration: number;
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
  /** Maximum connections in pool */
  maxConnections: number;
  /** Minimum connections to maintain */
  minConnections?: number;
  /** Idle connection timeout (ms) */
  idleTimeout?: number;
  /** Connection acquisition timeout (ms) */
  acquireTimeout?: number;
  /** Connection creation timeout (ms) */
  connectionTimeout?: number;
  /** Statement timeout (ms) */
  statementTimeout?: number;
  /** Max connection lifetime (ms) */
  maxLifetime?: number;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  waitingRequests: number;
  acquireCount: number;
  releaseCount: number;
  timeoutCount: number;
  avgAcquireTime: number;
}

/**
 * Query options
 */
export interface QueryOptions {
  /** Query timeout in milliseconds */
  timeout?: number;
  /** Name for prepared statement caching */
  name?: string;
  /** Row limit */
  limit?: number;
  /** Row offset */
  offset?: number;
}

/**
 * Sort direction
 */
export type SortDirection = 'ASC' | 'DESC';

/**
 * Sort configuration
 */
export interface SortConfig {
  column: string;
  direction: SortDirection;
  nulls?: 'FIRST' | 'LAST';
}

/**
 * Pagination configuration
 */
export interface PaginationConfig {
  page: number;
  pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Filter operator
 */
export type FilterOperator =
  | 'eq'      // equals
  | 'neq'     // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'like'    // LIKE pattern match
  | 'ilike'   // case-insensitive LIKE
  | 'in'      // IN array
  | 'nin'     // NOT IN array
  | 'null'    // IS NULL
  | 'nnull'   // IS NOT NULL
  | 'between' // BETWEEN range
  | 'contains' // array contains
  | 'overlaps'; // array overlaps

/**
 * Filter condition
 */
export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  estimatedRows: number;
  estimatedCost: number;
  actualTime?: number;
  planNodes: QueryPlanNode[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Query plan node
 */
export interface QueryPlanNode {
  nodeType: string;
  relationName?: string;
  alias?: string;
  startupCost: number;
  totalCost: number;
  planRows: number;
  planWidth: number;
  actualRows?: number;
  actualLoops?: number;
  actualStartupTime?: number;
  actualTotalTime?: number;
  indexName?: string;
  indexCondition?: string;
  filter?: string;
  children?: QueryPlanNode[];
}

/**
 * Index recommendation
 */
export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'brin';
  reason: string;
  estimatedImpact: 'low' | 'medium' | 'high';
}
