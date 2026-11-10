# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Chrome extension (Manifest V3), installed from a `.zip` with "Load unpacked"; replaces the userscript.
- Side panel that lists photos and videos from the open chat as you scroll, in chat order and grouped by day, with filters, select day/all, shift-click ranges and a "You are here" marker.
- Batch downloads from the side panel, with progress and saved/failed/cancelled states on every item.
- Downloads are saved into a subfolder of the browser's download folder (default `Telegram/{chat}`).
- Settings page: interface language, simultaneous downloads (1–4), download folder and whether to ask where to save.
- Vietnamese translation.

### Changed
- The userscript code is split into content scripts that run in the page's main world, with an isolated-world bridge for extension APIs.
- Settings are stored in `chrome.storage.sync` and shared by every Telegram tab, the side panel and the settings page.

### Removed
- Userscript distribution through Greasy Fork and its translated description pages.

## Userscript 2.0 (upstream)

The last userscript release by Nestor Qin, imported unchanged as the starting point of this fork. See the [original repository](https://github.com/Neet-Nestor/Telegram-Media-Downloader) for its history.
