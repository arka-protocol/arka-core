/**
 * Bulkhead Pattern Implementation
 *
 * Limits concurrent access to resources to prevent resource exhaustion.
 * Provides isolation between different types of operations.
 */

export interface BulkheadOptions {
  /** Name for logging/metrics */
  name: string;
  /** Maximum concurrent executions */
  maxConcurrent: number;
  /** Maximum queue size (0 = no queue) */
  maxQueue?: number;
  /** Timeout for queued items in ms (0 = no timeout) */
  queueTimeout?: number;
  /** Callback when execution starts */
  onExecute?: () => void;
  /** Callback when execution completes */
  onComplete?: (duration: number) => void;
  /** Callback when rejected */
  onReject?: (reason: 'full' | 'timeout') => void;
}

export interface BulkheadStats {
  name: string;
  maxConcurrent: number;
  maxQueue: number;
  activeCalls: number;
  queuedCalls: number;
  availableSlots: number;
  totalExecuted: number;
  totalRejected: number;
  totalQueueTimeout: number;
}

interface QueuedCall<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
  queuedAt: number;
}

export class Bulkhead {
  private activeCalls = 0;
  private queue: QueuedCall<unknown>[] = [];
  private totalExecuted = 0;
  private totalRejected = 0;
  private totalQueueTimeout = 0;

  private readonly options: Required<BulkheadOptions>;

  constructor(options: BulkheadOptions) {
    this.options = {
      name: options.name,
      maxConcurrent: options.maxConcurrent,
      maxQueue: options.maxQueue ?? 0,
      queueTimeout: options.queueTimeout ?? 0,
      onExecute: options.onExecute ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
      onReject: options.onReject ?? (() => {}),
    };
  }

  /**
   * Execute a function through the bulkhead
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can execute immediately
    if (this.activeCalls < this.options.maxConcurrent) {
      return this.doExecute(fn);
    }

    // Check if we can queue
    if (this.options.maxQueue > 0 && this.queue.length < this.options.maxQueue) {
      return this.enqueue(fn);
    }

    // Reject - bulkhead is full
    this.totalRejected++;
    this.options.onReject('full');
    throw new BulkheadError(
      `Bulkhead '${this.options.name}' is full (${this.activeCalls} active, ${this.queue.length} queued)`,
      this.options.name,
      'full'
    );
  }

  /**
   * Execute the function
   */
  private async doExecute<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCalls++;
    this.totalExecuted++;
    this.options.onExecute();

    const startTime = Date.now();

    try {
      return await fn();
    } finally {
      this.activeCalls--;
      this.options.onComplete(Date.now() - startTime);
      this.processQueue();
    }
  }

  /**
   * Add to queue and wait
   */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedCall: QueuedCall<T> = {
        fn,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      // Set timeout if configured
      if (this.options.queueTimeout > 0) {
        queuedCall.timeoutId = setTimeout(() => {
          const index = this.queue.indexOf(queuedCall as QueuedCall<unknown>);
          if (index !== -1) {
            this.queue.splice(index, 1);
            this.totalQueueTimeout++;
            this.options.onReject('timeout');
            reject(new BulkheadError(
              `Bulkhead '${this.options.name}' queue timeout after ${this.options.queueTimeout}ms`,
              this.options.name,
              'timeout'
            ));
          }
        }, this.options.queueTimeout);
      }

      this.queue.push(queuedCall as QueuedCall<unknown>);
    });
  }

  /**
   * Process the next item in the queue
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.activeCalls >= this.options.maxConcurrent) {
      return;
    }

    const queuedCall = this.queue.shift()!;

    // Clear timeout if set
    if (queuedCall.timeoutId) {
      clearTimeout(queuedCall.timeoutId);
    }

    // Execute the queued call
    this.doExecute(queuedCall.fn)
      .then(queuedCall.resolve)
      .catch(queuedCall.reject);
  }

  /**
   * Get current statistics
   */
  getStats(): BulkheadStats {
    return {
      name: this.options.name,
      maxConcurrent: this.options.maxConcurrent,
      maxQueue: this.options.maxQueue,
      activeCalls: this.activeCalls,
      queuedCalls: this.queue.length,
      availableSlots: Math.max(0, this.options.maxConcurrent - this.activeCalls),
      totalExecuted: this.totalExecuted,
      totalRejected: this.totalRejected,
      totalQueueTimeout: this.totalQueueTimeout,
    };
  }

  /**
   * Check if bulkhead can accept more calls
   */
  isAvailable(): boolean {
    return this.activeCalls < this.options.maxConcurrent ||
           (this.options.maxQueue > 0 && this.queue.length < this.options.maxQueue);
  }

  /**
   * Get number of available execution slots
   */
  getAvailableSlots(): number {
    return Math.max(0, this.options.maxConcurrent - this.activeCalls);
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * Bulkhead Error
 */
export class BulkheadError extends Error {
  constructor(
    message: string,
    public readonly bulkheadName: string,
    public readonly reason: 'full' | 'timeout'
  ) {
    super(message);
    this.name = 'BulkheadError';
  }
}

/**
 * Bulkhead Registry - manages multiple bulkheads
 */
export class BulkheadRegistry {
  private bulkheads = new Map<string, Bulkhead>();
  private defaultOptions: Partial<BulkheadOptions>;

  constructor(defaultOptions: Partial<BulkheadOptions> = {}) {
    this.defaultOptions = defaultOptions;
  }

  /**
   * Get or create a bulkhead
   */
  get(name: string, options?: Partial<BulkheadOptions>): Bulkhead {
    if (!this.bulkheads.has(name)) {
      this.bulkheads.set(name, new Bulkhead({
        maxConcurrent: 10,
        ...this.defaultOptions,
        ...options,
        name,
      }));
    }
    return this.bulkheads.get(name)!;
  }

  /**
   * Get all bulkheads
   */
  getAll(): Map<string, Bulkhead> {
    return new Map(this.bulkheads);
  }

  /**
   * Get stats for all bulkheads
   */
  getAllStats(): Record<string, BulkheadStats> {
    const stats: Record<string, BulkheadStats> = {};
    for (const [name, bulkhead] of this.bulkheads) {
      stats[name] = bulkhead.getStats();
    }
    return stats;
  }

  /**
   * Remove a bulkhead
   */
  remove(name: string): boolean {
    return this.bulkheads.delete(name);
  }

  /**
   * Clear all bulkheads
   */
  clear(): void {
    this.bulkheads.clear();
  }
}

/**
 * Default bulkhead registry
 */
export const defaultBulkheadRegistry = new BulkheadRegistry({
  maxConcurrent: 10,
  maxQueue: 100,
  queueTimeout: 30000,
});

/**
 * Decorator-style function to wrap async functions with bulkhead
 */
export function withBulkhead<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  bulkhead: Bulkhead
): T {
  return (async (...args: Parameters<T>) => {
    return bulkhead.execute(() => fn(...args));
  }) as T;
}
