// SPDX-License-Identifier: GPL-3.0-only

// Settings shared by the content scripts, side panel and options page.
// Stored in chrome.storage.sync by the extension pages and the bridge.
(function () {
  if (globalThis.TelSettings) return;
  const DEFAULTS = Object.freeze({
    language: "auto",          // "auto" or a key of TelI18n.UI_LANGUAGES
    concurrency: 2,            // simultaneous downloads, 1–4
    askWhereToSave: true,      // single video/audio downloads open a save dialog
    folderTemplate: "Telegram/{chat}", // subfolder inside the browser's download folder
  });
  const normalize = (value, languages = globalThis.TelI18n?.UI_LANGUAGES || {}) => {
    const input = value && typeof value === "object" ? value : {};
    return {
      language: input.language === "auto" || Object.hasOwn(languages, input.language) ? input.language : DEFAULTS.language,
      concurrency: Math.min(4, Math.max(1, Math.round(Number(input.concurrency)) || DEFAULTS.concurrency)),
      askWhereToSave: typeof input.askWhereToSave === "boolean" ? input.askWhereToSave : DEFAULTS.askWhereToSave,
      folderTemplate: typeof input.folderTemplate === "string" ? input.folderTemplate.slice(0, 200) : DEFAULTS.folderTemplate,
    };
  };
  globalThis.TelSettings = { DEFAULTS, normalize };
})();
