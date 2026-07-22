/**
 * Logger utility using electron-log.
 */
import log from 'electron-log';

// Configure electron-log
log.transports.file.level = 'debug';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

// Set file name
log.transports.file.fileName = 'hypothesis.log';

// Set max size (10MB)
log.transports.file.maxSize = 10 * 1024 * 1024;

export const logger = {
  info: (message: string, ...args: unknown[]) => log.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => log.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => log.error(message, ...args),
  debug: (message: string, ...args: unknown[]) => log.debug(message, ...args),
  verbose: (message: string, ...args: unknown[]) => log.verbose(message, ...args),
  silly: (message: string, ...args: unknown[]) => log.silly(message, ...args),

  // Create scoped logger
  scope: (name: string) => ({
    info: (message: string, ...args: unknown[]) => log.info(`[${name}] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) => log.warn(`[${name}] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) => log.error(`[${name}] ${message}`, ...args),
    debug: (message: string, ...args: unknown[]) => log.debug(`[${name}] ${message}`, ...args),
  }),
};

export default logger;
