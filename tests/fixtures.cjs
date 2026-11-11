// Simulated Telegram chats. Clicking media opens a viewer holding its full-size URL.
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const photo = `<img class="media-photo" src="${pixel}" style="width:120px;height:90px;display:block">`;

// Simulated WebK chat: clicking media opens a viewer with the full-size URL.
const webK = (base = 'https://test.invalid/', { closeButton = true } = {}) => `
<div class="chat-info"><span class="peer-title">Holiday photos</span></div>
<div class="bubbles">
  <section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">12 August</div></div>
  <div class="bubble" data-mid="10"><div class="attachment">${photo}</div></div>
  <div class="bubble" data-mid="11"><div class="attachment">
    <div class="album-item" data-mid="11">${photo}</div>
    <div class="album-item" data-mid="12">${photo}<span class="video-time">0:05</span></div>
  </div></div>
  <div class="bubble sticker" data-mid="13"><div class="attachment">${photo}</div></div></section>
  <div style="height:3000px"></div>
  <section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">14 August</div></div>
  <div class="bubble" data-mid="20"><div class="attachment">${photo}</div></div></section>
</div>
<script>
  const BASE = ${JSON.stringify(base)};
  const CLOSE_BUTTON = ${JSON.stringify(closeButton)};
  document.addEventListener('click', (event) => {
    const item = event.target.closest('.album-item[data-mid], .bubble[data-mid]');
    if (!item || document.querySelector('.media-viewer-whole')) return;
    const mid = item.dataset.mid;
    const isVideo = item.querySelector('.video-time');
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer-whole';
    viewer.innerHTML = '<div class="media-viewer-topbar"><div class="media-viewer-buttons">' +
      '<button class="btn-icon hide" aria-label="Delete"><span class="tgico button-icon"></span></button>' +
      '<button class="btn-icon quality-download-options-button-menu btn-menu-toggle hide" aria-label="Download"><span class="tgico button-icon"></span></button>' +
      (CLOSE_BUTTON ? '<button class="btn-icon" aria-label="Zoom In"><span class="tgico button-icon"></span></button>' : '') +
      '<div class="btn-icon btn-menu-toggle hide" role="button" aria-label="More"></div>' +
      (CLOSE_BUTTON ? '<button class="btn-icon" aria-label="Close"><span class="tgico button-icon"></span></button>' : '') +
      '</div></div>' +
      '<div class="media-viewer-movers"><div class="media-viewer-aspecter">' +
      (isVideo ? '<video src="' + BASE + 'clip-' + mid + '.mp4"></video>' : '<img class="thumbnail" src="' + BASE + 'full-' + mid + '.jpg">') +
      '</div></div>';
    const close = viewer.querySelector('[aria-label="Close"]');
    if (close) close.onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  });
  // Like Telegram: each Escape goes "back" once.
  window.escapes = 0;
  window.closeChat = () => {
    document.querySelector('.bubbles').replaceChildren();
    location.hash = '#closed';
  };
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    window.escapes++;
    const viewer = document.querySelector('.media-viewer-whole');
    if (viewer) viewer.remove();
    else window.closeChat();
  }, true);
</script>`;

const webA = (base = 'https://test.invalid/') => `
<div class="MiddleHeader"><div class="ChatInfo"><div class="fullName">Work</div></div></div>
<div class="message-list-item" id="message-30" data-message-id="30"><div class="media-inner">${photo}</div></div>
<div class="message-list-item" id="message-31" data-message-id="31"><div class="media-inner">${photo}<div class="message-media-duration">1:00</div></div></div>
<script>
  const BASE = ${JSON.stringify(base)};
  document.addEventListener('click', (event) => {
    const item = event.target.closest('.message-list-item');
    if (!item || document.querySelector('#MediaViewer')) return;
    const mid = item.dataset.messageId;
    const isVideo = item.querySelector('.message-media-duration');
    const viewer = document.createElement('div');
    viewer.id = 'MediaViewer';
    viewer.innerHTML = '<div class="MediaViewerActions"><button aria-label="Close"></button></div><div class="MediaViewerSlide MediaViewerSlide--active">' +
      (isVideo ? '<div class="VideoPlayer"><video src="' + BASE + 'clip-' + mid + '.mp4"></video></div>'
        : '<div class="MediaViewerContent"><div><img src="' + BASE + 'full-' + mid + '.jpg"></div></div>') + '</div>';
    viewer.querySelector('[aria-label="Close"]').onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  });
</script>`;

// WebK chat with one video whose preview loads late. Call sharpen() to swap the
// red 40px placeholder canvas for the real (blue, 200x150) preview image.
const webKLazy = `
<div class="chat-info"><span class="peer-title">Lazy previews</span></div>
<div class="bubbles"><section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">7 November</div></div>
  <div class="bubble" data-mid="50"><div class="attachment" style="width:200px;height:150px">
    <div class="album-item grouped-item" data-mid="50"><div class="album-item-media media-container">
      <span class="video-time">0:59</span>
      <canvas class="media-photo thumbnail" width="40" height="30" style="width:200px;height:150px;filter:blur(4px)"></canvas>
    </div></div>
  </div></div>
</section></div>
<script>
  const placeholder = document.querySelector('canvas.thumbnail');
  const context = placeholder.getContext('2d');
  context.fillStyle = 'rgb(220, 30, 30)';
  context.fillRect(0, 0, 40, 30);
  window.sharpen = () => {
    const full = document.createElement('canvas');
    full.width = 200; full.height = 150;
    const ctx = full.getContext('2d');
    ctx.fillStyle = 'rgb(30, 60, 220)';
    ctx.fillRect(0, 0, 200, 150);
    const image = document.createElement('img');
    image.className = 'media-photo';
    image.decoding = 'async';
    image.onload = () => placeholder.remove();
    image.src = full.toDataURL('image/png');
    placeholder.after(image);
  };
</script>`;

module.exports = { pixel, photo, webK, webA, webKLazy };
