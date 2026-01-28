/**
 * ARKA Metrics Middleware
 *
 * Express middleware for automatic request metrics collection.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  defaultRegistry,
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestsInFlight,
} from './metrics.js';
import { createSpan, injectTraceContext, extractTraceContext } from './tracing.js';

/**
 * Normalize path to avoid high-cardinality metrics
 * Replaces dynamic segments like IDs with placeholders
 */
function normalizePath(path: string): string {
  return path
    // UUID pattern
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    // Numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Base64-like tokens
    .replace(/\/[A-Za-z0-9_-]{20,}/g, '/:token')
    // Trailing slashes
    .replace(/\/+$/, '') || '/';
}

export interface MetricsMiddlewareConfig {
  /** Skip metrics for certain paths */
  skipPaths?: string[];
  /** Custom path normalizer */
  pathNormalizer?: (path: string) => string;
  /** Include path in metrics (can cause high cardinality) */
  includePath?: boolean;
  /** Enable request tracing */
  enableTracing?: boolean;
}

/**
 * Creates metrics middleware for Express
 */
export function createMetricsMiddleware(config: MetricsMiddlewareConfig = {}) {
  const {
    skipPaths = ['/health', '/metrics', '/ready', '/live'],
    pathNormalizer = normalizePath,
    includePath = true,
    enableTracing = true,
  } = config;

  return function metricsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Skip metrics for certain paths
    if (skipPaths.some(p => req.path.startsWith(p))) {
      next();
      return;
    }

    const startTime = performance.now();
    const method = req.method;
    const path = includePath ? pathNormalizer(req.path) : 'all';

    // Track in-flight requests
    httpRequestsInFlight.inc({ method });

    // Extract trace context from incoming request
    let span: ReturnType<typeof createSpan> | null = null;
    if (enableTracing) {
      const parentContext = extractTraceContext(req.headers as Record<string, string | string[] | undefined>);
      span = createSpan(`${method} ${path}`, 'server');
      span.setAttributes({
        'http.method': method,
        'http.url': req.url,
        'http.target': req.path,
        'http.host': req.hostname,
        'http.scheme': req.protocol,
        'http.user_agent': req.get('user-agent') || '',
      });

      if (parentContext) {
        span.setAttribute('parent.trace_id', parentContext.traceId);
      }
    }

    const activeSpan = span?.start();

    // Capture response metrics
    const originalEnd = res.end;
    res.end = function(this: Response, ...args: Parameters<Response['end']>): Response {
      const duration = (performance.now() - startTime) / 1000; // Convert to seconds
      const status = res.statusCode.toString();

      // Record metrics
      httpRequestsTotal.inc({ method, path, status });
      httpRequestDuration.observe({ method, path, status }, duration);
      httpRequestsInFlight.dec({ method });

      // Complete span
      if (activeSpan) {
        activeSpan.setAttributes({
          'http.status_code': res.statusCode,
          'http.response_content_length': res.get('content-length') || 0,
        });

        if (res.statusCode >= 400) {
          activeSpan.setStatus('error', `HTTP ${res.statusCode}`);
        } else {
          activeSpan.setStatus('ok');
        }

        activeSpan.end();
      }

      return originalEnd.apply(this, args);
    } as Response['end'];

    // Inject trace context for downstream services
    if (activeSpan) {
      const traceHeaders = injectTraceContext(activeSpan);
      (req as Request & { traceHeaders?: Record<string, string> }).traceHeaders = traceHeaders;
    }

    next();
  };
}

/**
 * Creates a route handler for Prometheus metrics endpoint
 */
export function createMetricsHandler() {
  return function metricsHandler(
    _req: Request,
    res: Response
  ): void {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(defaultRegistry.collect());
  };
}

/**
 * Express router for metrics endpoint
 */
export function metricsRouter() {
  // Return a simple handler that can be used with app.get('/metrics', metricsRouter())
  return createMetricsHandler();
}

/**
 * Database query metrics wrapper
 */
import { dbQueryDuration } from './metrics.js';

export function withDbMetrics<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  return dbQueryDuration.time({ operation, table }, fn);
}

/**
 * External service call metrics wrapper
 */
import { externalRequestDuration } from './metrics.js';

export function withExternalMetrics<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return externalRequestDuration.time({ service, operation }, fn);
}

/**
 * Cache metrics helpers
 */
import { cacheHits, cacheMisses } from './metrics.js';

export function recordCacheHit(cache: string): void {
  cacheHits.inc({ cache });
}

export function recordCacheMiss(cache: string): void {
  cacheMisses.inc({ cache });
}

/**
 * Error metrics helper
 */
import { errorsTotal } from './metrics.js';

export function recordError(type: string, code: string): void {
  errorsTotal.inc({ type, code });
}

/**
 * Process metrics (Node.js runtime)
 */
export function collectProcessMetrics(): void {
  const processMetrics = defaultRegistry.createGauge(
    'process_memory_bytes',
    'Process memory usage in bytes',
    ['type']
  );

  const cpuMetrics = defaultRegistry.createGauge(
    'process_cpu_seconds_total',
    'Total CPU time spent in seconds',
    ['type']
  );

  const eventLoopLag = defaultRegistry.createGauge(
    'nodejs_eventloop_lag_seconds',
    'Event loop lag in seconds',
    []
  );

  // Update metrics periodically
  const updateMetrics = () => {
    const mem = process.memoryUsage();
    processMetrics.set({ type: 'heapUsed' }, mem.heapUsed);
    processMetrics.set({ type: 'heapTotal' }, mem.heapTotal);
    processMetrics.set({ type: 'external' }, mem.external);
    processMetrics.set({ type: 'rss' }, mem.rss);

    const cpu = process.cpuUsage();
    cpuMetrics.set({ type: 'user' }, cpu.user / 1_000_000);
    cpuMetrics.set({ type: 'system' }, cpu.system / 1_000_000);

    // Measure event loop lag
    const start = performance.now();
    setImmediate(() => {
      const lag = (performance.now() - start) / 1000;
      eventLoopLag.set(lag);
    });
  };

  // Initial collection
  updateMetrics();

  // Update every 10 seconds
  setInterval(updateMetrics, 10000);
}
