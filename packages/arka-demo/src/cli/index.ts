#!/usr/bin/env node
/**
 * ARKA Demo CLI
 *
 * Interactive command-line interface for demonstrating ARKA Engine capabilities.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import inquirer from 'inquirer';
import { createDemoEngine, type InMemoryDemoEngine } from '../modes/in-memory-engine.js';
import { demoDataset, demoScenarios, ruleCategories } from '../seed-data/index.js';
import type { ArkaDecision } from '@arka-protocol/types';

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('ARKA Engine Demo')}                                               ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Privacy-Aware Consent Transaction Engine')}                       ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Version 1.0.0')}                                                   ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════════════╝')}
`;

/**
 * Format decision status with color
 */
function formatStatus(status: string): string {
  switch (status) {
    case 'ALLOW':
      return chalk.green('✓ ALLOW');
    case 'ALLOW_WITH_FLAGS':
      return chalk.yellow('⚠ FLAG');
    case 'DENY':
      return chalk.red('✗ DENY');
    default:
      return status;
  }
}

/**
 * Format rule severity with color
 */
function formatSeverity(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return chalk.red.bold(severity);
    case 'HIGH':
      return chalk.red(severity);
    case 'MEDIUM':
      return chalk.yellow(severity);
    case 'LOW':
      return chalk.green(severity);
    default:
      return severity;
  }
}

/**
 * Display decision details
 */
