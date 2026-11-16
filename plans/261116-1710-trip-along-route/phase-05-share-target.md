# Phase 05 — Web Share Target + changelog + docs

**Goal:** PWA đã cài trên Android hiện trong menu Chia sẻ của Google Maps; chọn nó thì mở `/trip` với link vừa chia sẻ. Changelog 0.5.0 và README mô tả tính năng, đổi path, API proxy.

## 1. Files chạm vào

| File | Action |
|---|---|
| `public/manifest.webmanifest` | MODIFY — `share_target`, `id`, `scope` |
| `src/data/changelog.ts` | MODIFY — bản 0.5.0 (đầu danh sách), `APP_VERSION` |
| `CHANGELOG.md` | MODIFY — `## [0.5.0] — 2026-11-16 — Trạm sạc dọc đường` |
| `package.json` | MODIFY — `version: 0.5.0` (nếu repo đang giữ khớp; xem bản 0.4.0 đã làm gì) |
| `README.md` | MODIFY — mục "Trạm dọc đường" |

## 2. `public/manifest.webmanifest`

```json
"id": "/",
"scope": "/",
"share_target": {
  "action": "/trip",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

Google Maps Android gửi link trong `text` (kèm tên địa điểm), có khi trong `url`. `readTripLink` ở phase 04 đã xử lý cả hai. `/trip` không cần Worker: `not_found_handling: single-page-application` trả `index.html`.

## 3. Changelog 0.5.0 (nháp)

- Trạm sạc dọc đường: chia sẻ chỉ đường từ Google Maps (Android, khi đã cài app lên màn hình chính) hoặc dán link vào app. App vẽ tuyến và liệt kê trạm theo thứ tự gặp trên đường.
- Chọn bề rộng hành lang 2 / 5 / 10 km; mỗi trạm ghi km trên tuyến và khoảng cách lệch khỏi đường.
- Trên cao tốc, tự bỏ trạm ở chiều ngược lại (bên kia dải phân cách).
- Link hành trình `/trip?link=…` mở lại được hành trình.
- Link trạm đổi sang `/station/<id>-<tên>`; link `/tram/…` cũ vẫn mở được.

## 4. Acceptance criteria

- [ ] `npm run build` pass; `dist/manifest.webmanifest` có `share_target`.
- [ ] Chrome DevTools → Application → Manifest: không báo lỗi `share_target` (kiểm bằng Playwright đọc manifest + `npx wrangler dev`). Thử thật trên Android (cài PWA → Google Maps → Chia sẻ): **cần user kiểm sau deploy**, ghi rõ "chưa kiểm tra" nếu chưa làm.
- [ ] Mở `/trip?text=Hà%20Nội%20đến%20Hải%20Phòng%20https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F21.0278,105.8342%2F20.8449,106.6881` → tính hành trình, URL đổi về `/trip?link=…`.
- [ ] Modal "Có gì mới" hiện 0.5.0.

## 5. Out of scope

- Share target `POST` / nhận file.
- Deploy production và đặt secret (user tự chạy `wrangler secret put HERE_API_KEY` + `npm run deploy`).

## 6. Commit message dự kiến

```
feat(pwa): receive Google Maps shares via Web Share Target; release 0.5.0

manifest share_target opens /trip with the shared text/url; App extracts
the Maps link and starts the trip. Changelog 0.5.0 + README cover the
along-route feature, the /station path rename and the HERE API proxy.
```

## 7. Kết quả thực hiện (2026-11-16)

- Bản phát hành là **0.7.0** (0.5.0/0.6.0 đã dùng). `package.json` giữ nguyên (repo không đồng bộ version ở đó). Thêm `enctype` vào `share_target` vì Chrome cảnh báo khi thiếu.
- Đã kiểm: `npm run build` pass, `dist/manifest.webmanifest` có `share_target`; CDP `Page.getAppManifest` → `errors: []`; `/trip?text=Hà Nội đến Hải Phòng <link>` → tính hành trình, URL về `/trip?link=<link>` (phase 04); nút "Có gì mới" hiện v0.7.0.
- **Chưa kiểm tra:** chia sẻ thật từ Google Maps trên Android (cần cài PWA sau deploy), tuyến HERE thật (cần `HERE_API_KEY`).
