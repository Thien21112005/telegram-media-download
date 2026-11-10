// Captures the side panel and options page in every state into .impeccable/review/
// for design review. Usage: node scripts/capture-review.cjs
// (set TEL_TEST_BROWSER to use Edge or another Chromium build).
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { launchWithExtension, openTelegram } = require('../tests/extension-helpers.cjs');

const out = path.join(__dirname, '../.impeccable/review');
fs.mkdirSync(out, { recursive: true });

// Solid-colour 8x8 PNGs stand in for photos (labelled demo content).
const png = (r, g, b) => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(8, 0); header.writeUInt32BE(8, 4); header[8] = 8; header[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(8).fill([r, g, b]).flat())]);
  const raw = Buffer.concat(Array(8).fill(row));
  return 'data:image/png;base64,' + Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
};
const colors = [[94, 129, 172], [191, 144, 103], [113, 160, 122], [176, 112, 132], [104, 150, 168], [206, 170, 92], [128, 112, 168], [84, 120, 98]];
const tile = (mid, i, video) => `<div class="bubble" data-mid="${mid}"><div class="attachment"><img class="media-photo" src="${png(...colors[i % colors.length])}" style="width:110px;height:80px;display:block">${video ? `<span class="video-time">0:${String(10 + i).padStart(2, '0')}</span>` : ''}</div></div>`;
const day = (label, start, count) => `<section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">${label}</div></div>${
  Array.from({ length: count }, (_, i) => tile(start + i, start + i, (start + i) % 3 === 1)).join('')}</section>`;
const chat = (title, body) => `<div class="chat-info"><span class="peer-title">${title}</span></div><div class="bubbles">${body}</div>`;
const demo = chat('Mountain trip 2026 (demo)', day('12 August', 100, 8) + day('13 August', 108, 6));
const photosOnly = chat('Photos only (demo)', `<section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">2 May</div></div>${tile(1, 0, false)}${tile(2, 2, false)}</section>`);

const openPanel = async (context, extensionId, telegramPage, { width = 360, height = 640, dark = false, init } = {}) => {
  const panel = await context.newPage();
  await panel.setViewportSize({ width, height });
  if (dark) await panel.emulateMedia({ colorScheme: 'dark' });
  if (init) await panel.addInitScript(init);
  let tab = '';
  if (telegramPage) {
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    const url = telegramPage.url();
    tab = await panel.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, url);
  } else {
    await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
    tab = await panel.evaluate(async () => (await chrome.tabs.getCurrent()).id);
  }
  await panel.goto(`chrome-extension://${extensionId}/sidepanel/index.html?tab=${tab}`);
  return panel;
};
const settle = (page) => page.waitForTimeout(600);
const shot = async (page, name) => {
  await settle(page);
  await page.screenshot({ path: path.join(out, name) });
  console.log('captured', name);
};
// Task states are sent from the page through the real bridge, as the download engine does.
const sendStates = (page) => page.evaluate(() => {
  const states = [
    ['chat:100', 'completed'], ['chat:101', 'downloading', 4.6e6, 1.02e7], ['chat:102', 'failed', 0, null, 'Telegram did not open this media. Try again.'],
    ['chat:103', 'cancelled'], ['chat:104', 'queued'], ['chat:105', 'preparing'], ['chat:106', 'handedOff'],
  ];
  for (const [itemId, state, received = 0, total = null, error = ''] of states) {
    TelCore.postToExtension({ type: 'task', task: { id: null, itemId, state, received, total, fileName: '', error } });
  }
});

(async () => {
  const { context, extensionId, cleanup } = await launchWithExtension();
  try {
    const telegram = await openTelegram(context, demo);
    await telegram.setViewportSize({ width: 900, height: 2400 });

    let panel = await openPanel(context, extensionId, telegram);
    await panel.locator('.tile').nth(10).waitFor();
    await panel.locator('.day-head button').first().click();
    await shot(panel, 'sidepanel-selected.png');
    await sendStates(telegram);
    await shot(panel, 'sidepanel-states.png');
    await panel.close();

    panel = await openPanel(context, extensionId, telegram, { dark: true });
    await panel.locator('.tile').nth(10).waitFor();
    await sendStates(telegram);
    await shot(panel, 'sidepanel-states-dark.png');
    await panel.close();

    // 320px in Russian, the longest strings.
    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/options/index.html`);
    await settingsPage.evaluate(() => chrome.storage.sync.set({ language: 'ru' }));
    panel = await openPanel(context, extensionId, telegram, { width: 320 });
    await panel.locator('.tile').nth(10).waitFor();
    await panel.locator('.tile').nth(2).click();
    await panel.locator('.tile').nth(5).click();
    await sendStates(telegram);
    await shot(panel, 'sidepanel-320-ru.png');
    await panel.close();
    await settingsPage.evaluate(() => chrome.storage.sync.set({ language: 'my' }));
    panel = await openPanel(context, extensionId, telegram, { width: 320 });
    await panel.locator('.tile').nth(10).waitFor();
    await panel.locator('.tile').nth(1).click();
    await shot(panel, 'sidepanel-320-my.png');
    await panel.close();
    await settingsPage.evaluate(() => chrome.storage.sync.set({ language: 'en' }));

    // Empty states.
    panel = await openPanel(context, extensionId, null);
    await shot(panel, 'sidepanel-empty-not-telegram.png');
    await panel.close();
    panel = await openPanel(context, extensionId, telegram, {
      init: () => { chrome.tabs.sendMessage = async () => { throw new Error('Could not establish connection'); }; },
    });
    await shot(panel, 'sidepanel-empty-reload.png');
    await panel.close();
    const emptyChat = await openTelegram(context, chat('Quiet group (demo)', ''));
    await emptyChat.evaluate(() => { location.hash = '#-100200300'; });
    panel = await openPanel(context, extensionId, emptyChat);
    await shot(panel, 'sidepanel-empty-no-media.png');
    await panel.close();
    const photos = await openTelegram(context, photosOnly);
    await photos.evaluate(() => { location.hash = '#-100400500'; });
    panel = await openPanel(context, extensionId, photos);
    await panel.locator('.tile').nth(1).waitFor();
    await panel.locator('[data-filter="video"]').click();
    await shot(panel, 'sidepanel-filter-empty.png');
    await panel.close();

    for (const dark of [false, true]) {
      const options = await context.newPage();
      await options.setViewportSize({ width: 720, height: 900 });
      if (dark) await options.emulateMedia({ colorScheme: 'dark' });
      await options.goto(`chrome-extension://${extensionId}/options/index.html`);
      await options.locator('#language option').nth(1).waitFor({ state: 'attached' });
      await shot(options, dark ? 'options-dark.png' : 'options.png');
      await options.close();
    }
  } finally {
    await cleanup();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
