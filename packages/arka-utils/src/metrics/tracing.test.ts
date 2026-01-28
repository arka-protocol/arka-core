/**
 * Tracing Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSpan,
  getCurrentSpan,
  generateTraceId,
  generateSpanId,
  InMemoryTraceExporter,
  setTraceExporter,
  extractTraceContext,
  injectTraceContext,
} from './tracing.js';

describe('Trace ID Generation', () => {
  it('should generate 32 character trace IDs', () => {
    const traceId = generateTraceId();
    expect(traceId).toHaveLength(32);
    expect(traceId).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate unique trace IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateTraceId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('Span ID Generation', () => {
  it('should generate 16 character span IDs', () => {
    const spanId = generateSpanId();
    expect(spanId).toHaveLength(16);
    expect(spanId).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate unique span IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSpanId());
    }
    expect(ids.size).toBe(100);
  });
});

describe('SpanBuilder', () => {
  let exporter: InMemoryTraceExporter;

  beforeEach(() => {
    exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);
    exporter.clear();
  });

  it('should create span with name and kind', () => {
    const span = createSpan('test-operation', 'server').start();
    span.end();

    const spans = exporter.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe('test-operation');
    expect(spans[0]?.kind).toBe('server');
  });

  it('should set attributes', () => {
    const span = createSpan('test-operation')
      .setAttribute('key1', 'value1')
      .setAttributes({ key2: 123, key3: true })
      .start();
    span.end();

    const spans = exporter.getSpans();
    expect(spans[0]?.attributes).toEqual({
      key1: 'value1',
      key2: 123,
      key3: true,
    });
  });

  it('should add events', () => {
    const span = createSpan('test-operation')
      .addEvent('event1', { detail: 'value' })
      .start();
    span.addEvent('event2');
    span.end();

    const spans = exporter.getSpans();
    expect(spans[0]?.events).toHaveLength(2);
    expect(spans[0]?.events[0]?.name).toBe('event1');
    expect(spans[0]?.events[1]?.name).toBe('event2');
  });

  it('should set status', () => {
    const span = createSpan('test-operation').start();
    span.setStatus('error', 'Something went wrong');
    span.end();

    const spans = exporter.getSpans();
    expect(spans[0]?.status).toBe('error');
    expect(spans[0]?.statusMessage).toBe('Something went wrong');
  });

  it('should record exceptions', () => {
    const span = createSpan('test-operation').start();
    span.recordException(new Error('Test error'));
    span.end();

    const spans = exporter.getSpans();
    const exceptionEvent = spans[0]?.events.find(e => e.name === 'exception');
    expect(exceptionEvent).toBeDefined();
    expect(exceptionEvent?.attributes?.['exception.message']).toBe('Test error');
  });

  it('should track timing', () => {
    const span = createSpan('test-operation').start();
    span.end();

    const spans = exporter.getSpans();
    expect(spans[0]?.startTime).toBeDefined();
    expect(spans[0]?.endTime).toBeDefined();
    expect(spans[0]?.endTime).toBeGreaterThanOrEqual(spans[0]?.startTime ?? 0);
  });
});

describe('Span Context', () => {
  let exporter: InMemoryTraceExporter;

  beforeEach(() => {
    exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);
    exporter.clear();
  });

  it('should generate trace and span IDs', () => {
    const span = createSpan('test').start();

    expect(span.context.traceId).toHaveLength(32);
    expect(span.context.spanId).toHaveLength(16);
    expect(span.context.traceFlags).toBe(1);

    span.end();
  });

  it('should link parent and child spans', () => {
    const parent = createSpan('parent').start();
    const child = createSpan('child').start();

    expect(child.context.parentSpanId).toBe(parent.context.spanId);
    expect(child.context.traceId).toBe(parent.context.traceId);

    child.end();
    parent.end();
  });

  it('should get current span', () => {
    expect(getCurrentSpan()).toBeNull();

    const span = createSpan('test').start();
    expect(getCurrentSpan()?.name).toBe('test');

    span.end();
    expect(getCurrentSpan()).toBeNull();
  });
});

describe('Trace Function', () => {
  let exporter: InMemoryTraceExporter;

  beforeEach(() => {
    exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);
    exporter.clear();
  });

  it('should trace async function and set ok status on success', async () => {
    const result = await createSpan('async-op').trace(async () => {
      return 'success';
    });

    expect(result).toBe('success');
    const spans = exporter.getSpans();
    expect(spans[0]?.status).toBe('ok');
  });

  it('should trace async function and set error status on failure', async () => {
    await expect(
      createSpan('failing-op').trace(async () => {
        throw new Error('Test error');
      })
    ).rejects.toThrow('Test error');

    const spans = exporter.getSpans();
    expect(spans[0]?.status).toBe('error');
    expect(spans[0]?.statusMessage).toBe('Test error');
  });

  it('should trace sync function', () => {
    const result = createSpan('sync-op').traceSync(() => {
      return 42;
    });

    expect(result).toBe(42);
    const spans = exporter.getSpans();
    expect(spans[0]?.status).toBe('ok');
  });

  it('should trace sync function and handle errors', () => {
    expect(() => {
      createSpan('failing-sync-op').traceSync(() => {
        throw new Error('Sync error');
      });
    }).toThrow('Sync error');

    const spans = exporter.getSpans();
    expect(spans[0]?.status).toBe('error');
  });
});

describe('W3C Trace Context', () => {
  it('should extract trace context from traceparent header', () => {
    const headers = {
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    };

    const context = extractTraceContext(headers);
    expect(context?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
    expect(context?.spanId).toBe('b7ad6b7169203331');
    expect(context?.traceFlags).toBe(1);
  });

  it('should return null for missing traceparent', () => {
    const context = extractTraceContext({});
    expect(context).toBeNull();
  });

  it('should return null for invalid traceparent', () => {
    const context = extractTraceContext({ traceparent: 'invalid' });
    expect(context).toBeNull();
  });

  it('should inject trace context into headers', () => {
    const exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);

    const span = createSpan('test').start();
    const headers = injectTraceContext(span);

    expect(headers.traceparent).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[0-9a-f]$/
    );

    span.end();
  });

  it('should return empty object for null span', () => {
    const headers = injectTraceContext(null);
    expect(headers).toEqual({});
  });
});

describe('InMemoryTraceExporter', () => {
  it('should store exported spans', () => {
    const exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);

    const span1 = createSpan('span1').start();
    span1.end();

    const span2 = createSpan('span2').start();
    span2.end();

    expect(exporter.getSpans()).toHaveLength(2);
  });

  it('should find spans by name', () => {
    const exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);

    createSpan('operation-a').start().end();
    createSpan('operation-b').start().end();
    createSpan('operation-a').start().end();

    const found = exporter.findSpans('operation-a');
    expect(found).toHaveLength(2);
  });

  it('should find spans by trace ID', () => {
    const exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);

    const parent = createSpan('parent').start();
    const child = createSpan('child').start();
    child.end();
    parent.end();

    const traceId = parent.context.traceId;
    const traceSpans = exporter.findSpansByTrace(traceId);
    expect(traceSpans).toHaveLength(2);
  });

  it('should clear spans', () => {
    const exporter = new InMemoryTraceExporter();
    setTraceExporter(exporter);

    createSpan('test').start().end();
    expect(exporter.getSpans()).toHaveLength(1);

    exporter.clear();
    expect(exporter.getSpans()).toHaveLength(0);
  });
});
