---
name: Telegram Media Downloader
description: An unofficial media picker that sits beside Telegram Web and mirrors the chat it watches.
colors:
  ground: "#ffffff"
  ground-dark: "#212121"
  fill: "#f1f3f5"
  fill-dark: "#2c2c2c"
  fill-strong: "#e4e7eb"
  fill-strong-dark: "#383838"
  line: "#e6e9ed"
  line-dark: "#333333"
  ink: "#0f1419"
  ink-dark: "#f1f1f1"
  muted: "#707579"
  muted-dark: "#a8a8a8"
  accent: "#3390ec"
  accent-dark: "#5aa7f2"
  accent-strong: "#1f6fc4"
  accent-strong-dark: "#2770c0"
  on-accent-strong: "#ffffff"
  success: "#2e8540"
  success-dark: "#6cc47b"
  danger: "#c62828"
  danger-dark: "#ff8a80"
  on-danger: "#ffffff"
  on-danger-dark: "#3b0a07"
  tile-empty: "#dfe5ec"
  tile-empty-dark: "#343a40"
  page-ground: "#f4f4f5"
  page-ground-dark: "#181818"
typography:
  title:
    fontFamily: "system-ui, Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "system-ui, Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "system-ui, Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  caption:
    fontFamily: "system-ui, Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.45
  micro:
    fontFamily: "system-ui, Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    fontFeature: "\"tnum\""
rounded:
  tile: "8px"
  field: "8px"
  button: "10px"
  card: "12px"
  pill: "16px"
  round: "50%"
spacing:
  tile-gap: "4px"
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  gutter: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent-strong}"
    rounded: "{rounded.button}"
    padding: "9px 16px"
    height: "38px"
  button-primary-disabled:
    backgroundColor: "{colors.fill-strong}"
    textColor: "{colors.muted}"
  button-secondary:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "9px 16px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.fill-strong}"
  filter-pill:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
    height: "30px"
  filter-pill-active:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent-strong}"
  text-button:
    backgroundColor: "transparent"
    textColor: "{colors.accent-strong}"
    typography: "{typography.label}"
    padding: "4px 2px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.round}"
    size: "36px"
  media-tile:
    backgroundColor: "{colors.tile-empty}"
    rounded: "{rounded.tile}"
  here-pill:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.on-accent-strong}"
    typography: "{typography.micro}"
    rounded: "10px"
    padding: "1px 9px"
  input-field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "8px 10px"
    height: "38px"
  settings-card:
    backgroundColor: "{colors.ground}"
    rounded: "{rounded.card}"
    padding: "4px 20px"
---

# Design System: Telegram Media Downloader

## Overview

**Creative North Star: "The Chat Mirror"**

The extension's pages sit beside Telegram Web and borrow its calm, quiet look: a white or near-black (#212121) ground, soft grey fills, one blue accent and system UI type at 11–16px. The side panel shows the chat it watches as a grid of rounded square tiles in chat order, grouped by day, with a blue "You are here" line where the reader is. Picking and progress share one surface. A tile never moves. Its download state appears on top of it, and a saved, failed or cancelled tile keeps that mark.

Density is high but calm. Tiles sit 4px apart in a 4-column grid (5 columns from 420px). The page has a 16px side margin and uses flat fills instead of cards. The panel is built for 320–400px and must hold long Russian and Burmese strings. Light and dark themes follow the operating system and are designed as pairs, not by inverting one theme.

The world matches Telegram's look but never its branding. The Telegram logo is never used. The name appears only inside the product's own name, "Telegram Media Downloader", which is an unofficial tool.

**Key Characteristics:**
- Telegram-matched light/dark grounds, grey fills and a single blue accent, split into a text-safe fill tone and a brighter non-text tone.
- System UI type only, 11–16px, weight 400 or 600, tabular numerals wherever counts or durations appear.
- Rounded square media tiles (8px), round check badges, pill filters.
- Download state is drawn on the tile itself: a scrim and ring while working or failed, a small corner stamp once settled.
- Almost no motion: the one authored moment is the status dot's "found" pulse.

## Colors

A quiet neutral system with one blue used two ways: a deeper tone behind white text and a brighter tone for marks that carry no text.

### Primary
- **Telegram Sky** (accent; dark: accent-dark): the non-text accent. Used for the selected-tile check badge, the 3px inset selection ring, the "You are here" rule, the bottom-bar progress strip, focus outlines and the text-selection tint. It never sits behind white text.
- **Deep Sky** (accent-strong; dark: accent-strong-dark): the fill under white text. Used for the primary button, the active filter pill and the "You are here" pill. It is also the colour of text buttons in light mode (dark mode uses Telegram Sky for text buttons). The settings page uses Deep Sky for links and the checkbox accent in light mode.

