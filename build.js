import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  minify: true,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["src/server.js"],
    outfile: "dist/server.js",
  }),
  build({
    ...shared,
    entryPoints: ["src/hooks/session-start.js"],
    outfile: "dist/hooks/session-start.js",
  }),
  build({
    ...shared,
    entryPoints: ["src/hooks/session-end.js"],
    outfile: "dist/hooks/session-end.js",
  }),
]);

console.log("Built dist/server.js, dist/hooks/session-start.js, dist/hooks/session-end.js");
