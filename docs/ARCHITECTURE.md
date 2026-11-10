# Architecture

Telegram Media Downloader is a Manifest V3 extension with no build step. Everything under `extension/` ships as is.

```
extension/
├─ manifest.json
├─ background.js           service worker: side panel behaviour, download folders
├─ shared/
│  ├─ i18n.js              message catalogs (6 languages) and translate()
│  └─ settings.js          defaults and validation for chrome.storage.sync settings
├─ content/
│  ├─ bridge.js            ISOLATED world: relays between the page and the extension
│  ├─ core.js              MAIN world: download engine, task queue, in-page progress panel
│  ├─ webk.js              MAIN world: download buttons for WebK (/k/)
│  ├─ weba.js              MAIN world: download buttons for WebA (/a/)
│  ├─ scanner.js           MAIN world: finds chat media, downloads side panel selections
│  └─ main.js              MAIN world: starts the refresh loop for the detected web version
├─ sidepanel/              the media list beside Telegram
├─ options/                settings page
├─ _locales/               extension name and description for the browser UI
└─ icons/                  icon.svg is the source; PNGs are rendered by `npm run icons`
```

## Why the content scripts run in the page's main world

The download engine came from a userscript that ran in the page context, where requests behave exactly like Telegram's own. WebK serves media through its service worker at `stream/...` URLs; running in the `MAIN` world keeps those requests identical to the userscript's, so the extension does not depend on how Chrome routes content-script requests.

Main-world scripts cannot use `chrome.*`. `content/bridge.js` runs in the isolated world, marks the document with `data-tel-dl-bridge`, and relays JSON messages over two DOM events:

| Event | Direction |
|---|---|
| `tel-dl:to-extension` | page → bridge → `chrome.runtime` / `chrome.storage` |
| `tel-dl:to-page` | bridge → page (settings, side panel requests, replies) |

Each side only accepts the message types it expects. Requests carry a `requestId` and get a `reply`.

Without the bridge (the regression tests inject the main-world scripts into a plain page), `core.js` falls back to `localStorage` for the language and never asks for download folders.

## Download flow

1. Something calls `TelCore.downloadMedia(url, kind, options)`: a viewer button, the pinned audio button, or the scanner on behalf of the side panel.
2. The task joins a queue limited to `concurrency` (1–4) parallel downloads.
3. `fetchMediaPart` downloads 4 MB ranges, validating `Content-Range`, MIME type and sizes, with a 30-second stall timeout.
4. The file is written either through `showSaveFilePicker` (single video/audio when "Ask where to save" is on) or collected into a Blob and saved with `<a download>`.
5. For Blob saves the page first sends `download:expect` with the blob URL and folder. The background worker stores it in `chrome.storage.session`, and `chrome.downloads.onDeterminingFilename` places the file at `<folder>/<name>`.

## Side panel flow

1. `scanner.js` observes media elements in the chat with an `IntersectionObserver` and records each one once: id (`<chat key>:<message id>`), kind, day label, duration and a small JPEG preview drawn from what Telegram already shows.
2. New items are batched to the extension as `media` messages; on-screen items as `view` messages (used for the *You are here* marker).
3. The side panel asks the active tab for `scan:get` and listens for updates from that tab only.
4. **Download** sends `scan:download` with item ids. The scanner opens each item in Telegram's media viewer, waits until the viewer's source stops changing, reads the full-size URL, closes the viewer, and hands the URL to `downloadMedia` with `batch: true`. Task updates flow back to the panel as `task` messages.

Selectors for each web version live in the `webK` and `webA` adapters at the top of `scanner.js` and in `webk.js` / `weba.js`. When Telegram changes its markup, these are the places to update, together with the fixtures in `tests/fixtures.cjs`.

## Settings

`shared/settings.js` defines the defaults and `normalize()`. The options page and the bridge read and write `chrome.storage.sync`; the bridge pushes changes to open Telegram tabs, and the side panel listens for language changes.

| Key | Default |
|---|---|
| `language` | `"auto"` |
| `concurrency` | `2` |
| `askWhereToSave` | `true` |
| `folderTemplate` | `"Telegram/{chat}"` |

## Tests

`npm test` runs every `tests/*.test.cjs` file with Playwright:

- `download`, `tasks`, `viewer`, `localization`, `scanner`: the main-world scripts injected into simulated Telegram pages (`tests/helpers.cjs`, `tests/fixtures.cjs`).
- `extension`: the real unpacked extension loaded into Chromium: bridge, settings sync, download folders, side panel and options page end to end. Screenshots land in `.impeccable/review/` for visual review.
