/**
 * Metrics Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Counter,
  Gauge,
  Histogram,
  MetricsRegistry,
  defaultRegistry,
} from './metrics.js';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('test_counter', 'Test counter', ['method', 'status']);
  });

  it('should start at 0', () => {
    expect(counter.get()).toBe(0);
  });

  it('should increment by 1 by default', () => {
    counter.inc();
    expect(counter.get()).toBe(1);
  });

  it('should increment by specified value', () => {
    counter.inc({}, 5);
    expect(counter.get()).toBe(5);
  });

  it('should track separate values per label combination', () => {
    counter.inc({ method: 'GET', status: '200' });
    counter.inc({ method: 'POST', status: '200' });
    counter.inc({ method: 'GET', status: '200' });

    expect(counter.get({ method: 'GET', status: '200' })).toBe(2);
    expect(counter.get({ method: 'POST', status: '200' })).toBe(1);
  });

  it('should reset all values', () => {
    counter.inc({ method: 'GET', status: '200' }, 10);
    counter.reset();
    expect(counter.get({ method: 'GET', status: '200' })).toBe(0);
  });

  it('should collect Prometheus format output', () => {
    counter.inc({ method: 'GET', status: '200' }, 5);
    const output = counter.collect();

    expect(output).toContain('# HELP test_counter Test counter');
    expect(output).toContain('# TYPE test_counter counter');
    expect(output).toContain('test_counter{method="GET",status="200"} 5');
  });
});

describe('Gauge', () => {
  it('should start at 0', () => {
    const gauge = new Gauge('new_gauge', 'Test gauge', ['type']);
    expect(gauge.get()).toBe(0);
  });

  it('should set value directly', () => {
    const gauge = new Gauge('set_gauge', 'Test gauge', []);
    gauge.set(42);
    expect(gauge.get()).toBe(42);
  });

  it('should set value with labels', () => {
    const gauge = new Gauge('label_gauge', 'Test gauge', ['type']);
    gauge.set({ type: 'cpu' }, 75.5);
    expect(gauge.get({ type: 'cpu' })).toBe(75.5);
  });

  it('should increment value', () => {
    const gauge = new Gauge('inc_gauge', 'Test gauge', []);
    gauge.set(10);
    gauge.inc({}, 5);
    expect(gauge.get()).toBe(15);
  });

  it('should decrement value', () => {
    const gauge = new Gauge('dec_gauge', 'Test gauge', []);
    gauge.set(10);
    gauge.dec({}, 3);
    expect(gauge.get()).toBe(7);
  });

  it('should collect Prometheus format output', () => {
    const gauge = new Gauge('collect_gauge', 'Test gauge', ['type']);
    gauge.set({ type: 'memory' }, 1024);
    const output = gauge.collect();

    expect(output).toContain('# HELP collect_gauge Test gauge');
    expect(output).toContain('# TYPE collect_gauge gauge');
    expect(output).toContain('collect_gauge{type="memory"} 1024');
  });
});

describe('Histogram', () => {
  it('should observe values', () => {
    const histogram = new Histogram(
      'obs_histogram',
      'Test histogram',
      [],
      [0.1, 0.5, 1, 5]
    );

    histogram.observe(0.25);
    histogram.observe(0.75);
    histogram.observe(2);

    const output = histogram.collect();
    expect(output).toContain('obs_histogram_count');
    expect(output).toContain('obs_histogram_sum');
    expect(output).toContain('} 3'); // count of 3
  });

  it('should observe values with labels', () => {
    const histogram = new Histogram(
      'label_histogram',
      'Test histogram',
      ['method'],
      [0.1, 0.5, 1, 5]
    );

    histogram.observe({ method: 'GET' }, 0.1);
    histogram.observe({ method: 'GET' }, 0.2);
    histogram.observe({ method: 'POST' }, 1.5);

    const output = histogram.collect();
    expect(output).toContain('method="GET"');
    expect(output).toContain('method="POST"');
  });

  it('should track bucket counts correctly', () => {
    const histogram = new Histogram(
      'bucket_histogram',
      'Test histogram',
      [],
      [0.1, 0.5, 1, 5]
    );

    histogram.observe(0.05); // <= 0.1
    histogram.observe(0.3);  // <= 0.5
    histogram.observe(0.8);  // <= 1
    histogram.observe(3);    // <= 5
    histogram.observe(10);   // > 5, only in +Inf

    const output = histogram.collect();
    // Buckets show cumulative counts
    expect(output).toContain('le="0.1"} 1');
    expect(output).toContain('le="0.5"} 2');
    expect(output).toContain('le="1"} 3');
    expect(output).toContain('le="5"} 4');
    expect(output).toContain('le="+Inf"} 5');
  });

  it('should time async operations', async () => {
    const histogram = new Histogram(
      'async_histogram',
      'Test histogram',
      [],
      [0.01, 0.1, 1]
    );

    const result = await histogram.time(async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return 'done';
    });

    expect(result).toBe('done');
    const output = histogram.collect();
    expect(output).toContain('async_histogram_count');
  });

  it('should time sync operations', () => {
    const histogram = new Histogram(
      'sync_histogram',
      'Test histogram',
      [],
      [0.01, 0.1, 1]
    );

    const result = histogram.timeSync(() => {
      return 42;
    });

    expect(result).toBe(42);
    const output = histogram.collect();
    expect(output).toContain('sync_histogram_count');
  });

  it('should time with labels', async () => {
    const histogram = new Histogram(
      'timed_histogram',
      'Test histogram',
      ['method'],
      [0.01, 0.1, 1]
    );

    await histogram.time({ method: 'GET' }, async () => {
      return 'result';
    });

    const output = histogram.collect();
    expect(output).toContain('method="GET"');
  });
});

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry('test');
  });

  it('should create counter with prefix', () => {
    const counter = registry.createCounter('requests', 'Total requests');
    counter.inc();

    const output = registry.collect();
    expect(output).toContain('test_requests');
  });

  it('should create gauge with prefix', () => {
    const gauge = registry.createGauge('connections', 'Active connections');
    gauge.set(5);

    const output = registry.collect();
    expect(output).toContain('test_connections');
  });

  it('should create histogram with prefix', () => {
    const histogram = registry.createHistogram('duration', 'Request duration');
    histogram.observe(0.5);

    const output = registry.collect();
    expect(output).toContain('test_duration');
  });

  it('should return existing metric if already created', () => {
    const counter1 = registry.createCounter('hits', 'Cache hits');
    const counter2 = registry.createCounter('hits', 'Cache hits');

    expect(counter1).toBe(counter2);
  });

  it('should collect all metrics', () => {
    registry.createCounter('counter1', 'Counter 1').inc();
    registry.createGauge('gauge1', 'Gauge 1').set(10);
    registry.createHistogram('hist1', 'Histogram 1').observe(0.5);

    const output = registry.collect();
    expect(output).toContain('test_counter1');
    expect(output).toContain('test_gauge1');
    expect(output).toContain('test_hist1');
  });

  it('should clear all metrics', () => {
    registry.createCounter('test', 'Test').inc();
    registry.clear();

    const output = registry.collect();
    expect(output).toBe('');
  });
});

describe('Default Registry', () => {
  it('should have pre-defined HTTP metrics', () => {
    const output = defaultRegistry.collect();
    expect(output).toContain('pact_http_requests_total');
    expect(output).toContain('pact_http_request_duration_seconds');
    expect(output).toContain('pact_http_requests_in_flight');
  });

  it('should have pre-defined database metrics', () => {
    const output = defaultRegistry.collect();
    expect(output).toContain('pact_db_query_duration_seconds');
  });

  it('should have pre-defined error metrics', () => {
    const output = defaultRegistry.collect();
    expect(output).toContain('pact_errors_total');
  });
});
