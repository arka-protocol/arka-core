/**
 * Debug Utilities
 *
 * Helpful utilities for debugging and development.
 */

/**
 * Pretty print an object with syntax highlighting (for console)
 */
export function prettyPrint(obj: unknown, options: PrettyPrintOptions = {}): string {
  const {
    indent = 2,
    colors = true,
    maxDepth = 10,
    maxArrayLength = 100,
    maxStringLength = 1000,
  } = options;

  const seen = new WeakSet();

  function colorize(str: string, color: string): string {
    if (!colors) return str;
    const codes: Record<string, string> = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      gray: '\x1b[90m',
    };
    return `${codes[color] || ''}${str}${codes.reset}`;
  }

  function format(value: unknown, depth: number, currentIndent: string): string {
    if (depth > maxDepth) {
      return colorize('[Max Depth]', 'gray');
    }

    if (value === null) {
      return colorize('null', 'magenta');
    }

    if (value === undefined) {
      return colorize('undefined', 'gray');
    }

    if (typeof value === 'boolean') {
      return colorize(String(value), 'yellow');
    }

    if (typeof value === 'number') {
      return colorize(String(value), 'cyan');
    }

    if (typeof value === 'string') {
      const truncated = value.length > maxStringLength
        ? value.slice(0, maxStringLength) + '...'
        : value;
      return colorize(`"${truncated}"`, 'green');
    }

    if (typeof value === 'function') {
      return colorize(`[Function: ${value.name || 'anonymous'}]`, 'blue');
    }

    if (typeof value === 'symbol') {
      return colorize(value.toString(), 'magenta');
    }

    if (value instanceof Date) {
      return colorize(`Date(${value.toISOString()})`, 'cyan');
    }

    if (value instanceof RegExp) {
      return colorize(value.toString(), 'red');
    }

    if (value instanceof Error) {
      return colorize(`Error: ${value.message}`, 'red');
    }

    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      return colorize(`[Buffer: ${(value as ArrayBufferView).byteLength} bytes]`, 'gray');
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        return colorize('[Circular]', 'gray');
      }
      seen.add(value);

      const nextIndent = currentIndent + ' '.repeat(indent);

      if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        if (value.length > maxArrayLength) {
          const truncated = value.slice(0, maxArrayLength);
          const items = truncated.map(v => format(v, depth + 1, nextIndent));
          return `[\n${nextIndent}${items.join(`,\n${nextIndent}`)},\n${nextIndent}${colorize(`... ${value.length - maxArrayLength} more items`, 'gray')}\n${currentIndent}]`;
        }
        const items = value.map(v => format(v, depth + 1, nextIndent));
        return `[\n${nextIndent}${items.join(`,\n${nextIndent}`)}\n${currentIndent}]`;
      }

      if (value instanceof Map) {
        const entries = Array.from(value.entries())
          .map(([k, v]) => `${format(k, depth + 1, nextIndent)} => ${format(v, depth + 1, nextIndent)}`);
        return `Map(${value.size}) {\n${nextIndent}${entries.join(`,\n${nextIndent}`)}\n${currentIndent}}`;
      }

      if (value instanceof Set) {
        const items = Array.from(value).map(v => format(v, depth + 1, nextIndent));
        return `Set(${value.size}) {\n${nextIndent}${items.join(`,\n${nextIndent}`)}\n${currentIndent}}`;
      }

      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';

      const lines = entries.map(([k, v]) => {
        const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `"${k}"`;
        return `${colorize(key, 'blue')}: ${format(v, depth + 1, nextIndent)}`;
      });

      return `{\n${nextIndent}${lines.join(`,\n${nextIndent}`)}\n${currentIndent}}`;
    }

    return String(value);
  }

  return format(obj, 0, '');
}

export interface PrettyPrintOptions {
  indent?: number;
  colors?: boolean;
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => T | Promise<T>,
  label?: string
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;

  if (label) {
    console.log(`[${label}] Execution time: ${durationMs.toFixed(2)}ms`);
  }

  return { result, durationMs };
}

/**
 * Create a timer for measuring multiple operations
 */
