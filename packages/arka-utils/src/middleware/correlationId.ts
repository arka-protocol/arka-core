/**
 * Correlation ID Middleware
 *
 * Provides request tracing via correlation IDs that propagate across services.
 * Supports both X-Correlation-ID and X-Request-ID headers.
 */

import type { Request, Response, NextFunction } from 'express';

export interface CorrelationIdConfig {
  /** Header name for correlation ID (default: x-correlation-id) */
  headerName?: string;
  /** Also accept x-request-id header */
  acceptRequestId?: boolean;
  /** Generator function for new correlation IDs */
  generator?: () => string;
  /** Include correlation ID in response headers */
  setResponseHeader?: boolean;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
      requestId: string;
    }
  }
}

/**
 * Default correlation ID generator
 */
function defaultGenerator(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Creates correlation ID middleware
 */
export function createCorrelationIdMiddleware(config: CorrelationIdConfig = {}) {
  const {
    headerName = 'x-correlation-id',
    acceptRequestId = true,
    generator = defaultGenerator,
    setResponseHeader = true,
  } = config;

  return function correlationIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // Try to extract correlation ID from headers
    let correlationId = req.headers[headerName.toLowerCase()] as string;

    // Fall back to x-request-id if configured
    if (!correlationId && acceptRequestId) {
      correlationId = req.headers['x-request-id'] as string;
    }

    // Generate new ID if not found
    if (!correlationId) {
      correlationId = generator();
    }

    // Set on request object
    req.correlationId = correlationId;
    req.requestId = correlationId; // Also set as requestId for compatibility

    // Set response header if configured
    if (setResponseHeader) {
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Request-ID', correlationId);
    }

    next();
  };
}

/**
 * Async local storage for correlation ID propagation
 * Allows accessing correlation ID from anywhere in the call stack
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  requestId: string;
  startTime: number;
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Gets the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Gets the current correlation ID
 */
export function getCorrelationId(): string | undefined {
  return getRequestContext()?.correlationId;
}

/**
 * Runs a function with request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Creates middleware that sets up async local storage context
 */
export function createContextMiddleware() {
  return function contextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const context: RequestContext = {
      correlationId: req.correlationId || defaultGenerator(),
      requestId: req.requestId || req.correlationId || defaultGenerator(),
      startTime: Date.now(),
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
    };

    // Ensure request has correlationId
    req.correlationId = context.correlationId;
    req.requestId = context.requestId;

    // Run the rest of the middleware chain in context
    requestContextStorage.run(context, () => {
      next();
    });
  };
}

/**
 * Helper to create headers for outgoing requests with correlation ID
 */
export function getTracingHeaders(): Record<string, string> {
  const context = getRequestContext();
  if (!context) {
    return {};
  }

  return {
    'X-Correlation-ID': context.correlationId,
    'X-Request-ID': context.requestId,
  };
}

/**
 * Helper for logging with correlation ID
 */
export function withCorrelation(data: Record<string, unknown>): Record<string, unknown> {
  const context = getRequestContext();
  if (!context) {
    return data;
  }

  return {
    ...data,
    correlationId: context.correlationId,
    requestId: context.requestId,
  };
}
