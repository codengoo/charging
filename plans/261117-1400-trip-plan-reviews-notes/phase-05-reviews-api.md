# Phase 05 — D1 + API đánh giá

**Goal:** Worker có API đánh giá / bình luận / báo cáo / admin trên D1, chạy được local; DB remote đã tạo và migrate.

## 1. Files chạm vào

| File | Action |
|---|---|
| `migrations/0001_reviews.sql` | CREATE — schema ở plan.md §3 |
| `wrangler.jsonc` | MODIFY — `d1_databases` (`REVIEWS`), ratelimit `REVIEW_LIMIT` (5 / 60 s) |
| `worker/reviews.ts` | CREATE — `serveReviews(req, url, env)` |
| `worker/index.ts` | MODIFY — `/api/reviews/*`, `/api/admin/*` đi tới `serveReviews` TRƯỚC `serveApi` (serveApi chỉ nhận GET) |
| `.dev.vars.example` | MODIFY — `REVIEW_PEPPER`, `ADMIN_TOKEN`, `TURNSTILE_SECRET` |

## 2. Quy tắc

- Request công khai: kiểm `sameSite` (như api.ts). Ghi cần `X-Device` 32 ký tự hex.
- Ghi: `REVIEW_LIMIT.limit({ key: ip })`; Turnstile `siteverify` nếu có `TURNSTILE_SECRET`; trạm phải có trong shard SEO.
- Lọc nội dung (biệt danh + bình luận): URL, tên miền phổ biến, email, ≥ 9 chữ số liền (cho phép cách bằng dấu cách / chấm / gạch) → 422.
- GET: `Cache-Control: no-store`.
- Báo cáo: `INSERT OR IGNORE` vào `review_reports`; chèn được thì `report_count + 1`, đạt 3 và `hidden = 0` → `hidden = 1`. Không cho tự báo cáo bài mình.
- Admin: `Authorization: Bearer <ADMIN_TOKEN>`, so sánh thời gian hằng.

## 3. Hạ tầng (Claude chạy)

```
npx wrangler d1 create tramsac-reviews
npx wrangler d1 migrations apply tramsac-reviews --local
npx wrangler d1 migrations apply tramsac-reviews --remote
npx wrangler secret put REVIEW_PEPPER
npx wrangler secret put ADMIN_TOKEN
```

## 4. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] `wrangler dev --local`: PUT → GET thấy bài + avg; PUT lại → vẫn 1 bài; 3 thiết bị báo cáo → bài khỏi `items`, tác giả thấy `mine.hidden`; nội dung có URL → 422; admin không token → 401, có token hiện lại được.
- [ ] D1 remote có 2 bảng.

## 5. Commit message dự kiến

```
feat(reviews): D1 + API đánh giá, bình luận, báo cáo và admin
```
