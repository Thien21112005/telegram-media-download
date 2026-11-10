const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright-core');

const extensionPath = path.join(__dirname, '../extension');

// Loads the unpacked extension the same way a user does with "Load unpacked".
const launchWithExtension = async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'tel-ext-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: process.env.TEL_TEST_BROWSER ? undefined : 'chromium',
    ...(process.env.TEL_TEST_BROWSER ? { executablePath: process.env.TEL_TEST_BROWSER } : {}),
    headless: true,
    args: [
      // Branded Chrome 137+ ignores --load-extension unless this switch is re-enabled.
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });
  const cleanup = async () => {
    await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 10000 });
    return { context, worker, extensionId: new URL(worker.url()).host, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

test('extension loads, opens its side panel page and injects the content script', async () => {
  const { context, worker, extensionId, cleanup } = await launchWithExtension();
  try {
    assert.match(worker.url(), /\/background\.js$/);

    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    assert.equal(await panel.locator('h1').textContent(), 'Telegram Media Downloader');
    assert.ok((await panel.locator('p').textContent()).length > 0);

    const page = await context.newPage();
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Telegram</title><body></body>' })
      : route.abort());
    await page.goto('https://web.telegram.org/k/');
    await page.locator('#tel-downloader-progress-bar-container').waitFor({ state: 'attached', timeout: 10000 });
  } finally {
    await cleanup();
  }
});
