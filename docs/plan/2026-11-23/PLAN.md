# Kế hoạch: Tải được media đã bị cuộn khuất (v0.9.3)

> Theo dõi tiến độ: [PROGRESS.md](PROGRESS.md) (cùng thư mục)
> Kế hoạch gốc của dự án: [../2026-11-10/PLAN.md](../2026-11-10/PLAN.md)

## 1. Lỗi

**Cách tái hiện**
1. Mở một chat, side panel liệt kê media của hôm nay.
2. Cuộn chat lên thật xa (để side panel hiện thêm nhiều media cũ).
3. Trong side panel bấm chọn ngày hôm nay, bấm **Tải**.
4. Các mục hôm nay đều báo lỗi: *"Hãy cuộn chat lại tới mục này rồi thử lại."*

**Nguyên nhân** (đã xác nhận trong code)
- Telegram chỉ giữ trong DOM một "cửa sổ" tin nhắn quanh vị trí đang xem. Khi cuộn xa, các bubble cũ phía dưới (hôm nay) bị gỡ khỏi DOM.
- Side panel vẫn giữ danh sách (scanner nhớ theo `mid`), nhưng khi tải, `resolveSource()` gọi `adapter.find(item.mid)` → không tìm thấy phần tử → ném `errorNotInView` ngay ([extension/content/scanner.js:278-280](../../../extension/content/scanner.js#L278-L280)).
- Tức là: liệt kê được nhưng không tải được, vì URL bản gốc chỉ lấy được khi mở mục đó trong trình xem của Telegram, mà muốn mở thì bubble phải có trong DOM.

## 2. Hướng sửa

### Chọn: tự cuộn chat tới mục cần tải
Khi một mục không còn trong DOM, scanner tự cuộn khung chat về phía mục đó cho tới khi Telegram nạp lại bubble, rồi mở trình xem như bình thường.

- **Hướng cuộn:** so `mid` của mục với `mid` nhỏ nhất/lớn nhất đang có trong DOM. `mid` lớn hơn → mới hơn → cuộn xuống; nhỏ hơn → cuộn lên.
- **Bước cuộn:** đặt `scrollTop` của khung chat ra mép (đầu hoặc cuối), đợi Telegram nạp thêm (MutationObserver hoặc chờ tối đa ~1,5 s), kiểm tra lại `find(mid)`. Lặp có giới hạn (số bước và tổng thời gian, ví dụ 40 bước / 60 s).
- **Đường tắt cho media mới:** nếu mục mới hơn mọi bubble đang có, bấm nút "cuộn xuống cuối" của Telegram (WebK `.bubbles-go-down`, WebA nút xuống trong `.MiddleColumn`) trước, rồi mới cuộn dần lên nếu cần.
- **Dừng khi:** tìm thấy; hoặc `mid` đã nằm giữa khoảng đang có mà vẫn không thấy (tin đã bị xoá); hoặc hết giới hạn; hoặc người dùng bấm Huỷ; hoặc chat đổi. Khi đó báo lỗi rõ ràng.
- **Thứ tự tải:** sắp hàng đợi theo `mid` (cùng chiều với hướng cuộn đầu tiên) để không phải cuộn qua lại giữa hai đầu chat.
- **Giữ chỗ người dùng:** sau khi tải xong cả lô, không cố trả về vị trí cũ (Telegram cũng không cho làm chính xác); ghi chú trong README.

### Phương án đã cân nhắc, không chọn
- **Đọc state nội bộ Telegram (world MAIN)** để lấy URL không cần DOM: nhanh hơn nhưng dễ vỡ mỗi khi Telegram cập nhật, trái quyết định ở plan gốc.
- **Mở trình xem ở mục đang hiện rồi bấm ←/→ tới mục cần tải:** trình xem duyệt được cả lịch sử, nhưng khó biết slide hiện tại là `mid` nào, và rất chậm khi xa.
- **Chụp URL ngay lúc quét:** URL bản gốc chỉ có khi mở trình xem; mở cho mọi mục lướt qua là quá nặng.

## 3. Việc cần làm

| # | Việc | File |
|---|---|---|
| 1 | Adapter thêm `scroller()` (khung cuộn), `goDownButton()`, `loadedRange()` (mid nhỏ/lớn nhất trong DOM) cho WebK và WebA | `extension/content/scanner.js` |
| 2 | Hàm `bringIntoView(item)`: logic cuộn có giới hạn như mục 2; `resolveSource()` gọi nó thay vì ném lỗi ngay | `extension/content/scanner.js` |
| 3 | Huỷ được giữa lúc đang cuộn (`scan:cancel` dừng vòng lặp) | `extension/content/scanner.js` |
| 4 | Sắp hàng đợi theo `mid` trong `download()` | `extension/content/scanner.js` |
| 5 | Trạng thái "Đang tìm trong chat…" cho ô đang được cuộn tới (task state `seeking`) | `scanner.js`, `extension/sidepanel/panel.js`, `extension/shared/i18n.js` |
| 6 | Đổi nội dung lỗi: `errorNotInView` → "Không tìm thấy mục này trong chat (có thể đã bị xoá)"; thêm lỗi hết thời gian tìm. Dịch đủ 6 ngôn ngữ | `extension/shared/i18n.js`, `_locales` nếu cần |
| 7 | Fixture giả lập "cửa sổ ảo": chỉ render N bubble quanh vị trí cuộn, gỡ/nạp lại khi `scrollTop` chạm mép (WebK và WebA) | `tests/fixtures.cjs` |
| 8 | Test: (a) cuộn lên xa rồi tải mục hôm nay → tải được; (b) mục đã bị xoá → báo lỗi, không treo; (c) bấm Huỷ khi đang cuộn → dừng; (d) sửa test cũ "items that left the chat view report an error" cho đúng hành vi mới | `tests/scanner.test.cjs` |
| 9 | Cập nhật README/README.vi (giới hạn), CHANGELOG, bump version 0.9.3 | docs |
| 10 | Chủ repo test trên Telegram thật (`/k/` trước, `/a/` sau) | — |

## 4. Rủi ro

- **Khung cuộn / nút "xuống cuối" khác selector trên Telegram thật** → cần HTML thật của khung chat (như lần sửa nút đóng ở v0.9.1). Nếu sai, vẫn còn lỗi cũ nhưng không tệ hơn.
- **`mid` không tăng đều** (WebA album dùng id album, WebK có mid cục bộ dạng số lớn): chỉ dùng để so sánh hướng; nếu so sánh không được thì thử cuộn xuống trước rồi lên.
- **Telegram nạp chậm khi mạng yếu** → giới hạn thời gian đủ rộng, có trạng thái "Đang tìm…" để người dùng không tưởng bị treo.
- **Chat rất dài** (hàng nghìn tin): cuộn từ xa về rất lâu; giới hạn bước sẽ báo lỗi thay vì chạy mãi.

## 5. Commit

- Theo [Conventional Commits](https://www.conventionalcommits.org/), mỗi việc (hoặc nhóm việc nhỏ liền nhau) một commit, ví dụ `fix(scanner): ...`, `test(scanner): ...`, `docs: ...`.
- Tác giả: **Thien211105** (git config của repo). Không thêm dòng `Co-Authored-By` hay ghi công nào khác trong commit.
- Mỗi commit cập nhật luôn [PROGRESS.md](PROGRESS.md) cho việc vừa xong.
- Chỉ push khi chủ repo đồng ý.

## 6. Tiêu chí xong

- Tái hiện ở mục 1 không còn lỗi: mọi mục của hôm nay được tải về đúng thư mục.
- Toàn bộ test cũ + test mới đều đạt trên CI.
- Chủ repo xác nhận trên Telegram thật.
