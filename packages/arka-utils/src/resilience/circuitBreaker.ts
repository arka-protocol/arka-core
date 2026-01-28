/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to failing services.
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Name for logging/metrics */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Number of successes in half-open to close circuit */
  successThreshold?: number;
  /** Time in ms to wait before trying again (half-open) */
  resetTimeout?: number;
  /** Time window in ms to count failures */
  failureWindow?: number;
  /** Timeout for individual calls in ms */
  callTimeout?: number;
  /** Function to determine if an error should trip the circuit */
  isFailure?: (error: unknown) => boolean;
  /** Callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback for metrics/logging */
  onCall?: (result: 'success' | 'failure' | 'rejected', duration: number) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRejected: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

interface FailureRecord {
  timestamp: number;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: FailureRecord[] = [];
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime = 0;

  // Stats
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalRejected = 0;

  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      name: options.name,
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      resetTimeout: options.resetTimeout ?? 30000,
      failureWindow: options.failureWindow ?? 60000,
      callTimeout: options.callTimeout ?? 10000,
      isFailure: options.isFailure ?? (() => true),
      onStateChange: options.onStateChange ?? (() => {}),
      onCall: options.onCall ?? (() => {}),
    };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      this.totalRejected++;
      this.options.onCall('rejected', 0);
      throw new CircuitBreakerError(
        `Circuit breaker '${this.options.name}' is OPEN`,
        this.options.name,
        this.state
      );
    }

    const startTime = Date.now();
    this.totalCalls++;

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      const duration = Date.now() - startTime;
      this.options.onCall('success', duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.options.isFailure(error)) {
        this.onFailure();
        this.options.onCall('failure', duration);
      } else {
        // Don't count as circuit failure but still propagate
        this.options.onCall('success', duration);
      }

      throw error;
    }
  }

  /**
   * Execute with timeout wrapper
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CircuitBreakerTimeoutError(
          `Circuit breaker '${this.options.name}' call timed out after ${this.options.callTimeout}ms`,
          this.options.name,
          this.options.callTimeout
        ));
      }, this.options.callTimeout);

      fn()
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Check if the circuit allows execution
   */
  private canExecute(): boolean {
    this.cleanupOldFailures();

    switch (this.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        if (Date.now() >= this.nextAttemptTime) {
          this.transition('HALF_OPEN');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;

    switch (this.state) {
      case 'HALF_OPEN':
        this.successCount++;
        if (this.successCount >= this.options.successThreshold) {
          this.transition('CLOSED');
        }
        break;

      case 'CLOSED':
        // Reset failure count on success in closed state
        this.failures = [];
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;

    switch (this.state) {
      case 'CLOSED':
        this.failures.push({ timestamp: Date.now() });
        if (this.failures.length >= this.options.failureThreshold) {
          this.transition('OPEN');
        }
        break;

      case 'HALF_OPEN':
        // Any failure in half-open goes back to open
        this.transition('OPEN');
        break;
    }
  }

  /**
   * Transition to a new state
   */
  private transition(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    switch (newState) {
      case 'OPEN':
        this.nextAttemptTime = Date.now() + this.options.resetTimeout;
        this.successCount = 0;
        break;

      case 'HALF_OPEN':
        this.successCount = 0;
        break;

      case 'CLOSED':
        this.failures = [];
        this.successCount = 0;
        break;
    }

    this.options.onStateChange(oldState, newState);
  }

  /**
   * Remove failures outside the failure window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindow;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      successes: this.successCount,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalRejected: this.totalRejected,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.transition('HALF_OPEN');
    }
    return this.state;
  }

  /**
   * Force the circuit to a specific state (for testing/admin)
   */
  forceState(state: CircuitState): void {
    this.transition(state);
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }
}

/**
 * Circuit Breaker Error
 */
export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly circuitState: CircuitState
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker Timeout Error
 */
export class CircuitBreakerTimeoutError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly timeout: number
  ) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

/**
 * Circuit Breaker Registry - manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultOptions: Partial<CircuitBreakerOptions>;

  constructor(defaultOptions: Partial<CircuitBreakerOptions> = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a circuit breaker
   */
  get(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({
        ...this.defaultOptions,
        ...options,
        name,
      }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Remove a circuit breaker
   */
  remove(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
  }
}

/**
 * Create a default circuit breaker registry
 */
export const defaultCircuitBreakerRegistry = new CircuitBreakerRegistry({
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30000,
  failureWindow: 60000,
  callTimeout: 10000,
});

/**
 * Decorator-style function to wrap async functions with circuit breaker
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  breaker: CircuitBreaker
): T {
  return (async (...args: Parameters<T>) => {
    return breaker.execute(() => fn(...args));
  }) as T;
}
