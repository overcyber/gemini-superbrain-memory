/**
 * Health check utilities for backend availability.
 */

import { fetchWithRetry } from "./retry.js";
import { logger } from "./logger.js";

/**
 * Health check status.
 * @typedef {Object} HealthStatus
 * @property {boolean} healthy - Whether the backend is healthy
 * @property {string} status - Status string: 'healthy', 'unhealthy', 'timeout'
 * @property {number} latency - Response latency in milliseconds
 * @property {string} [error] - Error message if unhealthy
 * @property {number} timestamp - Check timestamp
 */

/**
 * Default health check timeout in milliseconds.
 */
const DEFAULT_TIMEOUT = 5000;

/**
 * Check if the backend is healthy.
 * @param {string} apiUrl - API base URL
 * @param {string} apiKey - API key
 * @param {Object} options - Check options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.maxRetries - Maximum retries
 * @returns {Promise<HealthStatus>} Health status
 */
export async function checkHealth(
  apiUrl,
  apiKey,
  { timeout = DEFAULT_TIMEOUT, maxRetries = 1 } = {},
) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // Try to hit a simple endpoint - adjust based on actual API
    // Most APIs have a /health or /ping endpoint, otherwise we try a lightweight request
    const healthUrl = `${apiUrl.replace(/\/+$/, "")}/health`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetchWithRetry(
      healthUrl,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        signal: controller.signal,
      },
      { maxRetries },
    );

    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;

    logger.info(
      {
        apiUrl,
        latency,
        status: response.status,
      },
      "Health check passed",
    );

    return {
      healthy: true,
      status: "healthy",
      latency,
      timestamp,
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    const isTimeout = err.name === "AbortError" || err.code === "ABORT_ERR";

    logger.warn(
      {
        apiUrl,
        latency,
        error: err.message,
        isTimeout,
      },
      "Health check failed",
    );

    return {
      healthy: false,
      status: isTimeout ? "timeout" : "unhealthy",
      latency,
      error: err.message,
      timestamp,
    };
  }
}

/**
 * Health check cache to avoid excessive checks.
 */
const healthCache = new Map();

/**
 * Get cached health status if available and fresh.
 * @param {string} apiUrl - API URL
 * @param {number} maxAge - Maximum cache age in milliseconds
 * @returns {HealthStatus|null} Cached status or null
 */
function getCachedHealth(apiUrl, maxAge = 60000) {
  const cached = healthCache.get(apiUrl);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > maxAge) {
    healthCache.delete(apiUrl);
    return null;
  }

  return cached;
}

/**
 * Check health with caching.
 * @param {string} apiUrl - API base URL
 * @param {string} apiKey - API key
 * @param {Object} options - Check options
 * @param {number} options.timeout - Timeout in milliseconds
 * @param {number} options.maxAge - Maximum cache age in milliseconds
 * @returns {Promise<HealthStatus>} Health status
 */
export async function checkHealthCached(
  apiUrl,
  apiKey,
  { timeout, maxAge = 60000 } = {},
) {
  const cached = getCachedHealth(apiUrl, maxAge);
  if (cached) {
    logger.debug({ apiUrl, cached: true }, "Using cached health status");
    return cached;
  }

  const status = await checkHealth(apiUrl, apiKey, { timeout });
  healthCache.set(apiUrl, status);
  return status;
}

/**
 * Clear health check cache.
 */
export function clearHealthCache() {
  healthCache.clear();
}

export default { checkHealth, checkHealthCached, clearHealthCache };
