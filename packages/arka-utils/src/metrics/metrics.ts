/**
 * ARKA Metrics
 *
 * Prometheus-compatible metrics collection using a simple, dependency-free implementation.
 * Can be extended with OpenTelemetry SDK for production deployments.
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricLabels {
  [key: string]: string;
}

interface MetricValue {
  value: number;
  labels: MetricLabels;
  timestamp: number;
}

interface HistogramValue {
  count: number;
  sum: number;
  buckets: Map<number, number>;
  labels: MetricLabels;
}

/**
 * Base metric class
 */
abstract class Metric {
  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly type: MetricType,
    public readonly labelNames: string[] = []
  ) {}

  protected labelsToKey(labels: MetricLabels): string {
    return this.labelNames.map(name => `${name}="${labels[name] || ''}"`).join(',');
  }

  abstract collect(): string;
}

/**
 * Counter metric - monotonically increasing value
 */
export class Counter extends Metric {
  private values = new Map<string, MetricValue>();

  constructor(name: string, help: string, labelNames: string[] = []) {
    super(name, help, 'counter', labelNames);
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsToKey(labels);
    const existing = this.values.get(key);
    this.values.set(key, {
      value: (existing?.value || 0) + value,
      labels,
      timestamp: Date.now(),
    });
  }

  get(labels: MetricLabels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key)?.value || 0;
  }

  reset(): void {
    this.values.clear();
  }

  collect(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];

    for (const [key, { value }] of this.values) {
      const labelStr = key ? `{${key}}` : '';
      lines.push(`${this.name}${labelStr} ${value}`);
    }

    return lines.join('\n');
  }
}

/**
 * Gauge metric - value that can go up or down
 */
export class Gauge extends Metric {
  private values = new Map<string, MetricValue>();

  constructor(name: string, help: string, labelNames: string[] = []) {
    super(name, help, 'gauge', labelNames);
  }

  set(labels: MetricLabels, value: number): void;
  set(value: number): void;
  set(labelsOrValue: MetricLabels | number, value?: number): void {
    if (typeof labelsOrValue === 'number') {
      this.values.set('', {
        value: labelsOrValue,
        labels: {},
        timestamp: Date.now(),
      });
    } else {
      const key = this.labelsToKey(labelsOrValue);
      this.values.set(key, {
        value: value!,
        labels: labelsOrValue,
        timestamp: Date.now(),
      });
    }
  }

  inc(labels: MetricLabels = {}, value = 1): void {
    const key = this.labelsToKey(labels);
    const existing = this.values.get(key);
    this.set(labels, (existing?.value || 0) + value);
  }

  dec(labels: MetricLabels = {}, value = 1): void {
    this.inc(labels, -value);
  }

  get(labels: MetricLabels = {}): number {
    const key = this.labelsToKey(labels);
    return this.values.get(key)?.value || 0;
  }

  collect(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];

    for (const [key, { value }] of this.values) {
      const labelStr = key ? `{${key}}` : '';
      lines.push(`${this.name}${labelStr} ${value}`);
    }

    return lines.join('\n');
  }
}

/**
 * Histogram metric - distribution of values
 */
export class Histogram extends Metric {
  private values = new Map<string, HistogramValue>();
  private readonly buckets: number[];

