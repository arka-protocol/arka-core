/**
 * Resilience Testing Utilities
 *
 * Helpers for testing system resilience and recovery.
 */

/**
 * Resource exhaustion types
 */
export type ResourceType = 'memory' | 'cpu' | 'connections' | 'file_descriptors';

/**
 * Resource pressure configuration
 */
export interface ResourcePressureConfig {
  type: ResourceType;
  intensity: 'low' | 'medium' | 'high';
  duration: number; // ms
}

/**
 * Memory pressure generator
 *
 * Allocates memory to simulate memory pressure.
 * Use carefully - can crash Node.js process!
 */
export class MemoryPressure {
  private allocations: Buffer[] = [];
  private isActive = false;

  /**
   * Start memory pressure
   * @param targetMB Target memory allocation in MB
   * @param chunkSizeMB Size of each allocation chunk
   */
  start(targetMB: number, chunkSizeMB = 10): void {
    if (this.isActive) return;
    this.isActive = true;

    const chunkSize = chunkSizeMB * 1024 * 1024;
    const chunks = Math.ceil((targetMB * 1024 * 1024) / chunkSize);

    for (let i = 0; i < chunks && this.isActive; i++) {
      try {
        // Allocate and fill to ensure actual memory usage
        const buffer = Buffer.alloc(chunkSize);
        buffer.fill(Math.random() * 255);
        this.allocations.push(buffer);
      } catch {
        // Stop if allocation fails
        break;
      }
    }
  }

  /**
   * Stop memory pressure and free allocations
   */
  stop(): void {
    this.isActive = false;
    this.allocations = [];

    // Force garbage collection if exposed
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Get current allocation size
   */
  getAllocatedMB(): number {
    return this.allocations.reduce((sum, buf) => sum + buf.length, 0) / (1024 * 1024);
  }
}

/**
 * CPU pressure generator
 *
 * Generates CPU load through busy-waiting.
 */
export class CpuPressure {
  private workers: ReturnType<typeof setInterval>[] = [];
  private isActive = false;

  /**
   * Start CPU pressure
   * @param intensity Load intensity (0-1)
   * @param workers Number of worker threads
   */
  start(intensity = 0.5, workers = 1): void {
    if (this.isActive) return;
    this.isActive = true;

    const workTime = 100 * intensity;
    const sleepTime = 100 - workTime;

    for (let i = 0; i < workers; i++) {
      const worker = setInterval(() => {
        if (!this.isActive) return;

        // Busy work
        const start = Date.now();
        while (Date.now() - start < workTime) {
          Math.random() * Math.random();
        }
      }, sleepTime + workTime);

      this.workers.push(worker);
    }
  }

  /**
   * Stop CPU pressure
   */
  stop(): void {
    this.isActive = false;
    for (const worker of this.workers) {
      clearInterval(worker);
    }
    this.workers = [];
  }
}

/**
 * Connection pool exhaustion simulator
 */
export class ConnectionPoolExhaustion {
  private connections: Array<{ release: () => void }> = [];
  private isActive = false;

  /**
   * Start exhausting connection pool
   * @param acquireConnection Function to acquire a connection
   * @param targetConnections Number of connections to hold
   */
  async start(
    acquireConnection: () => Promise<{ release: () => void }>,
    targetConnections: number
  ): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    for (let i = 0; i < targetConnections && this.isActive; i++) {
      try {
        const conn = await acquireConnection();
        this.connections.push(conn);
      } catch {
        // Pool exhausted
        break;
      }
    }
  }

  /**
   * Stop and release connections
   */
  stop(): void {
    this.isActive = false;
    for (const conn of this.connections) {
      try {
        conn.release();
      } catch {
        // Ignore release errors
      }
    }
    this.connections = [];
  }

  /**
   * Get held connection count
   */
  getHeldConnections(): number {
    return this.connections.length;
  }
}

/**
 * Network partition simulator
 *
 * Simulates network partitions by blocking traffic.
 */
export interface NetworkPartitionConfig {
  /** Duration of partition in ms */
  duration: number;
  /** Whether to allow some packets through */
  partial?: boolean;
  /** Packet loss percentage for partial partition */
  packetLoss?: number;
}

/**
 * Simulate network partition effect
 */
export async function simulateNetworkPartition<T>(
  operation: () => Promise<T>,
  config: NetworkPartitionConfig
): Promise<T> {
  if (config.partial && config.packetLoss) {
    // Partial partition - random failures
    if (Math.random() < config.packetLoss / 100) {
      await sleep(config.duration);
      throw new Error('Network partition: packet lost');
    }
    return operation();
  }

  // Full partition - always fails during duration
  await sleep(config.duration);
  throw new Error('Network partition: connection timed out');
}

/**
 * Dependency failure simulator
 */
export class DependencyFailure {
  private failingDependencies = new Set<string>();
  private failureMode: 'error' | 'timeout' | 'slow' = 'error';
  private slowLatencyMs = 5000;

  /**
   * Mark a dependency as failing
   */
  fail(dependencyName: string, mode: 'error' | 'timeout' | 'slow' = 'error'): void {
    this.failingDependencies.add(dependencyName);
    this.failureMode = mode;
  }

  /**
   * Mark a dependency as recovered
   */
  recover(dependencyName: string): void {
    this.failingDependencies.delete(dependencyName);
  }

