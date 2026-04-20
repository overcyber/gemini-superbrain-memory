/**
 * Tests for schemas.js
 */

import { describe, it, expect } from "vitest";
import {
  sessionInputSchema,
  searchMemorySchema,
  addMemorySchema,
  saveProjectMemorySchema,
  memoryMetadataSchema,
  containerContextSchema,
  clientConfigSchema,
  validateAndThrow,
  validateSync,
  ValidationError,
} from "../../src/lib/schemas.js";

describe("schemas", () => {
  describe("sessionInputSchema", () => {
    it("should validate valid session input", () => {
      const input = {
        session_id: "test-session-123",
        summary: "Test session",
        transcript: "User did something",
      };

      const result = validateSync(sessionInputSchema, input);
      expect(result).toBeDefined();
      expect(result.session_id).toBe("test-session-123");
    });

    it("should accept optional fields", () => {
      const result = validateSync(sessionInputSchema, {});
      expect(result).toBeDefined();
    });

    it("should trim session_id", () => {
      const result = validateSync(sessionInputSchema, { session_id: "  test-session  " });
      expect(result.session_id).toBe("test-session");
    });

    it("should reject oversized summary", () => {
      const result = validateSync(sessionInputSchema, {
        summary: "x".repeat(10001),
      });

      expect(result).toBeNull();
    });

    it("should reject oversized transcript", () => {
      const result = validateSync(sessionInputSchema, {
        transcript: "x".repeat(500001),
      });

      expect(result).toBeNull();
    });
  });

  describe("searchMemorySchema", () => {
    it("should validate valid search input", () => {
      const input = {
        query: "test query",
        scope: "user",
        limit: 10,
      };

      const result = validateSync(searchMemorySchema, input);
      expect(result).toBeDefined();
      expect(result.query).toBe("test query");
      expect(result.scope).toBe("user");
    });

    it("should use default scope", () => {
      const result = validateSync(searchMemorySchema, { query: "test" });
      expect(result.scope).toBe("both");
    });

    it("should trim query", () => {
      const result = validateSync(searchMemorySchema, { query: "  test query  " });
      expect(result.query).toBe("test query");
    });

    it("should reject empty query", () => {
      const result = validateSync(searchMemorySchema, { query: "  " });
      expect(result).toBeNull();
    });

    it("should reject invalid scope", () => {
      const result = validateSync(searchMemorySchema, {
        query: "test",
        scope: "invalid",
      });

      expect(result).toBeNull();
    });

    it("should reject limit out of range", () => {
      const result1 = validateSync(searchMemorySchema, { query: "test", limit: 0 });
      expect(result1).toBeNull();

      const result2 = validateSync(searchMemorySchema, { query: "test", limit: 100 });
      expect(result2).toBeNull();
    });
  });

  describe("addMemorySchema", () => {
    it("should validate valid memory", () => {
      const input = {
        content: "Test memory content",
        sector: "semantic",
        tags: ["tag1", "tag2"],
      };

      const result = validateSync(addMemorySchema, input);
      expect(result).toBeDefined();
      expect(result.content).toBe("Test memory content");
    });

    it("should use defaults", () => {
      const result = validateSync(addMemorySchema, { content: "test" });
      expect(result.tags).toEqual([]);
    });

    it("should trim content", () => {
      const result = validateSync(addMemorySchema, { content: "  test content  " });
      expect(result.content).toBe("test content");
    });

    it("should reject invalid sector", () => {
      const result = validateSync(addMemorySchema, {
        content: "test",
        sector: "invalid",
      });

      expect(result).toBeNull();
    });

    it("should reject empty content", () => {
      const result = validateSync(addMemorySchema, { content: "  " });
      expect(result).toBeNull();
    });
  });

  describe("saveProjectMemorySchema", () => {
    it("should validate valid project memory", () => {
      const input = {
        content: "Project knowledge",
        sector: "procedural",
      };

      const result = validateSync(saveProjectMemorySchema, input);
      expect(result).toBeDefined();
      expect(result.content).toBe("Project knowledge");
    });
  });

  describe("memoryMetadataSchema", () => {
    it("should validate valid metadata", () => {
      const input = {
        type: "session_summary",
        project: "test-project",
        sessionId: "session-123",
        timestamp: "2024-01-01T00:00:00.000Z",
      };

      const result = validateSync(memoryMetadataSchema, input);
      expect(result).toBeDefined();
      expect(result.project).toBe("test-project");
    });

    it("should accept optional fields", () => {
      const result = validateSync(memoryMetadataSchema, {});
      expect(result).toBeDefined();
    });

    it("should reject invalid timestamp", () => {
      const result = validateSync(memoryMetadataSchema, {
        timestamp: "not-a-datetime",
      });

      expect(result).toBeNull();
    });
  });

  describe("containerContextSchema", () => {
    it("should validate valid container context", () => {
      const input = {
        personalTag: "personal-tag",
        repoTag: "repo-tag",
        projectName: "Test Project",
      };

      const result = validateSync(containerContextSchema, input);
      expect(result).toBeDefined();
    });

    it("should normalize tags to lowercase", () => {
      const result = validateSync(containerContextSchema, {
        personalTag: "Personal-Tag",
        repoTag: "REPO-TAG",
        projectName: "Test Project",
      });

      expect(result.personalTag).toBe("personal-tag");
      expect(result.repoTag).toBe("repo-tag");
    });

    it("should reject invalid tag characters", () => {
      const result = validateSync(containerContextSchema, {
        personalTag: "invalid@tag!",
        repoTag: "repo-tag",
        projectName: "Test Project",
      });

      expect(result).toBeNull();
    });
  });

  describe("clientConfigSchema", () => {
    it("should validate valid config", () => {
      const input = {
        apiKey: "test-key",
        apiUrl: "https://api.example.com",
        provider: "superbrain",
      };

      const result = validateSync(clientConfigSchema, input);
      expect(result).toBeDefined();
    });

    it("should accept optional fields", () => {
      const result = validateSync(clientConfigSchema, {});
      expect(result).toBeDefined();
    });

    it("should reject invalid URL", () => {
      const result = validateSync(clientConfigSchema, {
        apiUrl: "not-a-url",
      });

      expect(result).toBeNull();
    });

    it("should reject invalid provider", () => {
      const result = validateSync(clientConfigSchema, {
        provider: "invalid",
      });

      expect(result).toBeNull();
    });
  });

  describe("validateAndThrow", () => {
    it("should return validated data on success", async () => {
      const result = await validateAndThrow(searchMemorySchema, {
        query: "test",
      });

      expect(result.query).toBe("test");
    });

    it("should throw ValidationError on failure", async () => {
      await expect(
        validateAndThrow(searchMemorySchema, { query: "" })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("ValidationError", () => {
    it("should format error message", async () => {
      let error;

      try {
        await validateAndThrow(searchMemorySchema, { query: "" });
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBeTruthy();
    });
  });
});
