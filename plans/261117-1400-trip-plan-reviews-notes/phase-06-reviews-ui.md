# Phase 06 — Giao diện đánh giá & bình luận

**Goal:** Bảng trạm có khối "Đánh giá": điểm trung bình, phân bố sao, form viết / sửa / xoá bài của mình, danh sách bình luận, báo cáo.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/reviews.ts` | CREATE — `deviceId()`, `useReviews(entityId, enabled)`: load, loadMore, save, remove, report |
| `src/lib/turnstile.ts` | CREATE — tải script khi có `VITE_TURNSTILE_SITEKEY`, render widget, lấy token |
| `src/ui/ReviewsSection.tsx` | CREATE — tóm tắt (★ 4,3 · 12 đánh giá + thanh phân bố); "Viết đánh giá" mở form (chọn sao, biệt danh nhớ local, bình luận ≤ 500, widget Turnstile); danh sách 20 + "Xem thêm"; nút Báo cáo |
| `src/ui/StationSheet.tsx` | MODIFY — gắn `ReviewsSection` cuối nội dung |
| `src/App.tsx` | MODIFY — hook + truyền xuống, chỉ tải khi bảng mở |
| `src/vite-env.d.ts` | MODIFY nếu cần — khai `VITE_TURNSTILE_SITEKEY` |

## 2. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] Playwright với `wrangler dev` + dev server: viết 4 sao → TB 4; sửa 5 → TB 5; xoá → hết; bình luận có link → lỗi tiếng Việt; báo cáo bài người khác → "Đã báo cáo".
- [ ] Giao diện tối + `/en/` ổn.

## 3. Commit message dự kiến

```
feat(reviews): khối đánh giá sao và bình luận công khai trong bảng trạm
```