  constructor(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  ) {
    super(name, help, 'histogram', labelNames);
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(labels: MetricLabels, value: number): void;
  observe(value: number): void;
  observe(labelsOrValue: MetricLabels | number, value?: number): void {
    let labels: MetricLabels;
    let observeValue: number;

    if (typeof labelsOrValue === 'number') {
      labels = {};
      observeValue = labelsOrValue;
    } else {
      labels = labelsOrValue;
      observeValue = value!;
    }

    const key = this.labelsToKey(labels);
    let histValue = this.values.get(key);

    if (!histValue) {
      histValue = {
        count: 0,
        sum: 0,
        buckets: new Map(this.buckets.map(b => [b, 0])),
        labels,
      };
      this.values.set(key, histValue);
    }

    histValue.count++;
    histValue.sum += observeValue;

    // Find the appropriate bucket and increment only that one
    // collect() will compute cumulative sums
    for (const bucket of this.buckets) {
      if (observeValue <= bucket) {
        histValue.buckets.set(bucket, (histValue.buckets.get(bucket) || 0) + 1);
        break; // Only increment the first matching bucket
      }
    }
  }

  /**
   * Helper to time an async operation
   */
  async time<T>(labels: MetricLabels, fn: () => Promise<T>): Promise<T>;
  async time<T>(fn: () => Promise<T>): Promise<T>;
  async time<T>(
    labelsOrFn: MetricLabels | (() => Promise<T>),
    fn?: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    let labels: MetricLabels;
    let execFn: () => Promise<T>;

    if (typeof labelsOrFn === 'function') {
      labels = {};
      execFn = labelsOrFn;
    } else {
      labels = labelsOrFn;
      execFn = fn!;
    }

    try {
      return await execFn();
    } finally {
      const duration = (performance.now() - start) / 1000; // Convert to seconds
      this.observe(labels, duration);
    }
  }

  /**
   * Synchronous timing helper
   */
  timeSync<T>(labels: MetricLabels, fn: () => T): T;
  timeSync<T>(fn: () => T): T;
  timeSync<T>(labelsOrFn: MetricLabels | (() => T), fn?: () => T): T {
    const start = performance.now();
    let labels: MetricLabels;
    let execFn: () => T;

    if (typeof labelsOrFn === 'function') {
      labels = {};
      execFn = labelsOrFn;
    } else {
      labels = labelsOrFn;
      execFn = fn!;
    }

    try {
      return execFn();
    } finally {
      const duration = (performance.now() - start) / 1000;
      this.observe(labels, duration);
    }
  }

  collect(): string {
    const lines: string[] = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];

    for (const [key, histValue] of this.values) {
      const baseLabels = key ? `${key},` : '';
      let cumulativeCount = 0;

      for (const bucket of this.buckets) {
        cumulativeCount += histValue.buckets.get(bucket) || 0;
        lines.push(`${this.name}_bucket{${baseLabels}le="${bucket}"} ${cumulativeCount}`);
      }
      lines.push(`${this.name}_bucket{${baseLabels}le="+Inf"} ${histValue.count}`);
      lines.push(`${this.name}_sum{${key}} ${histValue.sum}`);
      lines.push(`${this.name}_count{${key}} ${histValue.count}`);
    }

    return lines.join('\n');
  }
}

/**
 * Metrics Registry - collects and exports all metrics
 */
export class MetricsRegistry {
  private metrics = new Map<string, Metric>();
  private prefix: string;

  constructor(prefix = 'arka') {
    this.prefix = prefix;
  }

  private fullName(name: string): string {
    return `${this.prefix}_${name}`;
  }

  createCounter(name: string, help: string, labelNames: string[] = []): Counter {
    const fullName = this.fullName(name);
    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Counter;
    }
    const counter = new Counter(fullName, help, labelNames);
    this.metrics.set(fullName, counter);
    return counter;
  }

  createGauge(name: string, help: string, labelNames: string[] = []): Gauge {
    const fullName = this.fullName(name);
    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Gauge;
    }
    const gauge = new Gauge(fullName, help, labelNames);
    this.metrics.set(fullName, gauge);
    return gauge;
  }

  createHistogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets?: number[]
  ): Histogram {
    const fullName = this.fullName(name);
    if (this.metrics.has(fullName)) {
      return this.metrics.get(fullName) as Histogram;
    }
    const histogram = new Histogram(fullName, help, labelNames, buckets);
    this.metrics.set(fullName, histogram);
    return histogram;
  }

  /**
   * Export all metrics in Prometheus text format
   */
  collect(): string {
    const output: string[] = [];

    for (const metric of this.metrics.values()) {
      output.push(metric.collect());
    }

    return output.join('\n\n');
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics.clear();
  }
}

// Default global registry
export const defaultRegistry = new MetricsRegistry();

// Pre-defined metrics for common use cases
export const httpRequestsTotal = defaultRegistry.createCounter(
  'http_requests_total',
  'Total number of HTTP requests',
  ['method', 'path', 'status']
);

export const httpRequestDuration = defaultRegistry.createHistogram(
  'http_request_duration_seconds',
  'HTTP request duration in seconds',
  ['method', 'path', 'status'],
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
);

export const httpRequestsInFlight = defaultRegistry.createGauge(
  'http_requests_in_flight',
  'Number of HTTP requests currently being processed',
  ['method']
);

export const dbQueryDuration = defaultRegistry.createHistogram(
  'db_query_duration_seconds',
  'Database query duration in seconds',
  ['operation', 'table'],
  [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
);

export const externalRequestDuration = defaultRegistry.createHistogram(
  'external_request_duration_seconds',
  'External service request duration in seconds',
  ['service', 'operation'],
  [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
);

export const cacheHits = defaultRegistry.createCounter(
  'cache_hits_total',
  'Total number of cache hits',
  ['cache']
);

export const cacheMisses = defaultRegistry.createCounter(
  'cache_misses_total',
  'Total number of cache misses',
  ['cache']
);

export const errorsTotal = defaultRegistry.createCounter(
  'errors_total',
  'Total number of errors',
  ['type', 'code']
);

export const activeConnections = defaultRegistry.createGauge(
  'active_connections',
  'Number of active connections',
  ['type']
);

export const queueSize = defaultRegistry.createGauge(
  'queue_size',
  'Current queue size',
  ['queue']
);

export const processedItems = defaultRegistry.createCounter(
  'processed_items_total',
  'Total number of processed items',
  ['type', 'status']
);