function displayDecision(decision: ArkaDecision): void {
  console.log('\n' + chalk.bold('Decision Result:'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(`  ${chalk.bold('ID:')}       ${decision.id}`);
  console.log(`  ${chalk.bold('Event:')}    ${decision.eventId}`);
  console.log(`  ${chalk.bold('Status:')}   ${formatStatus(decision.status)}`);
  const processingTime = (decision.metadata as Record<string, number> | undefined)?.processingTimeMs;
  console.log(`  ${chalk.bold('Time:')}     ${processingTime?.toFixed(2) ?? 'N/A'}ms`);

  if (decision.ruleEvaluations.length > 0) {
    console.log(`\n  ${chalk.bold('Rules Evaluated:')} ${decision.ruleEvaluations.length}`);

    const triggered = decision.ruleEvaluations.filter((e) => e.result === 'FAIL');
    if (triggered.length > 0) {
      console.log(`\n  ${chalk.bold('Triggered Rules:')}`);
      for (const eval_ of triggered) {
        const consequence = eval_.consequenceSnapshot as { decision?: string; code?: string; message?: string } | undefined;
        const icon = consequence?.decision === 'DENY' ? chalk.red('✗') : chalk.yellow('⚠');
        console.log(`    ${icon} ${eval_.ruleId}`);
        if (consequence) {
          console.log(
            chalk.gray(`       Code: ${consequence.code}`)
          );
          console.log(chalk.gray(`       ${consequence.message}`));
        }
      }
    }
  }

  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Interactive demo mode
 */
async function runInteractiveDemo(engine: InMemoryDemoEngine): Promise<void> {
  console.log(banner);
  console.log(chalk.gray('Interactive Demo Mode - Press Ctrl+C to exit\n'));

  const stats = engine.getDatasetInfo();
  console.log(chalk.bold('Loaded Demo Data:'));
  console.log(`  Rules: ${chalk.cyan(stats.totalRules)}`);
  console.log(`  Sample Events: ${chalk.cyan(stats.totalEvents)}`);
  console.log(`  Customer Profiles: ${chalk.cyan(stats.totalCustomers)}\n`);

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to demo?',
        choices: [
          { name: '🔍 Run a compliance scenario', value: 'scenario' },
          { name: '📋 View loaded rules', value: 'rules' },
          { name: '👤 View customer profiles', value: 'customers' },
          { name: '📊 View engine statistics', value: 'stats' },
          { name: '🔄 Reset engine', value: 'reset' },
          { name: '❌ Exit', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'scenario':
        await runScenarioDemo(engine);
        break;
      case 'rules':
        await viewRules(engine);
        break;
      case 'customers':
        await viewCustomers();
        break;
      case 'stats':
        displayStats(engine);
        break;
      case 'reset':
        engine.reset();
        console.log(chalk.green('\n✓ Engine reset successfully\n'));
        break;
      case 'exit':
        console.log(chalk.cyan('\nThank you for using ARKA Engine Demo!\n'));
        process.exit(0);
    }
  }
}

/**
 * Run a compliance scenario
 */
async function runScenarioDemo(engine: InMemoryDemoEngine): Promise<void> {
  const scenarios = Object.entries(demoScenarios).map(([key, scenario]) => ({
    name: `${scenario.name} (Expected: ${scenario.expectedOutcome})`,
    value: key,
  }));

  const { scenarioKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scenarioKey',
      message: 'Select a scenario:',
      choices: scenarios,
    },
  ]);

  const scenario = demoScenarios[scenarioKey as keyof typeof demoScenarios];

  console.log(`\n${chalk.bold(scenario.name)}`);
  console.log(chalk.gray(scenario.description));
  console.log(chalk.gray(`Expected Outcome: ${scenario.expectedOutcome}\n`));

  const spinner = ora('Processing events...').start();

  const decisions = await engine.processEvents(scenario.events);

  spinner.succeed(`Processed ${decisions.length} events`);

  for (const decision of decisions) {
    displayDecision(decision);
  }

  // Summary
  const summary = {
    allow: decisions.filter((d) => d.status === 'ALLOW').length,
    flag: decisions.filter((d) => d.status === 'ALLOW_WITH_FLAGS').length,
    deny: decisions.filter((d) => d.status === 'DENY').length,
  };

  console.log('\n' + chalk.bold('Scenario Summary:'));
  console.log(
    `  ${chalk.green('ALLOW')}: ${summary.allow}  ${chalk.yellow('FLAG')}: ${summary.flag}  ${chalk.red('DENY')}: ${summary.deny}`
  );
  console.log('');
}

/**
 * View loaded rules
 */
async function viewRules(engine: InMemoryDemoEngine): Promise<void> {
  const categories = Object.entries(ruleCategories).map(([key, cat]) => ({
    name: `${cat.name} (${cat.rules.length} rules)`,
    value: key,
  }));

  const { category } = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Select a rule category:',
      choices: [{ name: 'All Rules', value: 'all' }, ...categories],
    },
  ]);

  const rules =
    category === 'all'
      ? engine.getRules()
      : engine.getRulesByCategory(category);

  const tableData = [
    [chalk.bold('ID'), chalk.bold('Name'), chalk.bold('Severity'), chalk.bold('Decision')],
    ...rules.map((rule) => [
      rule.id.substring(0, 25),
      rule.name.substring(0, 35),
      formatSeverity(rule.severity),
      rule.consequence.decision,
    ]),
  ];

  console.log('\n' + table(tableData));
  console.log(`Total: ${rules.length} rules\n`);
}

/**
 * View customer profiles
 */
async function viewCustomers(): Promise<void> {
  const tableData = [
    [chalk.bold('ID'), chalk.bold('Type'), chalk.bold('Name'), chalk.bold('KYC Status'), chalk.bold('Risk')],
    ...demoDataset.customers.map((c) => [
      c.data.customerId,
      c.data.customerType,
      c.data.businessName ?? `${c.data.firstName} ${c.data.lastName}`,
      c.data.kycStatus === 'VERIFIED' ? chalk.green('VERIFIED') : chalk.yellow(c.data.kycStatus),
      c.data.riskLevel,
    ]),
  ];

  console.log('\n' + table(tableData));
}

/**
 * Display engine statistics
 */
