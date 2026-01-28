/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for API endpoints.
 * Uses a sliding window algorithm with in-memory store.
 * For production, consider using Redis-backed store.
 */

import type { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Message to return when rate limit exceeded */
  message?: string;
  /** Custom key generator function */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Headers to include in response */
  headers?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit data
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.ip || req.socket.remoteAddress || 'unknown';
  return `ratelimit:${ip}`;
}

/**
 * Creates a rate limiting middleware
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    message = 'Too many requests, please try again later',
    keyGenerator = defaultKeyGenerator,
    skip,
    headers = true,
  } = config;

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    // Check if should skip
    if (skip && skip(req)) {
      next();
      return;
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    // Initialize or reset entry if window expired
    if (!entry || entry.resetTime < now) {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      if (headers) {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
      }

      next();
      return;
    }

    // Increment count
    entry.count++;

    // Set headers
    if (headers) {
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));
    }

    // Check if over limit
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfter);

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: retryAfter,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  /** Standard API rate limit: 100 requests per minute */
  standard: () => createRateLimiter({
    maxRequests: 100,
    windowMs: 60 * 1000,
  }),

  /** Strict rate limit: 20 requests per minute (for sensitive endpoints) */
  strict: () => createRateLimiter({
    maxRequests: 20,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded for sensitive endpoint',
  }),

  /** Auth rate limit: 5 requests per minute (for login/auth endpoints) */
  auth: () => createRateLimiter({
    maxRequests: 5,
    windowMs: 60 * 1000,
    message: 'Too many authentication attempts, please try again later',
  }),

  /** Relaxed rate limit: 1000 requests per minute (for health checks, etc.) */
  relaxed: () => createRateLimiter({
    maxRequests: 1000,
    windowMs: 60 * 1000,
  }),

  /** Burst rate limit: 30 requests per 10 seconds */
  burst: () => createRateLimiter({
    maxRequests: 30,
    windowMs: 10 * 1000,
    message: 'Request burst limit exceeded',
  }),
};

/**
 * Rate limiter that uses tenant ID as key (for multi-tenant APIs)
 */
export function createTenantRateLimiter(config: Omit<RateLimitConfig, 'keyGenerator'>) {
  return createRateLimiter({
    ...config,
    keyGenerator: (req) => {
      const tenantId = (req as Request & { tenantId?: string }).tenantId ||
        req.headers['x-tenant-id'] as string ||
        'default';
      return `ratelimit:tenant:${tenantId}`;
    },
  });
}

/**
 * Rate limiter that uses user ID as key (for authenticated APIs)
 */
export function createUserRateLimiter(config: Omit<RateLimitConfig, 'keyGenerator'>) {
  return createRateLimiter({
    ...config,
    keyGenerator: (req) => {
      const userId = (req as Request & { userId?: string }).userId ||
        (req as Request & { user?: { id?: string } }).user?.id ||
        'anonymous';
      return `ratelimit:user:${userId}`;
    },
  });
}
