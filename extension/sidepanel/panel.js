// SPDX-License-Identifier: GPL-3.0-only

// Side panel: mirrors the media of the chat open in the active Telegram tab,
// in chat order and grouped by day, and downloads the selected items.
(() => {
  const { UI_LANGUAGES, matchLanguage, translate } = TelI18n;
  const TELEGRAM_URL = /^https:\/\/(web|webk|webz)\.telegram\.org\//;
  const FINAL_STATES = new Set(["completed", "handedOff", "failed", "cancelled"]);
  const $ = (id) => document.getElementById(id);

  let language = "en";
  const t = (key, params) => translate(language, key, params);
  let numberFormat = new Intl.NumberFormat("en");

  const state = {
    tabId: null,
    status: "loading", // loading | no-telegram | reload | ready
    chat: { key: "", title: "" },
    items: new Map(),   // id -> item from the scanner
    tasks: new Map(),   // item id -> latest task update
    selected: new Set(),
    batch: new Set(),   // item ids sent for download in the current batch
    onScreen: new Set(),
    filter: "all",
    anchor: null,       // last clicked tile, for shift-click ranges
    followMarker: true,
  };
  const tiles = new Map(); // item id -> tile element (kept so previews never reload)

  // The panel can be pointed at a tab for testing: sidepanel/index.html?tab=<id>
  const pinnedTab = Number(new URLSearchParams(location.search).get("tab")) || null;

  const send = async (message) => {
    if (state.tabId === null) return null;
    try {
      return await chrome.tabs.sendMessage(state.tabId, message);
    } catch {
      return undefined; // No content script in that tab.
    }
  };

  // ---- Language ----
  const applyLanguage = (preference) => {
    language = preference !== "auto" && Object.hasOwn(UI_LANGUAGES, preference) ? preference :
      [...(navigator.languages || []), chrome.i18n.getUILanguage()].map(matchLanguage).find(Boolean) || "en";
    numberFormat = new Intl.NumberFormat(language);
    document.documentElement.lang = language;
    $("open-settings").title = t("openSettings");
    $("open-settings").setAttribute("aria-label", t("openSettings"));
    $("filters").setAttribute("aria-label", t("filterGroup"));
    for (const button of document.querySelectorAll("[data-filter]")) {
      button.querySelector("[data-label]").textContent =
        t({ all: "filterAll", image: "filterPhotos", video: "filterVideos" }[button.dataset.filter]);
    }
    $("clear-selection").textContent = t("clearSelection");
    $("cancel").textContent = t("cancelAll");
    for (const [id, tile] of tiles) updateTile(tile, state.items.get(id));
    render();
  };

  // ---- Connection to the Telegram tab ----
  const connect = async () => {
    let tab;
    if (pinnedTab) tab = await chrome.tabs.get(pinnedTab).catch(() => null);
    else [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.tabId = tab?.id ?? null;
    if (!tab || !TELEGRAM_URL.test(tab.url || "")) {
      setStatus("no-telegram");
      return;
    }
    const snapshot = await send({ type: "scan:get" });
    if (!snapshot) {
      setStatus("reload");
      return;
    }
    loadSnapshot(snapshot);
  };
  const setStatus = (status) => {
    state.status = status;
    render();
  };
  const loadSnapshot = (snapshot) => {
    if (snapshot.chat.key !== state.chat.key) {
      state.items.clear();
      state.tasks.clear();
      state.selected.clear();
      state.batch.clear();
      state.anchor = null;
      tiles.clear();
    }
    state.chat = snapshot.chat;
    state.onScreen = new Set(snapshot.view || []);
    for (const item of snapshot.items) state.items.set(item.id, item);
    state.status = snapshot.supported ? "ready" : "no-telegram";
    state.followMarker = true;
    render();
  };

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!sender.tab || sender.tab.id !== state.tabId) return;
    if (message.type === "media") {
      if (message.reset || message.chat?.key !== state.chat.key) {
        send({ type: "scan:get" }).then((snapshot) => snapshot && loadSnapshot(snapshot));
        return;
      }
      if (message.chat.title) state.chat.title = message.chat.title;
      for (const item of message.items) {
        state.items.set(item.id, item);
        const tile = tiles.get(item.id);
        if (tile) updateTile(tile, item);
      }
      if (state.status !== "ready") state.status = "ready";
      render();
    } else if (message.type === "view" && message.chat?.key === state.chat.key) {
      state.onScreen = new Set(message.ids);
      for (const [id, tile] of tiles) tile.dataset.onScreen = String(state.onScreen.has(id));
      placeMarker();
    } else if (message.type === "task" && message.task?.itemId) {
      state.tasks.set(message.task.itemId, message.task);
      const tile = tiles.get(message.task.itemId);
      if (tile) updateTile(tile, state.items.get(message.task.itemId));
      renderBar();
    }
  });
  chrome.tabs.onActivated.addListener(() => { if (!pinnedTab) connect(); });
  chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (tabId === state.tabId && change.status === "complete") connect();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.language) applyLanguage(changes.language.newValue || "auto");
  });

  // ---- Rendering ----
  const visibleItems = () => {
    const items = Array.from(state.items.values())
      .filter((item) => state.filter === "all" || item.kind === state.filter);
    // Chat order: message ids increase with time.
    return items.sort((a, b) => Number(a.mid) - Number(b.mid) || a.mid.localeCompare(b.mid));
  };

  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const createTile = (item) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.setAttribute("role", "checkbox");
    tile.dataset.id = item.id;
    tile.innerHTML = `<span class="placeholder">${icon("photo")}</span><span class="check">${icon("check")}</span>`;
    tile.addEventListener("click", (event) => toggle(item.id, event.shiftKey));
    tiles.set(item.id, tile);
    updateTile(tile, item);
    return tile;
  };
  const updateTile = (tile, item) => {
    if (!item) return;
    if (item.thumb && tile.dataset.thumb !== "1") {
      tile.style.backgroundImage = `url("${item.thumb}")`;
      tile.dataset.thumb = "1";
      tile.querySelector(".placeholder")?.remove();
    }
    const label = item.kind === "video" ? t("tileVideo", { duration: item.duration || "" }).trim() : t("tilePhoto");
    const task = state.tasks.get(item.id);
    const taskLabel = task ? `, ${t(task.state)}${task.error ? `: ${task.error}` : ""}` : "";
    tile.setAttribute("aria-label", label + taskLabel);
    tile.setAttribute("aria-checked", String(state.selected.has(item.id)));
    tile.dataset.onScreen = String(state.onScreen.has(item.id));
    tile.title = task?.error || "";

    let badge = tile.querySelector(".badge");
    if (item.kind === "video") {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "badge";
        tile.appendChild(badge);
      }
      badge.innerHTML = `${icon("play")}${item.duration ? `<span></span>` : ""}`;
      if (item.duration) badge.querySelector("span").textContent = item.duration;
    }

    tile.dataset.state = task?.state || "";
    let overlay = tile.querySelector(".state");
    if (!task) {
      overlay?.remove();
      return;
    }
    if (!overlay) {
      overlay = document.createElement("span");
      overlay.className = "state";
      tile.appendChild(overlay);
    }
    const percent = task.total ? Math.min(100, Math.floor((task.received * 100) / task.total)) : null;
    if (task.state === "downloading" || task.state === "saving") {
      overlay.innerHTML = `<span></span><span class="meter"><i></i></span>`;
      overlay.firstChild.textContent = percent === null ? "" : `${numberFormat.format(percent)}%`;
      overlay.querySelector(".meter i").style.width = `${percent ?? 15}%`;
    } else if (task.state === "completed" || task.state === "handedOff") {
      overlay.innerHTML = `<span class="ring">${icon("check")}</span>`;
    } else if (task.state === "failed") {
      overlay.innerHTML = `<span class="ring">${icon("alert")}</span>`;
    } else if (task.state === "cancelled") {
      overlay.innerHTML = `<span class="ring">${icon("stop")}</span>`;
    } else {
      overlay.innerHTML = `<span></span>`;
      overlay.firstChild.textContent = t(task.state);
    }
  };

  const markerElement = document.createElement("div");
  markerElement.className = "here";
  markerElement.setAttribute("role", "separator");
  markerElement.innerHTML = "<span></span>";
  const placeMarker = () => {
    markerElement.querySelector("span").textContent = t("youAreHere");
    const shown = visibleItems().filter((item) => state.onScreen.has(item.id));
    const last = shown.length ? tiles.get(shown[shown.length - 1].id) : null;
    if (!last || !last.isConnected) {
      markerElement.remove();
      return;
    }
    if (markerElement.previousElementSibling !== last) last.after(markerElement);
    if (state.followMarker) markerElement.scrollIntoView({ block: "nearest" });
  };

  const render = () => {
    const ready = state.status === "ready";
    $("chat-title").textContent = ready && state.chat.title ? state.chat.title : "Telegram Media Downloader";
    const statusLine = $("status");
    statusLine.dataset.live = String(ready);
    $("status-text").textContent = ready
      ? `${t("panelScanning")} · ${t("panelFound", { count: numberFormat.format(state.items.size) })}`
      : "";
    statusLine.hidden = !ready;

    const showEmpty = !ready || state.items.size === 0;
    $("toolbar").hidden = !ready || state.items.size === 0;
    $("list").hidden = showEmpty;
    $("empty").hidden = !showEmpty;
    if (showEmpty) renderEmpty();
    else renderList();
    renderBar();
  };

  const renderEmpty = () => {
    const action = $("empty-action");
    action.hidden = true;
    const set = (title, hint, actionLabel, onAction) => {
      $("empty-title").textContent = title;
      $("empty-hint").textContent = hint;
      if (actionLabel) {
        action.hidden = false;
        action.textContent = actionLabel;
        action.onclick = onAction;
      }
    };
    if (state.status === "loading") set("", "");
    else if (state.status === "no-telegram") {
      set(t("emptyNoTelegram"), t("emptyNoTelegramHint"), t("openTelegram"), () => {
        const url = "https://web.telegram.org/k/";
        if (state.tabId !== null) chrome.tabs.update(state.tabId, { url });
        else chrome.tabs.create({ url });
      });
    } else if (state.status === "reload") {
      set(t("emptyReload"), t("emptyReloadHint"), t("reloadTab"), () => chrome.tabs.reload(state.tabId));
    } else {
      set(state.chat.key === "chat" ? t("emptyNoChat") : t("emptyNoMedia"), t("emptyNoMediaHint"));
    }
  };

  const renderList = () => {
    const all = Array.from(state.items.values());
    const counts = { all: all.length, image: all.filter((i) => i.kind === "image").length, video: all.filter((i) => i.kind === "video").length };
    for (const button of document.querySelectorAll("[data-filter]")) {
      button.setAttribute("aria-checked", String(button.dataset.filter === state.filter));
      button.querySelector(".count").textContent = numberFormat.format(counts[button.dataset.filter]);
    }
    const items = visibleItems();
    const allSelected = items.length > 0 && items.every((item) => state.selected.has(item.id));
    $("select-all").textContent = t(allSelected ? "clearSelection" : "selectAll");
    $("select-all").hidden = items.length === 0;

    const list = $("list");
    const fragment = document.createDocumentFragment();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "filter-empty";
      empty.textContent = t(state.filter === "video" ? "emptyVideos" : "emptyPhotos");
      fragment.appendChild(empty);
    }
    const days = new Map();
    for (const item of items) {
      const day = item.day || "";
      if (!days.has(day)) days.set(day, []);
      days.get(day).push(item);
    }
    for (const [day, dayItems] of days) {
      const head = document.createElement("div");
      head.className = "day-head";
      const title = document.createElement("h2");
      title.textContent = day || t("dateUnknown");
      const daySelected = dayItems.every((item) => state.selected.has(item.id));
      const toggleDay = document.createElement("button");
      toggleDay.type = "button";
      toggleDay.className = "text-button";
      toggleDay.textContent = t(daySelected ? "clearDay" : "selectDay");
      toggleDay.setAttribute("aria-label", `${t(daySelected ? "clearDay" : "selectDay")}: ${title.textContent}`);
      toggleDay.onclick = () => selectMany(dayItems.map((item) => item.id), !daySelected);
      head.append(title, toggleDay);
      const grid = document.createElement("div");
      grid.className = "grid";
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-label", title.textContent);
      for (const item of dayItems) {
        const tile = tiles.get(item.id) || createTile(item);
        updateTile(tile, item);
        grid.appendChild(tile);
      }
      fragment.append(head, grid);
    }
    const scrollTop = list.scrollTop;
    list.replaceChildren(fragment);
    list.scrollTop = scrollTop;
    placeMarker();
  };

  const renderBar = () => {
    const ready = state.status === "ready" && state.items.size > 0;
    $("bar").hidden = !ready;
    if (!ready) return;
    const batch = Array.from(state.batch);
    const done = batch.filter((id) => FINAL_STATES.has(state.tasks.get(id)?.state)).length;
    const running = batch.length > 0 && done < batch.length;
    const count = state.selected.size;
    const summary = $("bar-summary");
    if (running) summary.textContent = t("downloadingSummary", { done: numberFormat.format(done), total: numberFormat.format(batch.length) });
    else if (count) summary.textContent = t("selectedSummary", { count: numberFormat.format(count) });
    else if (batch.length) summary.textContent = t("batchDone", { done: numberFormat.format(done), total: numberFormat.format(batch.length) });
    else summary.textContent = t("pickHint");
    $("clear-selection").hidden = !count || running;
    $("cancel").hidden = !running;
    const download = $("download");
    download.textContent = count ? t("downloadSelected", { count: numberFormat.format(count) }) : t("download");
    download.disabled = count === 0;
    download.hidden = running && count === 0;
    $("bar-progress").parentElement.hidden = !running;
    $("bar-progress").style.width = running ? `${(done / batch.length) * 100}%` : "0";
    $("bar-note").hidden = !running;
    $("bar-note").textContent = t("batchNote");
  };

  // ---- Selection and actions ----
  const refreshSelectionViews = () => {
    for (const [id, tile] of tiles) tile.setAttribute("aria-checked", String(state.selected.has(id)));
    renderList();
    renderBar();
  };
  const selectMany = (ids, select) => {
    for (const id of ids) select ? state.selected.add(id) : state.selected.delete(id);
    refreshSelectionViews();
  };
  const toggle = (id, range) => {
    const order = visibleItems().map((item) => item.id);
    if (range && state.anchor && order.includes(state.anchor)) {
      const [from, to] = [order.indexOf(state.anchor), order.indexOf(id)].sort((a, b) => a - b);
      selectMany(order.slice(from, to + 1), !state.selected.has(id));
    } else {
      selectMany([id], !state.selected.has(id));
    }
    state.anchor = id;
    tiles.get(id)?.focus();
  };

  $("select-all").onclick = () => {
    const ids = visibleItems().map((item) => item.id);
    selectMany(ids, !ids.every((id) => state.selected.has(id)));
  };
  $("clear-selection").onclick = () => selectMany(Array.from(state.selected), false);
  for (const button of document.querySelectorAll("[data-filter]")) {
    button.onclick = () => {
      state.filter = button.dataset.filter;
      renderList();
    };
  }
  $("download").onclick = async () => {
    const ids = Array.from(state.selected).filter((id) => state.items.has(id));
    if (!ids.length) return;
    // Starting a new batch after the last one finished replaces it.
    const previous = Array.from(state.batch);
    if (previous.every((id) => FINAL_STATES.has(state.tasks.get(id)?.state))) state.batch.clear();
    for (const id of ids) {
      state.batch.add(id);
      state.tasks.set(id, { itemId: id, state: "queued", received: 0, total: null, error: "" });
    }
    state.selected.clear();
    refreshSelectionViews();
    await send({ type: "scan:download", ids });
  };
  $("cancel").onclick = async () => {
    await send({ type: "scan:cancel" });
    for (const id of state.batch) {
      const task = state.tasks.get(id);
      if (task?.id && !FINAL_STATES.has(task.state)) send({ type: "task:cancel", taskId: task.id });
    }
  };
  $("open-settings").onclick = () => chrome.runtime.openOptionsPage();
  // Stop following the reader's place once the user scrolls the panel themselves.
  $("list").addEventListener("wheel", () => { state.followMarker = false; }, { passive: true });
  $("list").addEventListener("keydown", (event) => {
    if (["PageDown", "PageUp", "ArrowDown", "ArrowUp"].includes(event.key)) state.followMarker = false;
  });

  // ---- Start ----
  chrome.storage.sync.get(TelSettings.DEFAULTS).then((settings) => {
    applyLanguage(TelSettings.normalize(settings, UI_LANGUAGES).language);
    connect();
  });
})();
