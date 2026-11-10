// Loads the real unpacked extension into Chromium with a throwaway profile.
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


// Serves a fake Telegram page; same-origin /media/ requests get a small file of the matching type.
const openTelegram = async (context, body = '') => {
  const page = await context.newPage();
  await page.route('**/*', route => {
    const url = route.request().url();
    if (route.request().isNavigationRequest()) {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><title>Telegram</title><body>${body}</body>` });
    }
    if (url.startsWith('https://web.telegram.org/media/')) {
      const type = url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
      return route.fulfill({ status: 206, headers: { 'Content-Type': type, 'Content-Range': 'bytes 0-2/3' }, body: 'abc' });
    }
    return route.abort();
  });
  await page.goto('https://web.telegram.org/k/');
  await page.locator('#tel-downloader-progress-bar-container').waitFor({ state: 'attached', timeout: 10000 });
  return page;
};


module.exports = { launchWithExtension, openTelegram, extensionPath };
