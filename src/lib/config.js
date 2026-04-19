import { validateContainerTag } from "./validate.js";
import { getProjectMemoryConfig } from "./project-config.js";

export const DEFAULT_CONTAINER_TAG = "gemini_default";
export const DEFAULT_SUPERBRAIN_API_URL =
  process.env.SUPERBRAIN_API_URL ?? "http://localhost:8082/api/v1";
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_SEARCH_MODE = "hybrid";

const SUPPORTED_PROVIDERS = new Set(["superbrain"]);

function readOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function validateRequiredBackendToken(label, token) {
  if (!token || typeof token !== "string") {
    return ""; // Retorna vazio em vez de lançar erro
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
        `Unsupported memory provider "${requested}". Supported providers: superbrain`,
      );
    }

    return requested;
  }

  return "superbrain";
}

export function loadConfig(env = process.env, cwd = process.cwd(), explicitProvider) {
  const projectConfig = getProjectMemoryConfig(cwd, env);
  const provider = resolveProvider(explicitProvider, projectConfig, env);
  const containerTag = validateDefaultContainerTag(
    readOptionalString(env.SUPERMEMORY_CONTAINER_TAG) ?? DEFAULT_CONTAINER_TAG,
  );
  const searchLimit = DEFAULT_SEARCH_LIMIT;
  const searchMode = DEFAULT_SEARCH_MODE;

  const apiKey = validateRequiredBackendToken(
    "SuperBrain API key",
    projectConfig.apiKey ??
      readOptionalString(env.SUPERBRAIN_API_KEY) ??
      readOptionalString(env.SUPERMEMORY_API_KEY),
  );
  const apiUrl =
    projectConfig.apiUrl ??
    readOptionalString(env.SUPERBRAIN_API_URL) ??
    readOptionalString(env.SUPERMEMORY_API_URL) ??
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

export default loadConfig;
