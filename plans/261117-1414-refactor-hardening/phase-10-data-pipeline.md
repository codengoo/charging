# Phase 10 — (Tuỳ chọn) Gia cố pipeline dữ liệu

**Goal:** File dữ liệu `immutable` không bao giờ bị ghi đè cùng tên; build hỏng không thay manifest.

## 1. Files chạm vào

| File | Action |
|---|---|
| `builder/lib/build.mjs`, `builder/run-local.mjs` | MODIFY — tên file `power-<gen>-<hash8>.json` (hash nội dung); manifest trỏ tên mới |
| `src/data/useStationData.ts` | MODIFY — so manifest theo tên file, không chỉ `gen` |
| `.github/workflows/build-data.yml` | MODIFY — bước sanity (số trạm ≥ 20.000 và không giảm > 5% so manifest đang chạy → fail); `permissions: contents: read`; pin `wrangler@4.x.y`; upload song song |

## 2. Acceptance criteria

- [ ] Build local 2 lần với KML đổi → 2 tên file khác nhau; cùng dữ liệu → cùng tên.
- [ ] Giả lập snapshot 100 trạm → job fail trước bước upload.
- [ ] Client đang mở với manifest cũ vẫn tải được (file cũ còn trên R2 ≥ 1 chu kỳ).

## 3. Commit message dự kiến

```
build(data): tên file theo hash nội dung, kiểm số trạm trước khi upload, siết quyền workflow
```

## 4. Kết quả (ghi lúc thực hiện)

- Builder: `contentHash()` (8 hex SHA-256, bỏ `builtAt` khỏi hash) → `base-<gen>-<hash>.json`, `power-<gen>-<hash>.json`. Shard SEO giữ `seo-<gen>/` (chỉ Worker đọc, cache ngắn qua manifest).
- Client: `dataKey(manifest)` = tên base + power; `useStationData` so khoá này thay vì generation (manifest cũ không hash vẫn so được).
- `builder/check.mjs`: chặn khi < 20.000 trạm, < 50% có số cổng, hoặc tụt > 5% so manifest đang chạy (không đọc được thì chỉ kiểm ngưỡng tuyệt đối). Dùng `process.exitCode` — `process.exit()` lúc fetch còn mở handle làm Node trên Windows văng assert (mã 127).
- Workflow: `permissions: contents: read`, `WRANGLER: wrangler@4.162.0`, Node 22, bước kiểm trước upload, upload shard song song 8 lượt (`xargs -P 8`), tên file đọc từ manifest.
- Đã kiểm: test `contentHash`/`dataKey`; `check.mjs` 4 kịch bản (100 trạm → 1; 25.000 → 0; 22.000 vs 25.000 đang chạy → 1; 25.010 → 0); chạy khô bước upload với `npx` giả → đúng thứ tự base → power → shard → manifest.
- **Chưa kiểm tra**: chạy `node builder/run-local.mjs` thật và workflow thật trên GitHub (cần mạng VinFast + secret Cloudflare). File cũ trên R2 không bị xoá nên client đang mở với manifest cũ vẫn tải được.
