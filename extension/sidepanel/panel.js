// SPDX-License-Identifier: GPL-3.0-only

// Placeholder panel; the media list is built in a later phase.
document.documentElement.lang = chrome.i18n.getUILanguage();
for (const element of document.querySelectorAll("[data-i18n]")) {
  const message = chrome.i18n.getMessage(element.dataset.i18n);
  if (message) element.textContent = message;
}