export function createTimer(name: string): Timer {
  return new Timer(name);
}

export class Timer {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();
  private startTime: number;

  constructor(private name: string) {
    this.startTime = performance.now();
  }

  mark(label: string): void {
    this.marks.set(label, performance.now());
  }

  measure(label: string, startMark?: string): number {
    const endTime = performance.now();
    const startTime = startMark ? this.marks.get(startMark) : this.startTime;

    if (startTime === undefined) {
      throw new Error(`Mark '${startMark}' not found`);
    }

    const duration = endTime - startTime;

    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);

    return duration;
  }

  getStats(label: string): TimerStats | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      total: sum,
      avg: sum / sorted.length,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      median: sorted[Math.floor(sorted.length / 2)]!,
      p95: sorted[Math.floor(sorted.length * 0.95)]!,
      p99: sorted[Math.floor(sorted.length * 0.99)]!,
    };
  }

  report(): string {
    const lines: string[] = [`Timer: ${this.name}`];
    lines.push('='.repeat(50));

    for (const [label] of this.measurements) {
      const stats = this.getStats(label);
      if (stats) {
        lines.push(`\n${label}:`);
        lines.push(`  Count:  ${stats.count}`);
        lines.push(`  Total:  ${stats.total.toFixed(2)}ms`);
        lines.push(`  Avg:    ${stats.avg.toFixed(2)}ms`);
        lines.push(`  Min:    ${stats.min.toFixed(2)}ms`);
        lines.push(`  Max:    ${stats.max.toFixed(2)}ms`);
        lines.push(`  Median: ${stats.median.toFixed(2)}ms`);
        lines.push(`  P95:    ${stats.p95.toFixed(2)}ms`);
        lines.push(`  P99:    ${stats.p99.toFixed(2)}ms`);
      }
    }

    return lines.join('\n');
  }

  reset(): void {
    this.marks.clear();
    this.measurements.clear();
    this.startTime = performance.now();
  }
}

export interface TimerStats {
  count: number;
  total: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Debug logger that can be enabled/disabled
 */
export function createDebugLogger(namespace: string): DebugLogger {
  return new DebugLogger(namespace);
}

export class DebugLogger {
  private enabled: boolean;

  constructor(private namespace: string) {
    this.enabled = this.checkEnabled();
  }

  private checkEnabled(): boolean {
    // Check DEBUG environment variable
    const debug = process.env.DEBUG || '';
    if (!debug) return false;

    const namespaces = debug.split(',').map(s => s.trim());
    return namespaces.some(ns => {
      if (ns === '*') return true;
      if (ns.endsWith('*')) {
        return this.namespace.startsWith(ns.slice(0, -1));
      }
      return ns === this.namespace;
    });
  }

  log(...args: unknown[]): void {
    if (!this.enabled) return;
    console.log(`[${this.namespace}]`, ...args);
  }

  error(...args: unknown[]): void {
    if (!this.enabled) return;
    console.error(`[${this.namespace}]`, ...args);
  }

  warn(...args: unknown[]): void {
    if (!this.enabled) return;
    console.warn(`[${this.namespace}]`, ...args);
  }

  time(label: string): void {
    if (!this.enabled) return;
    console.time(`[${this.namespace}] ${label}`);
  }

