// SPDX-License-Identifier: GPL-3.0-only
// Based on the Telegram Media Downloader userscript by Nestor Qin
// (https://github.com/Neet-Nestor/Telegram-Media-Downloader).
// Modified for the Chrome extension by Thien21112005.

// Message catalogs shared by the content scripts, side panel and options page.
(function () {
  if (globalThis.TelI18n) return;
  const UI_LANGUAGES = {
    en: "English", "zh-CN": "简体中文", "zh-TW": "繁體中文", ru: "Русский", my: "မြန်မာ",
  };
  const UI_MESSAGES = {
    en: {
      downloads: "Downloads", downloadsCount: "Downloads ({count})", mediaDownloads: "Media downloads",
      download: "Download", loadingMedia: "Media is loading", hide: "Hide", show: "Show",
      dismiss: "Dismiss download", progress: "Download progress", cancel: "Cancel", retry: "Retry",
      settings: "Settings", language: "Interface language", automatic: "Browser language",
      preparing: "Preparing", queued: "Queued", downloading: "Downloading", saving: "Saving",
      completed: "Completed", handedOff: "Sent to browser", failed: "Failed", cancelled: "Cancelled",
      rate: "{speed}/s", video: "video", audio: "audio", image: "image", unknownType: "an unknown file type",
      errorHttp: "Download request failed (HTTP {status})",
      errorMime: "Expected {kind}, received {mime}",
      errorRangeMissing: "Missing or invalid Content-Range",
      errorRangeInconsistent: "Inconsistent media range; download stopped to avoid a corrupt file",
      errorRangeUnsupported: "Server stopped supporting partial downloads",
      errorLength: "Invalid Content-Length", errorEmpty: "Empty media response",
      errorTooLarge: "Media response exceeds the expected size",
      errorIncomplete: "Incomplete media response; received byte count does not match",
      errorTimeout: "No data received for 30 seconds. Please retry.",
      errorUnexpected: "Download failed: {message}",
    },
    "zh-CN": {
      downloads: "下载", downloadsCount: "下载（{count}）", mediaDownloads: "媒体下载",
      download: "下载", loadingMedia: "媒体正在加载", hide: "收起", show: "展开",
      dismiss: "移除下载卡片", progress: "下载进度", cancel: "取消", retry: "重试",
      settings: "设置", language: "界面语言", automatic: "跟随浏览器",
      preparing: "准备中", queued: "排队中", downloading: "下载中", saving: "保存中",
      completed: "已完成", handedOff: "已交给浏览器", failed: "失败", cancelled: "已取消",
      rate: "{speed}/秒", video: "视频", audio: "音频", image: "图片", unknownType: "未知文件类型",
      errorHttp: "下载请求失败（HTTP {status}）",
      errorMime: "预期为{kind}，实际收到 {mime}",
      errorRangeMissing: "缺少 Content-Range，或其格式无效",
      errorRangeInconsistent: "媒体数据范围不一致；已停止下载，避免保存损坏的文件",
      errorRangeUnsupported: "服务器不再支持分段下载",
      errorLength: "Content-Length 无效", errorEmpty: "媒体响应为空",
      errorTooLarge: "收到的媒体数据超出预期大小",
      errorIncomplete: "媒体数据不完整；收到的字节数与预期不符",
      errorTimeout: "已连续 30 秒未收到数据，请重试。",
      errorUnexpected: "下载失败：{message}",
    },
    "zh-TW": {
      downloads: "下載", downloadsCount: "下載（{count}）", mediaDownloads: "媒體下載",
      download: "下載", loadingMedia: "媒體正在載入", hide: "收合", show: "展開",
      dismiss: "移除下載卡片", progress: "下載進度", cancel: "取消", retry: "重試",
      settings: "設定", language: "介面語言", automatic: "跟隨瀏覽器",
      preparing: "準備中", queued: "排隊中", downloading: "下載中", saving: "儲存中",
      completed: "已完成", handedOff: "已交給瀏覽器", failed: "失敗", cancelled: "已取消",
      rate: "{speed}/秒", video: "影片", audio: "音訊", image: "圖片", unknownType: "未知檔案類型",
      errorHttp: "下載請求失敗（HTTP {status}）",
      errorMime: "預期為{kind}，實際收到 {mime}",
      errorRangeMissing: "缺少 Content-Range，或其格式無效",
      errorRangeInconsistent: "媒體資料範圍不一致；已停止下載，避免儲存損壞的檔案",
      errorRangeUnsupported: "伺服器不再支援分段下載",
      errorLength: "Content-Length 無效", errorEmpty: "媒體回應為空",
      errorTooLarge: "收到的媒體資料超出預期大小",
      errorIncomplete: "媒體資料不完整；收到的位元組數與預期不符",
      errorTimeout: "已連續 30 秒未收到資料，請重試。",
      errorUnexpected: "下載失敗：{message}",
    },
    ru: {
      downloads: "Загрузки", downloadsCount: "Загрузки ({count})", mediaDownloads: "Загрузка медиа",
      download: "Скачать", loadingMedia: "Медиа загружается", hide: "Свернуть", show: "Развернуть",
      dismiss: "Убрать карточку загрузки", progress: "Ход загрузки", cancel: "Отменить", retry: "Повторить",
      settings: "Настройки", language: "Язык интерфейса", automatic: "Язык браузера",
      preparing: "Подготовка", queued: "В очереди", downloading: "Загрузка", saving: "Сохранение",
      completed: "Завершено", handedOff: "Передано браузеру", failed: "Ошибка", cancelled: "Отменено",
      rate: "{speed}/с", video: "видео", audio: "аудио", image: "изображение", unknownType: "неизвестный тип файла",
      errorHttp: "Ошибка запроса загрузки (HTTP {status})",
      errorMime: "Ожидалось: {kind}. Получено: {mime}",
      errorRangeMissing: "Заголовок Content-Range отсутствует или некорректен",
      errorRangeInconsistent: "Диапазоны данных не совпадают; загрузка остановлена во избежание повреждения файла",
      errorRangeUnsupported: "Сервер больше не поддерживает загрузку по частям",
      errorLength: "Некорректный Content-Length", errorEmpty: "Получен пустой ответ с медиа",
      errorTooLarge: "Размер полученных данных превышает ожидаемый",
      errorIncomplete: "Данные неполные; число полученных байтов не совпадает с ожидаемым",
      errorTimeout: "Нет данных в течение 30 секунд. Повторите попытку.",
      errorUnexpected: "Не удалось скачать: {message}",
    },
    my: {
      downloads: "ဒေါင်းလုဒ်များ", downloadsCount: "ဒေါင်းလုဒ်များ ({count})", mediaDownloads: "မီဒီယာဒေါင်းလုဒ်များ",
      download: "ဒေါင်းလုဒ်လုပ်ရန်", loadingMedia: "မီဒီယာကို ဖွင့်နေသည်", hide: "ဖျောက်ရန်", show: "ပြရန်",
      dismiss: "ဒေါင်းလုဒ်ကတ်ကို ဖယ်ရှားရန်", progress: "ဒေါင်းလုဒ်တိုးတက်မှု", cancel: "ပယ်ဖျက်ရန်", retry: "ထပ်စမ်းရန်",
      settings: "ဆက်တင်များ", language: "မျက်နှာပြင်ဘာသာစကား", automatic: "ဘရောက်ဇာဘာသာစကား",
      preparing: "ပြင်ဆင်နေသည်", queued: "စောင့်ဆိုင်းနေသည်", downloading: "ဒေါင်းလုဒ်လုပ်နေသည်", saving: "သိမ်းဆည်းနေသည်",
      completed: "ပြီးစီးပြီ", handedOff: "ဘရောက်ဇာသို့ လွှဲပေးပြီး", failed: "မအောင်မြင်ပါ", cancelled: "ပယ်ဖျက်ပြီး",
      rate: "{speed}/စက္ကန့်", video: "ဗီဒီယို", audio: "အသံ", image: "ပုံ", unknownType: "အမည်မသိ ဖိုင်အမျိုးအစား",
      errorHttp: "ဒေါင်းလုဒ်တောင်းဆိုမှု မအောင်မြင်ပါ (HTTP {status})",
      errorMime: "မျှော်လင့်ထားသည်မှာ {kind}၊ ရရှိသည်မှာ {mime}",
      errorRangeMissing: "Content-Range မရှိပါ သို့မဟုတ် မမှန်ကန်ပါ",
      errorRangeInconsistent: "မီဒီယာဒေတာအပိုင်းများ မကိုက်ညီပါ။ ဖိုင်မပျက်စီးစေရန် ဒေါင်းလုဒ်ကို ရပ်လိုက်သည်",
      errorRangeUnsupported: "ဆာဗာသည် အပိုင်းလိုက်ဒေါင်းလုဒ်ကို မပံ့ပိုးတော့ပါ",
      errorLength: "Content-Length မမှန်ကန်ပါ", errorEmpty: "မီဒီယာတုံ့ပြန်မှုတွင် ဒေတာမပါပါ",
      errorTooLarge: "ရရှိသော မီဒီယာဒေတာသည် မျှော်လင့်ထားသည့် ပမာဏထက် ကျော်လွန်နေသည်",
      errorIncomplete: "မီဒီယာဒေတာ မပြည့်စုံပါ။ ရရှိသော ဘိုက်အရေအတွက် မကိုက်ညီပါ",
      errorTimeout: "စက္ကန့် ၃၀ ကြာ ဒေတာမရရှိပါ။ ထပ်စမ်းပါ။",
      errorUnexpected: "ဒေါင်းလုဒ် မအောင်မြင်ပါ: {message}",
    },
  };
  const matchLanguage = (tag) => {
    const parts = String(tag || "").toLowerCase().replace(/_/g, "-").split("-");
    if (parts[0] === "zh") {
      if (parts.includes("hant")) return "zh-TW";
      if (parts.includes("hans")) return "zh-CN";
      return parts.some(part => ["tw", "hk", "mo"].includes(part)) ? "zh-TW" : "zh-CN";
    }
    return Object.hasOwn(UI_LANGUAGES, parts[0]) ? parts[0] : null;
  };
  const translate = (language, key, params = {}) =>
    (UI_MESSAGES[language]?.[key] ?? UI_MESSAGES.en[key] ?? key).replace(
      /\{(\w+)\}/g, (placeholder, name) => Object.hasOwn(params, name) ? String(params[name]) : placeholder
    );
  globalThis.TelI18n = { UI_LANGUAGES, UI_MESSAGES, matchLanguage, translate };
})();
