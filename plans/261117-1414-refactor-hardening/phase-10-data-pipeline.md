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
