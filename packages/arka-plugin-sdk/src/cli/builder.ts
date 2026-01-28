/**
 * ARKA Plugin CLI Builder
 *
 * Fluent API for building CLI commands in plugins.
 */

import type {
  CLIArgument,
  CLIFlag,
  CLISubcommand,
  CLICommandGroup,
  CLICommandHandler,
  PluginCLIManifest,
  CLIArgumentType,
} from './types.js';

/**
 * Builder for CLI arguments
 */
export class ArgumentBuilder {
  private argument: CLIArgument;

  constructor(name: string, description: string) {
    this.argument = { name, description };
  }

  required(): this {
    this.argument.required = true;
    return this;
  }

  optional(): this {
    this.argument.required = false;
    return this;
  }

  default(value: unknown): this {
    this.argument.default = value;
    return this;
  }

  type(type: CLIArgumentType): this {
    this.argument.type = type;
    return this;
  }

  choices(choices: string[]): this {
    this.argument.choices = choices;
    return this;
  }

  build(): CLIArgument {
    return this.argument;
  }
}

/**
 * Builder for CLI flags
 */
export class FlagBuilder {
  private flag: CLIFlag;

  constructor(name: string, description: string) {
    this.flag = { name, description, type: 'boolean' };
  }

  alias(alias: string): this {
    this.flag.alias = alias;
    return this;
  }

  string(): this {
    this.flag.type = 'string';
    return this;
  }

  number(): this {
    this.flag.type = 'number';
    return this;
  }

  boolean(): this {
    this.flag.type = 'boolean';
    return this;
  }

  default(value: unknown): this {
    this.flag.default = value;
    return this;
  }

  required(): this {
    this.flag.required = true;
    return this;
  }

  choices(choices: string[]): this {
    this.flag.choices = choices;
    return this;
  }

  build(): CLIFlag {
    return this.flag;
  }
}

/**
 * Builder for CLI subcommands
 */
export class SubcommandBuilder {
  private subcommand: Partial<CLISubcommand>;

  constructor(name: string, description: string) {
    this.subcommand = { name, description, args: [], flags: [], examples: [] };
  }

  argument(arg: CLIArgument | ArgumentBuilder): this {
    const argDef = arg instanceof ArgumentBuilder ? arg.build() : arg;
    this.subcommand.args!.push(argDef);
    return this;
  }

  arg(name: string, description: string): ArgumentBuilder {
    const builder = new ArgumentBuilder(name, description);
    this.subcommand.args!.push(builder.build());
    return builder;
  }

  flag(flag: CLIFlag | FlagBuilder): this {
    const flagDef = flag instanceof FlagBuilder ? flag.build() : flag;
    this.subcommand.flags!.push(flagDef);
    return this;
  }

  option(name: string, description: string): FlagBuilder {
    const builder = new FlagBuilder(name, description);
    this.subcommand.flags!.push(builder.build());
    return builder;
  }

  handler(handler: CLICommandHandler): this {
    this.subcommand.handler = handler;
    return this;
  }

  example(example: string): this {
    this.subcommand.examples!.push(example);
    return this;
  }

  examples(examples: string[]): this {
    this.subcommand.examples = examples;
    return this;
  }

  hidden(): this {
    this.subcommand.hidden = true;
    return this;
  }

  build(): CLISubcommand {
    if (!this.subcommand.handler) {
      throw new Error(`Subcommand '${this.subcommand.name}' requires a handler`);
    }
    return this.subcommand as CLISubcommand;
  }
}

/**
 * Builder for CLI command groups
 */
export class CommandGroupBuilder {
  private group: Partial<CLICommandGroup>;

  constructor(name: string, description: string) {
    this.group = { name, description, subcommands: [], globalFlags: [], examples: [] };
  }

  subcommand(subcommand: CLISubcommand | SubcommandBuilder): this {
    const subcmd = subcommand instanceof SubcommandBuilder ? subcommand.build() : subcommand;
    this.group.subcommands!.push(subcmd);
    return this;
  }

  command(name: string, description: string): SubcommandBuilder {
    const builder = new SubcommandBuilder(name, description);
    // Note: The subcommand will need to be built and added
    return builder;
  }

  globalFlag(flag: CLIFlag | FlagBuilder): this {
    const flagDef = flag instanceof FlagBuilder ? flag.build() : flag;
    this.group.globalFlags!.push(flagDef);
    return this;
  }

  example(example: string): this {
    this.group.examples!.push(example);
    return this;
  }

  examples(examples: string[]): this {
    this.group.examples = examples;
    return this;
  }

  build(): CLICommandGroup {
    if (this.group.subcommands!.length === 0) {
      throw new Error(`Command group '${this.group.name}' requires at least one subcommand`);
    }
    return this.group as CLICommandGroup;
  }
}

/**
 * Builder for complete plugin CLI manifest
 */
export class CLIManifestBuilder {
  private manifest: Partial<PluginCLIManifest>;

  constructor(pluginId: string, version: string) {
    this.manifest = { pluginId, version, commands: [] };
  }

  commandGroup(group: CLICommandGroup | CommandGroupBuilder): this {
    const groupDef = group instanceof CommandGroupBuilder ? group.build() : group;
    this.manifest.commands!.push(groupDef);
    return this;
  }

  group(name: string, description: string): CommandGroupBuilder {
    const builder = new CommandGroupBuilder(name, description);
    return builder;
  }

  build(): PluginCLIManifest {
    if (this.manifest.commands!.length === 0) {
      throw new Error(`CLI manifest for '${this.manifest.pluginId}' requires at least one command group`);
    }
    return this.manifest as PluginCLIManifest;
  }
}

// Factory functions for cleaner API

/**
 * Create a new CLI manifest builder
 */
export function defineCLI(pluginId: string, version: string): CLIManifestBuilder {
  return new CLIManifestBuilder(pluginId, version);
}

/**
 * Create a new command group builder
 */
export function defineGroup(name: string, description: string): CommandGroupBuilder {
  return new CommandGroupBuilder(name, description);
}

/**
 * Create a new subcommand builder
 */
export function defineCommand(name: string, description: string): SubcommandBuilder {
  return new SubcommandBuilder(name, description);
}

/**
 * Create a new argument builder
 */
export function defineArg(name: string, description: string): ArgumentBuilder {
  return new ArgumentBuilder(name, description);
}

/**
 * Create a new flag builder
 */
export function defineFlag(name: string, description: string): FlagBuilder {
  return new FlagBuilder(name, description);
}
