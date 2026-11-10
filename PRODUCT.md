# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Chrome extension, Manifest V3, plain HTML/CSS/JavaScript with no framework or bundler (decided in docs/PLAN.md). Content scripts run in Telegram Web pages; the side panel and options page are extension pages.

## Users

People who use Telegram Web in Chrome or Edge and want to keep media from chats, groups and channels, including ones where Telegram disables saving. Two situations matter equally:

- saving a few photos or videos while reading a chat;
- archiving a channel or group: scrolling through a long stretch of history and downloading everything seen in one go.

## Product Purpose

Make media in Telegram Web downloadable: restore download buttons in Telegram's own viewer, story viewer and pinned audio bar, and list the photos and videos a user scrolls past so they can tick and batch-download them into a per-chat folder. Success: the user gets the full-size original files, named and foldered sensibly, without a save dialog per file and without leaving Telegram.

## Positioning

It works inside the Telegram Web session the user already has (no bot, no API key, no separate login) and collects media simply by scrolling the chat, using Telegram's own viewer to obtain full-size files.

## Operating Context

- The side panel sits beside Telegram Web at Chrome's side panel width (about 320–400px) while the user scrolls the chat in the main tab.
- A typical session lists 30–200 items; it must stay usable from a handful up to a couple of hundred.
- Downloads run in the Telegram tab; the panel shows progress and errors. The tab must stay open until transfers finish.
- Batch downloads open each item briefly in Telegram's media viewer to read its full-size URL.
- Files go to the browser's download folder under a subfolder template (default `Telegram/{chat}`).

## Capabilities and Constraints

- Telegram Web versions: WebK (`/k/`, recommended) and WebA (`/a/`). Some features exist only in WebK (voice/pinned audio).
- Media types: photos, videos, GIFs (as video); audio from the pinned audio bar and viewer.
- Up to 1–4 simultaneous downloads (setting, default 2).
- Interface languages: English, Vietnamese, Simplified Chinese, Traditional Chinese, Russian, Burmese; follows the browser language unless chosen.
- Distributed as a `.zip` from GitHub Releases, installed with "Load unpacked". Not published on the Chrome Web Store.
- Undecided: whether to support audio/files in the side panel list (v1 lists photos and videos only).

## Brand Commitments

- Name: Telegram Media Downloader. It is an unofficial tool: never use Telegram's logo or present it as a Telegram product.
- Visual identity: sit naturally beside Telegram Web (its light and dark themes, calm blue accent, rounded media tiles) without imitating Telegram's branding.
- Credit the original author, Nestor Qin (Neet-Nestor/Telegram-Media-Downloader), and keep the GPL-3.0 license. Maintained by Thien21112005, developed with Claude.

## Evidence on Hand

- Working code and an automated test suite (Playwright fixtures that simulate Telegram pages).
- No screenshots of the extension running on real Telegram yet; no user testimonials, download counts or reviews for this fork. Do not invent any.

## Product Principles

1. Get the original file, not a preview; if only a preview is possible, say so.
2. Never lose the user's place: downloading must not disrupt reading the chat more than necessary.
3. Show honest progress and errors for every file; nothing fails silently.
4. Respect the user's session and privacy: nothing leaves the browser except requests Telegram itself makes.
5. Stay out of Telegram's way: blend in, never break Telegram's own controls.

## Accessibility & Inclusion

Keyboard operable, screen-reader labels and live progress announcements, reduced-motion support, and layouts that hold for long translations (Russian, Burmese) at narrow widths.
