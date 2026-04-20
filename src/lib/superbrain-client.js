import crypto from "node:crypto";
import { DEFAULT_SEARCH_LIMIT, loadConfig } from "./config.js";
import { getProjectBasePath } from "./container-tag.js";
import { SanitizeContent, ValidateContentLength } from "./validate.js";
import { fetchWithRetry } from "./retry.js";
import { createLogger, withContext } from "./logger.js";
import { wrapError, ApiError, NetworkError } from "./errors.js";

const GEMINI_SKILL_NAMESPACE = "gemini-cli:skill:gemini-superbrain-memory";
const PROJECT_FINGERPRINT_LENGTH = 16;

function dedupeBy(items, getKey) {
  const seen = new Set();

  return items.filter((item) => {
    const key = String(getKey(item) ?? "").trim().toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function sanitizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTags(values = []) {
  return dedupeBy(
    values
      .flat()
      .map((value) => sanitizeTag(value))
      .filter(Boolean),
    (value) => value,
  );
}

function normalizeTimestamp(value) {
  if (!value) return null;

  try {
    return new Date(value).toISOString();
  } catch {
    return null;
  }
}

function toStableUuid(input) {
  const hex = crypto.createHash("sha256").update(String(input)).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8).join(""),
    hex.slice(8, 12).join(""),
    hex.slice(12, 16).join(""),
    hex.slice(16, 20).join(""),
    hex.slice(20, 32).join(""),
  ].join("-");
}

function toProjectFingerprint(input) {
  return crypto
    .createHash("sha256")
    .update(String(input))
    .digest("hex")
    .slice(0, PROJECT_FINGERPRINT_LENGTH);
}

function normalizeSearchResult(result) {
  return {
    id: result?.id ?? null,
    text: result?.content ?? "",
    kind: result?.sector ?? "memory",
    chunk: null,
    context: null,
    documents: [],
    updatedAt: normalizeTimestamp(result?.createdAt),
    metadata: {
      sector: result?.sector ?? null,
      tags: Array.isArray(result?.tags) ? result.tags : [],
      summary: result?.summary ?? null,
      title: result?.title ?? null,
      importanceScore:
        typeof result?.importanceScore === "number" ? result.importanceScore : null,
      strength: typeof result?.strength === "number" ? result.strength : null,
    },
    similarity: typeof result?.similarity === "number" ? result.similarity : null,
    sector: result?.sector ?? null,
  };
}

function buildMemoryTags({ containerTag, metadata = {}, customId, tags = [] }) {
  const scopedTags = [
    "source:gemini-superbrain-memory",
    containerTag ? `scope:${sanitizeTag(containerTag)}` : null,
    metadata?.type ? `type:${sanitizeTag(metadata.type)}` : null,
    metadata?.project ? `project:${sanitizeTag(metadata.project)}` : null,
    customId ? `custom:${sanitizeTag(customId)}` : null,
    ...tags,
  ];

  return normalizeTags(scopedTags);
}

function createHttpError(status, bodyText, fallbackMessage) {
  let message = fallbackMessage;

  try {
    const parsed = JSON.parse(bodyText);
    message =
      parsed?.message ??
      parsed?.error ??
      parsed?.details?.[0]?.message ??
      fallbackMessage;
  } catch {
    if (bodyText?.trim()) {
      message = bodyText.trim();
    }
  }

  return wrapError({ message, status }, fallbackMessage);
}

export class SuperbrainClient {
  constructor({ apiKey, containerTag, apiUrl } = {}, cwd = process.cwd()) {
    const config = loadConfig(
      {
        ...process.env,
        ...(apiKey !== undefined ? { SUPERBRAIN_API_KEY: apiKey } : {}),
        ...(apiUrl !== undefined ? { SUPERBRAIN_API_URL: apiUrl } : {}),
        ...(containerTag !== undefined
          ? { SUPERMEMORY_CONTAINER_TAG: containerTag }
          : {}),
      },
      cwd,
      "superbrain",
    );

    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl.replace(/\/+$/, "");
    this.containerTag = containerTag ?? config.containerTag;
    this.cwd = cwd;
    this.basePath = getProjectBasePath(cwd);
    this.projectFingerprint = toProjectFingerprint(this.basePath);
    this.logger = createLogger({ component: "SuperbrainClient" });
  }

  getScopeTag(containerTag) {
    return containerTag ?? this.containerTag;
  }

  resolveUserId(containerTag) {
    const scopeTag = this.getScopeTag(containerTag);
    return toStableUuid(
      `${GEMINI_SKILL_NAMESPACE}|base:${this.basePath}|scope:${scopeTag}`,
    );
  }

  getScopeContext(containerTag) {
    const scopeTag = this.getScopeTag(containerTag);
    const userId = this.resolveUserId(scopeTag);

    return {
      scopeTag,
      userId,
      projectFingerprint: this.projectFingerprint,
      namespace: GEMINI_SKILL_NAMESPACE,
    };
  }

  async request(path, { method = "GET", userId, query, body } = {}) {
    const url = new URL(path, `${this.apiUrl}/`);

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const requestLogger = withContext(this.logger, {
      operation: "request",
      method,
      path,
    });

    requestLogger.debug({ url: url.href, method, hasBody: !!body }, "Making API request");

    try {
      const response = await fetchWithRetry(
        url,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": this.apiKey,
            "X-User-ID": userId,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        { maxRetries: 3, baseDelay: 1000 },
      );

      if (!response.ok) {
        const bodyText = await response.text();
        const error = createHttpError(
          response.status,
          bodyText,
          `SuperBrain API request failed with ${response.status}`,
        );
        requestLogger.warn({ status: response.status }, "API request failed");
        throw error;
      }

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};
      requestLogger.debug({ status: response.status }, "API request succeeded");
      return result;
    } catch (err) {
      requestLogger.error({ error: err.message }, "API request error");
      throw err;
    }
  }

  async addMemory(
    content,
    { containerTag, metadata = {}, customId, entityContext, sector, tags = [] } = {},
  ) {
    const sanitizedContent = SanitizeContent(content);
    const contentCheck = ValidateContentLength(sanitizedContent);

    if (!contentCheck.valid) {
      this.logger.warn({ reason: contentCheck.reason }, "Invalid memory content");
      throw new Error(`Invalid memory content: ${contentCheck.reason}`);
    }

    const scope = this.getScopeContext(containerTag);
    const payload = {
      content: sanitizedContent,
      source: "gemini-superbrain-memory",
      context: {
        containerTag: scope.scopeTag,
        superbrainUserId: scope.userId,
        namespace: scope.namespace,
        projectFingerprint: scope.projectFingerprint,
        customId: customId ?? null,
        entityContext: entityContext ?? null,
        metadata,
      },
      tags: buildMemoryTags({
        containerTag: scope.scopeTag,
        metadata,
        customId,
        tags,
      }),
    };

    if (sector) {
      payload.sector = sector;
    }

    this.logger.debug(
      { sector, customId, containerTag: scope.scopeTag },
      "Adding memory",
    );

    const response = await this.request(sector ? "memory" : "memory/auto", {
      method: "POST",
      userId: scope.userId,
      body: payload,
    });
    const data = response?.data ?? {};

    this.logger.info({ memoryId: data.memoryId, sector: data.sector }, "Memory saved");

    return {
      id: data.memoryId ?? customId ?? null,
      status: response?.success ? "saved" : "unknown",
      containerTag: scope.scopeTag,
      userId: scope.userId,
      sector: data.sector ?? sector ?? null,
    };
  }

  async search(
    query,
    {
      containerTag,
      limit = DEFAULT_SEARCH_LIMIT,
      tags,
      threshold,
      minSimilarity = threshold,
      sector,
    } = {},
  ) {
    const normalizedQuery = typeof query === "string" ? query.trim() : "";

    if (!normalizedQuery) {
      this.logger.warn({}, "Empty search query");
      throw new Error("Search query must be a non-empty string");
    }

    this.logger.debug(
      { queryLength: normalizedQuery.length, limit, sector },
      "Searching memories",
    );

    const response = await this.request(sector ? "search/sector" : "search", {
      method: "POST",
      userId: this.resolveUserId(containerTag),
      body: {
        query: normalizedQuery,
        limit,
        ...(sector ? { sector } : {}),
        ...(typeof minSimilarity === "number"
          ? { minSimilarity }
          : {}),
        ...(tags?.length ? { tags: normalizeTags(tags) } : {}),
      },
    });

    const results = Array.isArray(response?.data?.results)
      ? response.data.results
      : [];

    this.logger.debug({ resultCount: results.length }, "Search completed");

    return {
      results: dedupeBy(
        results.map(normalizeSearchResult).filter((item) => item.text),
        (item) => item.id || `${item.sector}:${item.text}`,
      ),
      total: response?.data?.count ?? results.length,
      timing: null,
    };
  }

  async getRecentMemories({ containerTag, limit = 5, sector, tags } = {}) {
    const query = {
      limit,
      ...(sector ? { sector } : {}),
      ...(tags?.length ? { tags: normalizeTags(tags).join(",") } : {}),
    };

    this.logger.debug({ limit, sector }, "Fetching recent memories");

    const response = await this.request("memory", {
      method: "GET",
      userId: this.resolveUserId(containerTag),
      query,
    });

    const results = Array.isArray(response?.data?.results)
      ? response.data.results
      : [];

    return {
      results: dedupeBy(
        results
          .map((result) => normalizeSearchResult({ ...result, similarity: 1 }))
          .filter((item) => item.text),
        (item) => item.id || `${item.sector}:${item.text}`,
      ),
      total: response?.data?.count ?? results.length,
      timing: null,
    };
  }

  formatProfileFact(result) {
    const sector = result?.sector ?? result?.metadata?.sector;
    const label = sector ? `[${sector}] ` : "";
    return `${label}${result.text}`;
  }

  async getProfile({ containerTag, query, threshold } = {}) {
    this.logger.debug({ hasQuery: !!query }, "Building profile");

    const [recentResult, relevantResult] = await Promise.all([
      this.getRecentMemories({ containerTag, limit: 8 }),
      query
        ? this.search(query, {
            containerTag,
            limit: 6,
            minSimilarity: threshold,
          })
        : Promise.resolve({ results: [], total: 0, timing: null }),
    ]);

    const recent = recentResult.results;
    const staticFacts = recent
      .filter((item) =>
        ["semantic", "procedural", "reflective"].includes(
          item.sector ?? item.metadata?.sector,
        ),
      )
      .map((item) => this.formatProfileFact(item))
      .slice(0, 5);
    const dynamicFacts = recent
      .filter((item) =>
        ["episodic", "emotional"].includes(item.sector ?? item.metadata?.sector),
      )
      .map((item) => this.formatProfileFact(item))
      .slice(0, 5);

    this.logger.debug(
      { staticCount: staticFacts.length, dynamicCount: dynamicFacts.length },
      "Profile built",
    );

    return {
      profile: {
        static: dedupeBy(staticFacts, (item) => item),
        dynamic: dedupeBy(dynamicFacts, (item) => item),
      },
      searchResults: relevantResult,
    };
  }
}

export default SuperbrainClient;
