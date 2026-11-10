# Kế hoạch: Userscript ➜ Chrome Extension

> Fork từ [Neet-Nestor/Telegram-Media-Downloader](https://github.com/Neet-Nestor/Telegram-Media-Downloader) (tác giả gốc: **Nestor Qin**, giấy phép **GNU GPLv3**).
> Repo mới: https://github.com/Thien21112005/telegram-media-download
> Theo dõi tiến độ hằng ngày: [PROGRESS.md](../PROGRESS.md)

## 1. Mục tiêu

1. Chuyển userscript hiện tại thành **Chrome Extension (Manifest V3)**, cài bằng cách tải file `.zip` trên GitHub Releases rồi "Load unpacked". Không cần Tampermonkey.
2. Thêm **Side Panel**: khi cuộn chat, ảnh và video lướt qua được tự phát hiện và hiện lên danh sách, người dùng tick chọn rồi tải hàng loạt.
3. Giữ lại tính năng cũ: nút tải trong trình xem media, story và audio ghim; panel tiến độ; 5 ngôn ngữ.
4. Viết lại README và tài liệu, ghi công đầy đủ cho tác giả gốc và tuân thủ GPLv3.
5. Mỗi giai đoạn kết thúc bằng một commit theo chuẩn [Conventional Commits](https://www.conventionalcommits.org/).

**Ngoài phạm vi (v1):** Firefox/Safari, đăng lên Chrome Web Store, tải toàn bộ lịch sử chat tự động (không cuộn).

## 2. Kiến trúc dự kiến

```
telegram-media-download/
├─ extension/                  # thư mục được nén thành file .zip phát hành
│  ├─ manifest.json            # MV3; quyền: downloads, sidePanel, storage; host: *.telegram.org
│  ├─ background.js            # service worker: mở side panel, điều phối tải, chrome.downloads
│  ├─ content/
│  │  ├─ core/                 # lõi tải (port từ tel_download.js): fetch theo Range, hàng đợi, đặt tên file
│  │  ├─ viewer-webk.js        # nút tải trong trình xem / story / audio ghim (WebK /k/)
│  │  ├─ viewer-weba.js        # tương tự cho WebA (/a/)
│  │  ├─ scanner-webk.js       # IntersectionObserver quét bubble trong chat
│  │  ├─ scanner-weba.js
│  │  └─ main-world.js         # (nếu cần) chạy trong world MAIN để đọc state nội bộ Telegram
│  ├─ sidepanel/               # UI chọn và tải hàng loạt (index.html, panel.js, panel.css)
│  ├─ options/                 # cài đặt: ngôn ngữ, thư mục con, số luồng tải
│  ├─ _locales/{en,vi,zh_CN,zh_TW,ru,my}/messages.json
│  └─ icons/
├─ tests/                      # Playwright: nạp extension thật vào Chromium
├─ scripts/pack.mjs            # nén extension/ thành dist/*.zip
├─ docs/                       # PLAN.md, RESEARCH.md, ARCHITECTURE.md, CONTRIBUTING.md
├─ .github/workflows/          # test.yml + release.yml (tag v* thì tự đính kèm .zip vào Release)
├─ README.md / README.vi.md
├─ PROGRESS.md
└─ LICENSE                     # giữ nguyên GPLv3
```

**Nguyên tắc:**
- Không dùng framework hay bundler. Code là JS thuần, nhiều content script dùng chung scope của isolated world, nên file trong `extension/` chạy được ngay.
- Lõi tải đã có test kỹ, nên chỉ **port** sang, không viết lại từ đầu.
- Side panel và content script nói chuyện với nhau qua `chrome.runtime` messaging.

## 3. Rủi ro cần kiểm chứng trước (Ngày 1)

| # | Câu hỏi | Nếu không được thì |
|---|---|---|
| R1 | Từ bubble trong chat có lấy được URL **bản gốc** (ảnh full-res, URL stream video) không? | Dùng main-world script đọc state Telegram, hoặc tự mở/đóng trình xem. Phương án cuối: tải thumbnail kèm cảnh báo |
| R2 | URL stream của WebK đi qua service worker của Telegram, vậy content script fetch có được không? | Fetch trong world MAIN rồi chuyển dữ liệu sang |
| R3 | `chrome.downloads` có nhận dữ liệu tải được từ trang không (blob hoặc data URL)? | Offscreen document, hoặc giữ cách `<a download>` hiện tại |
| R4 | Telegram ảo hoá danh sách tin nhắn (bubble bị gỡ khỏi DOM khi cuộn xa) | Lưu media đã thấy vào bộ nhớ của side panel, không phụ thuộc DOM |

Kết quả ghi vào `docs/RESEARCH.md`. Nếu R1 thất bại hoàn toàn thì dừng lại bàn với chủ repo trước khi làm tiếp.

## 4. Lộ trình theo ngày

> Ngày 0 = 10/11/2026. Mỗi ngày có cột "Commit" là commit dự kiến khi kết thúc giai đoạn.

### Ngày 0 – 10/11/2026: Khởi tạo repo
- `git init`, đặt tên tác giả commit, gắn remote.
- Commit code gốc **nguyên trạng** để lịch sử ghi nhận rõ phần của tác giả gốc.
- Thêm `docs/PLAN.md` và `PROGRESS.md`.

Commit:
- `chore: import upstream userscript v2.0 by Nestor Qin`
- `docs: add extension migration plan and progress tracker`

### Ngày 1 – 11/11: Nghiên cứu trên Telegram thật
- Kiểm chứng R1–R4 trên cả `/k/` và `/a/`, ghi lại selector DOM và định dạng URL.
- Chốt phương án lấy URL bản gốc.

Commit: `docs(research): document Telegram DOM and media URL findings`

### Ngày 2 – 12/11: Khung extension
- Tạo `manifest.json`, background, side panel trống, icon, `_locales`.
- Chuyển cấu trúc thư mục, xoá phần header userscript.
- `scripts/pack.mjs` để nén file `.zip`.

Commit:
- `build: scaffold Manifest V3 extension structure`
- `build: add packaging script`

### Ngày 3 – 13/11: Port lõi tải và nút trong trình xem
- Tách `tel_download.js` thành `core/`, `viewer-webk.js`, `viewer-weba.js`.
- i18n chuyển sang `chrome.i18n` / `_locales` và thêm **tiếng Việt**.
- Sửa harness test để nạp extension thật vào Chromium. Toàn bộ test cũ phải xanh.

Commit:
- `refactor(core): port download engine to content scripts`
- `refactor(i18n): migrate translations to chrome.i18n and add Vietnamese`
- `test: run regression suite against the unpacked extension`

### Ngày 4 – 14/11: Quét media trong chat
- `scanner-webk.js`: IntersectionObserver trên bubble, rút ra `{id, kind, thumb, url, size, tên chat, thời gian}`.
- `scanner-weba.js`: tương tự cho WebA.
- Chống trùng theo message id, xử lý album (nhiều ảnh trong một tin), chịu được danh sách ảo hoá (R4).
- Test bằng fixture DOM.

Commit:
- `feat(scanner): detect media in WebK chat while scrolling`
- `feat(scanner): support WebA chat layout`

### Ngày 5 – 15/11: Thiết kế và dựng Side Panel (dùng `/impeccable`)
- `/impeccable shape`: chốt bố cục trước khi code (lưới thumbnail, bộ lọc ảnh/video/audio, chọn tất cả, thanh hành động dính đáy, trạng thái rỗng/đang quét/lỗi).
- Dựng UI theo bản đã chốt, có dark/light theo Telegram, chiều rộng hẹp (side panel khoảng 320–400px).

Commit: `feat(sidepanel): add media list with selection and filters`

### Ngày 6 – 16/11: Tải hàng loạt và cài đặt
- Các mục được chọn đi vào hàng đợi có sẵn, tải qua `chrome.downloads` vào thư mục con (ví dụ `Telegram/<tên chat>/`), không bật hộp thoại cho từng file.
- Hiển thị tiến độ từng mục ngay trong side panel; giữ Cancel/Retry.
- Trang Options: ngôn ngữ, thư mục con, số luồng (1–4), hỏi vị trí lưu hay không.

Commit:
- `feat(download): batch download selected media via chrome.downloads`
- `feat(options): add settings page`

### Ngày 7 – 17/11: Kiểm định giao diện (dùng `/impeccable`)
- `/impeccable critique` và `/impeccable audit` cho side panel và panel tiến độ: phân cấp thị giác, tương phản, bàn phím, screen reader, reduced motion, chuỗi dài (tiếng Miến, tiếng Nga).
- `/impeccable polish` để sửa các điểm được báo.
- Chụp screenshot và GIF demo cho README.

Commit:
- `style(ui): apply design audit fixes`
- `fix(a11y): ...` (nếu có)

### Ngày 8 – 18/11: README, tài liệu, CI phát hành
- Viết lại **README.md** (tiếng Anh) và **README.vi.md**:
  - Giới thiệu, ảnh demo, tính năng.
  - **Cài đặt từ file zip** (từng bước kèm ảnh: tải Release, giải nén, `chrome://extensions`, bật Developer mode, Load unpacked).
  - Cách dùng side panel, cài đặt, FAQ, phần giới hạn và lưu ý pháp lý.
  - **Credits**: tác giả gốc Nestor Qin cùng link repo gốc; người duy trì bản fork Thien21112005; phát triển cùng Claude (Anthropic).
  - Giấy phép GPLv3 và ghi chú "đây là bản sửa đổi" theo yêu cầu GPL.
- `docs/ARCHITECTURE.md`, `docs/CONTRIBUTING.md`, cập nhật mẫu issue.
- Xoá `docs/greasyfork/` (không còn phát hành trên Greasy Fork).
- `release.yml`: push tag `v*` thì chạy test, nén, rồi đính kèm `.zip` vào GitHub Release.

Commit:
- `docs: rewrite README for the Chrome extension`
- `docs: add architecture and contributing guides`
- `ci: publish extension zip on tagged releases`

### Ngày 9 – 19/11: Kiểm thử thực tế và phát hành v1.0.0
- Test tay trên Telegram thật (/k/, /a/, kênh bị chặn tải, story, video lớn hơn 1GB, album).
- Sửa lỗi phát sinh, cập nhật `CHANGELOG.md`, tag `v1.0.0`.

Commit:
- `fix: ...` (theo lỗi tìm được)
- `chore(release): v1.0.0`

### Ngày 10 – 20/11: Dự phòng
Để trống cho việc trễ hạn hoặc khi R1 cần phương án khác.

## 5. Quy ước commit

- Định dạng: `<type>(<scope>): <mô tả>`, tiếng Anh, thể mệnh lệnh, không chấm cuối.
- Type dùng: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`.
- Tác giả: tài khoản git global của chủ repo (**Thien211105**). **Không** thêm dòng `Co-Authored-By`.
- Mỗi cuối ngày cập nhật `PROGRESS.md` trong cùng commit cuối của ngày đó.
- Push lên `origin/main` sau mỗi giai đoạn.
- Bản userscript cũ được bỏ hẳn khi chuyển sang extension (vẫn còn trong lịch sử git ở commit đầu tiên).

## 6. Tiêu chí hoàn thành v1.0.0

- [ ] Cài từ file `.zip` trên Releases chạy được trên Chrome và Edge bản mới nhất.
- [ ] Cuộn chat thì media xuất hiện trong side panel; tick và tải được ít nhất ảnh và video ở `/k/`.
- [ ] Tính năng cũ (nút trong trình xem, story, audio ghim, tiến độ, Cancel/Retry) còn chạy.
- [ ] Toàn bộ test xanh trên CI.
- [ ] Giao diện đã qua `/impeccable audit`, không còn lỗi mức nghiêm trọng.
- [ ] README ghi rõ tác giả gốc, giấy phép GPLv3, phần đóng góp của bản fork.
