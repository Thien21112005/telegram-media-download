const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers.cjs');
let browser;
let page;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
afterEach(async () => { await page?.close(); });

const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const photo = `<img class="media-photo" src="${pixel}" style="width:120px;height:90px;display:block">`;

// Simulated WebK chat: clicking media opens a viewer with the full-size URL.
const webK = `
<div class="chat-info"><span class="peer-title">Holiday photos</span></div>
<div class="bubbles">
  <div class="bubble" data-mid="10"><div class="attachment">${photo}</div></div>
  <div class="bubble" data-mid="11"><div class="attachment">
    <div class="album-item" data-mid="11">${photo}</div>
    <div class="album-item" data-mid="12">${photo}<span class="video-time">0:05</span></div>
  </div></div>
  <div class="bubble sticker" data-mid="13"><div class="attachment">${photo}</div></div>
  <div style="height:3000px"></div>
  <div class="bubble" data-mid="20"><div class="attachment">${photo}</div></div>
</div>
<script>
  document.addEventListener('click', (event) => {
    const item = event.target.closest('.album-item[data-mid], .bubble[data-mid]');
    if (!item || document.querySelector('.media-viewer-whole')) return;
    const mid = item.dataset.mid;
    const isVideo = item.querySelector('.video-time');
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer-whole';
    viewer.innerHTML = '<div class="media-viewer-topbar"><div class="media-viewer-buttons"><button class="btn-icon tgico-close"></button></div></div>' +
      '<div class="media-viewer-movers"><div class="media-viewer-aspecter">' +
      (isVideo ? '<video src="https://test.invalid/clip-' + mid + '.mp4"></video>' : '<img class="thumbnail" src="https://test.invalid/full-' + mid + '.jpg">') +
      '</div></div>';
    viewer.querySelector('.tgico-close').onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  });
</script>`;

const webA = `
<div class="MiddleHeader"><div class="ChatInfo"><div class="fullName">Work</div></div></div>
<div class="message-list-item" id="message-30" data-message-id="30"><div class="media-inner">${photo}</div></div>
<div class="message-list-item" id="message-31" data-message-id="31"><div class="media-inner">${photo}<div class="message-media-duration">1:00</div></div></div>
<script>
  document.addEventListener('click', (event) => {
    const item = event.target.closest('.message-list-item');
    if (!item || document.querySelector('#MediaViewer')) return;
    const mid = item.dataset.messageId;
    const isVideo = item.querySelector('.message-media-duration');
    const viewer = document.createElement('div');
    viewer.id = 'MediaViewer';
    viewer.innerHTML = '<div class="MediaViewerActions"><button aria-label="Close"></button></div><div class="MediaViewerSlide MediaViewerSlide--active">' +
      (isVideo ? '<div class="VideoPlayer"><video src="https://test.invalid/clip-' + mid + '.mp4"></video></div>'
        : '<div class="MediaViewerContent"><div><img src="https://test.invalid/full-' + mid + '.jpg"></div></div>') + '</div>';
    viewer.querySelector('[aria-label="Close"]').onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  });
</script>`;

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
