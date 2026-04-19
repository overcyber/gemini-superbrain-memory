/**
 * Per-project configuration with a hardened trust model.
 * By default, project-local config files are NOT auto-loaded.
 * Local per-project config is only enabled when the user explicitly opts in.
 *
 * When enabled, the preferred files are:
 * - .gemini/.supermemory/config.local.json
 * - .supermemory/config.local.json
 *
 * Legacy repo-shared config.json files are ignored unless the user
 * explicitly opts in via GEMINI_SUPERMEMORY_TRUST_PROJECT_CONFIG=true.
 */

import fs from "node:fs";
import path from "node:path";
import { getGitRoot } from "./git-utils.js";

const CONFIG_DIR_NAME = ".supermemory";
const LOCAL_CONFIG_FILE_NAME = "config.local.json";
const LEGACY_CONFIG_FILE_NAME = "config.json";

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function shouldAllowLocalProjectConfig(env = process.env) {
  return isTruthy(env.GEMINI_SUPERMEMORY_ALLOW_LOCAL_PROJECT_CONFIG);
}

function shouldTrustTrackedProjectConfig(env = process.env) {
  return isTruthy(env.GEMINI_SUPERMEMORY_TRUST_PROJECT_CONFIG);
}

function getConfigCandidates(basePath, allowLocalProjectConfig, allowTrackedProjectConfig) {
  const candidates = [];

  if (allowLocalProjectConfig) {
    candidates.push(
      path.join(basePath, ".gemini", CONFIG_DIR_NAME, LOCAL_CONFIG_FILE_NAME),
      path.join(basePath, CONFIG_DIR_NAME, LOCAL_CONFIG_FILE_NAME),
    );
  }

  if (allowTrackedProjectConfig) {
    candidates.push(
      path.join(basePath, ".gemini", CONFIG_DIR_NAME, LEGACY_CONFIG_FILE_NAME),
      path.join(basePath, CONFIG_DIR_NAME, LEGACY_CONFIG_FILE_NAME),
    );
  }

  return candidates;
}

function findConfigPath(cwd = process.cwd(), env = process.env) {
  const gitRoot = getGitRoot(cwd);
  const basePath = gitRoot || cwd;
  const allowLocalProjectConfig = shouldAllowLocalProjectConfig(env);
  const allowTrackedProjectConfig = shouldTrustTrackedProjectConfig(env);

  for (const candidatePath of getConfigCandidates(
    basePath,
    allowLocalProjectConfig,
    allowTrackedProjectConfig,
  )) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    return candidatePath;
  }

  return null;
}

export function loadProjectConfig(cwd = process.cwd(), env = process.env) {
  const configPath = findConfigPath(cwd, env);
  if (!configPath) return null;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readOptionalString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function getProjectMemoryConfig(cwd = process.cwd(), env = process.env) {
  const config = loadProjectConfig(cwd, env);

  return {
    provider: readOptionalString(config?.provider),
    apiKey: readOptionalString(config?.apiKey),
    apiUrl: readOptionalString(config?.apiUrl),
    personalContainerTag: readOptionalString(config?.personalContainerTag),
    repoContainerTag: readOptionalString(config?.repoContainerTag),
  };
}

export function getProjectApiKey(cwd = process.cwd(), env = process.env) {
  return getProjectMemoryConfig(cwd, env).apiKey;
}

export function getProjectContainerOverrides(cwd = process.cwd(), env = process.env) {
  const config = getProjectMemoryConfig(cwd, env);
  return {
    personalContainerTag: config.personalContainerTag,
    repoContainerTag: config.repoContainerTag,
  };
}
