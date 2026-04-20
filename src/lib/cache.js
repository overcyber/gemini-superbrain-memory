/**
 * Simple in-memory cache with TTL support.
 */

import { logger } from "./logger.js";

/**
 * Default TTL: 5 minutes
 */
const DEFAULT_TTL = 5 * 60 * 1000;

/**
 * Cache entry with expiration.
 * @typedef {Object} CacheEntry
 * @property {*} value - Cached value
 * @property {number} expires - Expiration timestamp
 */

/**
 * Simple in-memory cache class.
 */
export class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.defaultTtl = options.ttl ?? DEFAULT_TTL;
    this.maxSize = options.maxSize ?? 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  /**
   * Generate a cache key from parameters.
   * @param {string} containerTag - Container tag
   * @param {string} query - Query string
   * @param {Object} extra - Additional parameters
   * @returns {string} Cache key
   */
  static makeKey(containerTag, query, extra = {}) {
    const parts = [containerTag, query];

    if (extra.sector) {
      parts.push(`sector:${extra.sector}`);
    }
    if (extra.tags) {
      parts.push(`tags:${Array.isArray(extra.tags) ? extra.tags.sort().join(",") : extra.tags}`);
    }
    if (extra.limit) {
      parts.push(`limit:${extra.limit}`);
    }

    return parts.join(":");
  }

  /**
   * Check if a cache entry has expired.
   * @param {CacheEntry} entry - Cache entry
   * @returns {boolean} True if expired
   */
  isExpired(entry) {
    return entry.expires < Date.now();
  }

  /**
   * Get a value from cache.
   * @param {string} key - Cache key
   * @returns {*|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      logger.debug({ key }, "Cache entry expired");
      return null;
    }

    this.stats.hits++;
    logger.debug({ key, hit: true }, "Cache hit");
    return entry.value;
  }

  /**
   * Set a value in cache.
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time-to-live in milliseconds (optional)
   */
  set(key, value, ttl) {
    // Enforce max size by evicting oldest entries if needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        logger.debug({ evictedKey: firstKey }, "Cache full, evicted oldest entry");
      }
    }

    const expires = Date.now() + (ttl ?? this.defaultTtl);
    this.cache.set(key, { value, expires });
    this.stats.sets++;
    logger.debug({ key, ttl: ttl ?? this.defaultTtl }, "Cache set");
  }

  /**
   * Check if a key exists in cache and is not expired.
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and is not expired
   */
  has(key) {
    const entry = this.cache.get(key);
    return entry != null && !this.isExpired(entry);
  }

  /**
   * Delete a key from cache.
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      logger.debug({ key }, "Cache deleted");
    }
    return deleted;
  }

  /**
   * Invalidate all cache entries matching a pattern.
   * @param {string} pattern - Pattern to match (substring)
   */
  invalidate(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    logger.debug({ pattern, count }, "Cache invalidated");
    return count;
  }

  /**
   * Clear all cache entries.
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.debug({ size }, "Cache cleared");
  }

  /**
   * Get cache statistics.
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? this.stats.hits / (this.stats.hits + this.stats.misses)
        : 0,
    };
  }

  /**
   * Clean up expired entries.
   */
  cleanup() {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug({ removed }, "Cache cleanup: removed expired entries");
    }

    return removed;
  }
}

/**
 * Default singleton cache instance.
 */
export const defaultCache = new MemoryCache();

export default MemoryCache;
