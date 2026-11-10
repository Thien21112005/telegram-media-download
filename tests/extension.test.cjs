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
  // Keep downloads inside the throwaway profile instead of the user's Downloads folder.
  const downloadDir = path.join(profile, 'downloads');
  fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
  fs.writeFileSync(path.join(profile, 'Default', 'Preferences'),
    JSON.stringify({ download: { default_directory: downloadDir, prompt_for_download: false } }));
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
    return { context, worker, extensionId: new URL(worker.url()).host, downloadDir, cleanup };
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

    const page = await openTelegram(context);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-tel-dl-bridge')), true);
  } finally {
    await cleanup();
  }
});

// Serves a fake Telegram page; same-origin /media/ requests get a small JPEG response.
const openTelegram = async (context, body = '') => {
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Telegram</title><body>${body}</body>` });
    }
    if (url.startsWith('https://web.telegram.org/media/')) {
      return route.fulfill({ status: 206, headers: { 'Content-Type': 'image/jpeg', 'Content-Range': 'bytes 0-2/3' }, body: 'abc' });
    }
    return route.abort();
  });
  await page.goto('https://web.telegram.org/k/');
  await page.locator('#tel-downloader-progress-bar-container').waitFor({ state: 'attached', timeout: 10000 });
  return page;
};

test('settings saved by the extension reach open Telegram tabs', async () => {
  const { context, extensionId, cleanup } = await launchWithExtension();
  try {
    const page = await openTelegram(context);
    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    await extensionPage.evaluate(() => chrome.storage.sync.set({ language: 'vi' }));
    await page.waitForFunction(() => document.querySelector('#tel-downloader-progress-bar-container').lang === 'vi');

    // Choosing a language in the page panel is saved for the whole extension.
    await page.locator('#tel-downloader-progress-bar-container').evaluate(panel => { panel.hidden = false; });
    await page.locator('.tel-settings-toggle').click();
    await page.selectOption('#tel-download-language', 'ru');
    for (let i = 0; i < 50 && await extensionPage.evaluate(async () => (await chrome.storage.sync.get("language")).language) !== "ru"; i++) {
      await extensionPage.waitForTimeout(100);
    }
    assert.equal(await extensionPage.evaluate(async () => (await chrome.storage.sync.get("language")).language), "ru");
  } finally {
    await cleanup();
  }
});

test('downloads are saved into the configured subfolder', async () => {
  const { context, extensionId, downloadDir, cleanup } = await launchWithExtension();
  try {
    const extensionPage = await context.newPage();
    // Playwright normally captures downloads, which bypasses the extension's
    // filename hook. Hand downloads back to the browser for this test.
    const cdp = await context.newCDPSession(extensionPage);
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'default' });
    await extensionPage.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    await extensionPage.evaluate(() => chrome.storage.sync.set({ folderTemplate: 'TG Test/{chat}' }));
    const page = await openTelegram(context);
    await page.evaluate(() => TelCore.setChatTitleProvider(() => 'My: Chat?'));
    await page.waitForFunction(() => TelCore.resolveFolder() === 'TG Test/My_ Chat_');
    const result = await page.evaluate(() => TelCore.downloadMedia('https://web.telegram.org/media/photo.jpg', 'image'));
    assert.equal(result.state, 'handedOff');
    let item;
    for (const start = Date.now(); !item?.filename && Date.now() - start < 10000;) {
      item = await extensionPage.evaluate(async () => (await chrome.downloads.search({ filenameRegex: "photo" }))[0]);
      if (!item?.filename) await extensionPage.waitForTimeout(100);
    }
    assert.match(item.filename.replace(/\\/g, '/'), /\/TG Test\/My_ Chat_\/photo\.jpg$/);
  } finally {
    await cleanup();
  }
});
