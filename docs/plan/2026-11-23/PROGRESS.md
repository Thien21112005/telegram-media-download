# Progress: Tải được media đã bị cuộn khuất (v0.9.3)

Kế hoạch: [PLAN.md](PLAN.md)

**Trạng thái:** ⬜ chưa làm · 🟨 đang làm · ✅ xong · ⛔ bị chặn

| # | Việc | Trạng thái |
|---|---|---|
| 0 | Tái hiện, tìm nguyên nhân, viết plan | ✅ |
| 1 | Adapter: khung cuộn, nút xuống cuối, khoảng `mid` đang có | ⬜ |
| 2 | `bringIntoView()` + gọi trong `resolveSource()` | ⬜ |
| 3 | Huỷ được khi đang cuộn | ⬜ |
| 4 | Sắp hàng đợi theo `mid` | ⬜ |
| 5 | Trạng thái "Đang tìm trong chat…" trên side panel | ⬜ |
| 6 | Nội dung lỗi mới, dịch 6 ngôn ngữ | ⬜ |
| 7 | Fixture "cửa sổ ảo" WebK + WebA | ⬜ |
| 8 | Test hồi quy (cuộn xa, mục bị xoá, huỷ, sửa test cũ) | ⬜ |
| 9 | README, CHANGELOG, bump v0.9.3 | ⬜ |
| 10 | Chủ repo test trên Telegram thật | ⬜ |

---

## Nhật ký

### 23/11/2026
- Chủ repo báo: cuộn chat lên xa rồi tải media hôm nay → báo lỗi.
- Nguyên nhân: Telegram gỡ các bubble ở xa khỏi DOM; `resolveSource()` không tìm thấy phần tử nên ném `errorNotInView` ngay, không thử cuộn lại.
- [x] Chuyển `docs/PLAN.md` → `docs/plan/2026-11-10/PLAN.md`, sửa các link trỏ tới nó
- [x] Viết plan và progress cho lỗi này
- [ ] Bắt đầu việc 1
