const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers.cjs');
let browser;
let page;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
afterEach(async () => { await page?.close(); });

const { webK: webKChat, webA: webAChat } = require('./fixtures.cjs');
const webK = webKChat();
const webA = webAChat();

const snapshot = () => page.evaluate(() => TelScanner.snapshot());
const waitForItems = (count) => page.waitForFunction(n => TelScanner.snapshot().items.length >= n, count);

test('WebK media is listed as it scrolls into view, with album items and previews', async () => {
  page = await openPage(browser, webK, '/k/');
  await waitForItems(3);
  let { supported, chat, items } = await snapshot();
  assert.equal(supported, true);
  assert.equal(chat.title, 'Holiday photos');
  assert.deepEqual(items.map(item => [item.mid, item.kind]).sort(), [['10', 'image'], ['11', 'image'], ['12', 'video']]);
  assert.equal(items.find(item => item.mid === '12').duration, '0:05');
  assert.ok(items.every(item => item.thumb?.startsWith('data:image/jpeg')), 'previews are drawn');

  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await waitForItems(4);
  ({ items } = await snapshot());
  assert.ok(items.some(item => item.mid === '20'));
  assert.ok(!items.some(item => item.mid === '13'), 'stickers are ignored');
});

test('WebK selected items open the viewer, download the full-size file and close it', async () => {
  page = await openPage(browser, webK, '/k/');
  await waitForItems(3);
  await page.evaluate(() => TelScanner.download(['chat:10', 'chat:12']));
  await page.waitForFunction(() => saved.length === 2, null, { timeout: 15000 });
  const result = await page.evaluate(() => ({
    names: saved.map(file => file.name).sort(),
    urls: requests.map(request => request.url).sort(),
    viewerOpen: Boolean(document.querySelector('.media-viewer-whole')),
    errors,
  }));
  assert.deepEqual(result.names, ['clip-12.mp4', 'full-10.jpg']);
  assert.deepEqual(result.urls, ['https://test.invalid/clip-12.mp4', 'https://test.invalid/full-10.jpg']);
  assert.equal(result.viewerOpen, false);
  assert.deepEqual(result.errors, []);
});

test('items that left the chat view report an error instead of downloading', async () => {
  page = await openPage(browser, webK, '/k/');
  await waitForItems(3);
  await page.evaluate(() => {
    document.querySelector('.bubble[data-mid="10"]').remove();
    TelScanner.download(['chat:10']);
  });
  await page.waitForFunction(() => errors.length > 0);
  assert.match((await page.evaluate(() => errors))[0], /no longer in the chat view/);
  assert.equal(await page.evaluate(() => requests.length), 0);
});

test('WebA media is listed and downloaded through its viewer', async () => {
  page = await openPage(browser, webA, '/a/');
  await waitForItems(2);
  const { chat, items } = await snapshot();
  assert.equal(chat.title, 'Work');
  assert.deepEqual(items.map(item => [item.mid, item.kind]).sort(), [['30', 'image'], ['31', 'video']]);
  await page.evaluate(() => TelScanner.download(['chat:30', 'chat:31']));
  await page.waitForFunction(() => saved.length === 2, null, { timeout: 15000 });
  assert.deepEqual(await page.evaluate(() => saved.map(file => file.name).sort()), ['clip-31.mp4', 'full-30.jpg']);
  assert.equal(await page.evaluate(() => Boolean(document.querySelector('#MediaViewer'))), false);
});

// Regression: on live WebK the close button has no icon class, only an aria-label.
// The old code fell back to two Escape presses; the second one closed the chat.
test('WebK batch closes the viewer without closing the chat and downloads every item', async () => {
  page = await openPage(browser, webK, '/k/');
  await waitForItems(3);
  await page.evaluate(() => TelScanner.download(['chat:10', 'chat:11', 'chat:12']));
  await page.waitForFunction(() => saved.length === 3 || errors.length > 0, null, { timeout: 20000 });
  const result = await page.evaluate(() => ({
    names: saved.map(file => file.name).sort(),
    escapes, hash: location.hash, bubbles: document.querySelectorAll('.bubble[data-mid]').length, errors,
  }));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.names, ['clip-12.mp4', 'full-10.jpg', 'full-11.jpg']);
  assert.equal(result.escapes, 0, 'the close button is used, not Escape');
  assert.equal(result.hash, '', 'the chat stays open');
  assert.ok(result.bubbles > 0);
});

test('without a close button the viewer gets exactly one Escape per item and the chat stays open', async () => {
  page = await openPage(browser, webKChat('https://test.invalid/', { closeButton: false }), '/k/');
  await waitForItems(3);
  await page.evaluate(() => TelScanner.download(['chat:10', 'chat:11', 'chat:12']));
  await page.waitForFunction(() => saved.length === 3 || errors.length > 0, null, { timeout: 30000 });
  const result = await page.evaluate(() => ({ saved: saved.length, escapes, hash: location.hash, errors }));
  assert.deepEqual(result, { saved: 3, escapes: 3, hash: '', errors: [] });
});

test('items still waiting when the chat is closed fail with a clear reason', async () => {
  page = await openPage(browser, webK, '/k/');
  await waitForItems(3);
  await page.evaluate(() => TelScanner.download(['chat:10', 'chat:11', 'chat:12']));
  await page.waitForFunction(() => saved.length >= 1);
  await page.evaluate(() => closeChat());
  await page.waitForFunction(() => errors.some(error => /chat changed/.test(error)), null, { timeout: 20000 });
  const result = await page.evaluate(() => ({ urls: requests.map(request => request.url), viewerOpen: Boolean(document.querySelector('.media-viewer-whole')) }));
  assert.ok(!result.urls.some(url => url.includes('clip-12')), 'the last item is not downloaded from another chat');
  assert.equal(result.viewerOpen, false);
});

// Regression: live WebK shows a blurred placeholder first; the panel kept that blurry preview.
test('a provisional preview is replaced once Telegram shows the sharp image', async () => {
  const { webKLazy } = require('./fixtures.cjs');
  page = await openPage(browser, webKLazy, '/k/');
  await waitForItems(1);
  // Average colour of a preview, to tell the red placeholder from the blue image.
  const colour = () => page.evaluate(async () => {
    const [item] = TelScanner.snapshot().items;
    const image = new Image();
    image.src = item.thumb;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 1, 1);
    const [r, , b] = context.getImageData(0, 0, 1, 1).data;
    return { red: r > b, final: item.thumbFinal, kind: item.kind };
  });
  assert.deepEqual(await colour(), { red: true, final: false, kind: 'video' });
  await page.evaluate(() => sharpen());
  await page.waitForFunction(() => TelScanner.snapshot().items[0].thumbFinal === true);
  assert.deepEqual(await colour(), { red: false, final: true, kind: 'video' });
});
