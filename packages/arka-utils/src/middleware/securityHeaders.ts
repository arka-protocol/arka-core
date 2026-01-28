/**
 * Security Headers Middleware
 *
 * Adds security-related HTTP headers to responses.
 * Based on OWASP recommendations.
 */

import type { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  /** Enable/disable specific headers */
  xssProtection?: boolean;
  noSniff?: boolean;
  frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  contentSecurityPolicy?: string | false;
  strictTransportSecurity?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  } | false;
  referrerPolicy?: string | false;
  permissionsPolicy?: string | false;
  crossOriginEmbedderPolicy?: string | false;
  crossOriginOpenerPolicy?: string | false;
  crossOriginResourcePolicy?: string | false;
}

const DEFAULT_CONFIG: Required<SecurityHeadersConfig> = {
  xssProtection: true,
  noSniff: true,
  frameOptions: 'DENY',
  contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: false,
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
};

/**
 * Creates security headers middleware
 */
export function createSecurityHeaders(config: SecurityHeadersConfig = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return function securityHeadersMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction
  ): void {
    // X-XSS-Protection (deprecated but still useful for older browsers)
    if (mergedConfig.xssProtection) {
      res.setHeader('X-XSS-Protection', '1; mode=block');
    }

    // X-Content-Type-Options
    if (mergedConfig.noSniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options
    if (mergedConfig.frameOptions) {
      res.setHeader('X-Frame-Options', mergedConfig.frameOptions);
    }

    // Content-Security-Policy
    if (mergedConfig.contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', mergedConfig.contentSecurityPolicy);
    }

    // Strict-Transport-Security
    if (mergedConfig.strictTransportSecurity) {
      const hsts = mergedConfig.strictTransportSecurity;
      let value = `max-age=${hsts.maxAge || 31536000}`;
      if (hsts.includeSubDomains) {
        value += '; includeSubDomains';
      }
      if (hsts.preload) {
        value += '; preload';
      }
      res.setHeader('Strict-Transport-Security', value);
    }

    // Referrer-Policy
    if (mergedConfig.referrerPolicy) {
      res.setHeader('Referrer-Policy', mergedConfig.referrerPolicy);
    }

    // Permissions-Policy
    if (mergedConfig.permissionsPolicy) {
      res.setHeader('Permissions-Policy', mergedConfig.permissionsPolicy);
    }

    // Cross-Origin-Embedder-Policy
    if (mergedConfig.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', mergedConfig.crossOriginEmbedderPolicy);
    }

    // Cross-Origin-Opener-Policy
    if (mergedConfig.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', mergedConfig.crossOriginOpenerPolicy);
    }

    // Cross-Origin-Resource-Policy
    if (mergedConfig.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', mergedConfig.crossOriginResourcePolicy);
    }

    // Remove potentially dangerous headers
    res.removeHeader('X-Powered-By');

    next();
  };
}

/**
 * Pre-configured security header middleware for APIs
 * More relaxed CSP for API responses
 */
export function apiSecurityHeaders() {
  return createSecurityHeaders({
    contentSecurityPolicy: "default-src 'none'",
    frameOptions: 'DENY',
    // Disable COEP/COOP for APIs as they may break cross-origin requests
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: 'cross-origin', // Allow cross-origin for API responses
  });
}

/**
 * Creates CORS middleware with security considerations
 */
export interface CorsConfig {
  /** Allowed origins (use specific origins in production) */
  origins: string[] | '*';
  /** Allowed methods */
  methods?: string[];
  /** Allowed headers */
  allowedHeaders?: string[];
  /** Exposed headers */
  exposedHeaders?: string[];
  /** Allow credentials */
  credentials?: boolean;
  /** Preflight cache duration in seconds */
  maxAge?: number;
}

export function createCorsMiddleware(config: CorsConfig) {
  const {
    origins,
    methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID', 'X-Tenant-ID', 'X-API-Key'],
    exposedHeaders = ['X-Request-ID', 'X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials = true,
    maxAge = 86400, // 24 hours
  } = config;

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const origin = req.headers.origin;

    // Check if origin is allowed
    let allowedOrigin: string | null = null;
    if (origins === '*') {
      allowedOrigin = '*';
    } else if (origin && origins.includes(origin)) {
      allowedOrigin = origin;
    }

    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    }

    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));

    if (credentials && allowedOrigin !== '*') {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Max-Age', String(maxAge));

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

/**
 * Request size limiter middleware
 */
export function createRequestSizeLimiter(maxSizeBytes: number = 1024 * 1024) { // Default 1MB
  return function requestSizeLimiter(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request body exceeds maximum size of ${Math.round(maxSizeBytes / 1024)}KB`,
          maxSizeBytes,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Input sanitization middleware
 * Removes potentially dangerous characters from string inputs
 */
export function createSanitizer(config: {
  /** Fields to sanitize (default: all string fields) */
  fields?: string[];
  /** Remove HTML tags */
  stripHtml?: boolean;
  /** Escape special characters */
  escapeSpecialChars?: boolean;
} = {}) {
  const {
    fields,
    stripHtml = true,
    escapeSpecialChars = false,
  } = config;

  function sanitizeString(value: string): string {
    let result = value;

    if (stripHtml) {
      // Remove HTML tags
      result = result.replace(/<[^>]*>/g, '');
    }

    if (escapeSpecialChars) {
      // Escape special characters
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Remove null bytes
    result = result.replace(/\0/g, '');

    return result.trim();
  }

  function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (fields && !fields.includes(key)) {
        result[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        result[key] = sanitizeString(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item =>
          typeof item === 'string' ? sanitizeString(item) :
            typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>) :
              item
        );
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  return function sanitizerMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
    }

    next();
  };
}
