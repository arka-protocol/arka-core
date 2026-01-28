/**
 * ARKA Mock Utilities
 *
 * Provides mock factories for testing ARKA services.
 *
 * IMPORTANT: This module imports from 'vitest' and should only be used
 * in test files. If you need to import @arka/utils in production code,
 * use specific imports instead of the barrel export to avoid loading
 * this module.
 *
 * Example:
 *   // In production code, use specific imports:
 *   import { createLogger } from '@arka/utils/logger';
 *
 *   // In test files, you can use barrel import:
 *   import { createMockLogger } from '@arka/utils';
 */

import type { Request, Response, NextFunction } from 'express';
import { vi, type Mock } from 'vitest';

/**
 * Creates a mock Express request
 */
export function createMockRequest(overrides: Partial<Request> = {}): Request {
  const headers: Record<string, string> = (overrides.headers as Record<string, string>) || {};

  return {
    method: 'GET',
    path: '/test',
    url: '/test',
    baseUrl: '',
    originalUrl: '/test',
    headers,
    query: {},
    body: {},
    params: {},
    ip: '127.0.0.1',
    ips: [],
    hostname: 'localhost',
    protocol: 'http',
    secure: false,
    xhr: false,
    get: (header: string) => headers[header.toLowerCase()],
    header: (header: string) => headers[header.toLowerCase()],
    accepts: () => false,
    acceptsCharsets: () => false,
    acceptsEncodings: () => false,
    acceptsLanguages: () => false,
    is: () => false,
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

/**
 * Creates a mock Express response with tracking
 */
export interface MockResponse extends Response {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: unknown;
  _ended: boolean;
}

export function createMockResponse(): MockResponse {
  const state = {
    _statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: null as unknown,
    _ended: false,
  };

  const res = {
    get _statusCode() { return state._statusCode; },
    set _statusCode(v: number) { state._statusCode = v; },
    get _headers() { return state._headers; },
    get _body() { return state._body; },
    get _ended() { return state._ended; },
    statusCode: 200,

    status(code: number) {
      state._statusCode = code;
      res.statusCode = code;
      return res;
    },

    json(body: unknown) {
      state._body = body;
      state._ended = true;
      return res;
    },

    send(body: unknown) {
      state._body = body;
      state._ended = true;
      return res;
    },

    end() {
      state._ended = true;
      return res;
    },

    setHeader(name: string, value: string | number | readonly string[]) {
      state._headers[name] = String(value);
      return res;
    },

    getHeader(name: string) {
      return state._headers[name];
    },

    removeHeader(name: string) {
      delete state._headers[name];
      return res;
    },

    get(name: string) {
      return state._headers[name];
    },

    set(name: string, value: string) {
      state._headers[name] = value;
      return res;
    },

    type(type: string) {
      state._headers['Content-Type'] = type;
      return res;
    },

    contentType(type: string) {
      state._headers['Content-Type'] = type;
      return res;
    },

    redirect(urlOrStatus: string | number, url?: string) {
      if (typeof urlOrStatus === 'number') {
        state._statusCode = urlOrStatus;
        state._headers['Location'] = url || '';
      } else {
        state._statusCode = 302;
        state._headers['Location'] = urlOrStatus;
      }
      state._ended = true;
      return res;
    },
  } as unknown as MockResponse;

  return res;
}

/**
 * Creates a mock next function
 */
export function createMockNext(): NextFunction & { called: boolean; error: unknown } {
  const next = ((error?: unknown) => {
    next.called = true;
    next.error = error;
  }) as NextFunction & { called: boolean; error: unknown };

  next.called = false;
  next.error = undefined;

  return next;
}

/**
 * Mock HTTP client for testing external service calls
 */
export interface MockHttpClient {
  get: Mock;
  post: Mock;
  put: Mock;
  patch: Mock;
  delete: Mock;
  responses: Map<string, { status: number; data: unknown }>;
  addResponse: (method: string, path: string, status: number, data: unknown) => void;
}

export function createMockHttpClient(): MockHttpClient {
  const responses = new Map<string, { status: number; data: unknown }>();

  const createHandler = (method: string) => vi.fn(async (path: string) => {
    const key = `${method}:${path}`;
    const response = responses.get(key);
    if (response) {
      if (response.status >= 400) {
        const error = new Error(`HTTP ${response.status}`);
        (error as Error & { response: unknown }).response = { status: response.status, data: response.data };
        throw error;
      }
      return { status: response.status, data: response.data };
    }
    return { status: 200, data: {} };
  });

  return {
    get: createHandler('GET'),
    post: createHandler('POST'),
    put: createHandler('PUT'),
    patch: createHandler('PATCH'),
    delete: createHandler('DELETE'),
    responses,
    addResponse: (method: string, path: string, status: number, data: unknown) => {
      responses.set(`${method}:${path}`, { status, data });
    },
  };
}

/**
 * Mock database client
 */
export interface MockDbClient {
  query: Mock;
  execute: Mock;
  transaction: Mock;
  findOne: Mock;
  findMany: Mock;
  create: Mock;
  update: Mock;
  delete: Mock;
}

export function createMockDbClient(): MockDbClient {
  return {
    query: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rowCount: 1 }),
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    findOne: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    update: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
  };
}

/**
 * Mock logger
 */
export interface MockLogger {
  debug: Mock;
  info: Mock;
  warn: Mock;
  error: Mock;
  child: Mock;
  logs: Array<{ level: string; message: string; data?: unknown }>;
}

export function createMockLogger(): MockLogger {
  const logs: Array<{ level: string; message: string; data?: unknown }> = [];

  const createLogFn = (level: string) => vi.fn((message: string, data?: unknown) => {
    logs.push({ level, message, data });
  });

  const logger: MockLogger = {
    debug: createLogFn('debug'),
    info: createLogFn('info'),
    warn: createLogFn('warn'),
    error: createLogFn('error'),
    child: vi.fn().mockReturnThis(),
    logs,
  };

  // Make child return the same logger for chaining
  logger.child.mockReturnValue(logger);

  return logger;
}

/**
 * Mock cache client
 */
export interface MockCacheClient {
  get: Mock;
  set: Mock;
  delete: Mock;
  has: Mock;
  clear: Mock;
  store: Map<string, unknown>;
}

export function createMockCacheClient(): MockCacheClient {
  const store = new Map<string, unknown>();

  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: unknown) => { store.set(key, value); }),
    delete: vi.fn((key: string) => store.delete(key)),
    has: vi.fn((key: string) => store.has(key)),
    clear: vi.fn(() => { store.clear(); }),
    store,
  };
}
