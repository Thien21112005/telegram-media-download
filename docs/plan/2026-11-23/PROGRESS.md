# Progress: Tải được media đã bị cuộn khuất (v0.9.3)

Kế hoạch: [PLAN.md](PLAN.md)

**Trạng thái:** ⬜ chưa làm · 🟨 đang làm · ✅ xong · ⛔ bị chặn

| # | Việc | Trạng thái |
|---|---|---|
| 0 | Tái hiện, tìm nguyên nhân, viết plan | ✅ |
| 1 | Adapter: khung cuộn, nút xuống cuối, khoảng `mid` đang có | ✅ |
| 2 | `bringIntoView()` + gọi trong `resolveSource()` | ✅ |
| 3 | Huỷ được khi đang cuộn | ✅ |
| 4 | Sắp hàng đợi theo `mid` | ✅ (mục trong trang trước, rồi mục gần nhất) |
| 5 | Trạng thái "Đang tìm trong chat…" trên side panel | ✅ |
| 6 | Nội dung lỗi mới, dịch 6 ngôn ngữ | ✅ |
| 7 | Fixture "cửa sổ ảo" WebK + WebA | ✅ |
| 8 | Test hồi quy (cuộn xa, mục bị xoá, huỷ, sửa test cũ) | ✅ 66/66 |
| 9 | README, CHANGELOG, bump v0.9.3 | ⬜ |
| 10 | Chủ repo test trên Telegram thật | ⬜ |

---

## Nhật ký

### 23/11/2026
- Chủ repo báo: cuộn chat lên xa rồi tải media hôm nay → báo lỗi.
- Nguyên nhân: Telegram gỡ các bubble ở xa khỏi DOM; `resolveSource()` không tìm thấy phần tử nên ném `errorNotInView` ngay, không thử cuộn lại.
- [x] Chuyển `docs/PLAN.md` → `docs/plan/2026-11-10/PLAN.md`, sửa các link trỏ tới nó
- [x] Viết plan và progress cho lỗi này
- [x] Việc 1: mỗi adapter có `scroller()`, `goDownButton()`, `loadedRange()`; `TelScanner.chatWindow()` trả về cả ba
  - Khung cuộn: dùng selector của Telegram (WebK `.bubbles > .scrollable-y`, WebA `.MessageList`) nếu cuộn được, không thì tìm phần tử cha cuộn được gần nhất, cuối cùng là cả trang
  - Nút xuống cuối: WebK `.bubbles-go-down`, WebA `.ScrollDownButton` (chỉ tính khi `.FloatingActionButtons` có `.revealed`); nút đang ẩn thì trả về `null`
  - 2 test mới (WebK, WebA), scanner 10/10
  - Ghi chú: test nạp extension (7 test) không chạy được trên máy này với Chrome thường, code cũ cũng lỗi y vậy; CI dùng Chromium của Playwright
  - Selector khung cuộn và nút xuống cuối chưa đối chiếu HTML thật, cần kiểm ở việc 10
- [x] Việc 2: `bringIntoView()` trong `scanner.js`; `resolveSource()` đóng trình xem trước rồi mới cuộn tìm
  - Mục mới hơn các tin đang có → bấm nút xuống cuối (một lần) rồi cuộn xuống; cũ hơn → cuộn lên đầu
  - Mỗi bước chờ tối đa 1,5 s cho tới khi Telegram nạp thêm; nếu đã ở mép thì tự phát sự kiện `scroll` để Telegram nạp tiếp
  - Dừng khi: 3 bước liền không nạp thêm gì (hết chat), mã tin nằm trong khoảng đang có mà không thấy (đã bị xoá), quá 60 bước / 90 s, hoặc chat đổi (báo `errorChatChanged`)
  - Fixture `webKVirtual`: 60 tin, chỉ giữ 10 tin trong trang, nạp 5 tin mỗi lần chạm mép, có nút xuống cuối và `deleteMessage()`
  - 3 test mới: cuộn lên xa rồi tải mục hôm nay; về cuối rồi tải mục cũ nhất; mục đã bị xoá báo lỗi trong vài giây. Scanner 13/13
  - Test thứ nhất **fail với code cũ** (đúng lỗi chủ repo gặp), pass với code mới
  - Test cũ "items that left the chat view report an error" vẫn đúng, nhưng giờ mất ~5 s vì thử cuộn trước khi bỏ cuộc
- [x] Việc 3: bấm Huỷ dừng cả mục đang được tìm/mở (không chỉ các mục đang chờ)
  - Scanner giữ mục đang xử lý (`current`); `scan:cancel` đánh dấu huỷ, vòng cuộn và lúc chờ trình xem đều kiểm tra mỗi 100 ms
  - Mục bị huỷ báo trạng thái `cancelled`, không phải `failed`; `scan:clear` cũng huỷ như vậy
- [x] Việc 4: thay vì sắp cố định theo `mid`, mỗi lần lấy mục tiếp theo theo vị trí hiện tại: mục đang có trong trang trước, rồi tới mục gần khoảng tin đang có nhất. Chat cuộn một chiều, không nhảy qua lại
- [x] Việc 5: scanner gửi trạng thái `seeking` khi phải cuộn tìm. Ô trên side panel hiện chữ "Đang tìm trong chat", dòng ghi chú dưới thanh tiến độ đổi thành "Đang cuộn chat để tìm các mục ở xa…"
- [x] Việc 6: 6 ngôn ngữ có `seeking`, `seekingNote`, `errorSeekTimeout`; `errorNotInView` đổi thành "Mục này không còn trong chat, có thể đã bị xoá."
  - Tìm không thấy mà mã tin nằm trong khoảng đang có → `errorNotInView` (đã bị xoá); nằm ngoài (cuộn không tới) → `errorSeekTimeout`
- [x] Việc 7: fixture `virtualChat('k' | 'a')` dùng chung một logic cho WebK và WebA (`webKVirtual`, `webAVirtual`)
- [x] Việc 8: test cuộn xa / quay về cuối chạy cho cả WebK và WebA; thêm test trạng thái `seeking`, huỷ khi đang cuộn, thứ tự mở; test side panel hiện "Finding in chat" (chụp `.impeccable/review/sidepanel-seeking.png`)
  - Toàn bộ **66/66** đạt khi chạy bằng Chromium của Playwright (`TEL_TEST_BROWSER=…/ms-playwright/chromium-1254/chrome-win64/chrome.exe`). 7 test nạp extension lỗi ở việc 1 là do dùng Chrome thường, không phải lỗi code
- [ ] Việc 9: README, CHANGELOG, v0.9.3
