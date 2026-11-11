| 9 | 19/11/2026 | Test thực tế, phát hành v1.0.0 | 🟨 đã phát hành v0.9.0 (beta); v1.0.0 chờ test thật || 8 | 18/11/2026 | README, tài liệu, CI release | ✅ || 7 | 17/11/2026 | Kiểm định giao diện (impeccable) | ✅ reviewer: ship || 6 | 16/11/2026 | Tải hàng loạt + Options | ✅ (làm sớm, 10/11) || 5 | 15/11/2026 | Thiết kế + dựng Side Panel | ✅ (làm sớm, 10/11) || 4 | 14/11/2026 | Quét media trong chat | ✅ (làm sớm, 10/11) || 1 | 11/11/2026 | Nghiên cứu Telegram thật (R1–R4) | 🟨 R2, R3 xong; R1, R4 chờ chủ repo thử trên Telegram thật |# Progress

Tiến độ chuyển Telegram Media Downloader từ userscript sang Chrome Extension.
Kế hoạch chi tiết: [docs/PLAN.md](docs/PLAN.md)

**Trạng thái:** ⬜ chưa làm · 🟨 đang làm · ✅ xong · ⛔ bị chặn

| Ngày | Ngày tháng | Giai đoạn | Trạng thái |
|---|---|---|---|
| 0 | 10/11/2026 | Khởi tạo repo, plan | ✅ |
| 1 | 11/11/2026 | Nghiên cứu Telegram thật (R1–R4) | 🟨 R2, R3 xong; R1, R4 chờ thử trên Telegram thật |
| 2 | 12/11/2026 | Khung extension MV3 + đóng gói | ✅ |
| 3 | 13/11/2026 | Port lõi tải, i18n, test | ✅ |
| 4 | 14/11/2026 | Quét media trong chat | ⬜ |
| 5 | 15/11/2026 | Thiết kế + dựng Side Panel | ⬜ |
| 6 | 16/11/2026 | Tải hàng loạt + Options | ⬜ |
| 7 | 17/11/2026 | Kiểm định giao diện (impeccable) | ⬜ |
| 8 | 18/11/2026 | README, tài liệu, CI release | ⬜ |
| 9 | 19/11/2026 | Test thực tế, phát hành v1.0.0 | ⬜ |
| 10 | 20/11/2026 | Dự phòng | ⬜ |

---

## Nhật ký

### Ngày 0 – 10/11/2026
- [x] Đọc và phân tích code userscript gốc
- [x] Viết `docs/PLAN.md` và `PROGRESS.md`
- [x] `git init` (nhánh `main`), dùng tài khoản git global, gắn remote
- [x] Commit code gốc nguyên trạng
- [x] Commit plan và push

**Ghi chú:**
- Chủ repo đã duyệt plan. Quyết định: bỏ hẳn bản userscript cũ; push sau mỗi giai đoạn.

**Vướng mắc:** chưa có

### Ngày 2 – Khung extension
- [x] `extension/manifest.json` (MV3, Chrome 116+), background, side panel tạm, icon, `_locales` 6 ngôn ngữ (thêm tiếng Việt)
- [x] `npm run pack` nén `extension/` thành `dist/telegram-media-download-v<version>.zip` (không cần thư viện)
- [x] `npm run check` kiểm cú pháp, manifest, locale
- [x] Smoke test nạp extension thật vào trình duyệt

**Ghi chú:**
- Chrome bản thường (137+) chặn `--load-extension` nên chạy test bằng Edge (`TEL_TEST_BROWSER`) hoặc Chromium của Playwright (CI).
- Thêm `.gitattributes` để mọi file dùng LF.

### Ngày 3 – Port lõi tải, i18n, bridge
- [x] Tách userscript thành `shared/i18n.js`, `content/core.js`, `webk.js`, `weba.js`, `main.js`; code có test được chuyển nguyên văn
- [x] Content script chạy trong world MAIN, nên request giống hệt bản userscript
- [x] `content/bridge.js` (isolated world) làm cầu nối `chrome.storage`, side panel, background
- [x] Cài đặt dùng chung trong `chrome.storage.sync`: ngôn ngữ, số luồng (1–4), hỏi nơi lưu, thư mục con (`Telegram/{chat}`)
- [x] File tải được đưa vào thư mục con qua `chrome.downloads.onDeterminingFilename`
- [x] Thêm bản dịch tiếng Việt cho giao diện tải
- [x] 44/44 test xanh

**Kết quả nghiên cứu (R2, R3):**
- R2: giải quyết bằng thiết kế. Lõi chạy trong world MAIN giống userscript, nên không phụ thuộc việc content script fetch có đi qua service worker của Telegram hay không.
- R3: đã kiểm chứng bằng test. Blob URL do trang tạo ra vẫn được lưu đúng vào thư mục con.

**Vướng mắc:** R1, R4 cần thử trên Telegram thật (cần tài khoản đăng nhập).

