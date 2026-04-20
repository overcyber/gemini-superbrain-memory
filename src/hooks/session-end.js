#!/usr/bin/env node

/**
 * SessionEnd hook — auto-saves a session summary to the configured memory backend
 * when the Gemini CLI session ends.
 *
 * Reads: stdin JSON (session metadata from Gemini CLI)
 * Writes: stdout JSON (empty — advisory hook)
 * Env: SUPERMEMORY_API_KEY, GEMINI_CWD, GEMINI_SESSION_ID
 */

import { getContainerContext } from "../lib/container-tag.js";
import { createMemoryClient } from "../lib/memory-client.js";
import { createLogger } from "../lib/logger.js";
import { logError, getFriendlyErrorMessage } from "../lib/errors.js";

const logger = createLogger({ component: "SessionEndHook" });

const PERSONAL_ENTITY_CONTEXT = `Developer coding session. Focus on USER intent.

EXTRACT:
- Actions: "built auth flow with JWT", "fixed memory leak in useEffect"
- Preferences: "prefers Tailwind over CSS modules"
- Decisions: "chose SQLite for local storage"
- Learnings: "learned about React Server Components"

SKIP:
- Every fact assistant mentions (condense to user's action)
- Generic assistant explanations user didn't confirm/use`;

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
    const input = await readStdin();

    const sessionId = process.env.GEMINI_SESSION_ID || input.session_id;
    if (!sessionId) {
      logger.debug({}, "No session ID, skipping");
      output({});
      return;
    }

    const cwd = process.env.GEMINI_CWD || process.cwd();
    const { personalTag, projectName } = getContainerContext(cwd);

    logger.info({ sessionId, projectName }, "Session end hook triggered");

    // Build a summary from whatever session data is available
    const parts = [];
    parts.push(`Session in project: ${projectName}`);
    parts.push(`Session ID: ${sessionId}`);
    parts.push(`Timestamp: ${new Date().toISOString()}`);

    if (input.summary) {
      parts.push(`\nSummary:\n${input.summary}`);
    }
    if (input.transcript) {
      // If Gemini CLI provides transcript text, include it
      const trimmed =
        input.transcript.length > 50000
          ? input.transcript.slice(-50000)
          : input.transcript;
      parts.push(`\nTranscript:\n${trimmed}`);
    }

    const content = parts.join("\n");

    const client = createMemoryClient({ cwd });
    const sessionTag = `session:${sessionId}`;

    if (typeof client.getRecentMemories === "function") {
      const existing = await client.getRecentMemories({
        containerTag: personalTag,
        limit: 1,
        sector: "episodic",
        tags: [sessionTag],
      });

      if (existing?.results?.length) {
        logger.debug({ sessionId }, "Session already saved, skipping");
        console.error(`Memory backend: Session ${sessionId} already saved`);
        output({});
        return;
      }
    }

    await client.addMemory(content, {
      containerTag: personalTag,
      metadata: {
        type: "session_summary",
        project: projectName,
        sessionId,
        timestamp: new Date().toISOString(),
      },
      customId: `session_${sessionId}`,
      entityContext: PERSONAL_ENTITY_CONTEXT,
      sector: "episodic",
      tags: [sessionTag, "scope:personal", "kind:session-summary"],
    });

    logger.info({ sessionId, projectName }, "Session saved successfully");
    console.error(`Memory backend: Session saved for ${projectName}`);
    output({});
  } catch (err) {
    logError(err, { component: "SessionEndHook" });
    console.error(`Memory backend: ${getFriendlyErrorMessage(err)}`);
    output({});
  }
}

main();
