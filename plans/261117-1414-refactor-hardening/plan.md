# Refactor & gia cố codebase tramsac (lưới test, sửa lỗi, gom helper, tách App/Worker)

**Date:** 2026-11-17 14:14 (ICT)
**Scope:** `package.json`, `tsconfig*.json`, `.github/workflows/`, `src/` (data, lib, ui, map, App.tsx, components/ui), `worker/`, `builder/`, `README.md`, `CHANGELOG.md`
**Trigger:** Sau ~12 bản phát hành liên tiếp (0.1 → 0.12), code tăng lên ~12.600 dòng mà **không có test, không lint, `worker/` không được type-check**. Audit 3 lớp (UI / data+lib / worker+builder) tìm ra ~15 lỗi thật, ~8 helper bị chép lại 3–8 lần, `App.tsx` 528 dòng ôm 9 cờ mở sheet + đồng bộ URL. Mục tiêu: giữ nguyên hành vi người dùng thấy, nhưng có lưới an toàn để sửa tiếp không vỡ.

## 1. Goal

- `npm run typecheck` kiểm cả `src/` và `worker/`; `npm test` (Vitest, `--maxWorkers=2`) chạy unit test cho logic thuần; workflow CI chạy cả hai trên mỗi push/PR.
- Các lỗi đã xác định (liệt kê ở §4) được sửa, mỗi lỗi logic có test bắt được.
- Worker: chặn được lạm dụng `/api/station`, admin, review; helper HTTP/route gom một chỗ.
- Client: một `lib/storage.ts`, một `lib/http.ts`, một `lib/geo.ts`, một `lib/text.ts`; formatter trùng gộp vào `lib/format.ts`; code chết bị xoá.
- `App.tsx` < 300 dòng, `MapView.tsx` < 300 dòng; sheet và hàng danh sách trạm dùng chung component.
- Không đổi giao diện, không đổi định dạng localStorage / URL / dữ liệu R2 (trừ phase 10 nếu được duyệt).

## 2. Quyết định đã chốt (2026-11-17: "triển khai hết" → làm cả 11 phase, các câu §10 lấy đề xuất mặc định: giữ 2 ngữ nghĩa % pin, có phase 10, chưa ESLint)

| Câu hỏi | Đề xuất |
|---|---|
| Test runner | **Vitest** `^2.1` (khớp Vite 5), env `node` cho logic thuần; không test component/E2E ở đợt này. Luôn `--maxWorkers=2`. |
| Lint | **Chưa thêm ESLint** (nhiều cảnh báo, ít lợi so với typecheck + test). Có thể làm đợt sau. |
| Thứ tự | Lưới an toàn (tooling + test) **trước**, rồi sửa lỗi, rồi refactor cấu trúc. Refactor không đổi hành vi → test phải xanh trước và sau. |
| % pin "ngang qua trạm" (TripPanel `atKm + 2×offset`) vs kế hoạch sạc (`atKm + offset`, cộng offset ở chặng sau) | Giữ **cả hai ngữ nghĩa** (bảng = rẽ vào rồi quay ra; kế hoạch = tới trạm), nhưng đặt tên rõ trong 1 module: `passByKm()` / `arriveKm()` trong `chargePlan.ts`, test cả hai. Chỉ đổi nếu bạn muốn vạch "Trạm cuối còn kịp" khớp hẳn với kế hoạch. |
| Chống spam review (device id tự sinh) | Đợt này: rate-limit báo cáo theo IP + **chặn xoá-rồi-đăng-lại bài đã ẩn** (tombstone). Bật Turnstile prod là việc cấu hình của bạn. Lưu hash IP cho báo cáo → **ngoài phạm vi** (cần cột mới). |
| Tên file dữ liệu theo content hash (builder) | **Tách riêng phase 10, làm cuối, tuỳ chọn** — đổi đường dẫn R2 nên rủi ro cao hơn phần còn lại. |
| Builder `.mjs` | Thêm `// @ts-check` + JSDoc `import()` type từ `src/data/format.ts`, **không** đổi sang `.ts`. |
| Phiên bản | Phase sửa lỗi + worker → **0.12.1**; refactor thuần không bump; xong toàn bộ → **0.13.0** ở phase 11. |
| Commit | Mỗi phase 1 commit trên `main` (theo thói quen repo), không push trừ khi bạn bảo. |

## 3. Bản đồ module mục tiêu (sau refactor)

