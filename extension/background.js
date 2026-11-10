// SPDX-License-Identifier: GPL-3.0-only

// Clicking the toolbar icon opens the side panel next to the current tab.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("[Tel Download] Side panel setup failed:", error));
});

// Downloads saved by the content scripts are blob URLs from a Telegram page.
// Before each one starts, the page announces the folder it belongs in; this
// worker then places the file there (relative to the browser's download folder).
const TELEGRAM_BLOB = /^blob:https:\/\/(web|webk|webz)\.telegram\.org\//;
const EXPECT_TTL = 2 * 60 * 1000;
const sessionKey = (url) => `expect:${url}`;

const safeFolder = (folder) => String(folder || "")
  .split(/[/\\]+/)
  .map((segment) => segment.replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_").trim().replace(/[. ]+$/, ""))
  .filter((segment) => segment && segment !== "." && segment !== "..")
  .join("/");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "download:expect" || !sender.tab || sender.id !== chrome.runtime.id) return false;
  if (typeof message.url !== "string" || !TELEGRAM_BLOB.test(message.url)) {
    sendResponse(false);
    return false;
  }
  // Session storage survives the worker being suspended between the two events.
  chrome.storage.session
    .set({ [sessionKey(message.url)]: { folder: safeFolder(message.folder), expires: Date.now() + EXPECT_TTL } })
    .then(() => sendResponse(true), () => sendResponse(false));
  return true;
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  const url = [item.url, item.finalUrl].find((value) => TELEGRAM_BLOB.test(value || ""));
  if (!url) return false;
  chrome.storage.session.get(sessionKey(url)).then((stored) => {
    const entry = stored[sessionKey(url)];
    chrome.storage.session.remove(sessionKey(url));
    const name = item.filename.split(/[/\\]/).pop();
    if (entry?.folder && entry.expires > Date.now()) {
      suggest({ filename: `${entry.folder}/${name}`, conflictAction: "uniquify" });
    } else {
      suggest();
    }
  }, () => suggest());
  return true;
});
