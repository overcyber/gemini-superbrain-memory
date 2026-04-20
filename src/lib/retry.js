/**
 * Retry utilities with exponential backoff.
 */

import { logger } from "./logger.js";

/**
 * Sleep for specified milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable.
 * Network errors, timeouts, and 5xx responses are typically retryable.
 * @param {Error} err - The error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(err) {
  // Network errors (no response)
  if (!err.response && !err.status) {
    return true;
  }

  // HTTP status codes
  const status = err.status || err.response?.status;
  if (status) {
    // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx (Server Errors)
    return status === 408 || status === 429 || status >= 500;
  }

  return false;
}

/**
 * Fetch with retry logic and exponential backoff.
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {Object} config - Retry configuration
 * @param {number} config.maxRetries - Maximum number of retries (default: 3)
 * @param {number} config.baseDelay - Base delay in milliseconds (default: 1000)
 * @param {(attempt: number, err: Error) => void} config.onRetry - Callback on each retry
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If all retries fail
 */
export async function fetchWithRetry(
  url,
  options = {},
  { maxRetries = 3, baseDelay = 1000, onRetry } = {},
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    } catch (err) {
      lastError = err;

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(err)) {
        throw err;
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);

      logger.debug(
        {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay,
          error: err.message,
        },
        "Retrying fetch request",
      );

      if (onRetry) {
        onRetry(attempt + 1, err);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Wrap an async function with retry logic.
 * @param {Function} fn - Async function to retry
 * @param {Object} config - Retry configuration
 * @returns {Promise<*>} Result of the function
 */
export async function withRetry(
  fn,
  { maxRetries = 3, baseDelay = 1000, isRetryable = isRetryableError } = {},
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries || !isRetryable(err)) {
        throw err;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

export default { fetchWithRetry, withRetry, sleep };
