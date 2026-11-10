---
version: 1
slug: "extension-sidepanel-index-html"
primary_target: "extension/sidepanel/index.html"
related_targets: []
---

# Side panel: media picker

Scope: the extension side panel (extension/sidepanel/), Operate mode. Sits beside Telegram Web at 320–400px while the user scrolls a chat.

Audience and job: people saving a few items or archiving a whole chat (30–200 items per session). They scroll the chat, tick media in the panel, download in one go, and watch each file finish.

Constraints: plain HTML/CSS/JS; Telegram-matched light and dark themes without Telegram branding; six interface languages incl. long Russian/Burmese strings; keyboard and screen reader support; works with no Telegram tab, an unsupported page, an empty chat and errors.

Unresolved: audio/files are out of the v1 list.

## Direction contract

THESIS: The panel mirrors the chat it watches: media in chat order, grouped by day, with a live marker for where the reader is. It refuses the generic download-manager list that separates picking from progress.

OWN-WORLD: Telegram Web's calm system: white or #212121-dark ground, #f1f3f5 / #2c2c2c secondary fills, #3390ec accent for selection and the primary action, #707579 secondary text, system UI type at 13–16px, 8px tile radius, round check badges, pill filters.

STORY: The reader sees the chat's media appear as they scroll, understands which day each belongs to and where they are, ticks items or whole days, and downloads; every tile then carries its own state and never moves.

FIRST VIEWPORT: Header with chat title and a live scan status line; pill filters All / Photos / Videos with counts; day sections with a "Select day" toggle and 4-column square tiles (round check top-left, duration bottom-right); a blue "You are here" rule between days; sticky bottom bar with selection summary and the primary Download button.

FORM: Chat mirror, dealt lead (position 7 of 7 on my ordered list); seed:bac09f90500f2892. Signature move: the "You are here" rule tracking the chat's scroll position; progress overlays tiles in place and saved/failed/cancelled states stay stamped on them.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
