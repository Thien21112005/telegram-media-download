// Syntax-checks every script and validates the manifest and locale files.
import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const list = async (dir) => (await readdir(dir, { withFileTypes: true, recursive: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name));

const files = [...await list(path.join(root, "extension")), ...await list(path.join(root, "scripts"))];
for (const file of files.filter((f) => /\.(m?js)$/.test(f))) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const manifest = JSON.parse(await readFile(path.join(root, "extension/manifest.json"), "utf8"));
const keys = new Set(JSON.stringify(manifest).match(/__MSG_(\w+)__/g).map((m) => m.slice(6, -2)));
const referenced = keys;
const locales = await readdir(path.join(root, "extension/_locales"));
let failed = false;
for (const locale of locales) {
  const messages = JSON.parse(await readFile(path.join(root, "extension/_locales", locale, "messages.json"), "utf8"));
  for (const key of referenced) {
    if (!messages[key]?.message) {
      console.error(`_locales/${locale} is missing "${key}"`);
      failed = true;
    }
  }
  if (messages.extDescription?.message.length > 132) {
    console.error(`_locales/${locale} extDescription exceeds 132 characters`);
    failed = true;
  }
}
if (!locales.includes(manifest.default_locale)) {
  console.error(`default_locale "${manifest.default_locale}" has no _locales folder`);
  failed = true;
}
for (const icon of Object.values(manifest.icons)) {
  await readFile(path.join(root, "extension", icon));
}
if (failed) process.exit(1);
console.log(`Checked ${files.length} files and ${locales.length} locales.`);
