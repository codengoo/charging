# Phase 04 — Gia cố Worker (W1–W8), phát hành 0.12.1

**Goal:** Sửa W1–W8 trong `plan.md` §4 với thay đổi tối thiểu (chưa tái cấu trúc route — đó là phase 05).

## 1. Files chạm vào

| File | Action | Lỗi |
|---|---|---|
| `worker/index.ts`, `worker/locator.ts` | MODIFY | W1 — `sameSite` + `API_LIMIT` cho `/api/station/<id>`; W3 — rewrite `no-store` cả khi cache hit |
| `worker/reviews.ts` | MODIFY | W2 — DELETE trả 409 khi `hidden != 0`; W4 — `REVIEW_LIMIT` trước kiểm token admin; W7 — cursor `(updated_at, id)` |
| `worker/evcs.ts` | MODIFY | W5 — decode lỗi → 400; W8 — `ctx.waitUntil(cache.put)`, gộp promise xin token đang chạy |
| `src/lib/stationUrl.ts` | MODIFY | W6 — export `STATION_ID_RE = /^\d{1,12}$/`, worker dùng chung |
| `package.json`, `src/data/changelog.ts`, `CHANGELOG.md` | MODIFY | 0.12.1 |
| `worker/*.test.ts` | CREATE | test thuần cho validate/cursor nếu tách được |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh.
- [ ] `wrangler dev`: curl `/api/station/<id>` với `Origin: https://evil.example` → 403; vượt limit → 429.
- [ ] `wrangler dev` + D1 local: bài `hidden=2` → DELETE của tác giả → 409.
- [ ] curl đường dẫn có `%E0%A4` → 400.

## 3. Commit message dự kiến

```
fix(worker): rate limit /api/station, chặn đăng lại bài đã ẩn, cache lỗi no-store; phát hành 0.12.1
```
