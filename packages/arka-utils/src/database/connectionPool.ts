/**
 * Connection Pool Utilities
 *
 * Helpers for managing database connection pools effectively.
 */

import type { PoolConfig, PoolStats } from './types.js';

/**
 * Default pool configuration optimized for common use cases
 */
export const defaultPoolConfig: Required<PoolConfig> = {
  maxConnections: 20,
  minConnections: 2,
  idleTimeout: 30000,      // 30 seconds
  acquireTimeout: 10000,   // 10 seconds
  connectionTimeout: 5000, // 5 seconds
  statementTimeout: 30000, // 30 seconds
  maxLifetime: 1800000,    // 30 minutes
};

/**
 * Calculate optimal pool size based on workload
 *
 * Formula based on PostgreSQL best practices:
 * - connections = (core_count * 2) + effective_spindle_count
 * - For SSD: effective_spindle_count ≈ 1
 * - For HDD: effective_spindle_count = actual disk count
 *
 * This is a simplified version for cloud deployments.
 */
export function calculateOptimalPoolSize(options: {
  cpuCores: number;
  isAsync?: boolean;
  expectedConcurrentQueries?: number;
}): number {
  const { cpuCores, isAsync = true, expectedConcurrentQueries } = options;

  // Base formula: (cores * 2) + 1 for SSD storage
  const basePoolSize = cpuCores * 2 + 1;

  // Adjust for async I/O (Node.js is async)
  const adjustedSize = isAsync ? Math.ceil(basePoolSize * 1.5) : basePoolSize;

  // Cap based on expected concurrency if provided
  if (expectedConcurrentQueries) {
    return Math.min(adjustedSize, expectedConcurrentQueries * 2);
  }

  // Reasonable caps
  return Math.min(Math.max(adjustedSize, 5), 100);
}

/**
 * Pool configuration presets for different deployment scenarios
 */
export const poolPresets = {
  /**
   * Development - small pool, quick timeouts
   */
  development: {
    maxConnections: 5,
    minConnections: 1,
    idleTimeout: 10000,
    acquireTimeout: 5000,
    connectionTimeout: 3000,
    statementTimeout: 15000,
    maxLifetime: 600000, // 10 minutes
  } as Required<PoolConfig>,

  /**
   * Production - balanced for typical web apps
   */
  production: {
    maxConnections: 20,
    minConnections: 5,
    idleTimeout: 30000,
    acquireTimeout: 10000,
    connectionTimeout: 5000,
    statementTimeout: 30000,
    maxLifetime: 1800000, // 30 minutes
  } as Required<PoolConfig>,

  /**
   * High throughput - larger pool for high traffic
   */
  highThroughput: {
    maxConnections: 50,
    minConnections: 10,
    idleTimeout: 60000,
    acquireTimeout: 15000,
    connectionTimeout: 5000,
    statementTimeout: 60000,
    maxLifetime: 3600000, // 1 hour
  } as Required<PoolConfig>,

  /**
   * Serverless - optimized for Lambda/Cloud Functions
   */
  serverless: {
    maxConnections: 1,
    minConnections: 0,
    idleTimeout: 1000,
    acquireTimeout: 3000,
    connectionTimeout: 2000,
    statementTimeout: 15000,
    maxLifetime: 60000, // 1 minute
  } as Required<PoolConfig>,

  /**
   * Long-running tasks - for batch jobs
   */
  batchProcessing: {
    maxConnections: 10,
    minConnections: 2,
    idleTimeout: 120000,
    acquireTimeout: 30000,
    connectionTimeout: 10000,
    statementTimeout: 300000, // 5 minutes
    maxLifetime: 7200000, // 2 hours
  } as Required<PoolConfig>,
};

/**
 * Pool health checker
 */
export interface PoolHealthCheck {
  isHealthy: boolean;
  checks: {
    connectionsAvailable: boolean;
    waitingQueueAcceptable: boolean;
    timeoutsAcceptable: boolean;
    hitRateAcceptable: boolean;
  };
  metrics: {
    utilizationPercent: number;
    waitingQueueLength: number;
    timeoutRate: number;
    acquireSuccessRate: number;
  };
  recommendations: string[];
}

/**
 * Check pool health based on stats
 */
