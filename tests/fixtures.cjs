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

// A chat that, like Telegram, keeps only a window of messages in the page.
// Messages 100–159 (100–129 on 20 November, 130–159 Today); the window opens
// at the newest. Scrolling to an edge loads the next five messages after a
// delay and drops five from the far end; the go-down button jumps to the
// newest. deleteMessage(mid) removes a message from the chat's history.
// The flavor picks WebK or WebA markup; the behaviour is the same.
const VIRTUAL_FLAVORS = {
  k: {
    shell: `<div class="chat-info"><span class="peer-title">Long chat</span></div>
<div id="column-center"><div class="bubbles">
  <div class="scrollable scrollable-y" style="height:400px;overflow-y:auto"></div>
  <button class="btn-circle btn-corner bubbles-go-down hide">↓</button>
</div></div>`,
    scroller: '.scrollable-y',
    goDown: '.bubbles-go-down',
    showGoDown: (button, show) => button.classList.toggle('hide', !show),
    group: (day, body) => '<section class="bubbles-date-group"><div class="bubble service is-date"><div class="service-msg">' + day + '</div></div>' + body + '</section>',
    message: (mid, photo) => '<div class="bubble" data-mid="' + mid + '" style="height:150px"><div class="attachment">' + photo + '</div></div>',
    messageSelector: (mid) => '.bubble[data-mid="' + mid + '"]',
    clickTarget: '.bubble[data-mid]',
    midOf: (element) => element.dataset.mid,
    viewer: (src) => {
      const viewer = document.createElement('div');
      viewer.className = 'media-viewer-whole';
      viewer.innerHTML = '<div class="media-viewer-topbar"><div class="media-viewer-buttons"><button class="btn-icon" aria-label="Close"></button></div></div>' +
        '<div class="media-viewer-movers"><div class="media-viewer-aspecter"><img class="thumbnail" src="' + src + '"></div></div>';
      return viewer;
    },
    viewerSelector: '.media-viewer-whole',
  },
  a: {
    shell: `<div class="MiddleHeader"><div class="ChatInfo"><div class="fullName">Long chat</div></div></div>
<div class="MiddleColumn">
  <div class="MessageList custom-scroll" style="height:400px;overflow-y:auto"></div>
  <div class="FloatingActionButtons"><div class="ScrollDownButton"><button aria-label="Go to bottom">↓</button></div></div>
</div>`,
    scroller: '.MessageList',
    goDown: '.ScrollDownButton button',
    showGoDown: (button, show) => button.closest('.FloatingActionButtons').classList.toggle('revealed', show),
    group: (day, body) => '<div class="message-date-group"><div class="sticky-date"><span>' + day + '</span></div>' + body + '</div>',
    message: (mid, photo) => '<div class="message-list-item" id="message-' + mid + '" data-message-id="' + mid + '" style="height:150px"><div class="media-inner">' + photo + '</div></div>',
    messageSelector: (mid) => '#message-' + mid,
    clickTarget: '.message-list-item',
    midOf: (element) => element.dataset.messageId,
    viewer: (src) => {
      const viewer = document.createElement('div');
      viewer.id = 'MediaViewer';
      viewer.innerHTML = '<div class="MediaViewerActions"><button aria-label="Close"></button></div>' +
        '<div class="MediaViewerSlide MediaViewerSlide--active"><div class="MediaViewerContent"><div><img src="' + src + '"></div></div></div>';
      return viewer;
    },
    viewerSelector: '#MediaViewer',
  },
};

const virtualChat = (flavor, base = 'https://test.invalid/') => {
  const f = VIRTUAL_FLAVORS[flavor];
  const fn = (value) => value.toString();
  return `${f.shell}
<script>
  const BASE = ${JSON.stringify(base)};
  const PHOTO = ${JSON.stringify(photo)};
  const F = {
    scroller: ${JSON.stringify(f.scroller)}, goDown: ${JSON.stringify(f.goDown)},
    clickTarget: ${JSON.stringify(f.clickTarget)}, viewerSelector: ${JSON.stringify(f.viewerSelector)},
    showGoDown: ${fn(f.showGoDown)}, group: ${fn(f.group)}, message: ${fn(f.message)},
    messageSelector: ${fn(f.messageSelector)}, midOf: ${fn(f.midOf)}, viewer: ${fn(f.viewer)},
  };
  const WINDOW = 10, STEP = 5, DELAY = 150;
  const history = Array.from({ length: 60 }, (_, i) => ({ mid: 100 + i, day: i < 30 ? '20 November' : 'Today' }));
  const scroller = document.querySelector(F.scroller);
  const goDown = document.querySelector(F.goDown);
  let start = history.length - WINDOW;
  let loading = false;
  window.loads = 0;
  const render = () => {
    const shown = history.slice(start, start + WINDOW);
    const days = [...new Set(shown.map(message => message.day))];
    scroller.innerHTML = days.map(day => F.group(day,
      shown.filter(message => message.day === day).map(message => F.message(message.mid, PHOTO)).join(''))).join('');
  };
  const atNewest = () => start + WINDOW >= history.length && scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 5;
  const updateGoDown = () => F.showGoDown(goDown, !atNewest());
  const load = (older) => {
    if (loading) return;
    const next = older ? Math.max(0, start - STEP) : Math.min(history.length - WINDOW, start + STEP);
    if (next === start) return;
    loading = true;
    setTimeout(() => {
      const anchorMid = older ? history[start].mid : history[start + WINDOW - 1].mid;
      const anchor = scroller.querySelector(F.messageSelector(anchorMid));
      const offset = anchor ? anchor.offsetTop - scroller.scrollTop : 0;
      start = next;
      render();
      const kept = scroller.querySelector(F.messageSelector(anchorMid));
      if (kept) scroller.scrollTop = kept.offsetTop - offset;
      loading = false;
      loads++;
      updateGoDown();
    }, DELAY);
  };
  scroller.addEventListener('scroll', () => {
    if (scroller.scrollTop <= 20) load(true);
    else if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 20) load(false);
    updateGoDown();
  });
  goDown.addEventListener('click', () => {
    start = history.length - WINDOW;
    render();
    scroller.scrollTop = scroller.scrollHeight;
    updateGoDown();
  });
  window.deleteMessage = (mid) => {
    const index = history.findIndex(message => message.mid === mid);
    if (index < 0) return;
    history.splice(index, 1);
    start = Math.min(start, history.length - WINDOW);
    render();
  };
  window.scrollChat = (top) => { scroller.scrollTop = top === 'bottom' ? scroller.scrollHeight : top; };
  render();
  scroller.scrollTop = scroller.scrollHeight;
  updateGoDown();
  document.addEventListener('click', (event) => {
    const item = event.target.closest(F.clickTarget);
    if (!item || document.querySelector(F.viewerSelector)) return;
    const viewer = F.viewer(BASE + 'full-' + F.midOf(item) + '.jpg');
    viewer.querySelector('[aria-label="Close"]').onclick = () => viewer.remove();
    document.body.appendChild(viewer);
  });
</script>`;
};
const webKVirtual = (base) => virtualChat('k', base);
const webAVirtual = (base) => virtualChat('a', base);

module.exports = { pixel, photo, webK, webA, webKLazy, webKVirtual, webAVirtual };
