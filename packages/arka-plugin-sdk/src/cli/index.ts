/**
 * ARKA Plugin CLI SDK
 *
 * Provides types and utilities for plugins to define CLI commands.
 *
 * @example
 * ```typescript
 * import {
 *   defineCLI,
 *   defineGroup,
 *   defineCommand,
 *   defineArg,
 *   defineFlag,
 *   type PluginCLIExtension,
 *   type CLICommandContext,
 * } from '@arka-protocol/plugin-sdk/cli';
 *
 * // Define CLI commands using the fluent builder
 * const cliManifest = defineCLI('my-plugin', '1.0.0')
 *   .commandGroup(
 *     defineGroup('mycommand', 'My plugin commands')
 *       .subcommand(
 *         defineCommand('list', 'List all items')
 *           .flag(defineFlag('limit', 'Max items to show').number().default(10))
 *           .handler(async (ctx) => {
 *             // Implementation
 *             return { success: true, data: [] };
 *           })
 *       )
 *       .subcommand(
 *         defineCommand('get', 'Get a specific item')
 *           .argument(defineArg('id', 'Item ID').required())
 *           .handler(async (ctx) => {
 *             const id = ctx.args.id as string;
 *             return { success: true, data: { id } };
 *           })
 *       )
 *   )
 *   .build();
 *
 * // Export as PluginCLIExtension
 * export const cliExtension: PluginCLIExtension = {
 *   getCLIManifest: () => cliManifest,
 * };
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  CLIArgumentType,
  CLIArgument,
  CLIFlag,
  CLICommandContext,
  CLICommandResult,
  CLICommandHandler,
  CLISubcommand,
  CLICommandGroup,
  PluginCLIManifest,
  CLIOutputOptions,
  CLIPromptType,
  CLIPrompt,
  PluginCLIExtension,
} from './types.js';

// Builder classes
export {
  ArgumentBuilder,
  FlagBuilder,
  SubcommandBuilder,
  CommandGroupBuilder,
  CLIManifestBuilder,
} from './builder.js';

// Factory functions
export {
  defineCLI,
  defineGroup,
  defineCommand,
  defineArg,
  defineFlag,
} from './builder.js';
