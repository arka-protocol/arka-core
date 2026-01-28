/**
 * Demo Seed Data - Main Export
 *
 * Consolidated exports for all demo seed data.
 */

export * from './rules.js';
export * from './events.js';
export * from './customers.js';

import { allDemoRules, ruleCategories } from './rules.js';
import { allDemoEvents, demoScenarios } from './events.js';
import { allDemoCustomers, customerProfiles } from './customers.js';

/**
 * Complete demo dataset
 */
export const demoDataset = {
  rules: allDemoRules,
  events: allDemoEvents,
  customers: allDemoCustomers,
  ruleCategories,
  scenarios: demoScenarios,
  customerProfiles,
};

/**
 * Summary statistics for the demo dataset
 */
export const datasetStats = {
  totalRules: allDemoRules.length,
  totalEvents: allDemoEvents.length,
  totalCustomers: allDemoCustomers.length,
  rulesByCategory: Object.fromEntries(
    Object.entries(ruleCategories).map(([key, cat]) => [key, cat.rules.length])
  ),
  eventsByOutcome: {
    allow: demoScenarios.compliant.events.length,
    flag: Object.values(demoScenarios)
      .filter((s) => s.expectedOutcome === 'FLAG')
      .reduce((sum, s) => sum + s.events.length, 0),
    deny: Object.values(demoScenarios)
      .filter((s) => s.expectedOutcome === 'DENY')
      .reduce((sum, s) => sum + s.events.length, 0),
  },
};
