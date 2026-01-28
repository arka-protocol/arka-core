/**
 * ARKA Logger
 *
 * Structured logging utility for ARKA services.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  correlationId?: string;
  service?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
}

export interface LoggerConfig {
  service: string;
  level?: LogLevel;
  pretty?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Creates a structured logger instance
 */
export function createLogger(config: LoggerConfig) {
  const { service, level = 'info', pretty = process.env.NODE_ENV !== 'production' } = config;
  const minLevel = LOG_LEVELS[level];

  function shouldLog(logLevel: LogLevel): boolean {
    return LOG_LEVELS[logLevel] >= minLevel;
  }

  function formatEntry(entry: LogEntry): string {
    if (pretty) {
      const timestamp = new Date(entry.timestamp).toISOString();
      const levelStr = entry.level.toUpperCase().padEnd(5);
      let output = `[${timestamp}] ${levelStr} ${entry.message}`;

      if (entry.context && Object.keys(entry.context).length > 0) {
        output += ` ${JSON.stringify(entry.context)}`;
      }

      if (entry.data && Object.keys(entry.data).length > 0) {
        output += `\n  Data: ${JSON.stringify(entry.data, null, 2)}`;
      }

      if (entry.error) {
        output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.stack) {
          output += `\n  ${entry.error.stack}`;
        }
      }

      return output;
    }

    return JSON.stringify(entry);
  }

  function log(
    logLevel: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!shouldLog(logLevel)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: logLevel,
      message,
      context: { service },
    };

    if (data) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    const formatted = formatEntry(entry);

    switch (logLevel) {
      case 'error':
        console.error(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>, error?: Error) =>
      log('warn', message, data, error),
    error: (message: string, error?: Error, data?: Record<string, unknown>) =>
      log('error', message, data, error),

    /**
     * Creates a child logger with additional context
     */
    child: (context: LogContext) => {
      return createLogger({ ...config, service: context.service || service });
    },

    /**
     * Wraps an async function with logging
     */
    async withLogging<T>(
      operation: string,
      fn: () => Promise<T>,
      data?: Record<string, unknown>
    ): Promise<T> {
      const start = Date.now();
      log('debug', `Starting: ${operation}`, data);

      try {
        const result = await fn();
        const duration = Date.now() - start;
        log('debug', `Completed: ${operation}`, { ...data, durationMs: duration });
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        log('error', `Failed: ${operation}`, { ...data, durationMs: duration }, error as Error);
        throw error;
      }
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;

// Default logger instance
let defaultLogger: Logger | null = null;

export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger({ service: 'arka' });
  }
  return defaultLogger;
}

export function setDefaultLogger(logger: Logger): void {
  defaultLogger = logger;
}
