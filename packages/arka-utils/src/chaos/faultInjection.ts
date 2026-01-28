/**
 * Fault Injection for Chaos Engineering
 *
 * Utilities for injecting faults to test system resilience.
 * Use in testing/staging environments only.
 */

/**
 * Fault injection configuration
 */
export interface FaultConfig {
  /** Enable/disable fault injection */
  enabled: boolean;
  /** Probability of fault (0-1) */
  probability: number;
  /** Fault type */
  type: FaultType;
  /** Additional configuration */
  options?: FaultOptions;
}

export type FaultType =
  | 'latency'      // Add artificial delay
  | 'error'        // Return error response
  | 'exception'    // Throw exception
  | 'timeout'      // Simulate timeout
  | 'corruption'   // Corrupt response data
  | 'partial'      // Return partial response
  | 'abort';       // Abort connection

export interface FaultOptions {
  /** Latency in milliseconds (for 'latency' type) */
  latencyMs?: number;
  /** Latency range [min, max] ms */
  latencyRange?: [number, number];
  /** Error code (for 'error' type) */
  errorCode?: number;
  /** Error message */
  errorMessage?: string;
  /** Exception to throw (for 'exception' type) */
  exception?: Error;
  /** Timeout duration in ms (for 'timeout' type) */
  timeoutMs?: number;
}

/**
 * Fault Injector
 *
 * Injects faults based on configuration to test resilience.
 */
export class FaultInjector {
  private config: FaultConfig;
  private stats = {
    checked: 0,
    injected: 0,
    skipped: 0,
  };

  constructor(config: Partial<FaultConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      probability: config.probability ?? 0,
      type: config.type ?? 'error',
      options: config.options,
    };
  }

  /**
   * Check if fault should be injected
   */
  shouldInject(): boolean {
    this.stats.checked++;

    if (!this.config.enabled) {
      this.stats.skipped++;
      return false;
    }

    if (Math.random() >= this.config.probability) {
      this.stats.skipped++;
      return false;
    }

    this.stats.injected++;
    return true;
  }

  /**
   * Maybe inject fault (async version)
   * Returns a function that wraps operations with potential fault injection
   */
  async maybeInject<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.shouldInject()) {
      return operation();
    }

    return this.injectFault(operation);
  }

  /**
   * Inject the configured fault
   */
  private async injectFault<T>(operation: () => Promise<T>): Promise<T> {
    const { type, options = {} } = this.config;

    switch (type) {
      case 'latency': {
        const delay = options.latencyRange
          ? randomInRange(options.latencyRange[0], options.latencyRange[1])
          : options.latencyMs ?? 1000;
        await sleep(delay);
        return operation();
      }

      case 'error': {
        const error = new FaultInjectionError(
          options.errorMessage || 'Injected fault: error',
          options.errorCode || 500
        );
        throw error;
      }

      case 'exception': {
        throw options.exception || new Error('Injected fault: exception');
      }

      case 'timeout': {
        const timeoutMs = options.timeoutMs ?? 30000;
        await sleep(timeoutMs);
        throw new FaultInjectionError('Injected fault: timeout', 408);
      }

      case 'abort': {
        throw new FaultInjectionError('Injected fault: connection aborted', 0);
      }

      case 'corruption': {
        const result = await operation();
        return this.corruptData(result);
      }

      case 'partial': {
        const result = await operation();
        return this.truncateData(result);
      }

      default:
        return operation();
    }
  }

  /**
   * Corrupt data by modifying random fields
   */
  private corruptData<T>(data: T): T {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const corrupted = JSON.parse(JSON.stringify(data));
    const keys = Object.keys(corrupted);

    if (keys.length === 0) return corrupted;

    // Corrupt 1-3 random fields
    const numCorruptions = Math.min(randomInRange(1, 3), keys.length);
    const keysToCorrupt = shuffleArray(keys).slice(0, numCorruptions);

    for (const key of keysToCorrupt) {
      corrupted[key] = this.corruptValue(corrupted[key]);
    }

    return corrupted as T;
  }

  /**
   * Corrupt a single value
   */
  private corruptValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.split('').reverse().join('');
    }
    if (typeof value === 'number') {
      return value * -1;
    }
    if (typeof value === 'boolean') {
      return !value;
    }
    if (value === null) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.slice(0, Math.ceil(value.length / 2)) : value;
    }
    return null;
  }

  /**
   * Truncate data (partial response)
   */
  private truncateData<T>(data: T): T {
    if (typeof data === 'string') {
      return data.slice(0, Math.ceil(data.length / 2)) as T;
    }
    if (Array.isArray(data)) {
      return data.slice(0, Math.ceil(data.length / 2)) as T;
    }
    if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const truncated: Record<string, unknown> = {};
      const keepKeys = keys.slice(0, Math.ceil(keys.length / 2));
      for (const key of keepKeys) {
        truncated[key] = (data as Record<string, unknown>)[key];
      }
      return truncated as T;
    }
    return data;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<FaultConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable fault injection
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable fault injection
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats & { injectionRate: number } {
    const total = this.stats.checked;
    return {
      ...this.stats,
      injectionRate: total > 0 ? this.stats.injected / total : 0,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { checked: 0, injected: 0, skipped: 0 };
  }
}

