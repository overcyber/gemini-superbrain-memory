/**
 * Tests for cache.js
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCache } from "../../src/lib/cache.js";

describe("MemoryCache", () => {
  let cache;

  beforeEach(() => {
    cache = new MemoryCache({ ttl: 1000, maxSize: 10 });
  });

  describe("set and get", () => {
    it("should store and retrieve values", () => {
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("should return null for non-existent keys", () => {
      expect(cache.get("nonexistent")).toBeNull();
    });

    it("should expire entries after TTL", async () => {
      cache.set("key1", "value1", 50);
      expect(cache.get("key1")).toBe("value1");

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cache.get("key1")).toBeNull();
    });
  });

  describe("has", () => {
    it("should return true for existing keys", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should return false for non-existent keys", () => {
      expect(cache.has("nonexistent")).toBe(false);
    });

    it("should return false for expired keys", async () => {
      cache.set("key1", "value1", 50);
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(cache.has("key1")).toBe(false);
    });
  });

  describe("delete", () => {
    it("should remove keys", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);

      cache.delete("key1");
      expect(cache.has("key1")).toBe(false);
    });

    it("should return true when deleting existing key", () => {
      cache.set("key1", "value1");
      expect(cache.delete("key1")).toBe(true);
    });

    it("should return false when deleting non-existent key", () => {
      expect(cache.delete("nonexistent")).toBe(false);
    });
  });

  describe("maxSize", () => {
    it("should evict oldest entries when maxSize is reached", () => {
      const smallCache = new MemoryCache({ maxSize: 3 });

      smallCache.set("key1", "value1");
      smallCache.set("key2", "value2");
      smallCache.set("key3", "value3");
      expect(smallCache.has("key1")).toBe(true);

      smallCache.set("key4", "value4");
      expect(smallCache.has("key1")).toBe(false);
      expect(smallCache.has("key4")).toBe(true);
    });
  });

  describe("invalidate", () => {
    it("should remove all keys matching pattern", () => {
      cache.set("user:123:data", "value1");
      cache.set("user:456:data", "value2");
      cache.set("other:key", "value3");

      cache.invalidate("user:");
      expect(cache.has("user:123:data")).toBe(false);
      expect(cache.has("user:456:data")).toBe(false);
      expect(cache.has("other:key")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.clear();
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("stats", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1");

      cache.get("key1"); // hit
      cache.get("key2"); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it("should track sets and deletes", () => {
      cache.set("key1", "value1");
      cache.delete("key1");

      const stats = cache.getStats();
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
    });

    it("should calculate hit rate", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.get("key1"); // hit
      cache.get("key2"); // hit
      cache.get("key3"); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(2 / 3);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", async () => {
      cache.set("key1", "value1", 50);
      cache.set("key2", "value2", 10000);

      await new Promise((resolve) => setTimeout(resolve, 60));

      const removed = cache.cleanup();
      expect(removed).toBe(1);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
    });
  });

  describe("makeKey", () => {
    it("should generate consistent keys", () => {
      const key1 = MemoryCache.makeKey("container", "query", { sector: "semantic" });
      const key2 = MemoryCache.makeKey("container", "query", { sector: "semantic" });

      expect(key1).toBe(key2);
    });

    it("should include sector in key", () => {
      const key1 = MemoryCache.makeKey("container", "query", { sector: "semantic" });
      const key2 = MemoryCache.makeKey("container", "query", { sector: "episodic" });

      expect(key1).not.toBe(key2);
    });

    it("should include tags in key", () => {
      const key1 = MemoryCache.makeKey("container", "query", { tags: ["a", "b"] });
      const key2 = MemoryCache.makeKey("container", "query", { tags: ["b", "a"] }); // sorted

      expect(key1).toBe(key2);
    });

    it("should include limit in key", () => {
      const key1 = MemoryCache.makeKey("container", "query", { limit: 5 });
      const key2 = MemoryCache.makeKey("container", "query", { limit: 10 });

      expect(key1).not.toBe(key2);
    });
  });
});
