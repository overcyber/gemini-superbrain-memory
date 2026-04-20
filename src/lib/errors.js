/**
 * Custom error classes and error handling utilities.
 */

import { logger } from "./logger.js";

/**
 * Base error class for all extension errors.
 */
export class ExtensionError extends Error {
  constructor(message, code = "EXTENSION_ERROR", details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  /**
   * Convert error to a plain object for logging/serialization.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors (connection, timeout, DNS, etc).
 */
export class NetworkError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "NETWORK_ERROR", { ...details, retryable: true });
  }
}

/**
 * API-related errors (HTTP status codes, rate limits, etc).
 */
export class ApiError extends ExtensionError {
  constructor(message, status, details = {}) {
    const retryable = status === 408 || status === 429 || status >= 500;
    super(message, "API_ERROR", { ...details, status, retryable });
    this.status = status;
  }
}

/**
 * Configuration errors (missing/invalid config, API keys, etc).
 */
export class ConfigError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "CONFIG_ERROR", { ...details, retryable: false });
  }
}

/**
 * Validation errors (invalid input, malformed data, etc).
 */
export class ValidationError extends ExtensionError {
  constructor(message, field, value) {
    super(message, "VALIDATION_ERROR", { field, value, retryable: false });
    this.field = field;
    this.value = value;
  }
}

/**
 * Authentication/authorization errors.
 */
export class AuthError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "AUTH_ERROR", { ...details, retryable: false });
  }
}

/**
 * Rate limit error.
 */
export class RateLimitError extends ExtensionError {
  constructor(message, retryAfter, details = {}) {
    super(message, "RATE_LIMIT_ERROR", {
      ...details,
      retryable: true,
      retryAfter,
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * Check if an error is benign (can be silently ignored).
 * @param {Error} err - Error to check
 * @returns {boolean} True if error is benign
 */
export function isBenignError(err) {
  // Benign errors: missing session data, empty config, etc.
  const benignMessages = [
    "session id",
    "not found",
    "empty",
    "no data",
    "undefined",
  ];

  const message = err?.message?.toLowerCase() || "";
  return benignMessages.some((bm) => message.includes(bm));
}

/**
 * Check if an error is retryable.
 * @param {Error} err - Error to check
 * @returns {boolean} True if error is retryable
 */
export function isRetryableError(err) {
  if (err instanceof ExtensionError) {
    return err.details?.retryable === true;
  }

  // Network errors without response are retryable
  if (!err?.status && !err?.response) {
    return true;
  }

  // Specific status codes
  const status = err?.status || err?.response?.status;
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Wrap an unknown error as an ExtensionError.
 * @param {Error} err - Error to wrap
 * @param {string} fallbackMessage - Fallback message if error has no message
 * @returns {ExtensionError} Wrapped error
 */
export function wrapError(err, fallbackMessage = "An error occurred") {
  if (err instanceof ExtensionError) {
    return err;
  }

  const message = err?.message || fallbackMessage;

  // Detect error type from message/status
  if (err?.status === 401 || err?.status === 403) {
    return new AuthError(message, { originalError: err });
  }

  if (err?.status === 429) {
    return new RateLimitError(message, err.retryAfter, { originalError: err });
  }

  if (err?.status) {
    return new ApiError(message, err.status, { originalError: err });
  }

  if (err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.code === "ETIMEDOUT") {
    return new NetworkError(message, { originalError: err, code: err.code });
  }

  return new ExtensionError(message, "UNKNOWN_ERROR", { originalError: err });
}

/**
 * Log an error appropriately based on its type.
 * @param {Error} err - Error to log
 * @param {Object} context - Additional context for logging
 * @param {string} context.operation - Operation being performed
 * @param {string} context.sessionId - Session ID
 */
export function logError(err, context = {}) {
  const wrapped = wrapError(err);

  if (wrapped instanceof ValidationError) {
    logger.debug({ ...context, error: wrapped.toJSON() }, "Validation error");
  } else if (wrapped instanceof NetworkError) {
    logger.warn({ ...context, error: wrapped.toJSON() }, "Network error");
  } else if (wrapped instanceof ApiError) {
    logger.warn({ ...context, error: wrapped.toJSON() }, "API error");
  } else if (wrapped instanceof ConfigError) {
    logger.error({ ...context, error: wrapped.toJSON() }, "Configuration error");
  } else if (wrapped instanceof AuthError) {
    logger.error({ ...context, error: wrapped.toJSON() }, "Authentication error");
  } else {
    logger.error({ ...context, error: wrapped.toJSON() }, "Unexpected error");
  }

  return wrapped;
}

/**
 * Handle an error and return a user-friendly message.
 * @param {Error} err - Error to handle
 * @param {string} fallbackMessage - Fallback message
 * @returns {string} User-friendly error message
 */
export function getFriendlyErrorMessage(err, fallbackMessage = "Something went wrong") {
  const wrapped = wrapError(err);

  switch (wrapped.code) {
    case "NETWORK_ERROR":
      return "Network error. Please check your connection.";
    case "API_ERROR":
      if (wrapped.status >= 500) {
        return "Service temporarily unavailable. Please try again.";
      }
      return `API error: ${wrapped.message}`;
    case "CONFIG_ERROR":
      return `Configuration error: ${wrapped.message}`;
    case "AUTH_ERROR":
      return "Authentication failed. Please check your API key.";
    case "RATE_LIMIT_ERROR":
      return "Too many requests. Please try again later.";
    case "VALIDATION_ERROR":
      return `Invalid input: ${wrapped.message}`;
    default:
      return fallbackMessage;
  }
}

export default {
  ExtensionError,
  NetworkError,
  ApiError,
  ConfigError,
  ValidationError,
  AuthError,
  RateLimitError,
  isBenignError,
  isRetryableError,
  wrapError,
  logError,
  getFriendlyErrorMessage,
};
