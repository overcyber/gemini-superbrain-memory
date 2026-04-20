import { loadConfig } from "./config.js";
import { SuperbrainClient } from "./superbrain-client.js";
import { MemoryCache } from "./cache.js";
import { checkHealthCached, clearHealthCache } from "./health-check.js";
import { createLogger } from "./logger.js";
import { wrapError, ConfigError } from "./errors.js";

const logger = createLogger({ component: "memory-client" });

// Cache global para operações de memória
const searchCache = new MemoryCache({ ttl: 5 * 60 * 1000, maxSize: 500 }); // 5 minutos

export function createMemoryClient({ cwd = process.cwd(), enableCache = true, enableHealthCheck = false } = {}) {
  const config = loadConfig(process.env, cwd);

  if (!config.apiKey) {
    throw new ConfigError("API key not configured. Set SUPERBRAIN_API_KEY or configure via gemini extensions config.");
  }

  if (!config.apiUrl) {
    throw new ConfigError("API URL not configured. Set SUPERBRAIN_API_URL.");
  }

  const client = new SuperbrainClient(
    {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      containerTag: config.containerTag,
    },
    cwd,
  );

  // Wrapper com cache
  const cachedClient = {
    // Limpar cache
    clearCache() {
      searchCache.clear();
      clearHealthCache();
      logger.debug({}, "Memory client cache cleared");
    },

    // Invalidar cache por padrão
    invalidateCache(pattern) {
      return searchCache.invalidate(pattern);
    },

    // Health check
    async checkHealth() {
      return checkHealthCached(config.apiUrl, config.apiKey);
    },

    // Add memory - sem cache, mas com logging
    async addMemory(content, options = {}) {
      return client.addMemory(content, options);
    },

    // Search - com cache
    async search(query, options = {}) {
      const containerTag = options.containerTag ?? client.containerTag;

      if (!enableCache) {
        return client.search(query, options);
      }

      const cacheKey = MemoryCache.makeKey(containerTag, query, {
        sector: options.sector,
        tags: options.tags,
        limit: options.limit,
      });

      const cached = searchCache.get(cacheKey);
      if (cached) {
        logger.debug({ cacheHit: true, query }, "Search result from cache");
        return cached;
      }

      const result = await client.search(query, options);
      searchCache.set(cacheKey, result);
      return result;
    },

    // Get recent memories - com cache
    async getRecentMemories(options = {}) {
      const containerTag = options.containerTag ?? client.containerTag;

      if (!enableCache) {
        return client.getRecentMemories(options);
      }

      const cacheKey = MemoryCache.makeKey(containerTag, "recent", {
        sector: options.sector,
        tags: options.tags,
        limit: options.limit,
      });

      const cached = searchCache.get(cacheKey);
      if (cached) {
        logger.debug({ cacheHit: true }, "Recent memories from cache");
        return cached;
      }

      const result = await client.getRecentMemories(options);
      searchCache.set(cacheKey, result);
      return result;
    },

    // Get profile - com cache curto (1 minuto)
    async getProfile(options = {}) {
      const containerTag = options.containerTag ?? client.containerTag;

      if (!enableCache) {
        return client.getProfile(options);
      }

      const cacheKey = MemoryCache.makeKey(containerTag, options.query || "no-query", {
        sector: undefined,
        limit: undefined,
      });

      const cached = searchCache.get(cacheKey);
      if (cached) {
        logger.debug({ cacheHit: true }, "Profile from cache");
        return cached;
      }

      const result = await client.getProfile(options);
      // Cache de perfil por 1 minuto apenas
      searchCache.set(cacheKey, result, 60 * 1000);
      return result;
    },

    // Expor estatísticas do cache
    getCacheStats() {
      return searchCache.getStats();
    },

    // Health check automático se habilitado
    async ensureHealthy() {
      if (enableHealthCheck) {
        const health = await this.checkHealth();
        if (!health.healthy) {
          throw new Error(`Backend unhealthy: ${health.error || "Unknown error"}`);
        }
        return health;
      }
      return { healthy: true, status: "unknown" };
    },
  };

  // Health check inicial se habilitado
  if (enableHealthCheck) {
    checkHealthCached(config.apiUrl, config.apiKey).catch((err) => {
      logger.warn({ error: err.message }, "Initial health check failed");
    });
  }

  logger.info({ enableCache, enableHealthCheck }, "Memory client created");

  return cachedClient;
}

export default createMemoryClient;