### Ngày 4 – Quét media trong chat
- [x] `content/scanner.js`: IntersectionObserver ghi nhận ảnh/video khi lướt qua (WebK và WebA), có thumbnail, loại, thời lượng, ngày
- [x] Lấy URL bản gốc bằng cách mở nhanh trình xem của Telegram cho từng mục rồi đóng lại (không đụng state nội bộ)
- [x] Mục đã bị Telegram gỡ khỏi DOM thì báo "cuộn lại tới mục này"
- [x] Test bằng fixture DOM giả lập WebK/WebA

### Ngày 5–6 – Side panel, tải hàng loạt, cài đặt
- [x] Quy trình `/impeccable`: PRODUCT.md, vòng hỏi chủ repo, chọn bố cục trên trang quyết định → chọn **Chat mirror**
- [x] Side panel: theo thứ tự chat, chia ngày, lọc Ảnh/Video, chọn ngày/tất cả, Shift-click, vạch "Bạn đang ở đây", tiến độ trên từng ô
- [x] Trạng thái trống: không phải Telegram, cần tải lại tab, chưa có media, bộ lọc rỗng
- [x] Trang Options: ngôn ngữ, số luồng, thư mục, hỏi nơi lưu, ghi công tác giả gốc và người duy trì
- [x] Test end-to-end với extension thật: tải 3 file vào `Telegram/<tên chat>/`

### Ngày 7 – Kiểm định giao diện
- [x] Finish reviewer (impeccable) vòng 1: **fix** (7 điểm) → sửa màu chữ phụ, dấu trạng thái, chuyển động, chữ bị cắt, ghi công, chụp đủ trạng thái
- [x] Vòng 2: còn 3 điểm → sửa vị trí dấu, độ tương phản dấu lỗi ở chế độ tối, ghi DESIGN.md
- [x] Vòng 3: **ship**
- [x] `DESIGN.md` + `.impeccable/design.json` do documenter viết từ code thật
- [x] Detector impeccable: không còn lỗi
- [ ] Còn lệch (ghi nhận, chưa sửa): bảng tiến độ trong trang Telegram (core.js) vẫn dùng bảng màu cũ, animation lặp khi chưa biết dung lượng, và ký tự × làm icon

### Ngày 8 – Tài liệu, CI
- [x] README.md (EN) + README.vi.md: cài từ zip, cách dùng, cài đặt, giới hạn, FAQ, ghi công (Nestor Qin, Thien21112005, Claude), GPLv3
- [x] docs/ARCHITECTURE.md, docs/CONTRIBUTING.md, CHANGELOG.md, mẫu issue mới
- [x] `.github/workflows/release.yml`: tag `v*` → test → nén → GitHub Release (0.x là pre-release)
- [x] Xoá `docs/greasyfork/`
- [x] CI trên GitHub chạy xanh (kể cả test nạp extension thật)

### Ngày 9 – Phát hành
- [x] v0.9.0 (beta, pre-release) với file `telegram-media-download-v0.9.0.zip`
- [ ] **Chủ repo test trên Telegram thật** rồi mới lên v1.0.0:
  - [ ] Cài từ zip theo README trên Chrome (và Edge nếu có)
  - [ ] `/k/`: mở side panel, cuộn một chat có ảnh/video → danh sách hiện, chia đúng ngày
  - [ ] Chọn vài ảnh + video → Tải → file nằm trong `Downloads/Telegram/<tên chat>/`, mở được
  - [ ] Kênh bị chặn lưu: nút tải trong trình xem, story, audio ghim
  - [ ] `/a/`: lặp lại hai bước trên
  - [ ] Video > 1 GB, album nhiều ảnh, chat rất dài (cuộn xa rồi tải)
  - Nếu danh sách trống hoặc tải lỗi: mở DevTools ở tab Telegram, copy các dòng `[Tel Download]` và (nếu được) HTML của một bubble có ảnh để sửa selector trong `content/scanner.js`

### 11/11/2026 – Lỗi đầu tiên từ test thật (v0.9.1)
- Chủ repo test trên `/k/`: quét media chạy đúng (3 video hiện đủ), nhưng tải hàng loạt chỉ được mục đầu rồi nhóm chat bị đóng.
- Nguyên nhân: nút đóng trình xem thật là `button.btn-icon[aria-label="Close"]`, không có class `tgico-close`; nhánh dự phòng gửi Escape hai lần nên đóng luôn chat.
- [x] Tìm nút đóng theo aria-label hoặc vị trí cuối thanh công cụ; Escape chỉ gửi một lần khi trình xem còn mở
- [x] Chat bị đóng/đổi giữa chừng: các mục còn lại báo lỗi rõ ràng, side panel hiện số mục chưa tải
- [x] Fixture test dùng đúng HTML thanh công cụ lấy từ Telegram thật; test hồi quy thất bại với code cũ, đạt với code mới (54/54)
- [ ] Chủ repo test lại trên Telegram thật với v0.9.1
- Ghi nhận: detector báo 10 chỗ CSS side panel lệch với DESIGN.md (màu phủ mờ, vài bo góc, cỡ chữ 15px); có từ trước, chưa sửa.
