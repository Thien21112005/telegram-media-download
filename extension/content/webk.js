// SPDX-License-Identifier: GPL-3.0-only
// Based on the Telegram Media Downloader userscript by Nestor Qin
// (https://github.com/Neet-Nestor/Telegram-Media-Downloader).
// Modified for the Chrome extension by Thien21112005.

// WebK (/k/) media discovery and button placement.
(function () {
  if (globalThis.TelWebK) return;
  const { downloadMedia, getMediaSource, isUsableDownloadButton, localizeDownloadButton } = globalThis.TelCore;
  const tel_download_video = (url) => downloadMedia(url, "video");
  const tel_download_audio = (url) => downloadMedia(url, "audio");
  const tel_download_image = (url) => downloadMedia(url, "image");
  // WebK's icon font code points change between releases. Only learn the
  // download glyph from native buttons in this page, never from our own buttons.
  const WEB_K_DOWNLOAD_BUTTON_SELECTOR = [
    "button.quality-download-options-button-menu",
    "button.tgico-download",
    'button[aria-label="Download"]',
    'button[title="Download"]',
  ].join(", ");
  const getWebKDownloadButtons = (container) =>
    Array.from(container.querySelectorAll(WEB_K_DOWNLOAD_BUTTON_SELECTOR)).filter(
      (button) =>
        !button.matches(".tel-download, ._tel_download_button_pinned_container")
    );
  let webKDownloadGlyph = "";
  const createWebKDownloadIcon = (buttonIcon = false) =>
    `<span class="tgico tel-download-icon${buttonIcon ? " button-icon" : ""}" aria-hidden="true">${
      webKDownloadGlyph ||
      '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle" aria-hidden="true" focusable="false"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4"/></svg>'
    }</span>`;
  const refreshWebKDownloadIcon = () => {
    for (const button of getWebKDownloadButtons(document)) {
      const glyph = button.querySelector(":scope > .tgico")?.textContent.trim();
      // Ignore labels or menu contents; the icon must be one private-use glyph.
      if (!glyph || !/^[\uE000-\uF8FF]$/.test(glyph)) continue;
      if (glyph !== webKDownloadGlyph) {
        // Keep this in memory only: a new page load may use a different font.
        webKDownloadGlyph = glyph;
        document.querySelectorAll(".tel-download-icon").forEach((icon) => {
          icon.textContent = glyph;
        });
      }
      return;
    }
  };
  const getPinnedMedia = () => {
    const pinned = document.querySelector(".pinned-audio");
    const mid = pinned?.getAttribute("data-mid");
    if (!mid) return null;
    const peer = pinned.getAttribute("data-peer-id");
    const candidates = Array.from(document.querySelectorAll("audio-element")).filter(
      (element) => element.closest(".bubble") && element.getAttribute("data-mid") === mid &&
        (!peer || element.closest("[data-peer-id]")?.getAttribute("data-peer-id") === peer)
    );
    const element = candidates.length === 1 ? candidates[0] :
      candidates.find((candidate) => candidate.audio && !candidate.audio.paused);
    const url = getMediaSource(element?.audio);
    return url ? { url, kind: element.audio.tagName === "AUDIO" ? "audio" : "video" } : null;
  };

  const downloadCurrentWebKMedia = () => {
    // The toolbar can outlive its media node. Resolve both at click time.
    const viewer = document.querySelector(".media-viewer-whole");
    if (!viewer) return;
    const buttons = viewer.querySelector(".media-viewer-topbar .media-viewer-buttons");
    const nativeDownload = buttons && getWebKDownloadButtons(buttons).find(
      (button) => isUsableDownloadButton(button) && !button.matches(
        '.quality-download-options-button-menu, .btn-menu-toggle, [aria-haspopup="menu"], [aria-haspopup="true"]'
      )
    );
    if (nativeDownload) {
      nativeDownload.click();
      return;
    }
    const media = viewer.querySelector(".media-viewer-movers .media-viewer-aspecter");
    const videoUrl = getMediaSource(media?.querySelector("video"));
    const imageUrl = getMediaSource(media?.querySelector("img.thumbnail"));
    if (videoUrl) tel_download_video(videoUrl);
    else if (imageUrl) tel_download_image(imageUrl);
  };
  // WebK owns only media discovery and button placement.
  const refreshWebK = () => {
    refreshWebKDownloadIcon();

    // Resolve the pinned media again on every click: its source may load after
    // the pinned message changes, and message IDs can repeat across chats.
    const pinnedAudio = document.querySelector(".pinned-audio");
    const pinnedUtils = pinnedAudio?.querySelector(".pinned-container-wrapper-utils");
    if (pinnedUtils) {
      let button = pinnedUtils.querySelector("._tel_download_button_pinned_container");
      if (!button) {
        button = document.createElement("button");
        button.className = "btn-icon tgico-download _tel_download_button_pinned_container";
        button.innerHTML = createWebKDownloadIcon(true);
        button.type = "button";
        button.onclick = (event) => {
          event.stopPropagation();
          const media = getPinnedMedia();
          if (!media) return;
          if (media.kind === "audio") tel_download_audio(media.url);
          else tel_download_video(media.url);
        };
        pinnedUtils.appendChild(button);
      }
      const disabled = !getPinnedMedia();
      if (button.disabled !== disabled) button.disabled = disabled;
      localizeDownloadButton(button, disabled);
    }

    // Stories
    const storiesContainer = document.getElementById("stories-viewer");
    if (storiesContainer) {
      const createDownloadButton = () => {
        const downloadButton = document.createElement("button");
        downloadButton.className = "btn-icon rp tel-download";
        downloadButton.innerHTML = `${createWebKDownloadIcon()}<div class="c-ripple"></div>`;
        downloadButton.setAttribute("type", "button");
        localizeDownloadButton(downloadButton);
        downloadButton.onclick = () => {
          // 1. Story with video
          const video = storiesContainer.querySelector("video.media-video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            tel_download_video(videoSrc);
          } else {
            // 2. Story with image
            const imageSrc =
              storiesContainer.querySelector("img.media-photo")?.src;
            if (imageSrc) tel_download_image(imageSrc);
          }
        };
        return downloadButton;
      };

      const storyHeader = storiesContainer.querySelector(
        "[class*='_ViewerStoryHeaderRight']"
      );
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        storyHeader.prepend(createDownloadButton());
      }

      const storyFooter = storiesContainer.querySelector(
        "[class*='_ViewerStoryFooterRight']"
      );
      if (storyFooter && !storyFooter.querySelector(".tel-download")) {
        storyFooter.prepend(createDownloadButton());
      }
    }

    // All media opened are located in .media-viewer-movers > .media-viewer-aspecter
    const mediaContainer = document.querySelector(".media-viewer-whole");
    if (!mediaContainer) return;
    const mediaAspecter = mediaContainer.querySelector(
      ".media-viewer-movers .media-viewer-aspecter"
    );
    const mediaButtons = mediaContainer.querySelector(
      ".media-viewer-topbar .media-viewer-buttons"
    );
    if (!mediaAspecter || !mediaButtons) return;

    // Restore only identified download controls. Other hidden actions may be
    // unavailable for this media and should remain under Telegram's control.
    for (const button of getWebKDownloadButtons(mediaButtons)) {
      if (!button.disabled && button.getAttribute("aria-disabled") !== "true") {
        button.classList.remove("hide");
      }
    }

    // Recognize native downloads by their purpose, not their font code point.
    const nativeDownloadButtons = getWebKDownloadButtons(mediaButtons).filter(isUsableDownloadButton);
    if (nativeDownloadButtons.length > 0) {
      mediaButtons.querySelectorAll("button.tel-download").forEach((button) => {
        button.remove();
      });
    }
    const hasDownloadButton =
      nativeDownloadButtons.length > 0 ||
      mediaButtons.querySelector("button.tel-download");

    if (mediaAspecter.querySelector(".ckin__player")) {
      // 1. Video player detected - Video and it has finished initial loading
      // container > .ckin__player > video[src]

      // add download button to videos
      const controls = mediaAspecter.querySelector(
        ".default__controls.ckin__controls"
      );
      if (controls && !controls.querySelector(".tel-download")) {
        const brControls = controls.querySelector(
          ".bottom-controls .right-controls"
        );
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "btn-icon default__button tgico-download tel-download";
        downloadButton.innerHTML = createWebKDownloadIcon();
        downloadButton.setAttribute("type", "button");
        localizeDownloadButton(downloadButton);
        downloadButton.onclick = downloadCurrentWebKMedia;
        brControls?.prepend(downloadButton);
      }
    } else if (
      mediaAspecter.querySelector("video") &&
      !hasDownloadButton
    ) {
      // 2. Video HTML element detected, could be either GIF or unloaded video
      // container > video[src]
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = createWebKDownloadIcon(true);
      downloadButton.setAttribute("type", "button");
      localizeDownloadButton(downloadButton);
      downloadButton.onclick = downloadCurrentWebKMedia;
      mediaButtons.prepend(downloadButton);
    } else if (!hasDownloadButton) {
      // 3. Image without download button detected
      // container > img.thumbnail
      if (
        !mediaAspecter.querySelector("img.thumbnail") ||
        !mediaAspecter.querySelector("img.thumbnail").src
      ) {
        return;
      }
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = createWebKDownloadIcon(true);
      downloadButton.setAttribute("type", "button");
      localizeDownloadButton(downloadButton);
      downloadButton.onclick = downloadCurrentWebKMedia;
      mediaButtons.prepend(downloadButton);
    }
  };
  globalThis.TelWebK = { refresh: refreshWebK };
})();
