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
  // Exactly one Escape. Telegram treats each one as "go back": a second one
  // after the viewer has closed would close the chat itself.
  const pressEscape = () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
  };

  // Telegram keeps only the messages around the reader's place in the page.
  // These helpers describe that window so far-away items can be scrolled back.
  const isScrollable = (element) => {
    const { overflowY } = getComputedStyle(element);
    return /(auto|scroll|overlay)/.test(overflowY) && element.scrollHeight > element.clientHeight;
  };
  // The adapter's own scroller, else the nearest scrollable ancestor of a message.
  const findScroller = (preferred, message) => {
    const known = document.querySelector(preferred);
    if (known && isScrollable(known)) return known;
    for (let node = message?.parentElement; node && node !== document.body; node = node.parentElement) {
      if (isScrollable(node)) return node;
    }
    return document.scrollingElement;
  };
  // The smallest and largest message ids in the page, or null when none are.
  const rangeOf = (ids) => {
    const numbers = ids.map(Number).filter(Number.isFinite);
    return numbers.length ? { min: Math.min(...numbers), max: Math.max(...numbers) } : null;
  };
  const isShown = (element) => Boolean(element && element.getClientRects().length && !element.closest(".hide, [hidden]"));

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
    // WebK marks its buttons with aria-labels, not icon classes. If the label
    // is missing or translated, Close is still the last button of the toolbar.
    closeButton: (viewer) => {
      const bar = viewer.querySelector(".media-viewer-topbar .media-viewer-buttons");
      if (!bar) return null;
      const buttons = Array.from(bar.querySelectorAll("button.btn-icon:not(.hide):not(.btn-menu-toggle)"));
      return bar.querySelector('button[aria-label="Close"], button.tgico-close') || buttons[buttons.length - 1] || null;
    },
    scroller: () => findScroller("#column-center .bubbles > .scrollable-y, .bubbles > .scrollable-y", document.querySelector(".bubble[data-mid]")),
    goDownButton: () => {
      const button = document.querySelector("#column-center .bubbles-go-down, .bubbles-go-down");
      return isShown(button) ? button : null;
    },
    loadedRange: () => rangeOf(Array.from(document.querySelectorAll(".bubble[data-mid]:not(.is-date)"), (bubble) => bubble.dataset.mid)),
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
    closeButton: (viewer) =>
      viewer.querySelector('button[aria-label="Close"], .MediaViewerActions button:last-child'),
    scroller: () => findScroller(".MiddleColumn .MessageList, .MessageList", document.querySelector(".message-list-item")),
    goDownButton: () => {
      // The button stays in the page while hidden; its container is "revealed" when shown.
      const button = document.querySelector(".ScrollDownButton button") || document.querySelector(".ScrollDownButton");
      return isShown(button) && !button.closest(".FloatingActionButtons:not(.revealed)") ? button : null;
    },
    loadedRange: () => rangeOf(Array.from(document.querySelectorAll(".message-list-item"),
      (message) => message.dataset.messageId || message.id.replace(/^message-/, ""))),
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
  // Telegram first shows a tiny blurred placeholder and swaps in the real
  // preview once it has loaded. A preview drawn from the placeholder is
  // provisional (final: false) and is replaced when a sharp source appears.
  const THUMB_SIZE = 160;
  const SHARP_MIN_SIZE = 64; // placeholders are about 40px on their longer side
  const sourceSize = (source) => ({
    width: source.naturalWidth || source.videoWidth || source.width || 0,
    height: source.naturalHeight || source.videoHeight || source.height || 0,
  });
  const isDrawable = (source) => {
    const { width, height } = sourceSize(source);
    if (!width || !height) return false;
    if (source.tagName === "IMG") return source.complete;
    if (source.tagName === "VIDEO") return source.readyState >= 2;
    return true;
  };
  const isSharp = (source) => {
    if (source.tagName === "CANVAS" || source.matches('.thumbnail, [class*="blur"]')) return false;
    const { width, height } = sourceSize(source);
    return Math.max(width, height) >= SHARP_MIN_SIZE;
  };
  const makeThumbnail = (element) => {
    const sources = Array.from(element.querySelectorAll("img, canvas, video")).filter(isDrawable);
    if (!sources.length) return null;
    const area = (source) => sourceSize(source).width * sourceSize(source).height;
    const source = sources.sort((a, b) => isSharp(b) - isSharp(a) || area(b) - area(a))[0];
    const { width, height } = sourceSize(source);
    try {
      const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      return { url: canvas.toDataURL("image/jpeg", 0.7), final: isSharp(source) };
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
      refreshThumbnail(element, existing);
      return;
    }
    const item = { id, mid: description.mid, kind: description.kind, day: description.day, duration: description.duration, thumb: null, thumbFinal: false };
    items.set(id, item);
    if (!refreshThumbnail(element, item)) announce(item);
  };

  // Draws the preview again while it is missing or provisional. Returns true
  // if the item was announced with a new preview.
  const watchedImages = new WeakSet();
  const refreshThumbnail = (element, item) => {
    if (item.thumbFinal) return false;
    const shot = makeThumbnail(element);
    let changed = false;
    if (shot && shot.url !== item.thumb) {
      item.thumb = shot.url;
      item.thumbFinal = shot.final;
      announce(item);
      changed = true;
    }
    if (!item.thumbFinal) {
      // The sharp image may still be loading, or replace this one's source later.
      for (const image of element.querySelectorAll("img")) {
        if (watchedImages.has(image)) continue;
        watchedImages.add(image);
        image.addEventListener("load", () => record(element));
      }
    }
    return changed;
  };
  // Telegram swaps placeholders for real previews after a bubble is on screen.
  const refreshOnScreenThumbnails = () => {
    const items = itemsFor(chatKey());
    for (const id of onScreen) {
      const item = items.get(id);
      if (!item || item.thumbFinal) continue;
      const element = adapter.find(item.mid);
      if (element) refreshThumbnail(element, item);
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
    refreshOnScreenThumbnails();
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

  // Closes Telegram's media viewer and waits until it is gone. Escape is the
  // fallback, sent once and only while a viewer is still open.
  const closeViewer = async () => {
    const viewer = adapter.viewer();
    if (!viewer) return true;
    const button = adapter.closeButton(viewer);
    if (button) {
      button.click();
      if (await waitFor(() => !adapter.viewer(), 2500)) return true;
    }
    if (adapter.viewer()) pressEscape();
    return Boolean(await waitFor(() => !adapter.viewer(), 2500));
  };

  // Telegram drops messages far from the reader's place from the page. To open
  // such an item again, scroll the chat towards it until Telegram loads it back:
  // newer ids lie below the loaded messages, older ids above. Gives up when the
  // chat stops loading in that direction, when the id falls inside the loaded
  // range but is missing (the message was deleted), or when time runs out.
  const SEEK_STEP_WAIT = 1500;
  const SEEK_MAX_STEPS = 60;
  const SEEK_TIMEOUT = 90000;
  const SEEK_STUCK_STEPS = 3;
  const chatChanged = () => Object.assign(new Error("The chat changed before this item was downloaded"), { translationKey: "errorChatChanged" });
  const cancelledError = () => Object.assign(new Error("Cancelled"), { cancelled: true });
  // Not found after searching: deleted if its id lies inside the loaded
  // messages, otherwise the chat could not be scrolled far enough.
  const seekFailed = (item) => {
    const range = adapter.loadedRange();
    const target = Number(item.mid);
    const inside = range && Number.isFinite(target) && target >= range.min && target <= range.max;
    return inside
      ? Object.assign(new Error("Item is no longer in the chat (deleted?)"), { translationKey: "errorNotInView" })
      : Object.assign(new Error("Item is no longer in the chat view and scrolling did not reach it"), { translationKey: "errorSeekTimeout" });
  };
  const sameRange = (a, b) => (a && b ? a.min === b.min && a.max === b.max : a === b);
  const bringIntoView = async (item, { shouldStop = () => false, onSeek = () => {} } = {}) => {
    let element = adapter.find(item.mid);
    if (element) return element;
    onSeek();
    const target = Number(item.mid);
    const started = performance.now();
    let usedGoDown = false;
    let stuck = 0;
    let gapChecked = false;
    for (let step = 0; step < SEEK_MAX_STEPS && performance.now() - started < SEEK_TIMEOUT; step++) {
      if (shouldStop()) return null;
      const range = adapter.loadedRange();
      // Unknown order: look below first, where the newest messages are.
      const down = !range || !Number.isFinite(target) || target > range.max;
      if (range && Number.isFinite(target) && target >= range.min && target <= range.max) {
        // Inside the loaded messages yet missing: allow one late render, then stop.
        if (gapChecked) break;
        gapChecked = true;
      } else {
        const scroller = adapter.scroller();
        const goDown = down && !usedGoDown && adapter.goDownButton();
        if (goDown) {
          usedGoDown = true;
          goDown.click();
        } else if (scroller) {
          const before = scroller.scrollTop;
          scroller.scrollTop = down ? scroller.scrollHeight : 0;
          // Already at that edge: no scroll event fires, so announce one for Telegram to load more.
          if (scroller.scrollTop === before) {
            (scroller === document.scrollingElement ? document : scroller).dispatchEvent(new Event("scroll"));
          }
        }
      }
      element = await waitFor(() => adapter.find(item.mid) || (shouldStop() && "moved") || (!sameRange(adapter.loadedRange(), range) && "moved"), SEEK_STEP_WAIT);
      if (element && element !== "moved") return element;
      if (element === "moved") {
        stuck = 0;
      } else if (++stuck >= SEEK_STUCK_STEPS) {
        break; // Telegram loads nothing more in this direction.
      }
    }
    return shouldStop() ? null : adapter.find(item.mid);
  };

  // Opens one item in Telegram's viewer and returns its full-size URL.
  // shouldStop() returns the error to stop with (cancelled, chat changed) or null.
  const resolveSource = async (item, { shouldStop = () => null, onSeek } = {}) => {
    if (!await closeViewer()) {
      throw Object.assign(new Error("Telegram's media viewer did not close"), { translationKey: "errorNoSource" });
    }
    const element = await bringIntoView(item, { shouldStop: () => Boolean(shouldStop()), onSeek });
    if (shouldStop()) throw shouldStop();
    if (!element) throw seekFailed(item);
    element.scrollIntoView({ block: "center" });
    (element.querySelector("img, canvas, video") || element).click();
    let lastSource = "";
    let stableSince = 0;
    const source = await waitFor(() => {
      if (shouldStop()) return { stopped: true };
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
    await closeViewer();
    if (source?.stopped) throw shouldStop() || cancelledError();
    if (!source) throw Object.assign(new Error("Telegram did not open this media"), { translationKey: "errorNoSource" });
    return source;
  };

  // Items are opened one at a time; their downloads then run through the shared queue.
  const resolveQueue = [];
  let resolving = false;
  let current = null; // the entry being opened right now
  const postState = (item, state) => postToExtension({ type: "task", task: { id: null, itemId: item.id, state, fileName: "", received: 0, total: null, error: "" } });
  // Next item to open: one already in the page, else the one nearest to the
  // loaded messages, so the chat scrolls one way instead of back and forth.
  const takeNext = () => {
    let best = 0;
    let bestDistance = Infinity;
    const range = adapter.loadedRange();
    resolveQueue.forEach((entry, index) => {
      const target = Number(entry.item.mid);
      let distance;
      if (adapter.find(entry.item.mid)) distance = -1;
      else if (!range || !Number.isFinite(target)) distance = Number.MAX_SAFE_INTEGER;
      else distance = target > range.max ? target - range.max : target < range.min ? range.min - target : 0;
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return resolveQueue.splice(best, 1)[0];
  };
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
        const entry = takeNext();
        const { item, chat, folder } = entry;
        if (chat !== chatKey()) {
          // The chat was closed or switched; its messages are no longer on the page.
          reportFailure(item, chatChanged());
          continue;
        }
        current = entry;
        postState(item, "preparing");
        const shouldStop = () => (entry.cancelled ? cancelledError() : chat !== chatKey() ? chatChanged() : null);
        try {
          const { url, kind } = await resolveSource(item, { shouldStop, onSeek: () => postState(item, "seeking") });
          if (entry.cancelled) throw cancelledError();
          downloadMedia(url, kind, { batch: true, itemId: item.id, folder });
        } catch (error) {
          if (error.cancelled) postState(item, "cancelled");
          else reportFailure(item, error);
        } finally {
          current = null;
        }
      }
    } finally {
      resolving = false;
    }
  };
  const download = (ids) => {
    const chat = chatKey();
    const items = itemsFor(chat);
    // Fix the folder now, so files still go to this chat's folder if the chat changes later.
    const folder = TelCore.resolveFolder();
    let accepted = 0;
    for (const id of Array.isArray(ids) ? ids : []) {
      const item = items.get(id);
      if (!item || current?.item === item || resolveQueue.some((entry) => entry.item === item)) continue;
      resolveQueue.push({ item, chat, folder });
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
  // Stops the item being opened (even mid-scroll) and drops the waiting ones.
  const cancelPending = () => {
    const dropped = resolveQueue.splice(0);
    for (const { item } of dropped) postState(item, "cancelled");
    if (current && !current.cancelled) {
      current.cancelled = true;
      dropped.push(current);
    }
    return dropped.length;
  };
  onExtensionMessage("scan:cancel", () => ({ cancelled: cancelPending() }));
  onExtensionMessage("scan:clear", () => {
    itemsFor(chatKey()).clear();
    cancelPending();
    // Forget observed elements so media still on screen is listed again.
    if (visibility) {
      visibility.disconnect();
      observed = new WeakSet();
      scan();
    }
    return snapshot();
  });

  // Read-only view of the chat window, used by the scroll-back logic and tests.
  const chatWindow = () => adapter && {
    scroller: adapter.scroller(),
    goDownButton: adapter.goDownButton(),
    loadedRange: adapter.loadedRange(),
  };

  globalThis.TelScanner = { snapshot, download, cancel: cancelPending, scan, chatWindow };
})();
