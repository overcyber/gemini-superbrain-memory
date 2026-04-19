import { loadConfig } from "./config.js";
import { SuperbrainClient } from "./superbrain-client.js";

export function createMemoryClient({ cwd = process.cwd() } = {}) {
  const config = loadConfig(process.env, cwd);

  return new SuperbrainClient(
    {
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
      containerTag: config.containerTag,
    },
    cwd,
  );
}

export default createMemoryClient;
