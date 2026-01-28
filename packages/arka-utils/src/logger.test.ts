/**
 * Logger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from './logger.js';

describe('Logger', () => {
  let consoleLog: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create logger with service name', () => {
    const logger = createLogger({ service: 'test-service' });
    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.debug).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.error).toBeDefined();
  });

  it('should log info messages', () => {
    const logger = createLogger({ service: 'test-service', pretty: false });
    logger.info('Test message');

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const logOutput = consoleLog.mock.calls[0]?.[0] as string;
    expect(logOutput).toContain('Test message');
    expect(logOutput).toContain('info');
  });

  it('should log warn messages', () => {
    const logger = createLogger({ service: 'test-service', pretty: false });
    logger.warn('Warning message');

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    const logOutput = consoleWarn.mock.calls[0]?.[0] as string;
    expect(logOutput).toContain('Warning message');
  });

  it('should log error messages with stack trace', () => {
    const logger = createLogger({ service: 'test-service', pretty: false });
    const error = new Error('Test error');
    logger.error('Error occurred', error);

    expect(consoleError).toHaveBeenCalledTimes(1);
    const logOutput = consoleError.mock.calls[0]?.[0] as string;
    expect(logOutput).toContain('Error occurred');
    expect(logOutput).toContain('Test error');
  });

  it('should respect log level - debug hidden at info level', () => {
    const logger = createLogger({ service: 'test-service', level: 'info', pretty: false });
    logger.debug('Debug message');

    expect(consoleLog).not.toHaveBeenCalled();
  });

  it('should respect log level - debug shown at debug level', () => {
    const logger = createLogger({ service: 'test-service', level: 'debug', pretty: false });
    logger.debug('Debug message');

    expect(consoleLog).toHaveBeenCalledTimes(1);
  });

  it('should include additional data in logs', () => {
    const logger = createLogger({ service: 'test-service', pretty: false });
    logger.info('User action', { userId: '123', action: 'login' });

    const logOutput = consoleLog.mock.calls[0]?.[0] as string;
    expect(logOutput).toContain('userId');
    expect(logOutput).toContain('123');
    expect(logOutput).toContain('action');
    expect(logOutput).toContain('login');
  });

  it('should format output as JSON when not pretty', () => {
    const logger = createLogger({ service: 'test-service', pretty: false });
    logger.info('JSON test');

    const logOutput = consoleLog.mock.calls[0]?.[0] as string;
    expect(() => JSON.parse(logOutput)).not.toThrow();
  });

  it('should create child logger with different service name', () => {
    const logger = createLogger({ service: 'parent-service', pretty: false });
    const childLogger = logger.child({ service: 'child-service' });

    childLogger.info('Child message');

    const logOutput = consoleLog.mock.calls[0]?.[0] as string;
    expect(logOutput).toContain('child-service');
  });

  it('should wrap async operations with logging', async () => {
    const logger = createLogger({ service: 'test-service', level: 'debug', pretty: false });

    const result = await logger.withLogging('test-operation', async () => {
      return 'result';
    });

    expect(result).toBe('result');
    expect(consoleLog).toHaveBeenCalledTimes(2); // Start and complete
  });

  it('should log error on failed async operations', async () => {
    const logger = createLogger({ service: 'test-service', level: 'debug', pretty: false });

    await expect(
      logger.withLogging('failing-operation', async () => {
        throw new Error('Test failure');
      })
    ).rejects.toThrow('Test failure');

    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('should filter by level - error only shows error', () => {
    const logger = createLogger({ service: 'test-service', level: 'error', pretty: false });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('should filter by level - warn shows warn and error', () => {
    const logger = createLogger({ service: 'test-service', level: 'warn', pretty: false });

    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
