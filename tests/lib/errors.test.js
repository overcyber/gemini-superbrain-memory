/**
 * Tests for errors.js
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
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
} from "../../src/lib/errors.js";

// Mock logger
vi.mock("../../src/lib/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { logger } from "../../src/lib/logger.js";

describe("errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ExtensionError", () => {
    it("should create error with code and details", () => {
      const error = new ExtensionError("Test message", "TEST_CODE", { key: "value" });

      expect(error.message).toBe("Test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.details.key).toBe("value");
    });

    it("should serialize to JSON", () => {
      const error = new ExtensionError("Test", "TEST", { key: "value" });
      const json = error.toJSON();

      expect(json.name).toBe("ExtensionError");
      expect(json.code).toBe("TEST");
      expect(json.message).toBe("Test");
    });
  });

  describe("NetworkError", () => {
    it("should be retryable", () => {
      const error = new NetworkError("Connection failed");
      expect(error.details.retryable).toBe(true);
    });
  });

  describe("ApiError", () => {
    it("should store status code", () => {
      const error = new ApiError("API failed", 500);
      expect(error.status).toBe(500);
    });

    it("should be retryable for 5xx", () => {
      const error = new ApiError("Server error", 500);
      expect(error.details.retryable).toBe(true);
    });

    it("should not be retryable for 4xx", () => {
      const error = new ApiError("Not found", 404);
      expect(error.details.retryable).toBe(false);
    });

    it("should be retryable for 429", () => {
      const error = new ApiError("Rate limited", 429);
      expect(error.details.retryable).toBe(true);
    });
  });

  describe("ConfigError", () => {
    it("should not be retryable", () => {
      const error = new ConfigError("Missing API key");
      expect(error.details.retryable).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("should store field and value", () => {
      const error = new ValidationError("Invalid input", "email", "invalid-email");
      expect(error.field).toBe("email");
      expect(error.value).toBe("invalid-email");
    });
  });

  describe("AuthError", () => {
    it("should not be retryable", () => {
      const error = new AuthError("Unauthorized");
      expect(error.details.retryable).toBe(false);
    });
  });

  describe("RateLimitError", () => {
    it("should store retryAfter", () => {
      const error = new RateLimitError("Rate limited", 60);
      expect(error.retryAfter).toBe(60);
      expect(error.details.retryAfter).toBe(60);
    });
  });

  describe("isBenignError", () => {
    it("should detect benign errors", () => {
      expect(isBenignError(new Error("session id not found"))).toBe(true);
      expect(isBenignError(new Error("configuration is empty"))).toBe(true);
      expect(isBenignError(new Error("data is undefined"))).toBe(true);
    });

    it("should return false for serious errors", () => {
      expect(isBenignError(new Error("Database connection failed"))).toBe(false);
      expect(isBenignError(new Error("API timeout"))).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable ExtensionErrors", () => {
      const error = new NetworkError("Failed");
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for non-retryable ExtensionErrors", () => {
      const error = new ConfigError("Missing config");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should detect retryable plain errors", () => {
      const error = new Error("Network error");
      error.code = "ECONNREFUSED";
      expect(isRetryableError(error)).toBe(true);
    });

    it("should detect retryable status codes", () => {
      const error = new Error("API error");
      error.status = 503;
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe("wrapError", () => {
    it("should return ExtensionError as-is", () => {
      const original = new NetworkError("Network error");
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it("should wrap 401 as AuthError", () => {
      const error = new Error("Unauthorized");
      error.status = 401;
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(AuthError);
    });

    it("should wrap 429 as RateLimitError", () => {
      const error = new Error("Too many requests");
      error.status = 429;
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(RateLimitError);
    });

    it("should wrap network codes as NetworkError", () => {
      const error = new Error("Connection failed");
      error.code = "ECONNREFUSED";
      const wrapped = wrapError(error);

      expect(wrapped).toBeInstanceOf(NetworkError);
    });
  });

  describe("logError", () => {
    it("should log ValidationError at debug level", () => {
      const error = new ValidationError("Invalid input", "field", "value");
      logError(error, { operation: "test" });

      expect(logger.debug).toHaveBeenCalled();
    });

    it("should log NetworkError at warn level", () => {
      const error = new NetworkError("Network failed");
      logError(error, { operation: "test" });

      expect(logger.warn).toHaveBeenCalled();
    });

    it("should log ConfigError at error level", () => {
      const error = new ConfigError("Missing config");
      logError(error, { operation: "test" });

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("getFriendlyErrorMessage", () => {
    it("should return friendly message for NetworkError", () => {
      const error = new NetworkError("Connection failed");
      const message = getFriendlyErrorMessage(error);

      expect(message).toContain("Network error");
    });

    it("should return friendly message for ApiError", () => {
      const error = new ApiError("Server error", 500);
      const message = getFriendlyErrorMessage(error);

      expect(message).toContain("temporarily unavailable");
    });

    it("should return friendly message for AuthError", () => {
      const error = new AuthError("Unauthorized");
      const message = getFriendlyErrorMessage(error);

      expect(message).toContain("API key");
    });

    it("should return friendly message for RateLimitError", () => {
      const error = new RateLimitError("Too many requests", 60);
      const message = getFriendlyErrorMessage(error);

      expect(message).toContain("Too many requests");
    });

    it("should return fallback for unknown errors", () => {
      const message = getFriendlyErrorMessage(new Error("Unknown"), "Custom fallback");

      expect(message).toBe("Custom fallback");
    });
  });
});