  timeEnd(label: string): void {
    if (!this.enabled) return;
    console.timeEnd(`[${this.namespace}] ${label}`);
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}

/**
 * Create a tap function for debugging pipelines
 */
export function tap<T>(label: string, fn?: (value: T) => void): (value: T) => T {
  return (value: T) => {
    console.log(`[tap:${label}]`, value);
    fn?.(value);
    return value;
  };
}

/**
 * Assert function with detailed error messages
 */
export function assert(
  condition: unknown,
  message?: string,
  data?: unknown
): asserts condition {
  if (!condition) {
    const error = new Error(message || 'Assertion failed');
    if (data) {
      (error as Error & { data: unknown }).data = data;
      console.error('Assertion data:', prettyPrint(data));
    }
    throw error;
  }
}

/**
 * Deep diff between two objects
 */
export function diff(a: unknown, b: unknown, path = ''): DiffResult[] {
  const results: DiffResult[] = [];

  if (a === b) return results;

  if (typeof a !== typeof b) {
    results.push({ path: path || 'root', type: 'type', a, b });
    return results;
  }

  if (a === null || b === null) {
    if (a !== b) {
      results.push({ path: path || 'root', type: 'value', a, b });
    }
    return results;
  }

  if (typeof a !== 'object') {
    if (a !== b) {
      results.push({ path: path || 'root', type: 'value', a, b });
    }
    return results;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const itemPath = path ? `${path}[${i}]` : `[${i}]`;
      if (i >= a.length) {
        results.push({ path: itemPath, type: 'added', a: undefined, b: b[i] });
      } else if (i >= b.length) {
        results.push({ path: itemPath, type: 'removed', a: a[i], b: undefined });
      } else {
        results.push(...diff(a[i], b[i], itemPath));
      }
    }
    return results;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);

  for (const key of allKeys) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!(key in aObj)) {
      results.push({ path: keyPath, type: 'added', a: undefined, b: bObj[key] });
    } else if (!(key in bObj)) {
      results.push({ path: keyPath, type: 'removed', a: aObj[key], b: undefined });
    } else {
      results.push(...diff(aObj[key], bObj[key], keyPath));
    }
  }

  return results;
}

export interface DiffResult {
  path: string;
  type: 'added' | 'removed' | 'value' | 'type';
  a: unknown;
  b: unknown;
}

/**
 * Format diff results for display
 */
export function formatDiff(results: DiffResult[], colors = true): string {
  const colorize = (str: string, color: string): string => {
    if (!colors) return str;
    const codes: Record<string, string> = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
    };
    return `${codes[color] || ''}${str}${codes.reset}`;
  };

  return results.map(r => {
    switch (r.type) {
      case 'added':
        return colorize(`+ ${r.path}: ${JSON.stringify(r.b)}`, 'green');
      case 'removed':
        return colorize(`- ${r.path}: ${JSON.stringify(r.a)}`, 'red');
      case 'value':
        return colorize(`~ ${r.path}: ${JSON.stringify(r.a)} → ${JSON.stringify(r.b)}`, 'yellow');
      case 'type':
        return colorize(`! ${r.path}: type changed from ${typeof r.a} to ${typeof r.b}`, 'yellow');
    }
  }).join('\n');
}

/**
 * Memory usage helper
 */
export function getMemoryUsage(): MemoryUsage {
  const usage = process.memoryUsage();
  return {
    heapUsed: formatBytes(usage.heapUsed),
    heapTotal: formatBytes(usage.heapTotal),
    external: formatBytes(usage.external),
    rss: formatBytes(usage.rss),
    arrayBuffers: formatBytes(usage.arrayBuffers),
    raw: usage,
  };
}

export interface MemoryUsage {
  heapUsed: string;
  heapTotal: string;
  external: string;
  rss: string;
  arrayBuffers: string;
  raw: NodeJS.MemoryUsage;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Stack trace helper
 */
export function getStackTrace(skip = 0): string[] {
  const stack = new Error().stack || '';
  const lines = stack.split('\n').slice(2 + skip); // Skip Error and this function
  return lines.map(line => line.trim());
}

/**
 * Get caller information
 */
export function getCaller(skip = 0): CallerInfo | null {
  const stack = getStackTrace(skip + 1);
  const line = stack[0];
  if (!line) return null;

  const match = line.match(/at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
  if (match) {
    return {
      function: match[1]!,
      file: match[2]!,
      line: parseInt(match[3]!, 10),
      column: parseInt(match[4]!, 10),
    };
  }

  const simpleMatch = line.match(/at\s+(.+):(\d+):(\d+)/);
  if (simpleMatch) {
    return {
      function: '<anonymous>',
      file: simpleMatch[1]!,
      line: parseInt(simpleMatch[2]!, 10),
      column: parseInt(simpleMatch[3]!, 10),
    };
  }

  return null;
}

export interface CallerInfo {
  function: string;
  file: string;
  line: number;
  column: number;
}
