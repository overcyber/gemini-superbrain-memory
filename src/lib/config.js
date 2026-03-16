import { ValidateApiKey, validateContainerTag } from "./validate.js";

export const DEFAULT_CONTAINER_TAG = "gemini_default";
export const DEFAULT_API_URL = process.env.SUPERMEMORY_API_URL ?? "https://api.supermemory.ai";
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_SEARCH_MODE = "hybrid";

function readOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function validateRequiredApiKey(apiKey) {
  const keyCheck = ValidateApiKey(apiKey);

  if (!keyCheck.valid) {
    throw new Error(`Invalid Supermemory API key: ${keyCheck.reason}`);
  }

  return apiKey;
}

function validateDefaultContainerTag(containerTag) {
  const tagCheck = validateContainerTag(containerTag);

  if (!tagCheck.valid) {
    throw new Error(`Invalid default container tag: ${tagCheck.reason}`);
  }

  return containerTag;
}

export function loadConfig(env = process.env) {
  const apiKey = validateRequiredApiKey(readOptionalString(env.SUPERMEMORY_API_KEY));
  const apiUrl = readOptionalString(env.SUPERMEMORY_API_URL) ?? DEFAULT_API_URL;
  const containerTag = validateDefaultContainerTag(
    readOptionalString(env.SUPERMEMORY_CONTAINER_TAG) ?? DEFAULT_CONTAINER_TAG,
  );
  const searchLimit = DEFAULT_SEARCH_LIMIT;
  const searchMode = DEFAULT_SEARCH_MODE;

  return {
    apiKey,
    apiUrl,
    containerTag,
    searchLimit,
    searchMode,
  };
}

export default loadConfig;
