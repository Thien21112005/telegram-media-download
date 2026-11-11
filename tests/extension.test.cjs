const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { launchWithExtension, openTelegram } = require('./extension-helpers.cjs');

test('extension loads, opens its side panel page and injects the content script', async () => {
  const { context, worker, extensionId, cleanup } = await launchWithExtension();
  try {
    assert.match(worker.url(), /\/background\.js$/);

    // A tab that is not Telegram shows how to start.
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    const ownTab = await panel.evaluate(async () => (await chrome.tabs.getCurrent()).id);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html?tab=${ownTab}`);
    await panel.locator('#empty-action').waitFor();
    assert.equal(await panel.locator('#empty-title').textContent(), 'Open Telegram Web to start');
    assert.equal(await panel.locator('#empty-action').textContent(), 'Open Telegram Web');

    const page = await openTelegram(context);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-tel-dl-bridge')), true);
  } finally {
    await cleanup();
  }
});

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

const { webK } = require('./fixtures.cjs');
const reviewDir = path.join(__dirname, '../.impeccable/review');

test('side panel lists chat media by day and downloads a selected day into the chat folder', async () => {
  const { context, extensionId, downloadDir, cleanup } = await launchWithExtension();
  try {
    const page = await openTelegram(context, webK('https://web.telegram.org/media/'));
    const panel = await context.newPage();
    const cdp = await context.newCDPSession(panel);
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'default' });
    await panel.setViewportSize({ width: 360, height: 640 });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    const tabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://web.telegram.org/*' }))[0].id);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html?tab=${tabId}`);
    await panel.locator('.tile').nth(2).waitFor();

    assert.equal(await panel.locator('#chat-title').textContent(), 'Holiday photos');
    assert.deepEqual(await panel.locator('.day-head h2').allTextContents(), ['12 August']);
    assert.equal(await panel.locator('.tile').count(), 3);
    assert.equal(await panel.locator('.here').count(), 1, "the reader's place is marked");
    await panel.locator('[data-filter="video"]').click();
    assert.equal(await panel.locator('.tile').count(), 1);
    await panel.locator('[data-filter="all"]').click();

    // Media further down the chat is added as the chat scrolls.
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await panel.locator('.tile').nth(3).waitFor();
    assert.deepEqual(await panel.locator('.day-head h2').allTextContents(), ['12 August', '14 August']);

    fs.mkdirSync(reviewDir, { recursive: true });
    await panel.locator('.day-head button').first().click();
    assert.equal(await panel.locator('#bar-summary').textContent(), '3 selected');
    await panel.screenshot({ path: path.join(reviewDir, 'sidepanel-selected.png') });

    await panel.locator('#download').click();
    await panel.waitForFunction(() => document.querySelector('#bar-summary').textContent === 'Finished 3 of 3', null, { timeout: 30000 });
    assert.deepEqual(await panel.locator('.tile[data-state="handedOff"]').count(), 3);
    await panel.screenshot({ path: path.join(reviewDir, 'sidepanel-finished.png') });
    await panel.emulateMedia({ colorScheme: 'dark' });
    await panel.screenshot({ path: path.join(reviewDir, 'sidepanel-dark.png') });

    const folder = path.join(downloadDir, 'Telegram', 'Holiday photos');
    for (let i = 0; i < 50 && (!fs.existsSync(folder) || fs.readdirSync(folder).filter(f => !f.endsWith('.crdownload')).length < 3); i++) {
      await panel.waitForTimeout(100);
    }
    assert.deepEqual(fs.readdirSync(folder).sort(), ['clip-12.mp4', 'full-10.jpg', 'full-11.jpg']);
  } finally {
    await cleanup();
  }
});

test('options page saves settings and credits the original author', async () => {
  const { context, extensionId, cleanup } = await launchWithExtension();
  try {
    const options = await context.newPage();
    await options.setViewportSize({ width: 720, height: 900 });
    await options.goto(`chrome-extension://${extensionId}/options/index.html`);
    await options.locator('#language option').nth(1).waitFor({ state: 'attached' });
    await options.selectOption('#concurrency', '3');
    await options.locator('#folder').fill('Archive/{chat}');
    await options.locator('#folder').press('Tab');
    await options.locator('#ask').uncheck();
    await options.locator('#saved').filter({ hasText: 'Saved' }).waitFor();
    const stored = await options.evaluate(() => chrome.storage.sync.get(null));
    assert.deepEqual(
      { concurrency: stored.concurrency, folderTemplate: stored.folderTemplate, askWhereToSave: stored.askWhereToSave },
      { concurrency: 3, folderTemplate: 'Archive/{chat}', askWhereToSave: false },
    );
    assert.match(await options.locator('#about-credit').textContent(), /Nestor Qin/);
    await options.selectOption('#language', 'vi');
    await options.locator('#title').filter({ hasText: 'Cài đặt' }).waitFor();
    fs.mkdirSync(reviewDir, { recursive: true });
    await options.screenshot({ path: path.join(reviewDir, 'options.png'), fullPage: true });
  } finally {
    await cleanup();
  }
});

test('side panel says how many items were lost when the chat closes mid-batch', async () => {
  const { context, extensionId, cleanup } = await launchWithExtension();
  try {
    const page = await openTelegram(context, webK('https://web.telegram.org/media/'));
    const panel = await context.newPage();
    await panel.setViewportSize({ width: 360, height: 640 });
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    const tabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://web.telegram.org/*' }))[0].id);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html?tab=${tabId}`);
    await panel.locator('.tile').nth(2).waitFor();
    assert.equal(await panel.locator('#notice').isVisible(), false);
    await panel.locator('#select-all').click();
    await panel.locator('#download').click();
    await page.evaluate(() => closeChat());
    await panel.locator('#notice').waitFor({ state: 'visible', timeout: 10000 });
    assert.match(await panel.locator('#notice').textContent(), /download stopped because the chat changed\. [1-3] not downloaded/);
    fs.mkdirSync(reviewDir, { recursive: true });
    await panel.waitForTimeout(300);
    await panel.screenshot({ path: path.join(reviewDir, 'sidepanel-interrupted.png') });
  } finally {
    await cleanup();
  }
});

test('side panel tile switches to the sharp preview when it arrives', async () => {
  const { webKLazy } = require('./fixtures.cjs');
  const { context, extensionId, cleanup } = await launchWithExtension();
  try {
    const page = await openTelegram(context, webKLazy);
    const panel = await context.newPage();
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    const tabId = await panel.evaluate(async () => (await chrome.tabs.query({ url: 'https://web.telegram.org/*' }))[0].id);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html?tab=${tabId}`);
    const tile = panel.locator('.tile').first();
    await tile.waitFor();
    await panel.waitForFunction(() => document.querySelector('.tile').style.backgroundImage !== '');
    const blurry = await tile.evaluate(element => element.style.backgroundImage);
    await page.evaluate(() => sharpen());
    await panel.waitForFunction(before => document.querySelector('.tile').style.backgroundImage !== before, blurry, { timeout: 10000 });
  } finally {
    await cleanup();
  }
});