  /**
   * Check if dependency call should fail
   */
  async check<T>(
    dependencyName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    if (!this.failingDependencies.has(dependencyName)) {
      return operation();
    }

    switch (this.failureMode) {
      case 'error':
        throw new Error(`Dependency failure: ${dependencyName} is unavailable`);

      case 'timeout':
        await sleep(30000);
        throw new Error(`Dependency failure: ${dependencyName} timed out`);

      case 'slow':
        await sleep(this.slowLatencyMs);
        return operation();
    }
  }

  /**
   * Get list of failing dependencies
   */
  getFailingDependencies(): string[] {
    return Array.from(this.failingDependencies);
  }

  /**
   * Clear all failures
   */
  clearAll(): void {
    this.failingDependencies.clear();
  }
}

/**
 * Graceful degradation tester
 */
export interface GracefulDegradationTest {
  name: string;
  /** Dependencies to disable */
  disabledDependencies: string[];
  /** Expected behavior when degraded */
  expectedBehavior: 'fallback' | 'partial' | 'cached' | 'error';
  /** Test function */
  test: () => Promise<void>;
}

/**
 * Run graceful degradation tests
 */
export async function testGracefulDegradation(
  tests: GracefulDegradationTest[],
  dependencyFailure: DependencyFailure
): Promise<GracefulDegradationResult[]> {
  const results: GracefulDegradationResult[] = [];

  for (const test of tests) {
    const result: GracefulDegradationResult = {
      name: test.name,
      passed: false,
      disabledDependencies: test.disabledDependencies,
      expectedBehavior: test.expectedBehavior,
      error: undefined,
    };

    try {
      // Disable dependencies
      for (const dep of test.disabledDependencies) {
        dependencyFailure.fail(dep);
      }

      // Run test
      await test.test();
      result.passed = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      // Test might still pass if error is expected
      if (test.expectedBehavior === 'error') {
        result.passed = true;
      }
    } finally {
      // Recover dependencies
      dependencyFailure.clearAll();
    }

    results.push(result);
  }

  return results;
}

export interface GracefulDegradationResult {
  name: string;
  passed: boolean;
  disabledDependencies: string[];
  expectedBehavior: string;
  error?: string;
}

/**
 * Recovery time measurement
 */
export async function measureRecoveryTime(
  healthCheck: () => Promise<boolean>,
  maxWaitMs = 60000,
  checkIntervalMs = 1000
): Promise<{ recovered: boolean; recoveryTimeMs: number }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      if (await healthCheck()) {
        return {
          recovered: true,
          recoveryTimeMs: Date.now() - startTime,
        };
      }
    } catch {
      // Health check failed, continue waiting
    }

    await sleep(checkIntervalMs);
  }

  return {
    recovered: false,
    recoveryTimeMs: maxWaitMs,
  };
}

/**
 * Soak test runner
 *
 * Runs operations continuously to find memory leaks and stability issues.
 */
export interface SoakTestConfig {
  /** Duration in ms */
  duration: number;
  /** Operations per second */
  operationsPerSecond: number;
  /** Operation to run */
  operation: () => Promise<void>;
  /** Memory check interval */
  memoryCheckInterval?: number;
  /** Memory growth threshold (MB) */
  memoryGrowthThreshold?: number;
}

export interface SoakTestResult {
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  memoryGrowthMB: number;
  passed: boolean;
  errors: string[];
}

export async function runSoakTest(config: SoakTestConfig): Promise<SoakTestResult> {
  const {
    duration,
    operationsPerSecond,
    operation,
    memoryCheckInterval = 10000,
    memoryGrowthThreshold = 100,
  } = config;

  const result: SoakTestResult = {
    duration: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageLatencyMs: 0,
    maxLatencyMs: 0,
    memoryGrowthMB: 0,
    passed: true,
    errors: [],
  };

  const startTime = Date.now();
  const initialMemory = process.memoryUsage().heapUsed;
  const latencies: number[] = [];
  const interval = 1000 / operationsPerSecond;

  let lastMemoryCheck = startTime;

  while (Date.now() - startTime < duration) {
    const opStart = Date.now();

    try {
      await operation();
      result.successfulOperations++;
    } catch (error) {
      result.failedOperations++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!result.errors.includes(errorMsg)) {
        result.errors.push(errorMsg);
      }
    }

    result.totalOperations++;
    const latency = Date.now() - opStart;
    latencies.push(latency);
    result.maxLatencyMs = Math.max(result.maxLatencyMs, latency);

    // Memory check
    if (Date.now() - lastMemoryCheck >= memoryCheckInterval) {
      const currentMemory = process.memoryUsage().heapUsed;
      result.memoryGrowthMB = (currentMemory - initialMemory) / (1024 * 1024);

      if (result.memoryGrowthMB > memoryGrowthThreshold) {
        result.passed = false;
        result.errors.push(`Memory growth exceeded threshold: ${result.memoryGrowthMB.toFixed(2)}MB`);
      }

      lastMemoryCheck = Date.now();
    }

    // Rate limiting
    const elapsed = Date.now() - opStart;
    if (elapsed < interval) {
      await sleep(interval - elapsed);
    }
  }

  result.duration = Date.now() - startTime;
  result.averageLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  // Final memory check
  const finalMemory = process.memoryUsage().heapUsed;
  result.memoryGrowthMB = (finalMemory - initialMemory) / (1024 * 1024);

  // Check failure rate
  const failureRate = result.failedOperations / result.totalOperations;
  if (failureRate > 0.01) {
    result.passed = false;
    result.errors.push(`Failure rate too high: ${(failureRate * 100).toFixed(2)}%`);
  }

  return result;
}

// Utility
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
