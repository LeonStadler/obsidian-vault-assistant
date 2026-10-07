import { build } from "esbuild";

await build({
  entryPoints: ["obsidian-plugin/src/main.js"],
  outfile: "obsidian-plugin/main.js",
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2020",
  external: ["obsidian"],
  sourcemap: false,
  minify: true,
});
