/**
 * Resilient HTTP Client
 *
 * HTTP client with built-in resilience patterns:
 * - Circuit breaker for failure isolation
 * - Retry with exponential backoff
 * - Bulkhead for concurrency limiting
 * - Request timeout
 * - Request/response interceptors
 */

import { CircuitBreaker, CircuitBreakerOptions } from './circuitBreaker.js';
import { Bulkhead, BulkheadOptions } from './bulkhead.js';
import { retry, RetryOptions } from '../retry.js';

export interface HttpClientOptions {
  /** Base URL for all requests */
  baseUrl?: string;
  /** Default timeout in ms */
  timeout?: number;
  /** Default headers */
  headers?: Record<string, string>;
  /** Circuit breaker options */
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  /** Bulkhead options */
  bulkhead?: Partial<BulkheadOptions>;
  /** Retry options */
  retry?: Partial<RetryOptions>;
  /** Request interceptor */
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  /** Response interceptor */
  onResponse?: (response: HttpResponse) => HttpResponse | Promise<HttpResponse>;
  /** Error interceptor */
  onError?: (error: HttpError) => void;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  params?: Record<string, string | number | boolean>;
  /** Skip circuit breaker for this request */
  skipCircuitBreaker?: boolean;
  /** Skip retry for this request */
  skipRetry?: boolean;
  /** Skip bulkhead for this request */
  skipBulkhead?: boolean;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  config: RequestConfig;
  duration: number;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    public readonly headers: Record<string, string>,
    public readonly data: unknown,
    public readonly config: RequestConfig
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static isHttpError(error: unknown): error is HttpError {
    return error instanceof HttpError;
  }
}

export class ResilientHttpClient {
  private readonly options: Required<HttpClientOptions>;
  private readonly circuitBreaker?: CircuitBreaker;
  private readonly bulkhead?: Bulkhead;

  constructor(options: HttpClientOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? '',
      timeout: options.timeout ?? 30000,
      headers: options.headers ?? {},
      circuitBreaker: options.circuitBreaker ?? {},
      bulkhead: options.bulkhead ?? {},
      retry: options.retry ?? {},
      onRequest: options.onRequest ?? ((c) => c),
      onResponse: options.onResponse ?? ((r) => r),
      onError: options.onError ?? (() => {}),
    };

    // Initialize circuit breaker if enabled
    if (options.circuitBreaker !== null) {
      this.circuitBreaker = new CircuitBreaker({
        name: options.circuitBreaker?.name ?? 'http-client',
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30000,
        callTimeout: this.options.timeout,
        isFailure: (error) => {
          // Network errors and 5xx are failures
          if (error instanceof HttpError) {
            return error.status >= 500;
          }
          return true;
        },
        ...options.circuitBreaker,
      });
    }

    // Initialize bulkhead if enabled
    if (options.bulkhead !== null) {
      this.bulkhead = new Bulkhead({
        name: options.bulkhead?.name ?? 'http-client',
        maxConcurrent: 50,
        maxQueue: 100,
        queueTimeout: 30000,
        ...options.bulkhead,
      });
    }
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(config: RequestConfig): Promise<HttpResponse<T>> {
    // Apply request interceptor
    const finalConfig = await this.options.onRequest(config);

    // Build the execution function
    const execute = async (): Promise<HttpResponse<T>> => {
      return this.doRequest<T>(finalConfig);
    };

    // Wrap with retry if enabled
    let wrappedExecute = execute;
    if (!config.skipRetry && this.options.retry) {
      wrappedExecute = () => retry(execute, {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        isRetryable: (error: unknown) => {
          if (error instanceof HttpError) {
            // Retry on 5xx and specific 4xx errors
            return error.status >= 500 || error.status === 429 || error.status === 408;
          }
          return true; // Retry network errors
        },
        ...this.options.retry,
      });
    }

    // Wrap with circuit breaker if enabled
    if (!config.skipCircuitBreaker && this.circuitBreaker) {
      const cb = this.circuitBreaker;
      const innerExecute = wrappedExecute;
      wrappedExecute = () => cb.execute(innerExecute);
    }

    // Wrap with bulkhead if enabled
    if (!config.skipBulkhead && this.bulkhead) {
      const bh = this.bulkhead;
      const innerExecute = wrappedExecute;
      wrappedExecute = () => bh.execute(innerExecute);
    }

    try {
      const response = await wrappedExecute();
      return await this.options.onResponse(response) as HttpResponse<T>;
    } catch (error) {
      this.options.onError(error as HttpError);
      throw error;
    }
  }

  /**
   * Perform the actual HTTP request
   */
  private async doRequest<T>(config: RequestConfig): Promise<HttpResponse<T>> {
    const startTime = Date.now();

    // Build URL
    let url = config.url;
    if (this.options.baseUrl && !url.startsWith('http')) {
      url = `${this.options.baseUrl}${url}`;
    }

    // Add query parameters
    if (config.params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(config.params)) {
        searchParams.append(key, String(value));
      }
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}${searchParams.toString()}`;
    }

    // Merge headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers,
      ...config.headers,
    };

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: config.method,
      headers,
      signal: AbortSignal.timeout(config.timeout ?? this.options.timeout),
    };

    // Add body for non-GET requests
    if (config.body && config.method !== 'GET' && config.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(config.body);
    }

    // Make the request
    const response = await fetch(url, fetchOptions);

    // Parse response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Parse response body
    let data: T;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      data = await response.json() as T;
    } else {
      data = await response.text() as unknown as T;
    }

    const duration = Date.now() - startTime;

    // Check for error status
    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        response.statusText,
        responseHeaders,
        data,
        config
      );
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data,
      config,
      duration,
    };
  }

  // Convenience methods

  async get<T = unknown>(url: string, options?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'GET', url, ...options });
  }

  async post<T = unknown>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'POST', url, body, ...options });
  }

  async put<T = unknown>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PUT', url, body, ...options });
  }

  async patch<T = unknown>(url: string, body?: unknown, options?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'PATCH', url, body, ...options });
  }

  async delete<T = unknown>(url: string, options?: Partial<RequestConfig>): Promise<HttpResponse<T>> {
    return this.request<T>({ method: 'DELETE', url, ...options });
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }

  /**
   * Get bulkhead stats
   */
  getBulkheadStats() {
    return this.bulkhead?.getStats();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }
}

/**
 * Create a resilient HTTP client
 */
export function createHttpClient(options?: HttpClientOptions): ResilientHttpClient {
  return new ResilientHttpClient(options);
}
