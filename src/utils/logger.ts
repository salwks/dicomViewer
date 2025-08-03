/**
 * Medical-grade logging utility with appropriate log levels
 * Provides structured logging for production environments
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogContext {
  component?: string;
  operation?: string;
  imageId?: string;
  viewportId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private currentLevel: LogLevel = LogLevel.INFO;
  private isProduction = process.env.NODE_ENV === 'production';
  private logs: LogEntry[] = [];
  private maxLogHistory = 1000;

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Debug level logging - development only
   */
  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, context);
    }
  }

  /**
   * Info level logging - general information
   */
  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, context);
    }
  }

  /**
   * Warning level logging - potential issues
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, context, error);
    }
  }

  /**
   * Error level logging - recoverable errors
   */
  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, context, error);
    }
  }

  /**
   * Fatal level logging - critical system errors
   */
  fatal(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.log(LogLevel.FATAL, message, context, error);
    }
  }

  /**
   * Medical operation logging with structured context
   */
  medical(
    message: string,
    context: LogContext & {
      operation: string;
      imageId?: string;
      studyInstanceUID?: string;
      seriesInstanceUID?: string;
      sopInstanceUID?: string;
    },
  ): void {
    this.info(`[MEDICAL] ${message}`, context);
  }

  /**
   * Performance logging for monitoring
   */
  performance(message: string, duration: number, context?: LogContext): void {
    this.info(`[PERF] ${message} (${duration.toFixed(2)}ms)`, {
      ...context,
      metadata: { ...context?.metadata, duration },
    });
  }

  /**
   * Security-related logging
   */
  security(message: string, context?: LogContext, error?: Error): void {
    this.warn(`[SECURITY] ${message}`, context, error);
  }

  /**
   * User interaction logging
   */
  interaction(message: string, context?: LogContext): void {
    this.debug(`[UI] ${message}`, context);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    // Store in memory for debugging
    this.logs.push(entry);
    if (this.logs.length > this.maxLogHistory) {
      this.logs.shift();
    }

    // Console output with appropriate formatting
    this.outputToConsole(entry);

    // In production, send to monitoring service
    if (this.isProduction && level >= LogLevel.ERROR) {
      this.sendToMonitoring(entry);
    }
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  /**
   * Format and output to console
   */
  private outputToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const emoji = this.getLevelEmoji(entry.level);
    const timestamp = this.isProduction ? entry.timestamp : entry.timestamp.split('T')[1].slice(0, 8);

    let formattedMessage = `${emoji} [${timestamp}] ${levelName}: ${entry.message}`;

    if (entry.context?.component) {
      formattedMessage += ` (${entry.context.component})`;
    }

    const consoleMethod = this.getConsoleMethod(entry.level);

    if (entry.error) {
      consoleMethod(formattedMessage, entry.context, entry.error);
    } else if (entry.context) {
      consoleMethod(formattedMessage, entry.context);
    } else {
      consoleMethod(formattedMessage);
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return '🔍';
      case LogLevel.INFO:
        return '📄';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.FATAL:
        return '🚨';
      default:
        return '📝';
    }
  }

  /**
   * Get appropriate console method for level
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {

      case LogLevel.DEBUG:
        // eslint-disable-next-line no-console
        return console.debug;

      case LogLevel.INFO:
        // eslint-disable-next-line no-console
        return console.info;

      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * Send high-priority logs to monitoring service
   */
  private sendToMonitoring(entry: LogEntry): void {
    try {
      // In a real implementation, this would send to your monitoring service
      // For now, we'll just ensure critical errors are prominently logged
      if (entry.level >= LogLevel.FATAL) {
        console.error('🚨 CRITICAL ERROR - IMMEDIATE ATTENTION REQUIRED:', {
          message: entry.message,
          context: entry.context,
          error: entry.error,
          timestamp: entry.timestamp,
        });
      }
    } catch (error) {
      // Fallback logging if monitoring fails
      console.error('Failed to send log to monitoring service:', error);
    }
  }

  /**
   * Get recent log history for debugging
   */
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear log history
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs for debugging or support
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Set appropriate level based on environment
if (process.env.NODE_ENV === 'development') {
  logger.setLevel(LogLevel.DEBUG);
} else if (process.env.NODE_ENV === 'test') {
  logger.setLevel(LogLevel.WARN);
} else {
  logger.setLevel(LogLevel.INFO);
}

// Export convenience functions for easier migration
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext, error?: Error) => logger.warn(message, context, error),
  error: (message: string, context?: LogContext, error?: Error) => logger.error(message, context, error),
  fatal: (message: string, context?: LogContext, error?: Error) => logger.fatal(message, context, error),
  medical: (message: string, context: LogContext & { operation: string }) => logger.medical(message, context),
  performance: (message: string, duration: number, context?: LogContext) =>
    logger.performance(message, duration, context),
  security: (message: string, context?: LogContext, error?: Error) => logger.security(message, context, error),
  interaction: (message: string, context?: LogContext) => logger.interaction(message, context),
};

export default logger;
