/**
 * Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock express request/response
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    url: '/test',
    headers: {},
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    hostname: 'localhost',
    protocol: 'http',
    get: vi.fn((header: string) => (overrides.headers as Record<string, string>)?.[header.toLowerCase()]),
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response & { _statusCode: number; _headers: Record<string, string>; _body: unknown } {
  const res = {
    _statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: null as unknown,
    statusCode: 200,
    status(code: number) {
      this._statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    send(body: unknown) {
      this._body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this._headers[name] = value;
      return this;
    },
    removeHeader(name: string) {
      delete this._headers[name];
      return this;
    },
    get(name: string) {
      return this._headers[name];
    },
    end: vi.fn(),
  } as Response & { _statusCode: number; _headers: Record<string, string>; _body: unknown };
  return res;
}

// Import after mocks are set up
import { createRateLimiter } from './rateLimiter.js';
import { createCorrelationIdMiddleware, getRequestContext, runWithContext } from './correlationId.js';
import {
  createSecurityHeaders,
  apiSecurityHeaders,
  createCorsMiddleware,
  createRequestSizeLimiter,
  createSanitizer,
} from './securityHeaders.js';

describe('Rate Limiter', () => {
  it('should allow requests under limit', () => {
    const limiter = createRateLimiter({
      maxRequests: 5,
      windowMs: 60000,
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res._headers['X-RateLimit-Limit']).toBe(5);
  });

  it('should block requests over limit', () => {
    const limiter = createRateLimiter({
      maxRequests: 2,
      windowMs: 60000,
    });

    const req = createMockRequest();
    const next = vi.fn();

    // First two requests should pass
    limiter(req, createMockResponse(), next);
    limiter(req, createMockResponse(), next);

    // Third request should be blocked
    const res = createMockResponse();
    limiter(req, res, next);

    expect(res._statusCode).toBe(429);
    expect((res._body as { error: { code: string } }).error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should skip rate limiting for configured paths', () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      skip: (req) => req.path === '/health',
    });

    const req = createMockRequest({ path: '/health' });
    const res = createMockResponse();
    const next = vi.fn();

    // Should skip even multiple times
    limiter(req, res, next);
    limiter(req, res, next);
    limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('should use custom key generator', () => {
    const limiter = createRateLimiter({
      maxRequests: 1,
      windowMs: 60000,
      keyGenerator: (req) => `custom:${(req as Request & { userId?: string }).userId || 'anonymous'}`,
    });

    const req1 = createMockRequest() as Request & { userId?: string };
    req1.userId = 'user1';

    const req2 = createMockRequest() as Request & { userId?: string };
    req2.userId = 'user2';

    const next = vi.fn();

    // Different users should have separate limits
    limiter(req1 as Request, createMockResponse(), next);
    limiter(req2 as Request, createMockResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});

describe('Correlation ID Middleware', () => {
  it('should generate correlation ID if not provided', () => {
    const middleware = createCorrelationIdMiddleware();

    const req = createMockRequest() as Request & { correlationId?: string };
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.correlationId).toBeDefined();
    expect(req.correlationId?.length).toBeGreaterThan(0);
    expect(res._headers['X-Correlation-ID']).toBe(req.correlationId);
    expect(next).toHaveBeenCalled();
  });

  it('should use existing correlation ID from header', () => {
    const middleware = createCorrelationIdMiddleware();

    const req = createMockRequest({
      headers: { 'x-correlation-id': 'existing-id' },
    }) as Request & { correlationId?: string };
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.correlationId).toBe('existing-id');
  });

  it('should accept x-request-id as fallback', () => {
    const middleware = createCorrelationIdMiddleware({ acceptRequestId: true });

    const req = createMockRequest({
      headers: { 'x-request-id': 'request-id-123' },
    }) as Request & { correlationId?: string };
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.correlationId).toBe('request-id-123');
  });
});

describe('Request Context', () => {
  it('should run function with context', () => {
    const context = {
      correlationId: 'test-123',
      requestId: 'test-123',
      startTime: Date.now(),
    };

    const result = runWithContext(context, () => {
      const ctx = getRequestContext();
      return ctx?.correlationId;
    });

    expect(result).toBe('test-123');
  });

  it('should return undefined outside context', () => {
    const ctx = getRequestContext();
    expect(ctx).toBeUndefined();
  });
});

describe('Security Headers', () => {
  it('should set default security headers', () => {
    const middleware = createSecurityHeaders();

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res._headers['X-Frame-Options']).toBe('DENY');
    expect(res._headers['Content-Security-Policy']).toBeDefined();
    expect(res._headers['Strict-Transport-Security']).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('should allow custom CSP', () => {
    const middleware = createSecurityHeaders({
      contentSecurityPolicy: "default-src 'self' https://api.example.com",
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['Content-Security-Policy']).toBe("default-src 'self' https://api.example.com");
  });

  it('should disable headers when set to false', () => {
    const middleware = createSecurityHeaders({
      xssProtection: false,
      frameOptions: false,
    });

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['X-XSS-Protection']).toBeUndefined();
    expect(res._headers['X-Frame-Options']).toBeUndefined();
  });
});

describe('API Security Headers', () => {
  it('should use relaxed settings for APIs', () => {
    const middleware = apiSecurityHeaders();

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['Content-Security-Policy']).toBe("default-src 'none'");
    expect(res._headers['Cross-Origin-Resource-Policy']).toBe('cross-origin');
  });
});

describe('CORS Middleware', () => {
  it('should set CORS headers for allowed origins', () => {
    const middleware = createCorsMiddleware({
      origins: ['http://localhost:3000', 'https://app.example.com'],
    });

    const req = createMockRequest({
      headers: { origin: 'http://localhost:3000' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
    expect(res._headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('should not set origin for disallowed origins', () => {
    const middleware = createCorsMiddleware({
      origins: ['http://localhost:3000'],
    });

    const req = createMockRequest({
      headers: { origin: 'http://evil.com' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('should handle wildcard origin', () => {
    const middleware = createCorsMiddleware({
      origins: '*',
    });

    const req = createMockRequest({
      headers: { origin: 'http://any-origin.com' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
    // Credentials should not be set with wildcard
    expect(res._headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('should handle OPTIONS preflight', () => {
    const middleware = createCorsMiddleware({
      origins: ['http://localhost:3000'],
    });

    const req = createMockRequest({
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._statusCode).toBe(204);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Request Size Limiter', () => {
  it('should allow requests under size limit', () => {
    const middleware = createRequestSizeLimiter(1024); // 1KB

    const req = createMockRequest({
      headers: { 'content-length': '500' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should block requests over size limit', () => {
    const middleware = createRequestSizeLimiter(1024); // 1KB

    const req = createMockRequest({
      headers: { 'content-length': '2048' },
    });
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(res._statusCode).toBe(413);
    expect((res._body as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Input Sanitizer', () => {
  it('should strip HTML tags from body', () => {
    const middleware = createSanitizer({ stripHtml: true });

    const req = createMockRequest({
      body: {
        name: '<script>alert("xss")</script>John',
        safe: 'no html here',
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.name).toBe('alert("xss")John');
    expect(req.body.safe).toBe('no html here');
  });

  it('should escape special characters when configured', () => {
    const middleware = createSanitizer({ escapeSpecialChars: true, stripHtml: false });

    const req = createMockRequest({
      body: {
        content: '<div>"Hello" & \'World\'</div>',
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.content).toBe('&lt;div&gt;&quot;Hello&quot; &amp; &#x27;World&#x27;&lt;/div&gt;');
  });

  it('should only sanitize specified fields', () => {
    const middleware = createSanitizer({ fields: ['name'], stripHtml: true });

    const req = createMockRequest({
      body: {
        name: '<b>Bold</b>',
        description: '<i>Italic</i>',
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.name).toBe('Bold');
    expect(req.body.description).toBe('<i>Italic</i>'); // Not sanitized
  });

  it('should remove null bytes', () => {
    const middleware = createSanitizer();

    const req = createMockRequest({
      body: {
        data: 'hello\0world',
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.data).toBe('helloworld');
  });

  it('should handle nested objects', () => {
    const middleware = createSanitizer({ stripHtml: true });

    const req = createMockRequest({
      body: {
        user: {
          name: '<b>John</b>',
          profile: {
            bio: '<script>evil()</script>',
          },
        },
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.user.name).toBe('John');
    expect(req.body.user.profile.bio).toBe('evil()');
  });

  it('should handle arrays', () => {
    const middleware = createSanitizer({ stripHtml: true });

    const req = createMockRequest({
      body: {
        tags: ['<b>tag1</b>', '<i>tag2</i>'],
      },
    }) as Request;
    const res = createMockResponse();
    const next = vi.fn();

    middleware(req, res, next);

    expect(req.body.tags).toEqual(['tag1', 'tag2']);
  });
});
