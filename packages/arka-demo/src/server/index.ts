/**
 * ARKA Demo API Server
 *
 * REST API server for demonstrating ARKA Engine capabilities.
 * Provides endpoints for rule evaluation, event processing, and data retrieval.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import chalk from 'chalk';
import { createDemoEngine, type InMemoryDemoEngine } from '../modes/in-memory-engine.js';
import { demoDataset, demoScenarios, ruleCategories } from '../seed-data/index.js';
import type { ArkaEvent } from '@arka-protocol/types';

let engine: InMemoryDemoEngine;

/**
 * Create Express app with demo routes
 */
function createApp(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());

  // CORS for demo purposes
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Request logging
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(chalk.gray(`${new Date().toISOString()} ${req.method} ${req.path}`));
    next();
  });

  // ============================================================================
  // Health & Info Routes
  // ============================================================================

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'ARKA Engine Demo API',
      version: '1.0.0',
      description: 'Interactive demo API for ARKA compliance engine',
      endpoints: {
        health: 'GET /health',
        rules: 'GET /api/rules',
        events: 'POST /api/events/evaluate',
        scenarios: 'GET /api/scenarios',
        stats: 'GET /api/stats',
      },
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      engine: {
        rulesLoaded: engine.getStats().rulesLoaded,
        eventsProcessed: engine.getStats().eventsProcessed,
      },
    });
  });

  // ============================================================================
  // Rules Routes
  // ============================================================================

  app.get('/api/rules', (_req: Request, res: Response) => {
    const rules = engine.getRules();
    res.json({
      count: rules.length,
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        decision: rule.consequence.decision,
        code: rule.consequence.code,
        tags: rule.tags,
      })),
    });
  });

  app.get('/api/rules/categories', (_req: Request, res: Response) => {
    res.json({
      categories: Object.entries(ruleCategories).map(([key, cat]) => ({
        id: key,
        name: cat.name,
        description: cat.description,
        ruleCount: cat.rules.length,
      })),
    });
  });

  app.get('/api/rules/category/:category', (req: Request, res: Response) => {
    const category = req.params.category!;
    const rules = engine.getRulesByCategory(category);

    if (rules.length === 0) {
      res.status(404).json({ error: `Category not found: ${category}` });
      return;
    }

    res.json({
      category,
      count: rules.length,
      rules,
    });
  });

  app.get('/api/rules/:id', (req: Request, res: Response) => {
    const rule = engine.getRules().find((r) => r.id === req.params.id);

    if (!rule) {
      res.status(404).json({ error: `Rule not found: ${req.params.id}` });
      return;
    }

    res.json(rule);
  });

  // ============================================================================
  // Event Processing Routes
  // ============================================================================

  app.post('/api/events/evaluate', async (req: Request, res: Response) => {
    try {
      const event = req.body as ArkaEvent;

      // Validate event
      if (!event.id || !event.type || !event.payload) {
        res.status(400).json({
          error: 'Invalid event',
          required: ['id', 'type', 'payload'],
        });
        return;
      }

      // Process event
      const decision = await engine.processEvent(event);

      res.json({
        success: true,
        decision,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to evaluate event',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/events/batch', async (req: Request, res: Response) => {
    try {
      const events = req.body as ArkaEvent[];

      if (!Array.isArray(events) || events.length === 0) {
        res.status(400).json({ error: 'Request body must be an array of events' });
        return;
      }

      const decisions = await engine.processEvents(events);

      res.json({
        success: true,
        count: decisions.length,
        decisions,
        summary: {
          allow: decisions.filter((d) => d.status === 'ALLOW').length,
          flag: decisions.filter((d) => d.status === 'ALLOW_WITH_FLAGS').length,
          deny: decisions.filter((d) => d.status === 'DENY').length,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to process batch',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================================
  // Scenario Routes
  // ============================================================================

  app.get('/api/scenarios', (_req: Request, res: Response) => {
    res.json({
      scenarios: Object.entries(demoScenarios).map(([key, scenario]) => ({
        id: key,
        name: scenario.name,
        description: scenario.description,
        expectedOutcome: scenario.expectedOutcome,
        eventCount: scenario.events.length,
      })),
    });
  });

  app.get('/api/scenarios/:id', (req: Request, res: Response) => {
    const scenario = demoScenarios[req.params.id as keyof typeof demoScenarios];

    if (!scenario) {
      res.status(404).json({ error: `Scenario not found: ${req.params.id}` });
      return;
    }

    res.json({
      id: req.params.id,
      ...scenario,
    });
  });

  app.post('/api/scenarios/:id/run', async (req: Request, res: Response) => {
    const scenario = demoScenarios[req.params.id as keyof typeof demoScenarios];

    if (!scenario) {
      res.status(404).json({ error: `Scenario not found: ${req.params.id}` });
      return;
    }

    try {
      const decisions = await engine.processEvents(scenario.events);

      res.json({
        scenario: {
          id: req.params.id,
          name: scenario.name,
          expectedOutcome: scenario.expectedOutcome,
        },
        results: {
          decisions,
          summary: {
            allow: decisions.filter((d) => d.status === 'ALLOW').length,
            flag: decisions.filter((d) => d.status === 'ALLOW_WITH_FLAGS').length,
            deny: decisions.filter((d) => d.status === 'DENY').length,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to run scenario',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // ============================================================================
  // Data Routes
  // ============================================================================

  app.get('/api/customers', (_req: Request, res: Response) => {
    res.json({
      count: demoDataset.customers.length,
      customers: demoDataset.customers,
    });
  });

  app.get('/api/customers/:id', (req: Request, res: Response) => {
    const customer = demoDataset.customers.find(
      (c) => c.id === req.params.id || c.data.customerId === req.params.id
    );

    if (!customer) {
      res.status(404).json({ error: `Customer not found: ${req.params.id}` });
      return;
    }

    res.json(customer);
  });

  app.get('/api/sample-events', (_req: Request, res: Response) => {
    res.json({
      count: demoDataset.events.length,
      events: demoDataset.events,
    });
  });

  // ============================================================================
  // Engine Management Routes
  // ============================================================================

  app.get('/api/stats', (_req: Request, res: Response) => {
    res.json(engine.getStats());
  });

  app.get('/api/decisions', (_req: Request, res: Response) => {
    const decisions = engine.getDecisions();
    res.json({
      count: decisions.length,
      decisions,
    });
  });

  app.post('/api/reset', (_req: Request, res: Response) => {
    engine.reset();
    res.json({
      success: true,
      message: 'Engine reset successfully',
      stats: engine.getStats(),
    });
  });

  // Error handling
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(chalk.red('Error:'), err.message);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

/**
 * Start the demo server
 */
export async function startDemoServer(port: number = 3000): Promise<void> {
  // Initialize engine
  engine = createDemoEngine();

  const app = createApp();

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(chalk.green(`\n✓ Demo API server running on http://localhost:${port}\n`));
      console.log(chalk.bold('Available Endpoints:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`  ${chalk.cyan('GET')}  /                     API info`);
      console.log(`  ${chalk.cyan('GET')}  /health               Health check`);
      console.log(`  ${chalk.cyan('GET')}  /api/rules            List all rules`);
      console.log(`  ${chalk.cyan('GET')}  /api/rules/categories List rule categories`);
      console.log(`  ${chalk.cyan('GET')}  /api/scenarios        List demo scenarios`);
      console.log(`  ${chalk.cyan('POST')} /api/scenarios/:id/run Run a scenario`);
      console.log(`  ${chalk.cyan('POST')} /api/events/evaluate  Evaluate single event`);
      console.log(`  ${chalk.cyan('POST')} /api/events/batch     Evaluate multiple events`);
      console.log(`  ${chalk.cyan('GET')}  /api/customers        List demo customers`);
      console.log(`  ${chalk.cyan('GET')}  /api/stats            Engine statistics`);
      console.log(`  ${chalk.cyan('POST')} /api/reset            Reset engine state`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(chalk.gray('\nPress Ctrl+C to stop the server\n'));
      resolve();
    });
  });
}
