/**
 * ARKA Distributed Tracing
 *
 * Simple tracing implementation compatible with OpenTelemetry concepts.
 * Provides span creation, context propagation, and trace export.
 */

import { getRequestContext } from '../middleware/correlationId.js';

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  parentSpanId?: string;
}

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export type SpanStatus = 'unset' | 'ok' | 'error';

export interface Span {
  context: SpanContext;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  startTime: number;
  endTime?: number;
  attributes: SpanAttributes;
  events: SpanEvent[];
  status: SpanStatus;
  statusMessage?: string;
}

/**
 * Generate a random hex ID
 */
function generateId(bytes: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a trace ID (16 bytes / 32 hex chars)
 */
export function generateTraceId(): string {
  return generateId(16);
}

/**
 * Generate a span ID (8 bytes / 16 hex chars)
 */
export function generateSpanId(): string {
  return generateId(8);
}

/**
 * Active span storage using AsyncLocalStorage pattern
 */
let currentSpan: Span | null = null;
const spanStack: Span[] = [];

/**
 * SpanBuilder for fluent span creation
 */
export class SpanBuilder {
  private span: Span;

  constructor(name: string, kind: Span['kind'] = 'internal') {
    const parentSpan = currentSpan;
    const requestContext = getRequestContext();

    this.span = {
      context: {
        traceId: parentSpan?.context.traceId || requestContext?.correlationId || generateTraceId(),
        spanId: generateSpanId(),
        traceFlags: 1, // Sampled
        parentSpanId: parentSpan?.context.spanId,
      },
      name,
      kind,
      startTime: performance.now(),
      attributes: {},
      events: [],
      status: 'unset',
    };
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): this {
    Object.assign(this.span.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    this.span.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    this.span.statusMessage = message;
    return this;
  }

  /**
   * Start the span and make it the current span
   */
  start(): ActiveSpan {
    spanStack.push(this.span);
    currentSpan = this.span;
    return new ActiveSpan(this.span);
  }

  /**
   * Execute a function within this span's context
   */
  async trace<T>(fn: (span: ActiveSpan) => Promise<T>): Promise<T> {
    const activeSpan = this.start();
    try {
      const result = await fn(activeSpan);
      activeSpan.setStatus('ok');
      return result;
    } catch (error) {
      activeSpan.setStatus('error', error instanceof Error ? error.message : 'Unknown error');
      activeSpan.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      activeSpan.end();
    }
  }

  /**
   * Execute a synchronous function within this span's context
   */
  traceSync<T>(fn: (span: ActiveSpan) => T): T {
    const activeSpan = this.start();
    try {
      const result = fn(activeSpan);
      activeSpan.setStatus('ok');
      return result;
    } catch (error) {
      activeSpan.setStatus('error', error instanceof Error ? error.message : 'Unknown error');
      activeSpan.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      activeSpan.end();
    }
  }
}

/**
 * Active span that can be modified and ended
 */
export class ActiveSpan {
  constructor(private span: Span) {}

  get context(): SpanContext {
    return this.span.context;
  }

  get name(): string {
    return this.span.name;
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.span.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: SpanAttributes): this {
    Object.assign(this.span.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: SpanAttributes): this {
    this.span.events.push({
      name,
      timestamp: performance.now(),
      attributes,
    });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    this.span.statusMessage = message;
    return this;
  }

  recordException(error: Error): this {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
    return this;
  }

  end(): void {
    this.span.endTime = performance.now();
    spanStack.pop();
    currentSpan = spanStack.length > 0 ? spanStack[spanStack.length - 1] ?? null : null;

    // Export span to configured exporter
    defaultTraceExporter.export(this.span);
  }

  /**
   * Get the span data (for testing/debugging)
   */
  getData(): Span {
    return { ...this.span };
  }
}

/**
 * Create a new span
 */
export function createSpan(name: string, kind: Span['kind'] = 'internal'): SpanBuilder {
  return new SpanBuilder(name, kind);
}

/**
 * Get the current active span
 */
export function getCurrentSpan(): ActiveSpan | null {
  return currentSpan ? new ActiveSpan(currentSpan) : null;
}

/**
 * Trace exporter interface
 */
export interface TraceExporter {
  export(span: Span): void;
  flush(): Promise<void>;
}

/**
 * Console trace exporter (for development)
 */
export class ConsoleTraceExporter implements TraceExporter {
  private enabled: boolean;

  constructor(enabled = process.env.NODE_ENV !== 'production') {
    this.enabled = enabled;
  }

  export(span: Span): void {
    if (!this.enabled) return;

    const duration = span.endTime ? (span.endTime - span.startTime).toFixed(2) : 'ongoing';
    console.log(
      `[TRACE] ${span.name} (${span.kind}) - ${duration}ms - ${span.status}`,
      {
        traceId: span.context.traceId,
        spanId: span.context.spanId,
        parentSpanId: span.context.parentSpanId,
        attributes: span.attributes,
        events: span.events.length > 0 ? span.events : undefined,
      }
    );
  }

  async flush(): Promise<void> {
    // Console exporter doesn't need flushing
  }
}

/**
 * In-memory trace exporter (for testing)
 */
export class InMemoryTraceExporter implements TraceExporter {
  private spans: Span[] = [];

  export(span: Span): void {
    this.spans.push({ ...span });
  }

  async flush(): Promise<void> {
    // No-op for in-memory
  }

  getSpans(): Span[] {
    return [...this.spans];
  }

  clear(): void {
    this.spans = [];
  }

  findSpans(name: string): Span[] {
    return this.spans.filter(s => s.name === name);
  }

  findSpansByTrace(traceId: string): Span[] {
    return this.spans.filter(s => s.context.traceId === traceId);
  }
}

/**
 * OTLP-compatible trace exporter (sends to collector)
 */
export class OTLPTraceExporter implements TraceExporter {
  private endpoint: string;
  private headers: Record<string, string>;
  private batch: Span[] = [];
  private batchSize: number;
  private flushInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: {
    endpoint?: string;
    headers?: Record<string, string>;
    batchSize?: number;
    flushIntervalMs?: number;
  } = {}) {
    this.endpoint = config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
    this.batchSize = config.batchSize || 100;
    this.flushInterval = config.flushIntervalMs || 5000;

    // Start periodic flush
    this.timer = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushInterval);
  }

  export(span: Span): void {
    this.batch.push(span);
    if (this.batch.length >= this.batchSize) {
      this.flush().catch(console.error);
    }
  }

  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const spans = this.batch;
    this.batch = [];

    try {
      const payload = this.formatOTLP(spans);
      await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // Re-add spans to batch on failure
      this.batch.unshift(...spans);
      console.error('Failed to export traces:', error);
    }
  }

  private formatOTLP(spans: Span[]): object {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: process.env.SERVICE_NAME || 'arka-service' } },
              { key: 'service.version', value: { stringValue: process.env.SERVICE_VERSION || '0.1.0' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: '@arka/utils', version: '0.1.0' },
              spans: spans.map(span => ({
                traceId: span.context.traceId,
                spanId: span.context.spanId,
                parentSpanId: span.context.parentSpanId,
                name: span.name,
                kind: this.mapSpanKind(span.kind),
                startTimeUnixNano: Math.floor(span.startTime * 1_000_000).toString(),
                endTimeUnixNano: span.endTime ? Math.floor(span.endTime * 1_000_000).toString() : undefined,
                attributes: Object.entries(span.attributes).map(([key, value]) => ({
                  key,
                  value: this.formatValue(value),
                })),
                events: span.events.map(event => ({
                  name: event.name,
                  timeUnixNano: Math.floor(event.timestamp * 1_000_000).toString(),
                  attributes: event.attributes
                    ? Object.entries(event.attributes).map(([key, value]) => ({
                        key,
                        value: this.formatValue(value),
                      }))
                    : [],
                })),
                status: {
                  code: span.status === 'ok' ? 1 : span.status === 'error' ? 2 : 0,
                  message: span.statusMessage,
                },
              })),
            },
          ],
        },
      ],
    };
  }

  private mapSpanKind(kind: Span['kind']): number {
    const kinds: Record<Span['kind'], number> = {
      internal: 1,
      server: 2,
      client: 3,
      producer: 4,
      consumer: 5,
    };
    return kinds[kind];
  }

  private formatValue(value: string | number | boolean | undefined): object {
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') {
      return Number.isInteger(value) ? { intValue: value.toString() } : { doubleValue: value };
    }
    if (typeof value === 'boolean') return { boolValue: value };
    return { stringValue: '' };
  }

  shutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush().catch(console.error);
  }
}

// Default exporter (console in dev, can be swapped)
export let defaultTraceExporter: TraceExporter = new ConsoleTraceExporter();

/**
 * Set the default trace exporter
 */
export function setTraceExporter(exporter: TraceExporter): void {
  defaultTraceExporter = exporter;
}

/**
 * W3C Trace Context propagation
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): SpanContext | null {
  const traceparent = headers['traceparent'];
  if (!traceparent || typeof traceparent !== 'string') return null;

  // Format: version-traceId-spanId-traceFlags
  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, spanId, flagsHex] = parts;
  if (version !== '00' || !traceId || !spanId || !flagsHex) return null;

  return {
    traceId,
    spanId,
    traceFlags: parseInt(flagsHex, 16),
  };
}

/**
 * Inject trace context into headers
 */
export function injectTraceContext(span: ActiveSpan | null): Record<string, string> {
  if (!span) return {};

  const context = span.context;
  const traceparent = `00-${context.traceId}-${context.spanId}-${context.traceFlags.toString(16).padStart(2, '0')}`;

  return {
    traceparent,
  };
}
