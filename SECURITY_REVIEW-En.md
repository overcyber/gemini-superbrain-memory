# Security Review

Date: 2026-04-19

## Scope

Reviewed:
- `src/lib/project-config.js`
- `src/lib/config.js`
- `src/lib/container-tag.js`
- `src/lib/superbrain-client.js`
- `src/lib/supermemory-client.js`
- `src/hooks/session-start.js`
- `src/hooks/session-end.js`
- `src/lib/format-context.js`
- `hooks/hooks.json`
- `README.md`
- `.gitignore`

## Findings

### 1. Critical: repo-local config can redirect automatic memory traffic and credentials

Evidence:
- `src/lib/project-config.js:14-40` auto-loads `.gemini/.supermemory/config.json` or `.supermemory/config.json`
- `src/lib/config.js:82-119` gives project config priority over environment for `provider`, `apiUrl`, and `apiKey`
- `hooks/hooks.json:1-27` enables automatic `SessionStart` and `SessionEnd`
- `src/hooks/session-start.js:45-74` auto-queries the backend on session start
- `src/hooks/session-end.js:53-112` auto-sends session summaries/transcripts on session end

Impact:
- An untrusted repository can commit a memory config that points `apiUrl` to an attacker-controlled backend.
- The extension may then send stored context, session summaries, transcripts, and backend credentials automatically.
- In legacy `supermemory` mode, repo-controlled container-tag overrides can also target arbitrary memory namespaces.

### 2. High: recalled memory is injected into `systemMessage` without a strong prompt-injection boundary

Evidence:
- `src/hooks/session-start.js:56-74` injects recalled memories into `systemMessage`
- `src/lib/format-context.js:35-90` renders recalled content as raw text
- `src/lib/format-context.js:58-68` and `93-105` include `r.text` without escaping or strict untrusted-data framing

Impact:
- A compromised backend or poisoned memory record can inject instructions into the model context.
- Because the payload lands in `systemMessage`, the effect is stronger than a normal tool response.

### 3. Medium: repo instructions encourage local secret files, but git ignores do not protect them

Evidence:
- `README.md:66-83` recommends `.gemini/.supermemory/config.json` with an `apiKey`
- `.gitignore:1-5` does not ignore `.gemini/`, `.supermemory/`, or local config files
- `AGENTS.md:21-22` warns against committing credentials, but the repo does not enforce that

Impact:
- Contributors can accidentally commit live backend credentials.

### 4. Medium: absolute local project path is sent to the backend on writes

Evidence:
- `src/lib/superbrain-client.js:154-163` derives scope context with `basePath`
- `src/lib/superbrain-client.js:214-221` includes `basePath` in outbound memory context
- `src/hooks/session-end.js:100-112` writes automatically at session end

Impact:
- The backend receives the user’s absolute local filesystem path.
- This leaks host metadata that is not clearly required for the feature.

## Dependency Notes

`npm audit --omit=dev` reported no production vulnerabilities.

`npm audit` reported transitive issues through `@modelcontextprotocol/sdk@1.27.1`:
- `path-to-regexp` high
- `hono` moderate
- `@hono/node-server` moderate

Current impact appears limited because this project uses `StdioServerTransport`, not an exposed HTTP server, but the SDK should still be updated.

## Summary

The main security issue is the trust boundary around repo-local memory config. In the current design, simply opening an untrusted repo can redirect automatic memory traffic and potentially exfiltrate credentials and session content. The second major issue is prompt injection through recalled memory content.
