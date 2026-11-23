const fs = require('node:fs');
const path = require('node:path');
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { launch, openPage } = require('./helpers.cjs');
let browser;
let page;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });
afterEach(async () => { await page?.close(); });

const read = (file) => fs.readFileSync(path.join(__dirname, '../extension', file), 'utf8');
// The isolated-world scripts, run in the page against a stand-in chrome API.
// invalidate() makes it behave like an extension that was reloaded or updated:
// runtime.id disappears and every call throws.
const fakeChrome = `
window.sent = [];
let valid = true;
const gone = () => { throw new Error('Extension context invalidated.'); };
window.chrome = {
  runtime: {
    get id() { return valid ? 'test-extension' : undefined; },
    sendMessage: (message) => { if (!valid) gone(); sent.push(message.type); return Promise.resolve(null); },
    onMessage: { addListener: () => {} },
  },
  storage: {
    sync: { get: async (defaults) => { if (!valid) gone(); return defaults; }, set: async () => { if (!valid) gone(); } },
    onChanged: { addListener: () => {} },
  },
};
window.invalidate = () => { valid = false; };`;

test('after the extension is reloaded, the old bridge retires quietly and the page keeps working', async () => {
  page = await openPage(browser, '', '/k/');
  await page.addScriptTag({ content: fakeChrome + read('shared/settings.js') + read('content/bridge.js') });
  const post = (type) => page.evaluate((kind) => {
    document.dispatchEvent(new CustomEvent('tel-dl:to-extension', { detail: JSON.stringify({ type: kind, chat: { key: 'c' }, items: [], ids: [] }) }));
  }, type);

  await post('media');
  await page.waitForFunction(() => sent.includes('media'));
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-tel-dl-bridge')), true);

  await page.evaluate(() => invalidate());
  await post('media');
  await post('view');
  await page.evaluate(() => settle());
  // Downloads from the viewer buttons still work without the extension.
  await page.evaluate(() => downloads.image('https://test.invalid/photo.jpg'));
  await page.waitForFunction(() => saved.length === 1 || errors.length > 0, null, { timeout: 10000 });
  const result = await page.evaluate(() => ({ errors, saved: saved.length, bridge: document.documentElement.hasAttribute('data-tel-dl-bridge') }));
  assert.deepEqual(result.errors, [], 'no uncaught "Extension context invalidated"');
  assert.equal(result.bridge, false, 'the page stops using the bridge');
  assert.equal(result.saved, 1);
});
