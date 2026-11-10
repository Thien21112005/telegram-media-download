// Renders extension/icons/icon.svg to the PNG sizes Chrome needs.
// Usage: node scripts/render-icons.mjs   (set TEL_TEST_BROWSER to use a local Chrome)
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const svg = await readFile(new URL("../extension/icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEL_TEST_BROWSER ? { executablePath: process.env.TEL_TEST_BROWSER } : {}),
});
try {
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`
    );
    await page.screenshot({
      path: new URL(`../extension/icons/icon-${size}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
