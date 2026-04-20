#!/usr/bin/env node

/**
 * SessionStart hook — auto-loads memories from the configured backend and injects them
 * into the Gemini CLI context. Runs automatically when a session begins.
 *
 * Reads: stdin JSON (session metadata from Gemini CLI)
 * Writes: stdout JSON with systemMessage containing recalled memories
 * Env: SUPERMEMORY_API_KEY, GEMINI_CWD, GEMINI_SESSION_ID
 */

import { getContainerContext } from "../lib/container-tag.js";
import {
  formatProfileContext,
  combineContextSections,
} from "../lib/format-context.js";
import { createMemoryClient } from "../lib/memory-client.js";
import { createLogger } from "../lib/logger.js";
import { logError, getFriendlyErrorMessage, isBenignError } from "../lib/errors.js";

const logger = createLogger({ component: "SessionStartHook" });

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(data.trim() ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
    if (process.stdin.isTTY) resolve({});
  });
}

function output(json) {
  process.stdout.write(JSON.stringify(json));
}

async function main() {
  try {
    await readStdin();

    const cwd = process.env.GEMINI_CWD || process.cwd();
    const { personalTag, repoTag, projectName } = getContainerContext(cwd);

    logger.info({ cwd, projectName }, "Session start hook triggered");

    const client = createMemoryClient({ cwd });

    const handleError = (label) => (err) => {
      logError(err, { component: "SessionStartHook", label });
      if (isBenignError(err)) return null;
      return null;
    };

    const [personalResult, repoResult] = await Promise.all([
      client
        .getProfile({ containerTag: personalTag, query: projectName })
        .catch(handleError("personal context")),
      client
        .getProfile({ containerTag: repoTag, query: projectName })
        .catch(handleError("project context")),
    ]);

    const personalContext = formatProfileContext(personalResult, 5);
    const repoContext = formatProfileContext(repoResult, 5);

    const combined = combineContextSections([
      { label: "Personal Memories", content: personalContext },
      { label: "Project Knowledge (Shared)", content: repoContext },
    ]);

    if (combined) {
      logger.debug({ hasPersonal: !!personalContext, hasRepo: !!repoContext }, "Context loaded");
      output({ systemMessage: combined });
    } else {
      logger.debug({}, "No context loaded");
      output({});
    }
  } catch (err) {
    logError(err, { component: "SessionStartHook" });
    output({});
  }
}

main();
