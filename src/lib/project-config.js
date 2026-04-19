/**
 * Per-project configuration, loaded from .gemini/.supermemory/config.json
 * Allows project-specific backend/provider settings, API keys and scope
 * overrides without changing the global Gemini extension install.
 */

import fs from "node:fs";
import path from "node:path";
import { getGitRoot } from "./git-utils.js";

const CONFIG_DIR_NAME = ".supermemory";
const CONFIG_FILE_NAME = "config.json";

function findConfigPath(cwd = process.cwd()) {
  const gitRoot = getGitRoot(cwd);
  const basePath = gitRoot || cwd;

  // Check .gemini/.supermemory/config.json first
  const geminiPath = path.join(
    basePath,
    ".gemini",
    CONFIG_DIR_NAME,
    CONFIG_FILE_NAME
  );
  if (fs.existsSync(geminiPath)) return geminiPath;

  // Fallback: .supermemory/config.json in project root
  const rootPath = path.join(basePath, CONFIG_DIR_NAME, CONFIG_FILE_NAME);
  if (fs.existsSync(rootPath)) return rootPath;

  return null;
}

export function loadProjectConfig(cwd = process.cwd()) {
  const configPath = findConfigPath(cwd);
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

export function getProjectMemoryConfig(cwd = process.cwd()) {
  const config = loadProjectConfig(cwd);

  return {
    provider: readOptionalString(config?.provider),
    apiKey: readOptionalString(config?.apiKey),
    apiUrl: readOptionalString(config?.apiUrl),
    personalContainerTag: readOptionalString(config?.personalContainerTag),
    repoContainerTag: readOptionalString(config?.repoContainerTag),
  };
}

export function getProjectApiKey(cwd = process.cwd()) {
  return getProjectMemoryConfig(cwd).apiKey;
}

export function getProjectContainerOverrides(cwd = process.cwd()) {
  const config = getProjectMemoryConfig(cwd);
  return {
    personalContainerTag: config.personalContainerTag,
    repoContainerTag: config.repoContainerTag,
  };
}
