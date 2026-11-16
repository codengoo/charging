# Phase 06 — Tài liệu và changelog 0.6.0

**Goal:** README mô tả đúng các tính năng và dữ liệu mới. CHANGELOG và `src/data/changelog.ts` có bản 0.6.0; `APP_VERSION` thành 0.6.0.

## 1. Files chạm vào

| File | Action |
|---|---|
| `README.md` | MODIFY: mục Tính năng; Pipeline (base v3 + cột `status`, ghi chú file `sc` là showroom) |
| `CHANGELOG.md` | MODIFY: thêm `[0.6.0]` |
| `src/data/changelog.ts` | MODIFY: thêm mục 0.6.0 (nguồn hiển thị trong app) |
| `builder/README.md` | MODIFY nếu có mô tả fields của base |

## 2. Nội dung 0.6.0 (bản nháp)

```
## [0.6.0] — 2026-11-?? — Lọc sạc nhanh, trạng thái trạm, trạm gần bạn

- Lọc trạm có sạc nhanh DC hoặc từ 120 kW; ghim trạm đổi màu theo công suất.
- Trạm đang bảo trì, ngừng hoạt động hoặc sắp khai trương hiện mờ trên bản đồ, kèm nhãn trong chi tiết trạm.
- Lọc "Đang hoạt động" để ẩn các trạm không sạc được.
- "Gần tôi": 20 trạm đang hoạt động gần nhất, theo đúng bộ lọc đang bật.
- Sao lưu nhóm đã lưu và chuyển sang máy khác bằng link, mã QR hoặc file.
```

Ngày điền đúng ngày thực hiện phase này.

## 3. Acceptance criteria

- [ ] `npm run build` pass; trong app, "Có gì mới" hiện 0.6.0 ở đầu.
- [ ] README không còn câu "`sc` = … (nghi là status rút gọn, dùng sau)" mà ghi đúng là showroom.

## 4. Commit message dự kiến

```
docs: changelog 0.6.0 và README cho lọc công suất, trạng thái, gần tôi, sao lưu nhóm
```
