import { build } from "esbuild";

const sharedOptions = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  minify: true,
  legalComments: "none",
  banner: {
    js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
  },
};

await Promise.all([
  build({ ...sharedOptions, entryPoints: ["src/core/configure-cli.ts"], outfile: "scripts/configure-vault.bundle.mjs" }),
  build({ ...sharedOptions, entryPoints: ["src/core/scope.ts"], outfile: "scripts/vault-scope.bundle.mjs" }),
  build({
    ...sharedOptions,
    entryPoints: ["scripts/vault-mcp-server.mjs"],
    outfile: "scripts/vault-mcp-server.bundle.mjs",
  }),
  build({
    ...sharedOptions,
    entryPoints: ["node_modules/@modelcontextprotocol/server-filesystem/dist/index.js"],
    outfile: "scripts/filesystem-server.bundle.mjs",
    banner: {
      js: "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);",
    },
  }),
]);
