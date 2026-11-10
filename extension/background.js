// SPDX-License-Identifier: GPL-3.0-only

// Clicking the toolbar icon opens the side panel next to the current tab.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("[Tel Download] Side panel setup failed:", error));
});