```
src/lib/
  storage.ts   readJson/writeJson/readStr/writeStr (try/catch localStorage)   ← 8 bản chép
  http.ts      fetchJson(path, {signal, onStatus}) + lỗi mạng/abort thống nhất ← 5 wrapper
  geo.ts       LatLng, KM_PER_LAT, kmPerLng(lat), haversine, getPosition()   ← 3 đường geolocation
  text.ts      foldText (bỏ dấu, ̀-ͯ), base64url encode/decode      ← stations + stationUrl, backup + mapsLink
  format.ts    + fmtMinutes, clock, remaining (gộp từ drive/TripPanel/LiveSection/BatteryControl/groups)
src/data/
  format.ts    Manifest, SeoRow, pack/parse "kw:count:dc|…", cột base/power   ← dùng chung builder/worker/client
  here.ts      parseHereRoutes, limitedFlags, sumSummary (thuần)              ← tách khỏi trip.ts
  tripTypes.ts TripRadius, TRIP_RADII, RoutePath                              ← settings.ts hết kéo React
worker/
  http.ts      json/fail/readJson, cache headers, decode an toàn → 400
  routes.ts    bảng [prefix, methods, guard, handler]; guard = sameSite + limiter
  tsconfig.json
src/ui/
  AppSheet.tsx, StationRow.tsx, useQrCanvas.ts, useCopy.ts
src/app/ (mới)
  useUrlSync.ts, useSheets.ts, useChargePlan.ts, BatteryContext.tsx, MapChips.tsx
src/map/layers.ts  addAppSources/addAppLayers/bindLayerEvents
```

## 4. Danh sách lỗi sẽ sửa (phase 03 + 04)

| # | Lỗi | Vị trí |
|---|---|---|
| B1 | `nearestStations` dừng sớm: dùng `deg*111` cho cả kinh độ (thiếu `cos(lat)`) → có thể bỏ sót trạm gần | `src/data/stations.ts:203` |
| B2 | "Xem thêm" đánh giá không abort/kiểm trạm → đổi trạm giữa chừng thì lẫn review trạm cũ | `src/data/reviews.ts:128-137` |
| B3 | Ghi localStorage / `Date.now()` trong updater `setState` (StrictMode chạy 2 lần) | `src/data/settings.ts:108-116`, `src/data/notes.ts:63-76` |
| B4 | Màn lỗi tải dữ liệu không tự hết khi recheck thành công; `loadPower` cũ có thể đè gen mới | `src/data/useStationData.ts:49-65` |
| B5 | QR: `revokeObjectURL` ngay sau `click()` → Safari/Firefox có thể huỷ tải | `src/lib/qrCard.ts:57` |
| B6 | GPS fix đầu tiên kéo camera khỏi trạm/hành trình mở từ link | `src/map/MapView.tsx:243-255` |
| B7 | Mỗi GPS update (~1 s) re-render toàn App | `MapView.tsx:253` → `App.tsx:303` |
| B8 | Dropdown tìm kiếm không đóng khi bấm ra ngoài / Escape; hàng là `<li onClick>` | `src/ui/SearchBar.tsx:47-66` |
| B9 | `HistoryBox` không `key` theo trạm → giữ lựa chọn của trạm trước | `src/ui/StationSheet.tsx:203` |
| B10 | Lọc nhóm trong Đã lưu kẹt khi nhóm rỗng (0/N, không chip nào chọn) | `src/ui/SavedSheet.tsx:76,93` |
| B11 | Lỗi GPS cũ còn khi mở lại Gần bạn | `src/ui/NearbySheet.tsx:96` |
| W1 | `/api/station/<id>` không rate limit, không same-site → có thể bị VinFast chặn IP | `worker/index.ts:36`, `worker/locator.ts:72` |
| W2 | Xoá rồi đăng lại → bài bị ẩn (admin/auto) hiện lại | `worker/reviews.ts:283-285,176` |
| W3 | Cache hit của lỗi/stale vẫn `max-age=60` → bị Browser Cache TTL 4h đè | `worker/locator.ts:84-88` |
| W4 | Admin endpoint không rate limit (dò token) | `worker/reviews.ts:212-215` |
| W5 | `decodeURIComponent` lỗi → 500/502 thay vì 400 | `worker/reviews.ts:274`, `worker/evcs.ts:471` |
| W6 | Regex station id khác nhau 3 nơi (`\d+`, `\d{1,9}`, `\d{1,12}`) | `stationUrl.ts:39`, `locator.ts:72`, `reviews.ts:49` |
| W7 | Phân trang review bỏ sót bài trùng `updated_at` | `worker/reviews.ts:130` |
| W8 | `cache.put` bị `await` (chậm phản hồi), token EVCS hết hạn → nhiều request cùng xin token | `worker/evcs.ts:464` |

