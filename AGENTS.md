# Repository Guidelines

## Project Structure & Module Organization
`src/` is the source of truth. `src/server.js` exposes the MCP server, `src/hooks/` contains the `SessionStart` and `SessionEnd` entrypoints, and `src/lib/` holds shared helpers such as config loading, tag generation, validation, git utilities, and the memory backend clients. `commands/index.toml` defines the `/index` Gemini command. `hooks/hooks.json` and `gemini-extension.json` wire the built files into Gemini CLI. `dist/` contains bundled output generated from `src/`; do not edit it by hand.

## Build, Test, and Development Commands
- `npm install` installs the extension dependencies.
- `npm run build` bundles `src/server.js` and both hook entrypoints into `dist/` with esbuild.
- `gemini extensions link .` links the repository into a local Gemini CLI install for manual testing.
- `gemini extensions config gemini-superbrain-memory` updates the stored backend API key during local verification.

## Coding Style & Naming Conventions
Use ESM only: `import`/`export`, double quotes, semicolons, and explicit `.js` extensions in relative imports. Follow the existing 4-space indentation used in `src/`. Keep utility modules in `src/lib/` small and focused. Use `camelCase` for functions, `PascalCase` for classes, and `kebab-case` for filenames such as `supermemory-client.js` and `session-start.js`.

## Testing Guidelines
There is no automated test suite or `npm test` script yet. For now, validate changes by running `npm run build`, linking the extension locally, and exercising the MCP tools (`search_memory`, `add_memory`, `save_project_memory`) plus the `/index` command. When adding logic-heavy code, prefer extracting pure helpers in `src/lib/` so they are easy to cover once a test runner is introduced.

## Commit & Pull Request Guidelines
Recent history favors short, imperative subjects and mostly follows Conventional Commit prefixes such as `feat:`, `fix:`, and `chore:`. Keep using that style, for example `fix: validate empty memory search queries`. Pull requests should explain the user-visible change, list any config or hook behavior changes, and note the manual verification steps you ran. Include screenshots only when README or UX-facing documentation changes.

## Security & Configuration Tips
Never commit live memory-backend credentials. Use the Gemini extension config flow or backend-specific environment variables instead. Repo-specific overrides belong in `.gemini/.supermemory/config.json`, which should stay local unless you are intentionally documenting a safe example.
