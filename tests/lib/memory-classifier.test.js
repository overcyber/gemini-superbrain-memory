/**
 * Tests for memory-classifier.js
 */

import { describe, it, expect } from "vitest";
import { guessMemorySector } from "../../src/lib/memory-classifier.js";

describe("guessMemorySector", () => {
  describe("episodic sector", () => {
    it("should detect episodic keywords in English", () => {
      const content = "Today I worked on the auth flow";
      const sector = guessMemorySector(content);

      expect(sector).toBe("episodic");
    });

    it("should detect episodic keywords in Portuguese", () => {
      const content = "Hoje trabalhei no sistema de autenticação";
      const sector = guessMemorySector(content);

      expect(sector).toBe("episodic");
    });

    it("should detect session indicators", () => {
      const content = "Session ID: abc123\nSummary: Did some work";
      const sector = guessMemorySector(content);

      expect(sector).toBe("episodic");
    });
  });

  describe("semantic sector", () => {
    it("should detect semantic keywords in English", () => {
      const content = "The architecture uses a monorepo structure";
      const sector = guessMemorySector(content);

      expect(sector).toBe("semantic");
    });

    it("should detect semantic keywords in Portuguese", () => {
      const content = "A arquitetura usa monorepo com turborepo";
      const sector = guessMemorySector(content);

      expect(sector).toBe("semantic");
    });
  });

  describe("procedural sector", () => {
    it("should detect procedural keywords in English", () => {
      const content = "How to deploy the application to production";
      const sector = guessMemorySector(content);

      expect(sector).toBe("procedural");
    });

    it("should detect procedural keywords in Portuguese", () => {
      const content = "Como executar os testes do projeto";
      const sector = guessMemorySector(content);

      expect(sector).toBe("procedural");
    });
  });

  describe("emotional sector", () => {
    it("should detect emotional keywords in English", () => {
      const content = "I felt frustrated with the debugging process";
      const sector = guessMemorySector(content);

      expect(sector).toBe("emotional");
    });

    it("should detect emotional keywords in Portuguese", () => {
      const content = "Fiquei feliz com o resultado final";
      const sector = guessMemorySector(content);

      expect(sector).toBe("emotional");
    });
  });

  describe("reflective sector", () => {
    it("should detect reflective keywords in English", () => {
      const content = "I learned that React Server Components improve performance";
      const sector = guessMemorySector(content);

      expect(sector).toBe("reflective");
    });

    it("should detect reflective keywords in Portuguese", () => {
      const content = "Percebi que o código precisa ser refatorado";
      const sector = guessMemorySector(content);

      expect(sector).toBe("reflective");
    });
  });

  describe("fallback behavior", () => {
    it("should use fallback sector for empty content", () => {
      const sector = guessMemorySector("", { fallbackSector: "semantic" });
      expect(sector).toBe("semantic");
    });

    it("should use fallback sector for no matches", () => {
      const sector = guessMemorySector("xyz abc 123", { fallbackSector: "procedural" });
      expect(sector).toBe("procedural");
    });
  });

  describe("scope influence", () => {
    it("should prefer semantic for repo scope", () => {
      const content = "Some generic information";
      const sector = guessMemorySector(content, { scope: "repo" });

      expect(sector).toBe("semantic");
    });

    it("should prefer semantic for repo scope", () => {
      const content = "Some generic information";
      const sector = guessMemorySector(content, { scope: "repo", fallbackSector: "semantic" });

      expect(sector).toBe("semantic");
    });
  });
});