## 5. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-tooling.md | `worker/tsconfig.json`, script `typecheck`/`test`, Vitest, workflow CI | — |
| 02 | phase-02-safety-tests.md | Unit test cho logic thuần hiện có (chụp hành vi hiện tại) | 01 |
| 03 | phase-03-client-bugfix.md | Sửa B1–B11 (+ test cho B1, B3) | 02 |
| 04 | phase-04-worker-security.md | Sửa W1–W8; bump 0.12.1 | 01 |
| 05 | phase-05-worker-structure.md | `worker/http.ts`, `worker/routes.ts`, cache manifest theo isolate, `src/data/format.ts` dùng chung + `@ts-check` builder | 04 |
| 06 | phase-06-shared-lib.md | `lib/storage`, `lib/http`, `lib/geo`, `lib/text`, gộp formatter, xoá code chết | 03 |
| 07 | phase-07-data-boundaries.md | Tách `trip.ts` → `here.ts`; `tripTypes.ts`; `tripReducer`; `arriveKm/passByKm`; `useBattery` ra khỏi `battery.ts` | 06 |
| 08 | phase-08-ui-shared.md | `AppSheet`, `StationRow`, `useQrCanvas`, `useCopy`, token `--warn`/`--full`, hằng layout | 06 |
| 09 | phase-09-app-mapview-split.md | Tách `App.tsx` (useUrlSync/useSheets/useChargePlan/BatteryContext/MapChips) và `MapView` → `map/layers.ts` | 07, 08 |
| 10 | phase-10-data-pipeline.md | (Tuỳ chọn) tên file theo hash, sanity check số trạm, `permissions` + pin wrangler trong workflow | 05 |
| 11 | phase-11-docs.md | README (cấu trúc mới, lệnh test), CHANGELOG 0.13.0, `changelog.ts` | tất cả |

Đồ thị: 01 → {02, 04}; 02 → 03 → 06 → {07, 08} → 09; 04 → 05 → 10; mọi thứ → 11.

## 6. Phạm vi

**In scope:** các file/module nêu ở §3, §4 và trong từng phase.

**Out of scope:**
- Đổi giao diện / màu / copy (trừ chuỗi hard-code chuyển vào i18n: "Close", "Hotline", tick `h`).
- ESLint/Prettier, test component, E2E Playwright.
- Lưu hash IP cho báo cáo review, đổi schema D1.
- Kiểm `Content-Length` chunked, mở rộng validate lat/lng (ghi chú để làm sau).
- Mô hình pin (độ dốc, hệ số tốc độ) — chỉ đặt tên hằng, không đổi số.
- Đổi định dạng localStorage hoặc URL công khai.

## 7. Risks

- **Refactor App/URL-sync làm vỡ deep link / Share Target** — `tripHandled.current` phải set cùng commit với effect mở trip. Giảm thiểu: giữ 2 effect trong cùng `useUrlSync`, test tay `/station/…`, `/trip?link=…`, `#import=…`, `/en/…` trước khi commit phase 09.
- **`lib/http.ts` đổi thông báo lỗi** — mỗi module vẫn tự map status → thông điệp; so sánh từng nhánh UI (429/404/504/mạng) với bản cũ.
- **Route table worker chạm mọi route** — làm sau phase 04 (đã có guard), smoke test bằng `wrangler dev` + curl từng route.
- **Test "chụp hành vi" có thể khoá luôn lỗi** — ở phase 02 test nào đang chụp lỗi đã biết (B1) thì đánh `it.fails`/ghi chú, phase 03 đảo lại.
- **Phase 10 đổi đường dẫn R2** — client cũ đang cache manifest có thể trỏ file không còn; giữ file tên cũ 1 chu kỳ. Chấp nhận được vì là phase tuỳ chọn.

## 8. Cách verify chung (mỗi phase)

- `npm run typecheck` xanh, `npm test -- --maxWorkers=2` xanh, `npm run build` xanh.
- `npm run dev` mở được bản đồ, mở 1 trạm, mở Dọc đường với 1 link mẫu (khi phase chạm tới UI/data).
- Phase worker: `npx wrangler dev` + curl các route bị chạm.

## 9. Ước lượng

| Nhóm | Phase | Công |
|---|---|---|
| Lưới an toàn | 01–02 | ~0,5 ngày |
| Sửa lỗi | 03–04 | ~0,5–1 ngày |
| Refactor cấu trúc | 05–09 | ~1,5–2 ngày |
| Pipeline + docs | 10–11 | ~0,5 ngày |

## 10. Câu hỏi cần bạn chốt

1. Làm **toàn bộ 11 phase**, hay chỉ đợt 1 (01–04: tooling + test + sửa lỗi) trước?
2. Vạch "Trạm cuối còn kịp" giữ ngữ nghĩa *rẽ vào rồi quay ra* (2×offset) hay đổi khớp với kế hoạch sạc?
3. Phase 10 (đổi tên file dữ liệu theo hash) có làm không?
4. Có thêm ESLint luôn không, hay để sau?
