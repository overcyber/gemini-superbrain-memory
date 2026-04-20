/**
 * Zod schemas for input validation.
 */

import { z } from "zod";

/**
 * Sanitized container tag format.
 */
const containerTagSchema = z
  .string()
  .min(1, "Container tag cannot be empty")
  .max(100, "Container tag too long")
  .regex(/^[a-zA-Z0-9:_-]+$/, "Container tag must contain only letters, numbers, colons, underscores, and hyphens")
  .transform((val) => val.trim().toLowerCase());

/**
 * Session ID format.
 */
const sessionIdSchema = z
  .string()
  .min(1, "Session ID cannot be empty")
  .max(200, "Session ID too long")
  .transform((val) => val.trim());

/**
 * Memory sector.
 */
const sectorSchema = z.enum(["episodic", "semantic", "procedural", "emotional", "reflective"], {
  errorMap: () => ({ message: "Sector must be one of: episodic, semantic, procedural, emotional, reflective" }),
});

/**
 * Memory scope.
 */
const scopeSchema = z.enum(["user", "repo", "both"], {
  errorMap: () => ({ message: "Scope must be one of: user, repo, both" }),
});

/**
 * Memory tag.
 */
const tagSchema = z
  .string()
  .min(1, "Tag cannot be empty")
  .max(100, "Tag too long")
  .transform((val) => val.trim().toLowerCase());

/**
 * Project name.
 */
const projectNameSchema = z
  .string()
  .min(1, "Project name cannot be empty")
  .max(200, "Project name too long")
  .transform((val) => val.trim());

/**
 * Session input from Gemini CLI.
 */
export const sessionInputSchema = z.object({
  session_id: sessionIdSchema.optional(),
  summary: z
    .string()
    .max(10000, "Summary too long (max 10000 characters)")
    .optional(),
  transcript: z
    .string()
    .max(500000, "Transcript too long (max 500000 characters)")
    .optional(),
});

/**
 * Search memory input.
 */
export const searchMemorySchema = z.object({
  query: z
    .string()
    .max(500, "Search query too long")
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "Search query cannot be empty"),
  scope: scopeSchema.default("both"),
  limit: z
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(50, "Limit cannot exceed 50")
    .default(5)
    .optional(),
  sector: sectorSchema.optional(),
  threshold: z
    .number()
    .min(0, "Threshold cannot be negative")
    .max(1, "Threshold cannot exceed 1")
    .optional(),
});

/**
 * Add memory input.
 */
export const addMemorySchema = z.object({
  content: z
    .string()
    .max(10000, "Memory content too long (max 10000 characters)")
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "Memory content cannot be empty"),
  sector: sectorSchema.optional(),
  tags: z.array(tagSchema).default([]).optional(),
});

/**
 * Save project memory input.
 */
export const saveProjectMemorySchema = z.object({
  content: z
    .string()
    .max(10000, "Memory content too long (max 10000 characters)")
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, "Memory content cannot be empty"),
  sector: sectorSchema.optional(),
  tags: z.array(tagSchema).default([]).optional(),
});

/**
 * Memory metadata.
 */
export const memoryMetadataSchema = z.object({
  type: z.string().optional(),
  project: projectNameSchema.optional(),
  sessionId: sessionIdSchema.optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * Container context.
 */
export const containerContextSchema = z.object({
  personalTag: containerTagSchema,
  repoTag: containerTagSchema,
  projectName: projectNameSchema,
});

/**
 * Client configuration.
 */
export const clientConfigSchema = z.object({
  apiKey: z
    .string()
    .min(1, "API key cannot be empty")
    .optional(),
  apiUrl: z
    .string()
    .url("API URL must be a valid URL")
    .optional(),
  containerTag: containerTagSchema.optional(),
  provider: z.enum(["superbrain", "supermemory"]).optional(),
});

/**
 * Validation error with context.
 */
export class ValidationError extends Error {
  constructor(errors, zodError) {
    super("Validation failed");
    this.name = "ValidationError";
    this.errors = errors;
    this.zodError = zodError;
  }

  /**
   * Format errors as a readable string.
   */
  toString() {
    if (!this.errors || !Array.isArray(this.errors)) {
      return this.message || "Validation failed";
    }
    return this.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
  }
}

/**
 * Validate data against a schema and throw ValidationError if invalid.
 * @param {z.ZodSchema} schema - Zod schema
 * @param {*} data - Data to validate
 * @returns {Promise<*>} Validated data
 * @throws {ValidationError} If validation fails
 */
export async function validateAndThrow(schema, data) {
  const result = await schema.safeParseAsync(data);

  if (!result.success) {
    const errors = result.error.errors;
    throw new ValidationError(errors, result.error);
  }

  return result.data;
}

/**
 * Validate data synchronously against a schema.
 * @param {z.ZodSchema} schema - Zod schema
 * @param {*} data - Data to validate
 * @returns {*} Validated data or null if invalid
 */
export function validateSync(schema, data) {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

export default {
  sessionInputSchema,
  searchMemorySchema,
  addMemorySchema,
  saveProjectMemorySchema,
  memoryMetadataSchema,
  containerContextSchema,
  clientConfigSchema,
  ValidationError,
  validateAndThrow,
  validateSync,
};
