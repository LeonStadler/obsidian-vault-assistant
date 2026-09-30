import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["ui/vault-setup.js"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
}).then(async (result) => {
  const html = await readFile("ui/vault-setup.html", "utf8");
  const marker = "<script>__VAULT_SETUP_BUNDLE__</script>";
  if (!html.includes(marker)) throw new Error("Vault setup bundle marker is missing from ui/vault-setup.html.");
  const bundledScript = result.outputFiles[0].text.replace(/^[\t ]+$/gm, "");
  const bundledHtml = html.replace(marker, "<script>" + bundledScript + "</script>");
  await writeFile("ui/vault-setup.bundle.html", bundledHtml);
});
