import { loadConfig } from "./config.js";
import { SuperbrainClient } from "./superbrain-client.js";
import { SupermemoryClient } from "./supermemory-client.js";

export function createMemoryClient({ cwd = process.cwd() } = {}) {
  const config = loadConfig(process.env, cwd);

  if (config.provider === "superbrain") {
    return new SuperbrainClient(
      {
        apiKey: config.apiKey,
        apiUrl: config.apiUrl,
        containerTag: config.containerTag,
      },
      cwd,
    );
  }

  return new SupermemoryClient(
    {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      containerTag: config.containerTag,
    },
    cwd,
  );
}

export default createMemoryClient;
