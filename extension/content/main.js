// SPDX-License-Identifier: GPL-3.0-only
// Based on the Telegram Media Downloader userscript by Nestor Qin
// (https://github.com/Neet-Nestor/Telegram-Media-Downloader).
// Modified for the Chrome extension by Thien21112005.

// Starts the app-specific refresh loop for the Telegram web version in use.
(function () {
  if (globalThis.TelMainStarted) return;
  globalThis.TelMainStarted = true;
  const { logger } = globalThis.TelCore;
  const REFRESH_DELAY = 2000;
  const refreshWebK = globalThis.TelWebK.refresh;
  const refreshWebA = globalThis.TelWebA.refresh;
  const isWebK = location.hostname === "webk.telegram.org" || location.pathname.startsWith("/k/");
  const isWebA = location.hostname === "webz.telegram.org" || location.pathname.startsWith("/a/");
  const refreshApp = isWebK ? refreshWebK : isWebA ? refreshWebA : null;
  if (refreshApp) {
    const roots = isWebK
      ? ".media-viewer-whole, #stories-viewer, .pinned-audio, audio-element"
      : "#MediaViewer, #StoryViewer";
    let pending;
    const scheduleRefresh = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refreshApp();
      }, 100);
    };
    const observer = new MutationObserver((records) => {
      if (records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target?.closest("#tel-downloader-progress-bar-container, .tel-download, ._tel_download_button_pinned_container")) return false;
        return target?.closest(roots) || Array.from(record.addedNodes).some((node) =>
          node instanceof Element && (node.matches(roots) || node.querySelector(roots))
        );
      })) scheduleRefresh();
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ["class", "src", "data-mid", "data-peer-id", "disabled", "aria-disabled", "hidden"],
    });
    // A fallback handles media source properties changed outside the DOM.
    setInterval(() => { if (!document.hidden) refreshApp(); }, REFRESH_DELAY);
    document.addEventListener("visibilitychange", scheduleRefresh);
    refreshApp();
  }

  logger.info("Completed script setup.");
})();
