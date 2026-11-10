// SPDX-License-Identifier: GPL-3.0-only

// Isolated-world bridge between the main-world content scripts and the
// extension (storage, side panel, background). Messages cross worlds as JSON
// strings on DOM events; only the types listed below are relayed.
(function () {
  if (globalThis.TelBridgeStarted) return;
  globalThis.TelBridgeStarted = true;
  document.documentElement.setAttribute("data-tel-dl-bridge", "");

  const toPage = (message) =>
    document.dispatchEvent(new CustomEvent("tel-dl:to-page", { detail: JSON.stringify(message) }));
  const readSettings = async () =>
    TelSettings.normalize(await chrome.storage.sync.get(TelSettings.DEFAULTS), TelI18n.UI_LANGUAGES);
  // The side panel may be closed; a missing receiver is not an error.
  const toExtension = (message) => chrome.runtime.sendMessage(message).catch(() => null);

  // Requests the extension sends to the page, waiting for the page's reply.
  const pageReplies = new Map();
  let nextRequestId = 1;
  const requestPage = (message, timeout = 15000) => new Promise((resolve) => {
    const requestId = `x${nextRequestId++}`;
    const timer = setTimeout(() => {
      pageReplies.delete(requestId);
      resolve(null);
    }, timeout);
    pageReplies.set(requestId, (value) => {
      clearTimeout(timer);
      pageReplies.delete(requestId);
      resolve(value);
    });
    toPage({ ...message, requestId });
  });

  const fromPage = {
    "settings:get": () => readSettings(),
    "settings:set": async ({ patch }) => {
      const current = await readSettings();
      await chrome.storage.sync.set(TelSettings.normalize({ ...current, ...patch }, TelI18n.UI_LANGUAGES));
    },
    "download:expect": ({ url, folder }) => {
      if (typeof url !== "string" || !url.startsWith(`blob:${location.origin}/`)) return false;
      return toExtension({ type: "download:expect", url, folder: String(folder || "") });
    },
    task: ({ task }) => toExtension({ type: "task", task }),
    media: ({ chat, items }) => toExtension({ type: "media", chat, items }),
  };
  document.addEventListener("tel-dl:to-extension", (event) => {
    let message;
    try {
      message = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (message?.type === "reply") {
      pageReplies.get(message.requestId)?.(message.value);
      return;
    }
    const handler = fromPage[message?.type];
    if (!handler) return;
    Promise.resolve(handler(message)).then(
      (value) => message.requestId && toPage({ type: "reply", requestId: message.requestId, value: value ?? null }),
      (error) => {
        console.error("[Tel Download]", error);
        if (message.requestId) toPage({ type: "reply", requestId: message.requestId, value: null });
      }
    );
  });

  // Messages from the side panel to this tab, forwarded to the page.
  const TO_PAGE = new Set(["scan:get", "scan:download", "scan:clear", "task:cancel"]);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !TO_PAGE.has(message?.type)) return false;
    requestPage(message).then(sendResponse);
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") readSettings().then((settings) => toPage({ type: "settings", settings }));
  });
})();