export function checkPoolHealth(
  stats: PoolStats,
  config: PoolConfig
): PoolHealthCheck {
  const recommendations: string[] = [];

  // Calculate metrics
  const utilizationPercent =
    ((config.maxConnections - stats.idleConnections) / config.maxConnections) * 100;
  const timeoutRate =
    stats.acquireCount > 0
      ? stats.timeoutCount / stats.acquireCount
      : 0;
  const acquireSuccessRate =
    stats.acquireCount > 0
      ? (stats.acquireCount - stats.timeoutCount) / stats.acquireCount
      : 1;

  // Perform checks
  const checks = {
    connectionsAvailable: stats.idleConnections > 0 || utilizationPercent < 90,
    waitingQueueAcceptable: stats.waitingRequests < config.maxConnections * 2,
    timeoutsAcceptable: timeoutRate < 0.05, // Less than 5% timeout rate
    hitRateAcceptable: acquireSuccessRate > 0.95,
  };

  // Generate recommendations
  if (!checks.connectionsAvailable) {
    recommendations.push(
      `Pool utilization is ${utilizationPercent.toFixed(1)}% - consider increasing maxConnections`
    );
  }

  if (!checks.waitingQueueAcceptable) {
    recommendations.push(
      `${stats.waitingRequests} requests waiting - pool may be undersized`
    );
  }

  if (!checks.timeoutsAcceptable) {
    recommendations.push(
      `Timeout rate is ${(timeoutRate * 100).toFixed(1)}% - increase pool size or optimize queries`
    );
  }

  if (stats.avgAcquireTime > 100) {
    recommendations.push(
      `Average acquire time is ${stats.avgAcquireTime.toFixed(0)}ms - consider increasing pool size`
    );
  }

  if (utilizationPercent < 10 && config.maxConnections > 5) {
    recommendations.push(
      'Pool utilization is very low - consider reducing maxConnections to save resources'
    );
  }

  const isHealthy = Object.values(checks).every(Boolean);

  return {
    isHealthy,
    checks,
    metrics: {
      utilizationPercent,
      waitingQueueLength: stats.waitingRequests,
      timeoutRate,
      acquireSuccessRate,
    },
    recommendations,
  };
}

/**
 * Connection string builder
 */
export class ConnectionStringBuilder {
  private params: Record<string, string | number> = {};
  private host = 'localhost';
  private port = 5432;
  private database = '';
  private user = '';
  private password = '';
  private ssl = false;

  setHost(host: string): this {
    this.host = host;
    return this;
  }

  setPort(port: number): this {
    this.port = port;
    return this;
  }

  setDatabase(database: string): this {
    this.database = database;
    return this;
  }

  setUser(user: string): this {
    this.user = user;
    return this;
  }

  setPassword(password: string): this {
    this.password = password;
    return this;
  }

  setSsl(enabled: boolean): this {
    this.ssl = enabled;
    return this;
  }

  setParam(key: string, value: string | number): this {
    this.params[key] = value;
    return this;
  }

  /**
   * Apply pool configuration as connection parameters
   */
  applyPoolConfig(config: Partial<PoolConfig>): this {
    if (config.connectionTimeout) {
      this.params['connect_timeout'] = Math.ceil(config.connectionTimeout / 1000);
    }
    if (config.statementTimeout) {
      this.params['statement_timeout'] = config.statementTimeout;
    }
    return this;
  }

  /**
   * Build PostgreSQL connection string
   */
  build(): string {
    const auth = this.password
      ? `${encodeURIComponent(this.user)}:${encodeURIComponent(this.password)}`
      : encodeURIComponent(this.user);

    let url = `postgresql://${auth}@${this.host}:${this.port}/${this.database}`;

    const queryParams: string[] = [];
    if (this.ssl) {
      queryParams.push('sslmode=require');
    }
    for (const [key, value] of Object.entries(this.params)) {
      queryParams.push(`${key}=${encodeURIComponent(String(value))}`);
    }

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    return url;
  }
}

/**
 * Create a connection string builder
 */
export function connectionString(): ConnectionStringBuilder {
  return new ConnectionStringBuilder();
}

/**
 * Parse a connection string into components
 */
export function parseConnectionString(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: boolean;
  params: Record<string, string>;
} {
  const parsed = new URL(url);

  const params: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams) {
    params[key] = value;
  }

  return {
    host: parsed.hostname || 'localhost',
    port: parseInt(parsed.port, 10) || 5432,
    database: parsed.pathname.slice(1), // Remove leading /
    user: decodeURIComponent(parsed.username),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    ssl: params['sslmode'] === 'require' || params['ssl'] === 'true',
    params,
  };
}

/**
 * Retry configuration for transient database errors
 */
export interface DbRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrorCodes: string[];
}

/**
 * Default retry configuration for PostgreSQL
 */
export const defaultDbRetryConfig: DbRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  retryableErrorCodes: [
    '40001', // serialization_failure
    '40P01', // deadlock_detected
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
  ],
};

/**
 * Check if an error is retryable
 */
export function isRetryableDbError(
  error: unknown,
  config: DbRetryConfig = defaultDbRetryConfig
): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return config.retryableErrorCodes.includes(code);
  }
  return false;
}
