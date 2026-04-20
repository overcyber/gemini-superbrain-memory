/**
 * Tests for retry.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry, withRetry } from "../../src/lib/retry.js";

describe("retry", () => {
  describe("sleep (internal function)", () => {
    it("retry should use exponential backoff", async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;

      global.setTimeout = vi.fn((cb, delay) => {
        delays.push(delay);
        return originalSetTimeout(cb, 0);
      });

      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValue("success");

      await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

      expect(delays[0]).toBe(10);
      expect(delays[1]).toBe(20);

      global.setTimeout = originalSetTimeout;
    });
  });

  describe("withRetry", () => {
    it("should return result on first success", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn, { maxRetries: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable error", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 10 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should throw after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Permanent failure"));

      await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 }))
        .rejects.toThrow("Permanent failure");

      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should not retry non-retryable errors", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Non-retryable"));

      await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10, isRetryable: () => false }))
        .rejects.toThrow("Non-retryable");

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchWithRetry", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should return response on first success", async () => {
      const mockResponse = { ok: true, status: 200 };
      global.fetch.mockResolvedValue(mockResponse);

      const result = await fetchWithRetry("https://example.com", {}, { maxRetries: 2 });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on network error", async () => {
      global.fetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue({ ok: true, status: 200 });

      const result = await fetchWithRetry("https://example.com", {}, { maxRetries: 2, baseDelay: 10 });

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 5xx status", async () => {
      const error = new Error("Server Error");
      error.status = 500;

      global.fetch
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ ok: true, status: 200 });

      const result = await fetchWithRetry("https://example.com", {}, { maxRetries: 2, baseDelay: 10 });

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on 429 status", async () => {
      const error = new Error("Too Many Requests");
      error.status = 429;

      global.fetch
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ ok: true, status: 200 });

      const result = await fetchWithRetry("https://example.com", {}, { maxRetries: 2, baseDelay: 10 });

      expect(result.ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on 4xx (except 429 and 408)", async () => {
      const error = new Error("Not Found");
      error.status = 404;

      global.fetch.mockRejectedValue(error);

      await expect(fetchWithRetry("https://example.com", {}, { maxRetries: 2 }))
        .rejects.toThrow("Not Found");

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should call onRetry callback", async () => {
      const onRetry = vi.fn();
      global.fetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValue({ ok: true, status: 200 });

      await fetchWithRetry("https://example.com", {}, { maxRetries: 2, baseDelay: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });
  });
});
