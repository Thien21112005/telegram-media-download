// SPDX-License-Identifier: GPL-3.0-only

// Options page: settings shared with the content scripts through chrome.storage.sync.
(() => {
  const { UI_LANGUAGES, matchLanguage, translate } = TelI18n;
  const $ = (id) => document.getElementById(id);
  let settings = { ...TelSettings.DEFAULTS };

  const resolveLanguage = () => settings.language !== "auto" ? settings.language :
    [...(navigator.languages || []), chrome.i18n.getUILanguage()].map(matchLanguage).find(Boolean) || "en";

  const render = () => {
    const language = resolveLanguage();
    const t = (key, params) => translate(language, key, params);
    document.documentElement.lang = language;
    $("title").textContent = t("optionsTitle");
    $("language-label").textContent = t("language");
    $("concurrency-label").textContent = t("optionConcurrency");
    $("folder-label").textContent = t("optionFolder");
    $("folder-hint").textContent = t("optionFolderHint");
    $("ask-label").textContent = t("optionAskWhere");
    $("ask-hint").textContent = t("optionAskWhereHint");
    $("about-title").textContent = t("aboutTitle");
    $("about-credit").textContent = t("aboutCredit", { author: "Nestor Qin" });
    $("about-maintainer").textContent = t("aboutMaintainer", { maintainer: "Thien21112005" });
    $("about-license").textContent = t("aboutLicense");
    $("source").textContent = t("sourceCode");

    const select = $("language");
    select.replaceChildren(...[["auto", t("automatic")], ...Object.entries(UI_LANGUAGES)].map(([value, label]) => {
      const option = new Option(label, value);
      if (value !== "auto") option.lang = value;
      return option;
    }));
    select.value = settings.language;
    $("concurrency").value = String(settings.concurrency);
    if (document.activeElement !== $("folder")) $("folder").value = settings.folderTemplate;
    $("ask").checked = settings.askWhereToSave;
  };

  let savedTimer;
  const save = async (patch) => {
    settings = TelSettings.normalize({ ...settings, ...patch }, UI_LANGUAGES);
    await chrome.storage.sync.set(settings);
    render();
    const saved = $("saved");
    saved.textContent = translate(resolveLanguage(), "settingsSaved");
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => { saved.textContent = ""; }, 2000);
  };

  $("form").addEventListener("submit", (event) => event.preventDefault());
  $("language").onchange = (event) => save({ language: event.target.value });
  $("concurrency").onchange = (event) => save({ concurrency: Number(event.target.value) });
  $("ask").onchange = (event) => save({ askWhereToSave: event.target.checked });
  $("folder").onchange = (event) => save({ folderTemplate: event.target.value.trim() });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    chrome.storage.sync.get(TelSettings.DEFAULTS).then((stored) => {
      settings = TelSettings.normalize(stored, UI_LANGUAGES);
      render();
    });
  });
  chrome.storage.sync.get(TelSettings.DEFAULTS).then((stored) => {
    settings = TelSettings.normalize(stored, UI_LANGUAGES);
    render();
  });
})();
