# Gemini-SuperBrain-Memory

A [Gemini CLI](https://github.com/google-gemini/gemini-cli) extension that gives your AI **persistent memory across sessions** using **SuperBrain/OpenMemory**, with legacy `supermemory` support still available.
Your agent remembers what you worked on across sessions and across projects.

## Features

- **Persistent Memory** — Memories saved across sessions, automatically loaded when you start
- **Team Memory** — Project knowledge shared across your team, separate from personal memories
- **Auto Capture** — Sessions saved automatically when they end
- **Auto Load** — Past context injected when a new session starts
- **Codebase Indexing** — Deep-scan a repo's architecture and save it to memory
- **Project Config** — Per-repo backend settings and scope overrides

## Installation

```bash
gemini extensions install https://github.com/overcyber/gemini-superbrain-memory
```

Set the API key for your configured memory backend when prompted.

## How It Works

Your extension exposes **3 MCP tools** that Gemini calls automatically:

| Tool | Description |
| --- | --- |
| `search_memory` | Search past memories and coding sessions |
| `add_memory` | Save personal memories (decisions, preferences, learnings) |
| `save_project_memory` | Save team/project knowledge (architecture, conventions) |

Plus **two lifecycle hooks** that run behind the scenes:

| Hook | Trigger | What it does |
| --- | --- | --- |
| **SessionStart** | Session begins | Fetches your past memories and injects them as context |
| **SessionEnd** | Session ends | Saves a summary of the session to the configured memory backend |

## Commands

| Command | Description |
| --- | --- |
| `/index` | Index codebase architecture and patterns into the configured memory backend |

## Configuration

**API Key** — Set during installation, stored securely in system keychain.

To update it:
```bash
gemini extensions config gemini-superbrain-memory
```

Or set via environment variable:
```bash
export MEMORY_PROVIDER="superbrain"
export SUPERBRAIN_API_URL="http://localhost:8082/api/v1"
export SUPERBRAIN_API_KEY="dev-key-123"
```

---

**Project Config** — Create `.gemini/.supermemory/config.json` in your repo root. The `.supermemory` path is kept for backward compatibility:

```json
{
  "provider": "superbrain",
  "apiUrl": "http://localhost:8082/api/v1",
  "apiKey": "dev-key-123",
  "personalContainerTag": "my-personal-tag",
  "repoContainerTag": "my-team-project"
}
```

| Option | Description |
| --- | --- |
| `provider` | `superbrain` or `supermemory` |
| `apiUrl` | Project-specific backend URL |
| `apiKey` | Project-specific API key |
| `personalContainerTag` | Override personal memory container |
| `repoContainerTag` | Override team memory container |

## Examples

**Search memories:**
> "What did I work on yesterday?"
> "How did we implement auth?"

**Save memories:**
> "Remember that I prefer ESM imports over CommonJS"
> "Save project knowledge: this project uses MCP for tool integration"

**Index codebase:**
> `/index`

## Architecture

```
gemini-superbrain-memory/
├── gemini-extension.json    ← Extension manifest
├── GEMINI.md                ← Context instructions for Gemini
├── hooks/
│   └── hooks.json           ← SessionStart/End hook config
├── commands/
│   └── index.toml           ← /index codebase scanning command
└── src/
    ├── server.js             ← MCP server (3 tools)
    ├── hooks/
    │   ├── session-start.js  ← Auto-load memories
    │   └── session-end.js    ← Auto-save sessions
    └── lib/
        ├── superbrain-client.js   ← SuperBrain/OpenMemory client
        ├── memory-client.js       ← Provider factory
        ├── memory-classifier.js   ← Sector guessing for saved memories
        ├── supermemory-client.js  ← Legacy Supermemory SDK wrapper
        ├── container-tag.js       ← Container tag generation
        ├── config.js              ← Global config loader
        ├── project-config.js      ← Per-repo config loader
        ├── format-context.js      ← Memory formatting
        ├── error-helper.js        ← Error handling
        ├── git-utils.js           ← Git helpers
        └── validate.js            ← Input validation
```

## Development

```bash
# Clone and install
git clone https://github.com/overcyber/gemini-superbrain-memory.git
cd gemini-superbrain-memory
npm install

# Link for local development
gemini extensions link .
```

## License

MIT
