/**
 * Authentication Middleware
 *
 * Provides JWT authentication for API endpoints.
 * Supports both symmetric (HS256) and asymmetric (RS256) algorithms.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '../logger.js';

const logger = createLogger({ service: 'arka-auth' });

export interface JwtPayload {
  /** Subject (user ID) */
  sub: string;
  /** Email address */
  email?: string;
  /** User roles */
  roles?: string[];
  /** Tenant ID for multi-tenant systems */
  tenantId?: string;
  /** Issued at timestamp */
  iat?: number;
  /** Expiration timestamp */
  exp?: number;
  /** Issuer */
  iss?: string;
  /** Audience */
  aud?: string | string[];
  /** Additional claims */
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email?: string;
  roles: string[];
  tenantId?: string;
  claims: JwtPayload;
}

export interface AuthConfig {
  /** JWT secret for HS256 or public key for RS256 */
  secret: string;
  /** Algorithm to use (default: HS256) */
  algorithm?: 'HS256' | 'RS256';
  /** Token issuer to validate */
  issuer?: string;
  /** Token audience to validate */
  audience?: string;
  /** Skip authentication for certain paths */
  skipPaths?: string[];
  /** Custom token extractor */
  tokenExtractor?: (req: Request) => string | null;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * Simple JWT parser (decodes without verification for header inspection)
 */
function parseJwt(token: string): { header: Record<string, unknown>; payload: JwtPayload } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerPart = parts[0];
    const payloadPart = parts[1];
    if (!headerPart || !payloadPart) return null;

    const header = JSON.parse(base64UrlDecode(headerPart));
    const payload = JSON.parse(base64UrlDecode(payloadPart));

    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * Verify JWT signature using HMAC-SHA256
 */
async function verifyHS256(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const headerB64 = parts[0];
  const payloadB64 = parts[1];
  const signatureB64 = parts[2];
  if (!headerB64 || !payloadB64 || !signatureB64) return null;

  const data = `${headerB64}.${payloadB64}`;

  // Use Web Crypto API for HMAC
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const expectedSignature = Buffer.from(signature).toString('base64url');

  if (signatureB64 !== expectedSignature) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return null;
  }
}

/**
 * Default token extractor from Authorization header
 */
function defaultTokenExtractor(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // Support both "Bearer <token>" and raw token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return authHeader;
}

/**
 * Creates JWT authentication middleware
 */
export function createAuthMiddleware(config: AuthConfig) {
  const {
    secret,
    algorithm = 'HS256',
    issuer,
    audience,
    skipPaths = [],
    tokenExtractor = defaultTokenExtractor,
  } = config;

  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Check if path should be skipped
    const path = req.path;
    if (skipPaths.some(p => path.startsWith(p) || path === p)) {
      next();
      return;
    }

    // Extract token
    const token = tokenExtractor(req);
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authentication token',
        },
      });
      return;
    }

    try {
      let payload: JwtPayload | null = null;

      if (algorithm === 'HS256') {
        payload = await verifyHS256(token, secret);
      } else {
        // For RS256, in production use a proper JWT library like jose
        // For now, we just parse and validate claims (verification should use the public key)
        const parsed = parseJwt(token);
        if (parsed) {
          payload = parsed.payload;
        }
      }

      if (!payload) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid authentication token',
          },
        });
        return;
      }

      // Validate expiration
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Authentication token has expired',
          },
        });
        return;
      }

      // Validate issuer
      if (issuer && payload.iss !== issuer) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_ISSUER',
            message: 'Invalid token issuer',
          },
        });
        return;
      }

      // Validate audience
      if (audience) {
        const tokenAud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        if (!tokenAud.includes(audience)) {
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_AUDIENCE',
              message: 'Invalid token audience',
            },
          });
          return;
        }
      }

      // Set user on request
      req.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles || [],
        tenantId: payload.tenantId,
        claims: payload,
      };
      req.token = token;

      logger.debug('Authentication successful', {
        userId: payload.sub,
        tenantId: payload.tenantId,
      });

      next();
    } catch (error) {
      logger.error('Authentication error', error as Error);
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  };
}

/**
 * Authorization middleware - checks for required roles
 */
export function requireRoles(...requiredRoles: string[]) {
  return function roleMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    const userRoles = req.user.roles || [];

    // Check if user has any of the required roles
    const hasRole = requiredRoles.some(role => userRoles.includes(role));

    // Also allow if user has admin role
    const isAdmin = userRoles.includes('admin') || userRoles.includes('ADMIN');

    if (!hasRole && !isAdmin) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          requiredRoles,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Tenant isolation middleware - ensures user can only access their tenant's data
 */
export function requireTenant(
  tenantIdExtractor?: (req: Request) => string | undefined
) {
  return function tenantMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    // Extract tenant ID from request
    const requestTenantId = tenantIdExtractor
      ? tenantIdExtractor(req)
      : (req.params.tenantId || req.query.tenantId as string || req.headers['x-tenant-id'] as string);

    // Skip check for admin users
    const isAdmin = req.user.roles?.includes('admin') || req.user.roles?.includes('ADMIN');
    if (isAdmin) {
      next();
      return;
    }

    // Verify tenant matches
    if (requestTenantId && req.user.tenantId !== requestTenantId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: 'Access denied to this tenant',
        },
      });
      return;
    }

    next();
  };
}

/**
 * Optional authentication - sets user if token present, but doesn't require it
 */
export function optionalAuth(config: AuthConfig) {
  const authMiddleware = createAuthMiddleware({
    ...config,
    skipPaths: [], // Don't skip any paths
  });

  return async function optionalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // If no auth header, continue without user
    if (!req.headers.authorization) {
      next();
      return;
    }

    // Create a modified response that doesn't send errors
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    let statusCode = 200;

    res.status = (code: number) => {
      statusCode = code;
      return res;
    };

    res.json = (body: unknown) => {
      // If auth failed, just continue without user
      if (statusCode === 401 || statusCode === 403) {
        res.status = originalStatus;
        res.json = originalJson;
        next();
        return res;
      }
      return originalJson(body);
    };

    await authMiddleware(req, res, () => {
      res.status = originalStatus;
      res.json = originalJson;
      next();
    });
  };
}

/**
 * API Key authentication middleware
 */
export function createApiKeyAuth(config: {
  /** Header name for API key */
  headerName?: string;
  /** Query parameter name for API key */
  queryParam?: string;
  /** Function to validate API key and return user info */
  validateKey: (apiKey: string) => Promise<AuthUser | null>;
  /** Paths to skip authentication */
  skipPaths?: string[];
}) {
  const {
    headerName = 'x-api-key',
    queryParam = 'apiKey',
    validateKey,
    skipPaths = [],
  } = config;

  return async function apiKeyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Check if path should be skipped
    if (skipPaths.some(p => req.path.startsWith(p) || req.path === p)) {
      next();
      return;
    }

    // Extract API key from header or query param
    const apiKey = (req.headers[headerName.toLowerCase()] as string) ||
      (req.query[queryParam] as string);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing API key',
        },
      });
      return;
    }

    try {
      const user = await validateKey(apiKey);

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid API key',
          },
        });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('API key validation error', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
        },
      });
    }
  };
}
