# Phase 04 — Changelog 0.11.0 + docs

**Goal:** Người dùng thấy "Có gì mới" v0.11.0; README mô tả định dạng `data=` và tham số mới của `/api/route`.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/changelog.ts` | MODIFY — mục 0.11.0 (vi + en) đầu mảng |
| `CHANGELOG.md` | MODIFY — mục 0.11.0 |
| `README.md` | MODIFY — đoạn "Trạm dọc đường" + bảng API `/api/route` |

## 2. Nội dung

- 0.11.0 "Chọn tuyến đường" / "Pick your route":
  - Đi 2 điểm: xem tối đa 3 tuyến, mỗi tuyến ghi km, thời gian, số trạm; chạm thẻ hoặc đường xám trên bản đồ để chọn — danh sách trạm, % pin và kế hoạch sạc theo tuyến đã chọn.
  - Link có kéo tuyến trên Google Maps (máy tính): app đi đúng qua các điểm đã kéo.
  - Tuỳ chọn tránh thu phí / cao tốc / phà trong link được giữ, và đổi được ngay trong bảng.
  - Sửa: link có kéo tuyến từng làm sai vị trí điểm đến.
- README: `/api/route?stops=…[!p]&alt=0..2&avoid=toll,highway,ferry`; ghi cấu trúc `data=` đã kiểm (bảng plan §7, rút gọn).

## 3. Acceptance criteria

- [ ] `npm run build` pass.
- [ ] Playwright: nút "Có gì mới" hiện v0.11.0 (vi và `/en`).

## 4. Commit message dự kiến

```
docs: chọn tuyến, điểm kéo tuyến, tuỳ chọn tránh; phát hành 0.11.0
```
