import { ValidateApiKey, validateContainerTag } from "./validate.js";
import { getProjectMemoryConfig } from "./project-config.js";

export const DEFAULT_CONTAINER_TAG = "gemini_default";
export const DEFAULT_SUPERMEMORY_API_URL =
  process.env.SUPERMEMORY_API_URL ?? "https://api.supermemory.ai";
export const DEFAULT_SUPERBRAIN_API_URL =
  process.env.SUPERBRAIN_API_URL ?? "http://localhost:8082/api/v1";
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_SEARCH_MODE = "hybrid";

const SUPPORTED_PROVIDERS = new Set(["supermemory", "superbrain"]);

function readOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function validateRequiredSupermemoryApiKey(apiKey) {
  const keyCheck = ValidateApiKey(apiKey);

  if (!keyCheck.valid) {
    throw new Error(`Invalid Supermemory API key: ${keyCheck.reason}`);
  }

  return apiKey;
}

function validateRequiredBackendToken(label, token) {
  if (!token || typeof token !== "string") {
    throw new Error(`${label} is missing or not a string`);
  }

  if (!token.trim()) {
    throw new Error(`${label} must not be empty`);
  }

  return token.trim();
}

function validateDefaultContainerTag(containerTag) {
  const tagCheck = validateContainerTag(containerTag);

  if (!tagCheck.valid) {
    throw new Error(`Invalid default container tag: ${tagCheck.reason}`);
  }

  return containerTag;
}

function resolveProvider(explicitProvider, projectConfig, env) {
  const requested =
    readOptionalString(explicitProvider) ??
    projectConfig.provider ??
    readOptionalString(env.MEMORY_PROVIDER);

  if (requested) {
    if (!SUPPORTED_PROVIDERS.has(requested)) {
      throw new Error(
        `Unsupported memory provider "${requested}". Supported providers: supermemory, superbrain`,
      );
    }

    return requested;
  }

  const hasSuperbrainUrlHint =
    Boolean(projectConfig.apiUrl) &&
    /\/api\/v1|localhost:8082|127\.0\.0\.1:8082/i.test(projectConfig.apiUrl);
  const hasSuperbrainHint =
    hasSuperbrainUrlHint ||
    Boolean(readOptionalString(env.SUPERBRAIN_API_URL)) ||
    Boolean(readOptionalString(env.SUPERBRAIN_API_KEY));

  return hasSuperbrainHint ? "superbrain" : "supermemory";
}

export function loadConfig(env = process.env, cwd = process.cwd(), explicitProvider) {
  const projectConfig = getProjectMemoryConfig(cwd);
  const provider = resolveProvider(explicitProvider, projectConfig, env);
  const containerTag = validateDefaultContainerTag(
    readOptionalString(env.SUPERMEMORY_CONTAINER_TAG) ?? DEFAULT_CONTAINER_TAG,
  );
  const searchLimit = DEFAULT_SEARCH_LIMIT;
  const searchMode = DEFAULT_SEARCH_MODE;

  if (provider === "superbrain") {
    const apiKey = validateRequiredBackendToken(
      "SuperBrain API key",
      projectConfig.apiKey ??
        readOptionalString(env.SUPERBRAIN_API_KEY) ??
        readOptionalString(env.SUPERMEMORY_API_KEY),
    );
    const apiUrl =
      projectConfig.apiUrl ??
      readOptionalString(env.SUPERBRAIN_API_URL) ??
      DEFAULT_SUPERBRAIN_API_URL;

    return {
      provider,
      apiKey,
      apiUrl,
      containerTag,
      searchLimit,
      searchMode,
    };
  }

  const apiKey = validateRequiredSupermemoryApiKey(
    projectConfig.apiKey ?? readOptionalString(env.SUPERMEMORY_API_KEY),
  );
  const apiUrl =
    projectConfig.apiUrl ??
    readOptionalString(env.SUPERMEMORY_API_URL) ??
    DEFAULT_SUPERMEMORY_API_URL;

  return {
    provider,
    apiKey,
    apiUrl,
    containerTag,
    searchLimit,
    searchMode,
  };
}

export default loadConfig;
