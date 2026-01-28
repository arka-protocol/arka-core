/**
 * ARKA Demo Package
 *
 * Interactive demo environment for ARKA Engine.
 * Supports multiple demo modes:
 * - Standalone in-memory mode
 * - Interactive CLI
 * - REST API server
 * - Docker Compose full stack
 *
 * @packageDocumentation
 */

// Engine
export {
  InMemoryDemoEngine,
  createDemoEngine,
  type EngineStats,
} from './modes/in-memory-engine.js';

// Seed Data
export * from './seed-data/index.js';

// Server
export { startDemoServer } from './server/index.js';
