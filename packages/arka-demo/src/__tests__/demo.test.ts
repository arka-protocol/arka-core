/**
 * ARKA Demo Package Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock console to prevent noise during tests
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('@arka/demo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('In-Memory Demo Engine', () => {
    it('should export InMemoryDemoEngine class', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      expect(InMemoryDemoEngine).toBeDefined();
      expect(typeof InMemoryDemoEngine).toBe('function');
    });

    it('should export createDemoEngine function', async () => {
      const { createDemoEngine } = await import('../modes/in-memory-engine.js');
      expect(createDemoEngine).toBeDefined();
      expect(typeof createDemoEngine).toBe('function');
    });

    it('should create demo engine instance', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      expect(engine).toBeDefined();
      expect(engine.initialize).toBeDefined();
      expect(engine.getRules).toBeDefined();
      expect(engine.getEntities).toBeDefined();
      expect(engine.getDecisions).toBeDefined();
      expect(engine.getStats).toBeDefined();
      expect(engine.processEvent).toBeDefined();
      expect(engine.reset).toBeDefined();
    });

    it('should initialize with rules', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      const stats = engine.getStats();
      expect(stats.rulesLoaded).toBeGreaterThan(0);
    });

    it('should get rules after initialization', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      const rules = engine.getRules();
      expect(Array.isArray(rules)).toBe(true);
    });

    it('should get entities after initialization', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      const entities = engine.getEntities();
      expect(Array.isArray(entities)).toBe(true);
    });

    it('should reset engine state', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      engine.reset();
      const stats = engine.getStats();
      expect(stats.eventsProcessed).toBe(0);
      expect(stats.decisionsGenerated).toBe(0);
    });

    it('should get dataset info', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      const datasetInfo = engine.getDatasetInfo();
      expect(datasetInfo).toBeDefined();
    });
  });

  describe('Seed Data', () => {
    it('should export seed data module', async () => {
      const seedData = await import('../seed-data/index.js');
      expect(seedData).toBeDefined();
    });

    it('should export demo dataset', async () => {
      const { demoDataset } = await import('../seed-data/index.js');
      expect(demoDataset).toBeDefined();
    });

    it('should have rules in dataset', async () => {
      const { demoDataset } = await import('../seed-data/index.js');
      expect(Array.isArray(demoDataset.rules)).toBe(true);
      expect(demoDataset.rules.length).toBeGreaterThan(0);
    });

    it('should have customers in dataset', async () => {
      const { demoDataset } = await import('../seed-data/index.js');
      expect(Array.isArray(demoDataset.customers)).toBe(true);
    });

    it('should have scenarios in dataset', async () => {
      const { demoDataset } = await import('../seed-data/index.js');
      expect(demoDataset.scenarios).toBeDefined();
    });

    it('should have rule categories', async () => {
      const { demoDataset } = await import('../seed-data/index.js');
      expect(demoDataset.ruleCategories).toBeDefined();
    });

    it('should export dataset stats', async () => {
      const { datasetStats } = await import('../seed-data/index.js');
      expect(datasetStats).toBeDefined();
    });
  });

  describe('Demo Server', () => {
    it('should export startDemoServer function', async () => {
      const { startDemoServer } = await import('../server/index.js');
      expect(startDemoServer).toBeDefined();
      expect(typeof startDemoServer).toBe('function');
    });
  });

  describe('Rules Seed Data', () => {
    it('should export rules seed data', async () => {
      const rulesModule = await import('../seed-data/rules.js');
      expect(rulesModule).toBeDefined();
    });
  });

  describe('Customers Seed Data', () => {
    it('should export customers seed data', async () => {
      const customersModule = await import('../seed-data/customers.js');
      expect(customersModule).toBeDefined();
    });
  });

  describe('Events Seed Data', () => {
    it('should export events seed data', async () => {
      const eventsModule = await import('../seed-data/events.js');
      expect(eventsModule).toBeDefined();
    });
  });

  describe('Engine Stats Interface', () => {
    it('should have correct stats structure', async () => {
      const { InMemoryDemoEngine } = await import('../modes/in-memory-engine.js');
      const engine = new InMemoryDemoEngine();
      engine.initialize();
      const stats = engine.getStats();

      expect(typeof stats.rulesLoaded).toBe('number');
      expect(typeof stats.eventsProcessed).toBe('number');
      expect(typeof stats.decisionsGenerated).toBe('number');
      expect(typeof stats.allowCount).toBe('number');
      expect(typeof stats.flagCount).toBe('number');
      expect(typeof stats.denyCount).toBe('number');
      expect(typeof stats.avgProcessingTimeMs).toBe('number');
    });
  });
});
