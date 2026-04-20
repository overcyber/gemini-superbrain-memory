/**
 * Structured logging using Pino.
 * Provides consistent logging across the extension.
 */

import pino from "pino";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";

/**
 * Create a logger with optional context binding.
 * @param {Object} context - Context to bind to all log entries
 * @param {string} context.operation - Operation being performed
 * @param {string} context.sessionId - Session ID
 * @param {string} context.project - Project name
 * @param {string} context.containerTag - Container tag
 * @returns {pino.Logger} Pino logger instance
 */
export function createLogger(context = {}) {
  return pino({
    level: LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "message",
    errorKey: "error",
    base: {
      name: "brain-extension",
    },
  }, pino.destination(2)).child(context);
}

/**
 * Default logger instance without context binding.
 */
export const logger = createLogger();

/**
 * Create a child logger with additional context.
 * @param {pino.Logger} parent - Parent logger
 * @param {Object} context - Additional context
 * @returns {pino.Logger} Child logger
 */
export function withContext(parent, context) {
  return parent.child(context);
}

export default logger;
