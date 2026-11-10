import { redactValue } from '@/lib/logging';

/**
 * Error handling utilities for the Receipt & Spending Tracker
 * Provides consistent error responses and logging across the application
 */

import { randomUUID } from 'crypto';

/**
 * Standard error response format for API endpoints
 */
export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: object;
    requestId?: string;
  };
};

/**
 * Error codes for different error types
 */
export enum ErrorCode {
  // Authentication errors (401)
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Validation errors (400)
  BAD_REQUEST = 'BAD_REQUEST',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // Database errors (500, 503, 409)
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // External API errors (502, 504, 429)
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  EXTERNAL_API_TIMEOUT = 'EXTERNAL_API_TIMEOUT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Generic errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * Log levels for error logging
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Log entry structure
 */
type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  context?: object;
  stack?: string;
};

/**
 * Factory function to create error responses
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: object,
  requestId?: string,
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(details && { details }),
      ...(requestId && { requestId }),
    },
  };
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return randomUUID();
}

/**
 * Logger utility with different log levels
 */
export class Logger {
  private static formatLogEntry(entry: LogEntry): string {
    const { level, message, timestamp, requestId, userId, context, stack } = entry;

    let logMessage = `[${timestamp}] [${level}]`;

    if (requestId) {
      logMessage += ` [RequestID: ${requestId}]`;
    }

    if (userId) {
      logMessage += ` [UserID: ${userId}]`;
    }

    logMessage += ` ${message}`;

    if (context) {
      logMessage += `\nContext: ${JSON.stringify(context, null, 2)}`;
    }

    if (stack) {
      logMessage += `\nStack: ${stack}`;
    }

    return logMessage;
  }

  private static log(
    level: LogLevel,
    message: string,
    options?: {
      requestId?: string;
      userId?: string;
      context?: object;
      stack?: string;
    },
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...options,
    };

    // The same redaction as submitLogEvent: no email addresses, receipt contents or image links,
    // even in the platform's own logs.
    const formattedLog = String(redactValue(this.formatLogEntry(entry)));

    // Console only: these reach the platform's runtime logs, not the log service.
    switch (level) {
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(formattedLog);
        }
        break;
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
        console.error(formattedLog);
        break;
    }
  }

  /**
   * Log debug messages (development only)
   */
  static debug(
    message: string,
    options?: {
      requestId?: string;
      userId?: string;
      context?: object;
    },
  ): void {
    this.log(LogLevel.DEBUG, message, options);
  }

  /**
   * Log informational messages
   */
  static info(
    message: string,
    options?: {
      requestId?: string;
      userId?: string;
      context?: object;
    },
  ): void {
    this.log(LogLevel.INFO, message, options);
  }

  /**
   * Log warning messages
   */
  static warn(
    message: string,
    options?: {
      requestId?: string;
      userId?: string;
      context?: object;
    },
  ): void {
    this.log(LogLevel.WARN, message, options);
  }

  /**
   * Log error messages with full stack trace
   */
  static error(
    message: string,
    error?: Error,
    options?: {
      requestId?: string;
      userId?: string;
      context?: object;
    },
  ): void {
    this.log(LogLevel.ERROR, message, {
      ...options,
      stack: error?.stack,
    });
  }
}

/**
 * Map error codes to HTTP status codes
 */
export function getHttpStatusCode(errorCode: ErrorCode): number {
  switch (errorCode) {
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.SESSION_EXPIRED:
      return 401;

    case ErrorCode.FORBIDDEN:
    case ErrorCode.INSUFFICIENT_PERMISSIONS:
      return 403;

    case ErrorCode.BAD_REQUEST:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.MISSING_REQUIRED_FIELD:
      return 400;

    case ErrorCode.NOT_FOUND:
      return 404;

    case ErrorCode.CONSTRAINT_VIOLATION:
      return 409;

    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;

    case ErrorCode.EXTERNAL_API_ERROR:
      return 502;

    case ErrorCode.EXTERNAL_API_TIMEOUT:
      return 504;

    case ErrorCode.DATABASE_CONNECTION_FAILED:
      return 503;

    case ErrorCode.DATABASE_ERROR:
    case ErrorCode.INTERNAL_SERVER_ERROR:
    default:
      return 500;
  }
}

/**
 * Sanitize error messages to prevent sensitive data exposure
 */
export function sanitizeErrorMessage(error: Error): string {
  // Remove sensitive patterns from error messages
  let message = error.message;

  // Remove potential SQL query details
  message = message.replace(/SELECT .* FROM/gi, 'SELECT ... FROM');
  message = message.replace(/INSERT INTO .* VALUES/gi, 'INSERT INTO ... VALUES');
  message = message.replace(/UPDATE .* SET/gi, 'UPDATE ... SET');

  // Remove potential connection strings
  message = message.replace(/postgresql:\/\/[^\s]+/gi, 'postgresql://***');
  message = message.replace(/postgres:\/\/[^\s]+/gi, 'postgres://***');

  // Remove potential API keys
  message = message.replace(/[a-zA-Z0-9_-]{32,}/g, '***');

  return message;
}
