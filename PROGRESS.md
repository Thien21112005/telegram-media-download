# Progress

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