function displayStats(engine: InMemoryDemoEngine): void {
  const stats = engine.getStats();

  console.log('\n' + chalk.bold('Engine Statistics:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`  Rules Loaded:        ${chalk.cyan(stats.rulesLoaded)}`);
  console.log(`  Events Processed:    ${chalk.cyan(stats.eventsProcessed)}`);
  console.log(`  Decisions Generated: ${chalk.cyan(stats.decisionsGenerated)}`);
  console.log('');
  console.log(`  ${chalk.green('ALLOW')}:  ${stats.allowCount}`);
  console.log(`  ${chalk.yellow('FLAG')}:   ${stats.flagCount}`);
  console.log(`  ${chalk.red('DENY')}:   ${stats.denyCount}`);
  console.log('');
  console.log(`  Avg Processing Time: ${chalk.cyan(stats.avgProcessingTimeMs.toFixed(2))}ms`);
  console.log(chalk.gray('─'.repeat(40)) + '\n');
}

/**
 * Quick demo mode - run all scenarios automatically
 */
async function runQuickDemo(engine: InMemoryDemoEngine): Promise<void> {
  console.log(banner);
  console.log(chalk.bold('Quick Demo Mode - Running all scenarios\n'));

  const spinner = ora('Initializing...').start();
  spinner.succeed('Engine initialized');

  for (const [key, scenario] of Object.entries(demoScenarios)) {
    console.log(`\n${chalk.bold.cyan('▶')} ${chalk.bold(scenario.name)}`);
    console.log(chalk.gray(`  ${scenario.description}`));

    const decisions = await engine.processEvents(scenario.events);

    const summary = {
      allow: decisions.filter((d) => d.status === 'ALLOW').length,
      flag: decisions.filter((d) => d.status === 'ALLOW_WITH_FLAGS').length,
      deny: decisions.filter((d) => d.status === 'DENY').length,
    };

    console.log(
      `  Results: ${chalk.green(`${summary.allow} ALLOW`)} | ${chalk.yellow(`${summary.flag} FLAG`)} | ${chalk.red(`${summary.deny} DENY`)}`
    );
  }

  displayStats(engine);
  console.log(chalk.cyan('\nQuick demo complete!\n'));
}

// CLI Commands
program
  .name('arka-demo')
  .description('ARKA Engine Demo - Interactive compliance rule demonstration')
  .version('1.0.0');

program
  .command('start')
  .description('Start interactive demo mode')
  .action(async () => {
    const engine = createDemoEngine();
    await runInteractiveDemo(engine);
  });

program
  .command('quick')
  .description('Run quick demo (all scenarios)')
  .action(async () => {
    const engine = createDemoEngine();
    await runQuickDemo(engine);
  });

program
  .command('scenario <name>')
  .description('Run a specific scenario')
  .action(async (name: string) => {
    const engine = createDemoEngine();

    const scenario = demoScenarios[name as keyof typeof demoScenarios];
    if (!scenario) {
      console.error(chalk.red(`Unknown scenario: ${name}`));
      console.log('Available scenarios:', Object.keys(demoScenarios).join(', '));
      process.exit(1);
    }

    console.log(banner);
    console.log(`\n${chalk.bold(scenario.name)}`);
    console.log(chalk.gray(scenario.description + '\n'));

    const decisions = await engine.processEvents(scenario.events);
    for (const decision of decisions) {
      displayDecision(decision);
    }
  });

program
  .command('rules')
  .description('List all loaded rules')
  .option('-c, --category <name>', 'Filter by category')
  .action(async (options: { category?: string }) => {
    const engine = createDemoEngine();
    const rules = options.category
      ? engine.getRulesByCategory(options.category)
      : engine.getRules();

    const tableData = [
      ['ID', 'Name', 'Severity', 'Decision'],
      ...rules.map((rule) => [
        rule.id,
        rule.name,
        rule.severity,
        rule.consequence.decision,
      ]),
    ];

    console.log(table(tableData));
  });

program
  .command('server')
  .description('Start demo API server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .action(async (options: { port: string }) => {
    console.log(banner);
    console.log(chalk.yellow('Starting demo API server...'));
    console.log(chalk.gray(`This feature starts a REST API for integration demos.\n`));

    // Dynamic import to avoid loading express unless needed
    const { startDemoServer } = await import('../server/index.js');
    await startDemoServer(parseInt(options.port, 10));
  });

// Default command
program
  .action(async () => {
    const engine = createDemoEngine();
    await runInteractiveDemo(engine);
  });

program.parse();
