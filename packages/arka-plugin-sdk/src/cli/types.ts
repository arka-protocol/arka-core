/**
 * ARKA Plugin CLI Types
 *
 * Type definitions for plugin CLI extensions.
 * Plugins can define their own CLI commands that integrate with the main `pact` CLI.
 */

/**
 * Type of CLI argument
 */
export type CLIArgumentType = 'string' | 'number' | 'boolean' | 'array' | 'json';

/**
 * CLI command argument definition
 */
export interface CLIArgument {
  /** Argument name */
  name: string;
  /** Description for help text */
  description: string;
  /** Whether this argument is required */
  required?: boolean;
  /** Default value if not provided */
  default?: unknown;
  /** Type of the argument */
  type?: CLIArgumentType;
  /** Possible values for enum-like arguments */
  choices?: string[];
}

/**
 * CLI command flag definition
 */
export interface CLIFlag {
  /** Flag name (without dashes) */
  name: string;
  /** Short alias (single character) */
  alias?: string;
  /** Description for help text */
  description: string;
  /** Type of the flag */
  type: 'string' | 'number' | 'boolean';
  /** Default value if not provided */
  default?: unknown;
  /** Whether this flag is required */
  required?: boolean;
  /** Possible values for enum-like flags */
  choices?: string[];
}

/**
 * Context passed to CLI command handlers
 */
export interface CLICommandContext {
  /** Parsed positional arguments */
  args: Record<string, unknown>;
  /** Parsed flags */
  flags: Record<string, unknown>;
  /** Current profile name */
  profile: string;
  /** API URL for the current profile */
  apiUrl: string;
  /** Whether JSON output is requested */
  json: boolean;
  /** Whether quiet mode is enabled */
  quiet: boolean;
  /** Whether verbose mode is enabled */
  verbose: boolean;
}

/**
 * Result of a CLI command execution
 */
export interface CLICommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Data to output (will be JSON-formatted if --json flag is used) */
  data?: unknown;
  /** Error message if command failed */
  error?: string;
  /** Exit code (defaults to 0 for success, 1 for error) */
  exitCode?: number;
}

/**
 * CLI command handler function
 */
export type CLICommandHandler = (
  context: CLICommandContext
) => Promise<CLICommandResult> | CLICommandResult;

/**
 * CLI subcommand definition
 */
export interface CLISubcommand {
  /** Subcommand name (e.g., "list", "create", "validate") */
  name: string;
  /** Description for help text */
  description: string;
  /** Positional arguments */
  args?: CLIArgument[];
  /** Flags/options */
  flags?: CLIFlag[];
  /** Handler function */
  handler: CLICommandHandler;
  /** Examples shown in help text */
  examples?: string[];
  /** Whether this command is hidden from help */
  hidden?: boolean;
}

/**
 * CLI command group definition (top-level command)
 */
export interface CLICommandGroup {
  /** Command name (e.g., "aml", "sanctions", "fraud") */
  name: string;
  /** Description for help text */
  description: string;
  /** Subcommands in this group */
  subcommands: CLISubcommand[];
  /** Global flags that apply to all subcommands */
  globalFlags?: CLIFlag[];
  /** Examples shown in help text */
  examples?: string[];
}

/**
 * Complete CLI manifest for a plugin
 */
export interface PluginCLIManifest {
  /** Plugin ID (must match PluginManifest.id) */
  pluginId: string;
  /** Plugin version (must match PluginManifest.version) */
  version: string;
  /** CLI command groups provided by this plugin */
  commands: CLICommandGroup[];
}

/**
 * Options for rendering CLI output
 */
export interface CLIOutputOptions {
  /** Output format */
  format: 'table' | 'json' | 'yaml' | 'csv';
  /** Columns to include (for table format) */
  columns?: string[];
  /** Whether to include headers (for table/csv format) */
  headers?: boolean;
  /** Color scheme */
  colors?: boolean;
}

/**
 * Interactive prompt types
 */
export type CLIPromptType = 'input' | 'password' | 'confirm' | 'select' | 'multiselect';

/**
 * Interactive prompt definition
 */
export interface CLIPrompt {
  /** Prompt type */
  type: CLIPromptType;
  /** Prompt message */
  message: string;
  /** Name for the result */
  name: string;
  /** Default value */
  default?: unknown;
  /** Choices for select/multiselect */
  choices?: Array<{ label: string; value: unknown }>;
  /** Validation function */
  validate?: (value: unknown) => boolean | string;
}

/**
 * Plugin CLI extension interface
 * Plugins implement this to provide CLI commands
 */
export interface PluginCLIExtension {
  /** Get the CLI manifest for this plugin */
  getCLIManifest(): PluginCLIManifest;

  /**
   * Optional: Initialize CLI resources
   * Called once when the CLI loads this plugin's commands
   */
  initializeCLI?(): Promise<void>;

  /**
   * Optional: Cleanup CLI resources
   * Called when the CLI unloads this plugin's commands
   */
  cleanupCLI?(): Promise<void>;
}