### Secondary
- **Saved Green** (success; dark: success-dark): the live-scan status dot, the saved/handed-off stamp and the settings "saved" confirmation.
- **Failure Red** (danger; dark: danger-dark): the failed-tile ring. Its glyph uses On-Danger (white in light mode, deep oxblood #3b0a07 in dark mode) so the mark stays at least 3:1 on the brighter dark-mode red.

### Neutral
- **Paper** (ground / ground-dark): the side panel ground and the settings card surface.
- **Settings Ground** (page-ground / page-ground-dark): the slightly darker page behind the settings cards. Only the settings page uses it.
- **Soft Fill** (fill / fill-dark): resting pills, secondary buttons and icon-button hover.
- **Pressed Fill** (fill-strong / fill-strong-dark): hover on pills and secondary buttons, the disabled primary button and the scrollbar thumb.
- **Hairline** (line / line-dark): 1px header and bottom-bar dividers, settings field separators and borders.
- **Ink** (ink / ink-dark): primary text.
- **Telegram Grey** (muted / muted-dark): secondary text: the status line, day headings, empty-state copy, hints and resting icons.
- **Unloaded Tile** (tile-empty / tile-empty-dark): a tile's ground before its thumbnail arrives.

### Named Rules
**The Two Blues Rule.** White text never sits on Telegram Sky (white on #3390ec is only 3.3:1). Any fill that carries text uses Deep Sky (5.1:1 at 13–14px). Telegram Sky is kept for marks without text: checks, rings, rules, progress and focus.

**The Paired Theme Rule.** Every colour token has a light and a dark value chosen together. Dark mode is not an inverted light mode. The dark accent, success and danger tones are lifted, and contrast is checked again for each pair.

## Typography

**Body Font:** system-ui (with Segoe UI, Roboto, Noto Sans, Noto Sans Myanmar, sans-serif)

**Character:** The platform's own UI face, as Telegram Web uses. Noto Sans Myanmar is in the stack so Burmese renders without fallback gaps. There is no display face. Hierarchy comes from weight (400/600) and colour (Ink vs Telegram Grey), not size jumps.

### Hierarchy
- **Title** (600, 16px, 1.3): the chat title in the panel header, truncated with an ellipsis. The settings page heading uses 600 at 18px. Empty-state and settings section headings use 600 at 15px.
- **Body** (400, 14px, 1.45; settings page 1.5): default text, the bottom-bar summary (the count in 600 with tabular numerals) and button labels (600).
- **Label** (13px): filter pills, the status line, text buttons (500) and day headings (600, Telegram Grey). Settings hints use the same size.
- **Caption** (12px): the bottom-bar note and the percentage on in-progress tiles (600, tabular numerals).
- **Micro** (600, 11px, 16px line): video duration badges and the "You are here" pill.

### Named Rules
**The Tabular Count Rule.** Every number that changes (filter counts, durations, progress percentages, the selection count) uses tabular numerals so it doesn't jitter as it updates.

## Layout

The side panel is a full-height flex column: header, toolbar, a scrolling list and a bottom bar. The header (14px 16px 10px) and bottom bar (10px 16px 12px) are separated from the list by 1px Hairline rules. The toolbar's pill filters wrap onto a second line when a translation is long. Day headings are sticky, on a 94% Paper ground so tiles fade underneath them. The tile grid is 4 equal columns with a 4px gap and a 16px side margin, and becomes 5 columns at 420px wide. The "You are here" marker spans the full grid row between tiles. Empty states are centred with copy capped at 30ch.

The settings page is a single column, at most 560px wide, with 24px between cards. Fields are separated by Hairline rules, not boxed.

Long strings wrap (`overflow-wrap: anywhere`) instead of truncating. The chat title and button labels are the exceptions.

## Elevation & Depth

Flat by default, with tonal layering. Depth comes from fills and hairlines. The one structural shadow is the bottom bar's upward shadow over the scrolling list. Other shadows are small and only there to keep white or coloured marks legible over arbitrary photo thumbnails.

### Shadow Vocabulary
- **Bar lift** (`0 -6px 18px rgb(15 20 25 / 0.08)`; dark `rgb(0 0 0 / 0.35)`): the sticky bottom bar over the list.
- **Badge lift** (`0 1px 3px rgb(0 0 0 / 0.3)`): the round check badge over thumbnails.
- **Ring lift** (`0 2px 6px rgb(0 0 0 / 0.35)`): the centred state ring on working and failed tiles.

### Named Rules
**The Legibility-Only Shadow Rule.** Inside the list, a shadow exists only to separate a mark from an unknown photo behind it. Tiles, pills and buttons have no shadow.

## Shapes

Soft rounded rectangles, plus true circles for single marks. Tiles and fields are rounded 8px, buttons 10px and settings cards 12px. Filter pills are fully rounded, and duration badges and the "You are here" pill are rounded the same way at their own size. Check badges, state rings, icon buttons and the status dot are circles. Tiles are always square (aspect-ratio 1) and crop thumbnails to cover.

## Components

### Buttons
- **Shape:** gently rounded (10px), 38px minimum height, 600 weight.
- **Primary:** Deep Sky with white text, 9px 16px. There is one per surface: Download in the bottom bar, or the call to action in an empty state.
- **Hover / Focus:** hover darkens the fill (Deep Sky mixed 88% with black). Focus shows a 2px Telegram Sky outline 2px outside the button. Disabled uses Pressed Fill with Telegram Grey text.
- **Secondary:** Soft Fill, with Pressed Fill on hover.
- **Text button:** no fill, Deep Sky label (Telegram Sky in dark mode), 13px/500, and an underline on hover. Used for Select all, Select day / Clear day and Clear.
- **Icon button:** a 36px circle, Telegram Grey icon, Soft Fill and Ink on hover.

### Chips
- **Style:** pill filters (All / Photos / Videos) on Soft Fill, 13px, 30px minimum height. Each count is shown at 75% opacity with tabular numerals.
- **State:** the active pill is Deep Sky with white text, and hover is Pressed Fill. Filters act as a radio group (`aria-checked`).

### Media Tile (signature)
- **Rest:** a square on Unloaded Tile with the thumbnail set to cover, 8px radius. A round check badge sits top-left: 22px, 2px white border, translucent black. Videos show a duration badge bottom-right (11px, black at 55%, play glyph).
- **Selected:** the check fills Telegram Sky and shows the check glyph, and a 3px inset Telegram Sky ring outlines the tile.
- **Press:** scales to 0.96 (160ms).
- **Queued / Preparing:** black scrim at 35%, with a 3px white meter at the bottom (a static 12% while preparing, never looping).
- **Downloading:** Scrim (42% / 55% dark), centred percentage (600, 12px), and the meter filling white.
- **Failed:** Scrim with a centred 30px Failure Red ring carrying the alert glyph in On-Danger.
- **Saved / Cancelled:** no scrim, so the picture stays clear. A 20px stamp sits top-right: Saved Green with a white check, or dark grey (rgb 40 40 40 / 0.85) with a white cross. The check badge stays top-left and the duration bottom-right.

### "You are here" Marker (signature)
A full-row, 2px Telegram Sky rule followed by a Deep Sky pill (white, 11px/600) reading "You are here". It moves with the chat's scroll position (320ms transform).

### Status Line
A 13px Telegram Grey line under the chat title, led by an 8px dot. The dot is Telegram Grey when idle and Saved Green while scanning is live. When new media is found, the dot pulses once (scales to 1.35 with a green halo, 900ms). This is the panel's only authored animation.

### Inputs / Fields
- **Style:** Paper fill, 1px Hairline border, 8px radius, 8px 10px padding, 38px minimum height. Checkboxes are 18px using the system control tinted with the accent.
- **Focus:** the global 2px accent outline, offset 2px.

### Settings Card
A Paper card with a 1px Hairline border and 12px radius on the Settings Ground. Fields are stacked inside it with a label (600), the control, and a 13px Telegram Grey hint. The settings header uses the extension's own download icon, never Telegram's logo.

## Do's and Don'ts

### Do:
- **Do** put white text only on Deep Sky (#1f6fc4 light / #2770c0 dark); keep Telegram Sky (#3390ec / #5aa7f2) for checks, rings, rules, progress and focus.
- **Do** keep every download state on its tile: scrim and centred ring while working or failed; a 20px top-right stamp with no scrim once saved or cancelled.
- **Do** use On-Danger (#fff light / #3b0a07 dark) for any mark on Failure Red.
- **Do** use tabular numerals for every count, duration and percentage.
- **Do** disable all transitions and animations under `prefers-reduced-motion: reduce`.
- **Do** let long translations wrap; test at 320px in Russian and Burmese.

### Don't:
- **Don't** use Telegram's logo or present the extension as a Telegram product; the name is only ever used as part of the product's own name.
- **Don't** add looping or decorative motion; the status dot's single "found" pulse is the only authored animation, and preparing tiles show a static meter.
- **Don't** reorder or move tiles when their state changes.
- **Don't** put a scrim over saved or cancelled tiles; the picture stays visible.
- **Don't** add shadows to tiles, pills or buttons.