/**
 * Custom error for fault injection
 */
export class FaultInjectionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'FaultInjectionError';
  }
}

/**
 * Create a middleware for Express fault injection
 */
export function createFaultMiddleware(config: Partial<FaultConfig> = {}) {
  const injector = new FaultInjector(config);

  return async (
    req: unknown,
    res: { status: (code: number) => { json: (data: unknown) => void } },
    next: (error?: Error) => void
  ) => {
    if (!injector.shouldInject()) {
      return next();
    }

    const { type, options = {} } = injector['config'];

    switch (type) {
      case 'latency': {
        const delay = options.latencyRange
          ? randomInRange(options.latencyRange[0], options.latencyRange[1])
          : options.latencyMs ?? 1000;
        await sleep(delay);
        return next();
      }

      case 'error':
        return res.status(options.errorCode || 500).json({
          error: 'Fault injection',
          message: options.errorMessage || 'Injected server error',
        });

      case 'timeout':
        // Don't respond at all
        return;

      default:
        return next();
    }
  };
}

/**
 * Chaos Experiment Runner
 *
 * Runs chaos experiments with defined parameters.
 */
export interface ChaosExperiment {
  name: string;
  description: string;
  target: string;
  faultConfig: FaultConfig;
  duration: number; // ms
  steadyStateCheck: () => Promise<boolean>;
}

export interface ExperimentResult {
  name: string;
  success: boolean;
  duration: number;
  steadyStateMaintained: boolean;
  faultsInjected: number;
  errors: string[];
}

/**
 * Run a chaos experiment
 */
export async function runExperiment(
  experiment: ChaosExperiment,
  injector: FaultInjector
): Promise<ExperimentResult> {
  const result: ExperimentResult = {
    name: experiment.name,
    success: false,
    duration: 0,
    steadyStateMaintained: false,
    faultsInjected: 0,
    errors: [],
  };

  const startTime = Date.now();

  try {
    // 1. Verify steady state before experiment
    const initialSteadyState = await experiment.steadyStateCheck();
    if (!initialSteadyState) {
      result.errors.push('System not in steady state before experiment');
      return result;
    }

    // 2. Enable fault injection
    injector.configure(experiment.faultConfig);
    injector.enable();
    injector.resetStats();

    // 3. Wait for experiment duration
    await sleep(experiment.duration);

    // 4. Disable fault injection
    injector.disable();
    result.faultsInjected = injector.getStats().injected;

    // 5. Allow system to recover
    await sleep(5000);

    // 6. Verify steady state after experiment
    result.steadyStateMaintained = await experiment.steadyStateCheck();
    result.success = result.steadyStateMaintained;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    result.duration = Date.now() - startTime;
    injector.disable();
  }

  return result;
}

/**
 * Predefined chaos experiments
 */
export const chaosExperiments = {
  /**
   * Test service resilience to high latency
   */
  highLatency: (steadyStateCheck: () => Promise<boolean>): ChaosExperiment => ({
    name: 'High Latency',
    description: 'Inject 500-2000ms latency to test timeout handling',
    target: 'all-services',
    faultConfig: {
      enabled: true,
      probability: 0.3,
      type: 'latency',
      options: { latencyRange: [500, 2000] },
    },
    duration: 60000,
    steadyStateCheck,
  }),

  /**
   * Test service resilience to errors
   */
  intermittentErrors: (steadyStateCheck: () => Promise<boolean>): ChaosExperiment => ({
    name: 'Intermittent Errors',
    description: 'Inject 10% 500 errors to test error handling',
    target: 'all-services',
    faultConfig: {
      enabled: true,
      probability: 0.1,
      type: 'error',
      options: { errorCode: 500, errorMessage: 'Chaos: random error' },
    },
    duration: 60000,
    steadyStateCheck,
  }),

  /**
   * Test circuit breaker behavior
   */
  circuitBreakerTest: (steadyStateCheck: () => Promise<boolean>): ChaosExperiment => ({
    name: 'Circuit Breaker Test',
    description: 'Inject 100% errors briefly to trigger circuit breaker',
    target: 'external-dependency',
    faultConfig: {
      enabled: true,
      probability: 1.0,
      type: 'error',
      options: { errorCode: 503, errorMessage: 'Service unavailable' },
    },
    duration: 10000,
    steadyStateCheck,
  }),

  /**
   * Test timeout handling
   */
  timeoutTest: (steadyStateCheck: () => Promise<boolean>): ChaosExperiment => ({
    name: 'Timeout Test',
    description: 'Inject timeouts to test timeout configuration',
    target: 'all-services',
    faultConfig: {
      enabled: true,
      probability: 0.2,
      type: 'timeout',
      options: { timeoutMs: 35000 },
    },
    duration: 30000,
    steadyStateCheck,
  }),
};

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
