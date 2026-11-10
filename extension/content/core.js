// SPDX-License-Identifier: GPL-3.0-only
// Based on the Telegram Media Downloader userscript by Nestor Qin
// (https://github.com/Neet-Nestor/Telegram-Media-Downloader).
// Modified for the Chrome extension by Thien21112005.

// Download engine, task panel and settings. Runs in the page's main world so
// requests behave exactly as they did in the userscript.
(function () {
  if (globalThis.TelCore) return;
  const { UI_LANGUAGES, translate, matchLanguage } = globalThis.TelI18n;
  const LANGUAGE_STORAGE_KEY = "tel-media-downloader-language";

  // In the extension, content/bridge.js (isolated world) marks the document and
  // relays chrome.* APIs over DOM events. Without it, settings use page storage.
  const hasBridge = () => document.documentElement.hasAttribute("data-tel-dl-bridge");
  const extensionHandlers = new Map();
  const pendingReplies = new Map();
  let nextRequestId = 1;
  const postToExtension = (message) => {
    if (!hasBridge()) return false;
    document.dispatchEvent(new CustomEvent("tel-dl:to-extension", { detail: JSON.stringify(message) }));
    return true;
  };
  const requestExtension = (message, timeout = 3000) => new Promise((resolve) => {
    if (!hasBridge()) {
      resolve(null);
      return;
    }
    const requestId = nextRequestId++;
    const timer = setTimeout(() => {
      pendingReplies.delete(requestId);
      resolve(null);
    }, timeout);
    pendingReplies.set(requestId, (value) => {
      clearTimeout(timer);
      pendingReplies.delete(requestId);
      resolve(value);
    });
    postToExtension({ ...message, requestId });
  });
  const onExtensionMessage = (type, handler) => extensionHandlers.set(type, handler);
  document.addEventListener("tel-dl:to-page", (event) => {
    let message;
    try {
      message = JSON.parse(event.detail);
    } catch {
      return;
    }
    if (message?.type === "reply") {
      pendingReplies.get(message.requestId)?.(message.value);
      return;
    }
    const handler = extensionHandlers.get(message?.type);
    if (!handler) return;
    Promise.resolve().then(() => handler(message)).then(
      (value) => message.requestId && postToExtension({ type: "reply", requestId: message.requestId, value: value ?? null }),
      (error) => {
        console.error("[Tel Download]", error);
        if (message.requestId) postToExtension({ type: "reply", requestId: message.requestId, value: null });
      }
    );
  });

  const DEFAULT_SETTINGS = globalThis.TelSettings.DEFAULTS;
  let userSettings = { ...DEFAULT_SETTINGS };
  let chatTitleProvider = () => "";
  // Builds a relative download folder from the template; each segment is made safe for any OS.
  const resolveFolder = () => {
    const chat = String(chatTitleProvider() || "").trim() || "Telegram";
    return String(userSettings.folderTemplate || "").replace(/\{chat\}/g, chat.replace(/[/\\]/g, "_"))
      .split(/[/\\]+/)
      .map((segment) => segment.replace(/[\x00-\x1f\x7f<>:"|?*]/g, "_").trim().replace(/[. ]+$/, "").slice(0, 80))
      .filter((segment) => segment && segment !== "." && segment !== "..")
      .join("/");
  };
  const readLanguagePreference = () => {
    if (hasBridge()) return "auto";
    try {
      const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return Object.hasOwn(UI_LANGUAGES, value) ? value : "auto";
    } catch {
      return "auto";
    }
  };
  let languagePreference = readLanguagePreference();
  const resolveLanguage = () => languagePreference !== "auto" ? languagePreference :
    (navigator.languages || [navigator.language]).map(matchLanguage).find(Boolean) || "en";
  let uiLanguage = resolveLanguage();
  const t = (key, params) => translate(uiLanguage, key, params);
  let integerFormat = new Intl.NumberFormat(uiLanguage, { maximumFractionDigits: 0 });
  let decimalFormat = new Intl.NumberFormat(uiLanguage, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const downloadError = (key, params = {}, name = "Error") => {
    // Keep diagnostic messages stable; render the structured error in the current UI language.
    const diagnostic = { ...params };
    if (key === "errorMime") {
      diagnostic.kind = translate("en", params.kind);
      diagnostic.mime ||= translate("en", "unknownType");
    }
    return Object.assign(new Error(translate("en", key, diagnostic)), { name, translationKey: key, params });
  };
  const formatDownloadError = (error) => {
    if (!error) return "";
    if (!error.translationKey) return t("errorUnexpected", { message: error.message || String(error) });
    const params = { ...error.params };
    if (error.translationKey === "errorMime") {
      params.kind = t(params.kind);
      params.mime ||= t("unknownType");
    }
    return t(error.translationKey, params);
  };
  const localizeDownloadButton = (button, loading = false) => {
    const label = t(loading ? "loadingMedia" : "download");
    if (button.title !== label) button.title = label;
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
    if (button.lang !== uiLanguage) button.lang = uiLanguage;
  };
  const logger = {
    info: (message, fileName = null) => {
      console.log(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
    error: (message, fileName = null) => {
      console.error(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
  };
  const isUsableDownloadButton = (button) => {
    if (button.disabled || button.getAttribute("aria-disabled") === "true" ||
        button.hidden || button.classList.contains("hide") || button.closest("[inert]")) {
      return false;
    }
    const style = getComputedStyle(button);
    return style.visibility !== "hidden" && style.visibility !== "collapse" &&
      button.getClientRects().length > 0;
  };
  const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REFRESH_DELAY = 2000;
  const DOWNLOAD_CHUNK_SIZE = 4 * 1024 * 1024;
  const fetchMediaPart = async (url, offset, total, kind, options = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal.reason);
    let timer;
    let reader;
    const resetTimeout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(
        downloadError("errorTimeout", {}, "TimeoutError")
      ), 30000);
    };
    const checkAborted = () => {
      if (controller.signal.aborted) throw controller.signal.reason;
    };
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    resetTimeout();
    try {
      checkAborted();
      const res = await fetch(url, {
        headers: { Range: `bytes=${offset}-${offset + DOWNLOAD_CHUNK_SIZE - 1}` },
        signal: controller.signal,
      });
      if (res.status !== 200 && res.status !== 206) {
        throw downloadError("errorHttp", { status: res.status });
      }
      const mime = res.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
      if (!mime?.startsWith(`${kind}/`)) {
        throw downloadError("errorMime", { kind, mime });
      }
      let expectedSize;
      let totalSize;
      if (res.status === 206) {
        const match = res.headers.get("Content-Range")?.match(contentRangeRegex);
        if (!match) throw downloadError("errorRangeMissing");
        const [start, end, size] = match.slice(1).map(Number);
        if (![start, end, size].every(Number.isSafeInteger) ||
            start !== offset || end < start || size <= end ||
            (total !== null && total !== size)) {
          throw downloadError("errorRangeInconsistent");
        }
        expectedSize = end - start + 1;
        totalSize = size;
      } else {
        if (offset !== 0) throw downloadError("errorRangeUnsupported");
        const length = res.headers.get("Content-Length");
        if (length !== null && !res.headers.has("Content-Encoding")) {
          if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
            throw downloadError("errorLength");
          }
          expectedSize = Number(length);
          totalSize = expectedSize;
        }
      }
      if (!res.body) throw downloadError("errorEmpty");
      reader = res.body.getReader();
      controller.signal.addEventListener("abort", () => {
        reader.cancel().catch(() => {});
      }, { once: true });
      const chunks = [];
      let received = 0;
      options.onProgress?.(offset, totalSize ?? null);
      while (true) {
        checkAborted();
        const { value, done } = await reader.read();
        checkAborted();
        if (done) break;
        received += value.byteLength;
        if (expectedSize !== undefined && received > expectedSize) {
          throw downloadError("errorTooLarge");
        }
        // Wait for disk writes before reading more data, so slow disks do not
        // cause an unbounded queue of writes or large in-memory responses.
        clearTimeout(timer);
        if (options.write) await options.write(value);
        else chunks.push(value);
        checkAborted();
        resetTimeout();
        options.onProgress?.(offset + received, totalSize ?? null);
      }
      if (!received || (expectedSize !== undefined && received !== expectedSize)) {
        throw downloadError("errorIncomplete");
      }
      return {
        blob: options.write ? null : new Blob(chunks, { type: mime }),
        mime, totalSize: totalSize ?? received, nextOffset: offset + received,
      };
    } catch (error) {
      controller.abort(error);
      throw controller.signal.reason || error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (reader) {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    }
  };
  const hashCode = (s) => {
    var h = 0,
      l = s.length,
      i = 0;
    if (l > 0) {
      while (i < l) {
        h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
      }
    }
    return h >>> 0;
  };

  const getMediaMetadata = (url) => {
    try {
      return JSON.parse(decodeURIComponent(url.split("/").pop()));
    } catch {
      return {};
    }
  };
  const getDownloadFileName = (url, mime, kind) => {
    const extensions = {
      "video/mp4": ["mp4", "m4v"], "video/webm": ["webm"],
      "video/quicktime": ["mov"], "video/x-matroska": ["mkv"],
      "audio/ogg": ["ogg", "oga", "opus"], "audio/mpeg": ["mp3"],
      "audio/mp4": ["m4a"], "audio/webm": ["webm"], "audio/aac": ["aac"],
      "audio/wav": ["wav"], "audio/x-wav": ["wav"],
      "image/jpeg": ["jpg", "jpeg"], "image/png": ["png"],
      "image/webp": ["webp"], "image/gif": ["gif"], "image/avif": ["avif"],
      "image/heic": ["heic"], "image/bmp": ["bmp"], "image/svg+xml": ["svg"],
    };
    const metadata = getMediaMetadata(url);
    let name = typeof metadata?.fileName === "string" ? metadata.fileName : "";
    if (!name) {
      try {
        const basename = decodeURIComponent(new URL(url, location.href).pathname.split("/").pop());
        if (/\.[a-z0-9]{2,5}$/i.test(basename)) name = basename;
      } catch {
        // Some blob URLs do not carry a filename.
      }
    }
    name = (name || hashCode(url).toString(36)).replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_");
    const allowed = extensions[mime?.toLowerCase()] || (mime ? null :
      (kind === "video" ? ["mp4"] : kind === "audio" ? ["ogg"] : ["jpg"]));
    const dot = name.lastIndexOf(".");
    if (!allowed) return dot > 0 ? name : name + ".bin";
    if (dot > 0 && allowed.includes(name.slice(dot + 1).toLowerCase())) return name;
    return (dot > 0 ? name.slice(0, dot) : name) + "." + allowed[0];
  };
  const saveMediaBlob = async (blob, fileName, folder) => {
    const url = URL.createObjectURL(blob);
    // Ask the background worker to place this download in the folder before it starts.
    if (folder && hasBridge()) await requestExtension({ type: "download:expect", url, folder });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Let the browser consume the URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadTasks = new Map();
  const activeDownloads = new Map();
  const downloadQueue = [];
  let maxConcurrentDownloads = DEFAULT_SETTINGS.concurrency;
  let runningDownloads = 0;

  const formatBytes = (bytes) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
    return `${(index ? decimalFormat : integerFormat).format(bytes / (1024 ** index))} ${units[index]}`;
  };
  const updateTaskPanel = () => {
    const panel = document.getElementById("tel-downloader-progress-bar-container");
    if (!panel) return;
    panel.hidden = !panel.querySelector(".tel-task");
    if (panel.hidden) setSettingsOpen(false);
    panel.querySelector(".tel-panel-title").textContent = activeDownloads.size
      ? t("downloadsCount", { count: integerFormat.format(activeDownloads.size) }) : t("downloads");
  };
  const dismissTask = (task) => {
    document.getElementById("tel-downloader-progress-" + task.id)?.remove();
    if (task.finished) downloadTasks.delete(task.id);
    updateTaskPanel();
  };
  const showTask = (task) => {
    const panel = document.getElementById("tel-downloader-progress-bar-container");
    const list = panel.querySelector(".tel-task-list");
    list.hidden = false;
    const toggle = panel.querySelector(".tel-panel-toggle");
    toggle.textContent = t("hide");
    toggle.setAttribute("aria-expanded", "true");
    let card = document.getElementById("tel-downloader-progress-" + task.id);
    if (!card) {
      card = document.createElement("div");
      card.id = "tel-downloader-progress-" + task.id;
      card.className = "tel-task";
      card.tabIndex = -1;
      card.innerHTML = `
        <div class="tel-task-heading"><p class="filename" dir="auto"></p><button type="button" data-action="dismiss">&times;</button></div>
        <span class="tel-task-state" role="status" aria-live="polite"></span>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div></div><p></p></div>
        <p class="tel-task-details"></p><p class="tel-task-error"></p>
        <div class="tel-task-actions"><button type="button" data-action="cancel"></button><button type="button" data-action="retry" hidden></button></div>`;
      card.querySelector('[data-action="dismiss"]').onclick = () => dismissTask(task);
      card.querySelector('[data-action="cancel"]').onclick = () => cancelTask(task);
      card.querySelector('[data-action="retry"]').onclick = () => retryTask(task);
      list.prepend(card);
    }
    renderTask(task);
    return card;
  };
  const cancelTask = (task) => {
    if (task.finished || task.state === "saving") return;
    task.controller.abort(new DOMException("Download cancelled", "AbortError"));
    if (!task.running) finishTask(task, "cancelled");
  };
  const retryTask = (task) => {
    dismissTask(task);
    return downloadMedia(task.url, task.kind, { batch: task.batch, itemId: task.itemId, folder: task.folder });
  };
  // Side panel items follow their task; progress updates are throttled.
  const notifyTask = (task) => {
    if (!task.itemId || !hasBridge()) return;
    const now = performance.now();
    if (task.notifiedState === task.state && now - (task.notifiedAt || 0) < 250) return;
    task.notifiedState = task.state;
    task.notifiedAt = now;
    postToExtension({
      type: "task",
      task: {
        id: task.id, itemId: task.itemId, state: task.state, fileName: task.fileName,
        received: task.received, total: task.total, error: formatDownloadError(task.error),
      },
    });
  };
  const renderTask = (task) => {
    notifyTask(task);
    const card = document.getElementById("tel-downloader-progress-" + task.id);
    if (!card) return;
    const label = t(task.state);
    card.dataset.state = task.state;
    const title = card.querySelector(".filename");
    title.textContent = task.fileName;
    title.title = task.fileName;
    const state = card.querySelector(".tel-task-state");
    if (state.textContent !== label) state.textContent = label;
    const progress = card.querySelector(".progress");
    progress.setAttribute("aria-label", t("progress"));
    card.querySelector('[data-action="dismiss"]').setAttribute("aria-label", t("dismiss"));
    const percent = task.total ? Math.min(100, Math.floor(task.received * 100 / task.total)) : null;
    progress.classList.toggle("tel-indeterminate", task.state === "downloading" && percent === null);
    if (percent === null) progress.removeAttribute("aria-valuenow");
    else progress.setAttribute("aria-valuenow", percent);
    progress.setAttribute("aria-valuetext", label);
    progress.querySelector("div").style.width = (percent ?? 0) + "%";
    progress.querySelector("p").textContent = task.state === "downloading" && percent !== null ? `${integerFormat.format(percent)}%` : label;
    const speed = task.received / Math.max((performance.now() - task.startedAt) / 1000, 0.1);
    card.querySelector(".tel-task-details").textContent =
      formatBytes(task.received) + (task.total !== null ? ` / ${formatBytes(task.total)}` : "") +
      (task.state === "downloading" && task.received ? ` · ${t("rate", { speed: formatBytes(speed) })}` : "");
    const error = card.querySelector(".tel-task-error");
    error.textContent = formatDownloadError(task.error);
    error.hidden = !task.error;
    const cancel = card.querySelector('[data-action="cancel"]');
    cancel.textContent = t("cancel");
    cancel.hidden = task.finished;
    cancel.disabled = task.state === "saving";
    const retry = card.querySelector('[data-action="retry"]');
    retry.textContent = t("retry");
    retry.hidden = !["failed", "cancelled"].includes(task.state);
    task.renderedAt = performance.now();
    task.renderedBytes = task.received;
    updateTaskPanel();
  };
  const finishTask = (task, state, error) => {
    if (task.finished) return;
    task.finished = true;
    clearTimeout(task.progressTimer);
    task.state = state;
    task.error = error;
    if (activeDownloads.get(task.key) === task) activeDownloads.delete(task.key);
    if (error) logger.error(error, task.fileName);
    renderTask(task);
    if (!document.getElementById("tel-downloader-progress-" + task.id)) downloadTasks.delete(task.id);
    updateTaskPanel();
    task.resolve({ state, fileName: task.fileName, received: task.received });
  };
  const runTask = async (task) => {
    const parts = [];
    let writable;
    const checkCancelled = () => {
      if (task.controller.signal.aborted) throw task.controller.signal.reason;
    };
    try {
      checkCancelled();
      task.state = "preparing";
      renderTask(task);
      if (task.handle) writable = await task.handle.createWritable();
      checkCancelled();
      task.state = "downloading";
      task.startedAt = performance.now();
      renderTask(task);
      let offset = 0;
      let total = null;
      let mime;
      do {
        const part = await fetchMediaPart(task.url, offset, total, task.kind, {
          signal: task.controller.signal,
          write: writable ? (chunk) => writable.write(chunk) : undefined,
          onProgress: (received, size) => {
            task.received = received;
            task.total = size;
            if ((!task.renderedBytes && received) || performance.now() - task.renderedAt >= 100 || received === size) {
              renderTask(task);
            } else if (!task.progressTimer) {
              task.progressTimer = setTimeout(() => {
                task.progressTimer = null;
                renderTask(task);
              }, 100);
            }
          },
        });
        checkCancelled();
        if (!writable) parts.push(part.blob);
        offset = part.nextOffset;
        total = part.totalSize;
        mime = part.mime;
        task.fileName = getDownloadFileName(task.url, mime, task.kind);
        task.received = offset;
        task.total = total;
        renderTask(task);
      } while (offset < total);
      checkCancelled();
      task.state = "saving";
      renderTask(task);
      if (writable) await writable.close();
      else await saveMediaBlob(new Blob(parts, { type: mime }), task.fileName, task.folder);
      finishTask(task, writable ? "completed" : "handedOff");
    } catch (error) {
      if (writable) {
        try { await writable.abort(); } catch { /* Already closed or errored. */ }
      }
      if (task.controller.signal.aborted || error.name === "AbortError") finishTask(task, "cancelled");
      else finishTask(task, "failed", error);
    } finally {
      parts.length = 0;
      task.handle = null;
    }
  };
  const pumpDownloads = () => {
    while (runningDownloads < maxConcurrentDownloads && downloadQueue.length) {
      const task = downloadQueue.shift();
      if (task.finished) continue;
      runningDownloads++;
      task.running = true;
      runTask(task).finally(() => {
        task.running = false;
        runningDownloads--;
        pumpDownloads();
      });
    }
  };
  // options.batch: started from the side panel; never opens a save dialog.
  // options.itemId: side panel item to report progress to.
  const downloadMedia = (url, kind, options = {}) => {
    if (typeof url !== "string" || !url) return Promise.resolve();
    const key = `${kind}:${url}`;
    const existing = activeDownloads.get(key);
    if (existing) {
      const card = showTask(existing);
      card.scrollIntoView({ block: "nearest" });
      card.focus({ preventScroll: true });
      return existing.promise;
    }
    // Retain a small history without retaining media buffers.
    for (const previous of downloadTasks.values()) {
      if (downloadTasks.size < 20) break;
      if (previous.finished) dismissTask(previous);
    }
    const task = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      key, url, kind, fileName: getDownloadFileName(url, getMediaMetadata(url)?.mimeType, kind),
      state: "preparing", received: 0, total: null, controller: new AbortController(),
      startedAt: performance.now(), renderedAt: 0, finished: false,
      batch: Boolean(options.batch), itemId: options.itemId || null,
      folder: options.folder ?? resolveFolder(),
    };
    task.promise = new Promise(resolve => { task.resolve = resolve; });
    downloadTasks.set(task.id, task);
    activeDownloads.set(key, task);
    showTask(task);
    const enqueue = (handle) => {
      if (task.finished) return;
      task.handle = handle;
      task.state = "queued";
      renderTask(task);
      downloadQueue.push(task);
      pumpDownloads();
    };
    try {
      const pageWindow = typeof unsafeWindow === "undefined" ? window : unsafeWindow;
      if (kind !== "image" && !task.batch && userSettings.askWhereToSave &&
          typeof pageWindow.showSaveFilePicker === "function" && pageWindow.self === pageWindow.top) {
        // Keep the picker inside the original click, before queueing or fetching.
        Promise.resolve(pageWindow.showSaveFilePicker({ suggestedName: task.fileName }))
          .then(enqueue, (error) => {
            if (error.name === "AbortError") finishTask(task, "cancelled");
            else finishTask(task, "failed", error);
          });
      } else enqueue(null);
    } catch (error) {
      finishTask(task, "failed", error);
    }
    return task.promise;
  };
  const tel_download_video = (url) => downloadMedia(url, "video");
  const tel_download_audio = (url) => downloadMedia(url, "audio");
  const tel_download_image = (url) => downloadMedia(url, "image");

  const getMediaSource = (media) =>
    media?.getAttribute("src") ? media.src :
      media?.currentSrc || media?.querySelector("source")?.src;
  const createDownloadButton = (className, iconHTML, onClick) => {
    const button = document.createElement("button");
    button.className = className;
    button.innerHTML = iconHTML;
    button.type = "button";
    localizeDownloadButton(button);
    button.onclick = onClick;
    return button;
  };
  // The task panel is independent of Telegram's viewer and survives media changes.
  const panel = document.createElement("section");
  panel.id = "tel-downloader-progress-bar-container";
  panel.dir = "ltr";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="tel-panel-heading">
      <strong class="tel-panel-title"></strong>
      <div class="tel-panel-tools">
        <button class="tel-settings-toggle" type="button" aria-expanded="false" aria-controls="tel-download-settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M10 2h4l.6 3 2 1.2 2.9-.9 2 3.4-2.3 2v2.6l2.3 2-2 3.4-2.9-.9-2 1.2L14 22h-4l-.6-3-2-1.2-2.9.9-2-3.4 2.3-2v-2.6l-2.3-2 2-3.4 2.9.9 2-1.2Z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button class="tel-panel-toggle" type="button" aria-expanded="true" aria-controls="tel-task-list"></button>
      </div>
    </div>
    <div id="tel-download-settings" class="tel-language-setting" hidden><label for="tel-download-language"></label><select id="tel-download-language"></select></div>
    <div id="tel-task-list" class="tel-task-list"></div>`;
  const languageSelect = panel.querySelector("select");
  const settings = panel.querySelector("#tel-download-settings");
  const settingsToggle = panel.querySelector(".tel-settings-toggle");
  const setSettingsOpen = (open) => {
    const returnFocus = !open && settings.contains(document.activeElement);
    settings.hidden = !open;
    settingsToggle.setAttribute("aria-expanded", String(open));
    if (open) languageSelect.focus();
    else if (returnFocus && !panel.hidden) settingsToggle.focus();
  };
  settingsToggle.onclick = () => setSettingsOpen(settings.hidden);
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape" && !settings.hidden) {
      event.preventDefault();
      event.stopPropagation();
      setSettingsOpen(false);
    }
  });
  // Wait for the click: closing settings moves this bottom-anchored panel,
  // which must not move a control between pointer-down and pointer-up.
  document.addEventListener("click", event => {
    if (!settings.hidden && !settings.contains(event.target) && !settingsToggle.contains(event.target)) {
      setSettingsOpen(false);
    }
  });
  for (const [value, label] of [["auto", ""], ...Object.entries(UI_LANGUAGES)]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if (value !== "auto") option.lang = value;
    languageSelect.appendChild(option);
  }
  const refreshLanguage = () => {
    uiLanguage = resolveLanguage();
    integerFormat = new Intl.NumberFormat(uiLanguage, { maximumFractionDigits: 0 });
    decimalFormat = new Intl.NumberFormat(uiLanguage, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    panel.lang = uiLanguage;
    panel.setAttribute("aria-label", t("mediaDownloads"));
    settingsToggle.title = t("settings");
    settingsToggle.setAttribute("aria-label", t("settings"));
    panel.querySelector("label").textContent = t("language");
    languageSelect.querySelector('[value="auto"]').textContent = t("automatic");
    languageSelect.value = languagePreference;
    panel.querySelector(".tel-panel-toggle").textContent = t(panel.querySelector(".tel-task-list").hidden ? "show" : "hide");
    for (const task of downloadTasks.values()) renderTask(task);
    updateTaskPanel();
    document.querySelectorAll("button.tel-download, button._tel_download_button_pinned_container").forEach(button => {
      localizeDownloadButton(button, button.matches("._tel_download_button_pinned_container:disabled"));
    });
  };
  languageSelect.onchange = () => {
    languagePreference = Object.hasOwn(UI_LANGUAGES, languageSelect.value) ? languageSelect.value : "auto";
    if (postToExtension({ type: "settings:set", patch: { language: languagePreference } })) {
      refreshLanguage();
      return;
    }
    try {
      if (languagePreference === "auto") localStorage.removeItem(LANGUAGE_STORAGE_KEY);
      else localStorage.setItem(LANGUAGE_STORAGE_KEY, languagePreference);
    } catch {
      // Storage can be disabled; the selected language still works for this tab.
    }
    refreshLanguage();
  };
  window.addEventListener("languagechange", () => {
    if (languagePreference === "auto") refreshLanguage();
  });
  window.addEventListener("storage", event => {
    if (!hasBridge() && (event.key === LANGUAGE_STORAGE_KEY || event.key === null)) {
      languagePreference = readLanguagePreference();
      refreshLanguage();
    }
  });
  panel.querySelector(".tel-panel-toggle").onclick = () => {
    const list = panel.querySelector(".tel-task-list");
    list.hidden = !list.hidden;
    if (list.hidden) setSettingsOpen(false);
    const toggle = panel.querySelector(".tel-panel-toggle");
    toggle.textContent = t(list.hidden ? "show" : "hide");
    toggle.setAttribute("aria-expanded", String(!list.hidden));
  };
  const style = document.createElement("style");
  style.textContent = `
    #tel-downloader-progress-bar-container {
      --tel-bg: #fff; --tel-fg: #202b36; --tel-muted: #556472; --tel-line: #d9e1e8;
      --tel-track: #e9eef3; --tel-accent: #1967b3; --tel-error: #b42318;
      box-sizing: border-box; position: fixed; right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom));
      width: min(340px, calc(100vw - 24px)); max-height: calc(100vh - 24px); z-index: 2147483646;
      background: var(--tel-bg); color: var(--tel-fg); border: 1px solid var(--tel-line); border-radius: 12px;
      box-shadow: 0 6px 28px #0003; font: 13px/1.4 system-ui, sans-serif; overflow: hidden;
      display: flex; flex-direction: column; text-align: start;
    }
    html.night #tel-downloader-progress-bar-container, html.theme-dark #tel-downloader-progress-bar-container {
      --tel-bg: #202a35; --tel-fg: #f2f5f8; --tel-muted: #b0bdca; --tel-line: #455361;
      --tel-track: #394754; --tel-accent: #73b7ff; --tel-error: #ff9f97;
    }
    #tel-downloader-progress-bar-container [hidden], #tel-downloader-progress-bar-container[hidden] { display: none !important; }
    #tel-downloader-progress-bar-container * { box-sizing: border-box; }
    #tel-downloader-progress-bar-container p { margin: 0; }
    #tel-downloader-progress-bar-container .tel-panel-heading, #tel-downloader-progress-bar-container .tel-task-heading {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    #tel-downloader-progress-bar-container .tel-panel-heading { padding: 10px 12px; flex-shrink: 0; }
    #tel-downloader-progress-bar-container .tel-panel-title { min-width: 0; overflow-wrap: anywhere; }
    #tel-downloader-progress-bar-container .tel-panel-tools { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
    #tel-downloader-progress-bar-container .tel-language-setting { display: flex; align-items: center; gap: 8px; padding: 0 12px 10px; flex-shrink: 0; }
    #tel-downloader-progress-bar-container .tel-language-setting label { flex: 1; min-width: 0; color: var(--tel-muted); overflow-wrap: anywhere; }
    #tel-downloader-progress-bar-container select { width: 150px; max-width: 55%; min-width: 0; min-height: 32px; font: inherit; color: var(--tel-fg); background: var(--tel-bg); border: 1px solid var(--tel-line); border-radius: 6px; padding: 4px; }
    #tel-downloader-progress-bar-container .tel-task-list { min-height: 0; overflow-y: auto; max-height: 440px; overscroll-behavior: contain; }
    #tel-downloader-progress-bar-container .tel-task { padding: 12px; border-top: 1px solid var(--tel-line); }
    #tel-downloader-progress-bar-container .filename { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    #tel-downloader-progress-bar-container button {
      appearance: none; background: transparent; color: var(--tel-accent); border: 1px solid transparent;
      font: inherit; border-radius: 6px; padding: 5px 8px; min-height: 32px; cursor: pointer; flex-shrink: 0;
    }
    #tel-downloader-progress-bar-container button:hover { background: var(--tel-track); }
    #tel-downloader-progress-bar-container .tel-settings-toggle { display: inline-flex; align-items: center; justify-content: center; width: 32px; padding: 5px; color: var(--tel-muted); }
    #tel-downloader-progress-bar-container .tel-settings-toggle:hover, #tel-downloader-progress-bar-container .tel-settings-toggle[aria-expanded="true"] { color: var(--tel-fg); background: var(--tel-track); }
    #tel-downloader-progress-bar-container button:focus-visible, #tel-downloader-progress-bar-container select:focus-visible, #tel-downloader-progress-bar-container .tel-task:focus-visible { outline: 2px solid var(--tel-accent); outline-offset: -2px; }
    #tel-downloader-progress-bar-container button:disabled { opacity: .5; cursor: default; }
    #tel-downloader-progress-bar-container [data-action="dismiss"] { color: var(--tel-muted); font-size: 20px; }
    #tel-downloader-progress-bar-container .progress { position: relative; min-height: 24px; margin: 8px 0; background: var(--tel-track); border-radius: 6px; overflow: hidden; }
    #tel-downloader-progress-bar-container .progress > div { position: absolute; height: 100%; background: var(--tel-accent); opacity: .35; }
    #tel-downloader-progress-bar-container .progress > p { position: relative; text-align: center; line-height: 1.5; padding: 3px 8px; overflow-wrap: anywhere; color: var(--tel-fg); }
    #tel-downloader-progress-bar-container .tel-task-details { color: var(--tel-muted); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    #tel-downloader-progress-bar-container .tel-task-error { color: var(--tel-error); margin-top: 8px; overflow-wrap: anywhere; }
    #tel-downloader-progress-bar-container .tel-task-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin-top: 4px; }
    #tel-downloader-progress-bar-container .tel-task-state { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    #tel-downloader-progress-bar-container [data-state="failed"] .progress > div { background: var(--tel-error); }
    #tel-downloader-progress-bar-container .tel-indeterminate > div { width: 35% !important; animation: tel-download-progress 1.4s infinite ease-in-out; }
    @keyframes tel-download-progress { from { left: -35%; } to { left: 100%; } }
    @media (prefers-reduced-motion: reduce) { #tel-downloader-progress-bar-container .tel-indeterminate > div { animation: none; left: 32%; } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(panel);
  refreshLanguage();

  const applySettings = (next) => {
    if (!next || typeof next !== "object") return;
    userSettings = globalThis.TelSettings.normalize(next, UI_LANGUAGES);
    languagePreference = userSettings.language;
    maxConcurrentDownloads = userSettings.concurrency;
    refreshLanguage();
    pumpDownloads();
  };
  onExtensionMessage("settings", (message) => applySettings(message.settings));
  onExtensionMessage("task:cancel", ({ taskId }) => {
    const task = downloadTasks.get(taskId);
    if (task) cancelTask(task);
  });
  requestExtension({ type: "settings:get" }).then(applySettings);

  globalThis.TelCore = {
    logger, t, downloadMedia, getMediaSource, isUsableDownloadButton,
    localizeDownloadButton, createDownloadButton, onExtensionMessage, postToExtension,
    setChatTitleProvider: (provider) => { chatTitleProvider = provider; },
    resolveFolder,
  };
})();
