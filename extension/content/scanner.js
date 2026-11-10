// SPDX-License-Identifier: GPL-3.0-only

// Finds photos and videos in the open chat as they scroll into view and
// downloads the ones chosen in the side panel. Full-size media URLs only exist
// once Telegram opens its media viewer, so each download briefly opens the
// item in the viewer, reads the URL the same way the viewer buttons do, and
// closes it again.
(function () {
  if (globalThis.TelScanner) return;
  const { downloadMedia, getMediaSource, onExtensionMessage, postToExtension, setChatTitleProvider, t, logger } = globalThis.TelCore;

  const text = (selector) => document.querySelector(selector)?.textContent.trim() || "";
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (check, timeout) => {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const value = check();
      if (value) return value;
      await wait(100);
    }
    return null;
  };
  const pressEscape = () => {
    for (const target of [document.activeElement || document.body, document]) {
      target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    }
  };

  // Each adapter knows one Telegram web version's markup.
  const webK = {
    mediaSelector: ".bubble[data-mid] .attachment .album-item[data-mid], .bubble[data-mid] .attachment",
    chatTitle: () => text("#column-center .chat-info .peer-title") || text(".chat-info .peer-title"),
    describe: (element) => {
      // Albums are scanned per item; skip the album container itself.
      if (element.matches(".attachment") && element.querySelector(".album-item[data-mid]")) return null;
      if (element.closest(".webpage, .reply, .sticker, .media-sticker-wrapper")) return null;
      const bubble = element.closest(".bubble[data-mid]");
      const mid = element.dataset.mid || bubble?.dataset.mid;
      if (!mid) return null;
      const isVideo = Boolean(element.querySelector("video, .video-time, .video-play, .btn-circle.video-play"));
      const hasPhoto = Boolean(element.querySelector("img.media-photo, canvas.media-photo, img.thumbnail, img"));
      if (!isVideo && !hasPhoto) return null;
      const day = element.closest(".bubbles-date-group")?.querySelector(".is-date .service-msg, .is-date .bubble-content, .service-msg")?.textContent.trim() || "";
      return { mid, kind: isVideo ? "video" : "image", day, duration: element.querySelector(".video-time")?.textContent.trim() || "" };
    },
    find: (mid) =>
      document.querySelector(`.bubble .attachment .album-item[data-mid="${CSS.escape(mid)}"]`) ||
      document.querySelector(`.bubble[data-mid="${CSS.escape(mid)}"] .attachment`),
    viewer: () => document.querySelector(".media-viewer-whole"),
    viewerSource: (viewer) => {
      const media = viewer.querySelector(".media-viewer-movers .media-viewer-aspecter");
      const video = media?.querySelector("video");
      const image = media?.querySelector("img.thumbnail");
      return { video, image };
    },
    close: (viewer) => {
      const close = viewer.querySelector(".media-viewer-topbar .btn-icon.tgico-close, .media-viewer-topbar [class*='close']");
      if (close) close.click();
      else pressEscape();
    },
  };

  const webA = {
    mediaSelector: ".message-list-item .media-inner",
    chatTitle: () => text(".MiddleHeader .ChatInfo .fullName") || text(".MiddleHeader .ChatInfo h3"),
    describe: (element) => {
      if (element.closest(".WebPage, .EmbeddedMessage, .sticker-message")) return null;
      const album = element.closest("[id^='album-media-message-']");
      const message = element.closest(".message-list-item");
      const mid = album?.id.replace("album-media-message-", "") ||
        message?.dataset.messageId || message?.id.replace(/^message-/, "");
      if (!mid) return null;
      const isVideo = Boolean(element.querySelector("video, .message-media-duration, .icon-large-play"));
      if (!isVideo && !element.querySelector("img, canvas")) return null;
      const day = element.closest(".message-date-group")?.querySelector(".sticky-date")?.textContent.trim() || "";
      return { mid, kind: isVideo ? "video" : "image", day, duration: element.querySelector(".message-media-duration")?.textContent.trim() || "" };
    },
    find: (mid) =>
      document.querySelector(`#album-media-message-${CSS.escape(mid)} .media-inner`) ||
      document.querySelector(`#message-${CSS.escape(mid)} .media-inner`) ||
      document.querySelector(`.message-list-item[data-message-id="${CSS.escape(mid)}"] .media-inner`),
    viewer: () => document.querySelector("#MediaViewer"),
    viewerSource: (viewer) => {
      const media = viewer.querySelector(".MediaViewerSlide--active");
      return {
        video: media?.querySelector(".VideoPlayer video"),
        image: media?.querySelector(".MediaViewerContent > div > img"),
      };
    },
    close: (viewer) => {
      const close = viewer.querySelector('button[aria-label="Close"], .MediaViewerActions button:last-child');
      if (close) close.click();
      else pressEscape();
    },
  };

  const isWebK = location.hostname === "webk.telegram.org" || location.pathname.startsWith("/k/");
  const isWebA = location.hostname === "webz.telegram.org" || location.pathname.startsWith("/a/");
  const adapter = isWebK ? webK : isWebA ? webA : null;
  if (adapter) setChatTitleProvider(adapter.chatTitle);

  const chatKey = () => location.hash.replace(/^#/, "") || "chat";
  const chats = new Map(); // chat key -> Map(item id -> item)
  const itemsFor = (key) => {
    if (!chats.has(key)) chats.set(key, new Map());
    return chats.get(key);
  };

  // A small preview drawn from what Telegram already shows; null if unavailable.
  const THUMB_SIZE = 160;
  const makeThumbnail = (element) => {
    const source = element.querySelector("img.media-photo, img.thumbnail, img.full-media, img, canvas, video");
    if (!source) return null;
    const width = source.naturalWidth || source.videoWidth || source.width;
    const height = source.naturalHeight || source.videoHeight || source.height;
    if (!width || !height || (source.tagName === "IMG" && !source.complete)) return null;
    try {
      const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch {
      return null; // Cross-origin or not yet decoded.
    }
  };

  let pendingItems = [];
  let flushTimer;
  const announce = (item) => {
    pendingItems.push(item);
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const items = pendingItems;
      pendingItems = [];
      postToExtension({ type: "media", chat: { key: chatKey(), title: adapter.chatTitle() }, items });
    }, 300);
  };

  const record = (element) => {
    const description = adapter.describe(element);
    if (!description) return;
    const key = chatKey();
    const items = itemsFor(key);
    const id = `${key}:${description.mid}`;
    const existing = items.get(id);
    if (existing) {
      // Fill in a preview that was not decoded the first time.
      if (!existing.thumb) {
        existing.thumb = makeThumbnail(element);
        if (existing.thumb) announce(existing);
      }
      return;
    }
    const item = { id, mid: description.mid, kind: description.kind, day: description.day, duration: description.duration, thumb: makeThumbnail(element) };
    items.set(id, item);
    announce(item);
    if (!item.thumb) {
      // Previews often finish decoding after the bubble scrolls in.
      element.querySelector("img")?.addEventListener("load", () => record(element), { once: true });
    }
  };

  let observed = new WeakSet();
  // Items currently on screen in the chat; the side panel marks the reader's place with them.
  const onScreen = new Set();
  let viewTimer;
  const announceView = () => {
    if (viewTimer) return;
    viewTimer = setTimeout(() => {
      viewTimer = null;
      postToExtension({ type: "view", chat: { key: chatKey() }, ids: Array.from(onScreen) });
    }, 200);
  };
  const visibility = adapter && new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const description = adapter.describe(entry.target);
      const id = description && `${chatKey()}:${description.mid}`;
      if (entry.isIntersecting) {
        record(entry.target);
        if (id) onScreen.add(id);
      } else if (id) {
        onScreen.delete(id);
      }
    }
    announceView();
  }, { threshold: 0.25 });
  const scan = () => {
    if (!adapter) return;
    for (const element of document.querySelectorAll(adapter.mediaSelector)) {
      if (observed.has(element)) continue;
      observed.add(element);
      visibility.observe(element);
    }
  };
  let scanTimer;
  const scheduleScan = () => {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 250);
  };
  if (adapter) {
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", () => {
      onScreen.clear();
      postToExtension({ type: "media", chat: { key: chatKey(), title: adapter.chatTitle() }, items: [], reset: true });
      scheduleScan();
    });
    scan();
  }

  // Opens one item in Telegram's viewer and returns its full-size URL.
  const resolveSource = async (item) => {
    const element = adapter.find(item.mid);
    if (!element) throw Object.assign(new Error("Item is no longer in the chat view"), { translationKey: "errorNotInView" });
    const before = adapter.viewer();
    if (before) {
      adapter.close(before);
      await waitFor(() => !adapter.viewer(), 3000);
    }
    element.scrollIntoView({ block: "center" });
    (element.querySelector("img, canvas, video") || element).click();
    let lastSource = "";
    let stableSince = 0;
    const source = await waitFor(() => {
      const viewer = adapter.viewer();
      if (!viewer) return null;
      const { video, image } = adapter.viewerSource(viewer);
      const url = item.kind === "video" ? getMediaSource(video) : getMediaSource(image) || getMediaSource(video);
      if (!url) return null;
      // Images may start as a preview; wait until the source stops changing.
      if (url !== lastSource) {
        lastSource = url;
        stableSince = performance.now();
        return null;
      }
      if (video && !video.paused) video.pause();
      return performance.now() - stableSince >= 400 ? { url, kind: video && getMediaSource(video) === url ? "video" : "image" } : null;
    }, 20000);
    const viewer = adapter.viewer();
    if (viewer) {
      adapter.close(viewer);
      await waitFor(() => !adapter.viewer(), 3000);
    }
    if (!source) throw Object.assign(new Error("Telegram did not open this media"), { translationKey: "errorNoSource" });
    return source;
  };

  // Items are opened one at a time; their downloads then run through the shared queue.
  const resolveQueue = [];
  let resolving = false;
  const reportFailure = (item, error) => {
    logger.error(error.message);
    postToExtension({
      type: "task",
      task: { id: null, itemId: item.id, state: "failed", fileName: "", received: 0, total: null,
        error: error.translationKey ? t(error.translationKey) : t("errorUnexpected", { message: error.message }) },
    });
  };
  const pumpResolve = async () => {
    if (resolving) return;
    resolving = true;
    try {
      while (resolveQueue.length) {
        const item = resolveQueue.shift();
        postToExtension({ type: "task", task: { id: null, itemId: item.id, state: "preparing", fileName: "", received: 0, total: null, error: "" } });
        try {
          const { url, kind } = await resolveSource(item);
          downloadMedia(url, kind, { batch: true, itemId: item.id });
        } catch (error) {
          reportFailure(item, error);
        }
      }
    } finally {
      resolving = false;
    }
  };
  const download = (ids) => {
    const items = itemsFor(chatKey());
    let accepted = 0;
    for (const id of Array.isArray(ids) ? ids : []) {
      const item = items.get(id);
      if (!item || resolveQueue.includes(item)) continue;
      resolveQueue.push(item);
      accepted++;
    }
    pumpResolve();
    return { accepted };
  };
  const snapshot = () => ({
    supported: Boolean(adapter),
    chat: { key: chatKey(), title: adapter?.chatTitle() || "" },
    items: Array.from(itemsFor(chatKey()).values()),
    view: Array.from(onScreen),
  });

  onExtensionMessage("scan:get", snapshot);
  onExtensionMessage("scan:download", ({ ids }) => download(ids));
  onExtensionMessage("scan:cancel", () => {
    const dropped = resolveQueue.splice(0);
    for (const item of dropped) {
      postToExtension({ type: "task", task: { id: null, itemId: item.id, state: "cancelled", fileName: "", received: 0, total: null, error: "" } });
    }
    return { cancelled: dropped.length };
  });
  onExtensionMessage("scan:clear", () => {
    itemsFor(chatKey()).clear();
    resolveQueue.length = 0;
    // Forget observed elements so media still on screen is listed again.
    if (visibility) {
      visibility.disconnect();
      observed = new WeakSet();
      scan();
    }
    return snapshot();
  });

  globalThis.TelScanner = { snapshot, download, scan };
})();
