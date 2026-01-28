/**
 * Connection Pool Tests
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOptimalPoolSize,
  poolPresets,
  checkPoolHealth,
  ConnectionStringBuilder,
  connectionString,
  parseConnectionString,
  isRetryableDbError,
  defaultDbRetryConfig,
} from './connectionPool.js';
import type { PoolStats, PoolConfig } from './types.js';

describe('ConnectionPool', () => {
  describe('calculateOptimalPoolSize', () => {
    it('should calculate pool size based on CPU cores', () => {
      // 4 cores: (4 * 2 + 1) * 1.5 = 13.5 → 14
      const size = calculateOptimalPoolSize({ cpuCores: 4 });
      expect(size).toBeGreaterThanOrEqual(10);
      expect(size).toBeLessThanOrEqual(20);
    });

    it('should cap at 100 for many cores', () => {
      const size = calculateOptimalPoolSize({ cpuCores: 64 });
      expect(size).toBeLessThanOrEqual(100);
    });

    it('should ensure minimum of 5', () => {
      const size = calculateOptimalPoolSize({ cpuCores: 1 });
      expect(size).toBeGreaterThanOrEqual(5);
    });

    it('should respect expected concurrency limit', () => {
      const size = calculateOptimalPoolSize({
        cpuCores: 16,
        expectedConcurrentQueries: 10,
      });
      expect(size).toBeLessThanOrEqual(20); // 10 * 2
    });

    it('should adjust for sync vs async', () => {
      const asyncSize = calculateOptimalPoolSize({ cpuCores: 4, isAsync: true });
      const syncSize = calculateOptimalPoolSize({ cpuCores: 4, isAsync: false });
      expect(asyncSize).toBeGreaterThan(syncSize);
    });
  });

  describe('poolPresets', () => {
    it('should have development preset with small pool', () => {
      expect(poolPresets.development.maxConnections).toBeLessThanOrEqual(10);
      expect(poolPresets.development.idleTimeout).toBeLessThan(poolPresets.production.idleTimeout);
    });

    it('should have production preset with reasonable defaults', () => {
      expect(poolPresets.production.maxConnections).toBeGreaterThanOrEqual(10);
      expect(poolPresets.production.minConnections).toBeGreaterThan(0);
    });

    it('should have serverless preset with single connection', () => {
      expect(poolPresets.serverless.maxConnections).toBe(1);
      expect(poolPresets.serverless.minConnections).toBe(0);
      expect(poolPresets.serverless.idleTimeout).toBeLessThanOrEqual(1000);
    });

    it('should have batch processing preset with long timeouts', () => {
      expect(poolPresets.batchProcessing.statementTimeout).toBeGreaterThan(60000);
      expect(poolPresets.batchProcessing.maxLifetime).toBeGreaterThan(3600000);
    });
  });

  describe('checkPoolHealth', () => {
    const config: PoolConfig = {
      maxConnections: 20,
      minConnections: 5,
    };

    it('should report healthy for normal usage', () => {
      const stats: PoolStats = {
        totalConnections: 20,
        idleConnections: 15,
        waitingRequests: 0,
        acquireCount: 1000,
        releaseCount: 1000,
        timeoutCount: 0,
        avgAcquireTime: 5,
      };

      const health = checkPoolHealth(stats, config);
      expect(health.isHealthy).toBe(true);
      expect(health.metrics.utilizationPercent).toBe(25);
      expect(health.recommendations).toHaveLength(0);
    });

    it('should warn when pool is nearly exhausted', () => {
      const stats: PoolStats = {
        totalConnections: 20,
        idleConnections: 0,
        waitingRequests: 10,
        acquireCount: 1000,
        releaseCount: 990,
        timeoutCount: 10,
        avgAcquireTime: 50,
      };

      const health = checkPoolHealth(stats, config);
      expect(health.isHealthy).toBe(false);
      expect(health.checks.connectionsAvailable).toBe(false);
      expect(health.recommendations.length).toBeGreaterThan(0);
    });

    it('should warn about high timeout rate', () => {
      const stats: PoolStats = {
        totalConnections: 20,
        idleConnections: 5,
        waitingRequests: 0,
        acquireCount: 100,
        releaseCount: 94,
        timeoutCount: 10, // 10% timeout rate
        avgAcquireTime: 20,
      };

      const health = checkPoolHealth(stats, config);
      expect(health.checks.timeoutsAcceptable).toBe(false);
      expect(health.metrics.timeoutRate).toBe(0.1);
    });

    it('should suggest reducing pool size when underutilized', () => {
      const stats: PoolStats = {
        totalConnections: 20,
        idleConnections: 19,
        waitingRequests: 0,
        acquireCount: 100,
        releaseCount: 100,
        timeoutCount: 0,
        avgAcquireTime: 1,
      };

      const health = checkPoolHealth(stats, config);
      expect(health.metrics.utilizationPercent).toBe(5);
      expect(health.recommendations.some(r => r.includes('reducing'))).toBe(true);
    });
  });

  describe('ConnectionStringBuilder', () => {
    it('should build basic connection string', () => {
      const url = connectionString()
        .setHost('localhost')
        .setPort(5432)
        .setDatabase('mydb')
        .setUser('myuser')
        .setPassword('mypassword')
        .build();

      expect(url).toBe('postgresql://myuser:mypassword@localhost:5432/mydb');
    });

    it('should handle SSL', () => {
      const url = connectionString()
        .setHost('prod.example.com')
        .setDatabase('proddb')
        .setUser('admin')
        .setPassword('secret')
        .setSsl(true)
        .build();

      expect(url).toContain('sslmode=require');
    });

    it('should encode special characters', () => {
      const url = connectionString()
        .setHost('localhost')
        .setDatabase('db')
        .setUser('user@domain')
        .setPassword('p@ss/word')
        .build();

      expect(url).toContain('user%40domain');
      expect(url).toContain('p%40ss%2Fword');
    });

    it('should add custom parameters', () => {
      const url = connectionString()
        .setHost('localhost')
        .setDatabase('db')
        .setUser('user')
        .setParam('application_name', 'myapp')
        .setParam('connect_timeout', 10)
        .build();

      expect(url).toContain('application_name=myapp');
      expect(url).toContain('connect_timeout=10');
    });

    it('should apply pool config', () => {
      const url = connectionString()
        .setHost('localhost')
        .setDatabase('db')
        .setUser('user')
        .applyPoolConfig({
          connectionTimeout: 5000,
          statementTimeout: 30000,
        })
        .build();

      expect(url).toContain('connect_timeout=5');
      expect(url).toContain('statement_timeout=30000');
    });
  });

  describe('parseConnectionString', () => {
    it('should parse basic connection string', () => {
      const parsed = parseConnectionString(
        'postgresql://myuser:mypassword@localhost:5432/mydb'
      );

      expect(parsed.host).toBe('localhost');
      expect(parsed.port).toBe(5432);
      expect(parsed.database).toBe('mydb');
      expect(parsed.user).toBe('myuser');
      expect(parsed.password).toBe('mypassword');
    });

    it('should detect SSL mode', () => {
      const parsed = parseConnectionString(
        'postgresql://user@localhost:5432/db?sslmode=require'
      );

      expect(parsed.ssl).toBe(true);
    });

    it('should parse query parameters', () => {
      const parsed = parseConnectionString(
        'postgresql://user@localhost:5432/db?application_name=test&connect_timeout=10'
      );

      expect(parsed.params['application_name']).toBe('test');
      expect(parsed.params['connect_timeout']).toBe('10');
    });

    it('should handle encoded characters', () => {
      const parsed = parseConnectionString(
        'postgresql://user%40domain:p%40ss@localhost:5432/db'
      );

      expect(parsed.user).toBe('user@domain');
      expect(parsed.password).toBe('p@ss');
    });
  });

  describe('isRetryableDbError', () => {
    it('should identify retryable error codes', () => {
      expect(isRetryableDbError({ code: '40001' })).toBe(true); // serialization_failure
      expect(isRetryableDbError({ code: '40P01' })).toBe(true); // deadlock_detected
      expect(isRetryableDbError({ code: '57P01' })).toBe(true); // admin_shutdown
    });

    it('should not retry non-retryable errors', () => {
      expect(isRetryableDbError({ code: '23505' })).toBe(false); // unique_violation
      expect(isRetryableDbError({ code: '42P01' })).toBe(false); // undefined_table
    });

    it('should handle non-error objects', () => {
      expect(isRetryableDbError(null)).toBe(false);
      expect(isRetryableDbError(undefined)).toBe(false);
      expect(isRetryableDbError('error')).toBe(false);
      expect(isRetryableDbError({})).toBe(false);
    });

    it('should use custom config', () => {
      const customConfig = {
        ...defaultDbRetryConfig,
        retryableErrorCodes: ['CUSTOM1', 'CUSTOM2'],
      };

      expect(isRetryableDbError({ code: 'CUSTOM1' }, customConfig)).toBe(true);
      expect(isRetryableDbError({ code: '40001' }, customConfig)).toBe(false);
    });
  });
});
