# Progress: Tải được media đã bị cuộn khuất (v0.9.3)

Kế hoạch: [PLAN.md](PLAN.md)

**Trạng thái:** ⬜ chưa làm · 🟨 đang làm · ✅ xong · ⛔ bị chặn

| # | Việc | Trạng thái |
|---|---|---|
| 0 | Tái hiện, tìm nguyên nhân, viết plan | ✅ |
| 1 | Adapter: khung cuộn, nút xuống cuối, khoảng `mid` đang có | ✅ |
| 2 | `bringIntoView()` + gọi trong `resolveSource()` | ✅ |
| 3 | Huỷ được khi đang cuộn | ⬜ |
| 4 | Sắp hàng đợi theo `mid` | ⬜ |
| 5 | Trạng thái "Đang tìm trong chat…" trên side panel | ⬜ |
| 6 | Nội dung lỗi mới, dịch 6 ngôn ngữ | ⬜ |
| 7 | Fixture "cửa sổ ảo" WebK + WebA | 🟨 WebK xong, còn WebA |
| 8 | Test hồi quy (cuộn xa, mục bị xoá, huỷ, sửa test cũ) | 🟨 cuộn xa + mục bị xoá xong (WebK) |
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
- [ ] Việc 3: huỷ được khi đang cuộn
