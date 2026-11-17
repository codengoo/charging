# Phase 02 — Lưới test cho logic thuần (chụp hành vi hiện tại)

**Goal:** Có unit test cho các hàm thuần dễ vỡ nhất, chạy trên code **chưa sửa**. Test phản ánh hành vi hiện tại; chỗ nào đang chụp một lỗi đã biết thì đánh `it.fails` kèm mã lỗi (vd. `B1`) để phase 03 đảo lại.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/mapsLink.test.ts` | CREATE |
| `src/lib/flexiblePolyline.test.ts` | CREATE |
| `src/data/routeCorridor.test.ts` | CREATE |
| `src/data/chargePlan.test.ts` | CREATE |
| `src/data/battery.test.ts` | CREATE |
| `src/data/trip.test.ts` | CREATE (`parseHereRoutes`, `limitedFlags`, `waypointsOf`) |
| `src/data/groups.test.ts` | CREATE |
| `src/data/backup.test.ts` | CREATE |
| `src/data/live.test.ts` | CREATE (`parseLive`, `analyseHistory`, `windowHistory`, `estimateFromHistory`) |
| `src/data/stations.test.ts` | CREATE (`nearestStations`, `passesFilters`, `kwLabel`, `statusOf`) |
| `src/data/settings.test.ts` | CREATE (`parseSettings` migration) |
| `src/lib/stationUrl.test.ts` | CREATE (`slugify`, `parseStationId`) |
| `src/lib/__fixtures__/maps-links.ts` | CREATE (link thật: dir/data pb, `saddr/daddr/geocode` iOS, 1 địa điểm, link rút gọn) |

Không sửa source. Nếu một hàm cần test chưa được export → ghi lại, export ở phase 06/07 (không sửa ở đây).

## 2. Trọng tâm từng file

- **mapsLink** — toạ độ chặng `!2m2!1d!2d`, via `!3m…`, cờ tránh `!1b1/!2b1/!3b1`, `!5iN`, link iOS, `firstUrl`/`isShortLink`.
- **flexiblePolyline** — vector mẫu chính thức của HERE (gồm trường hợp chiều thứ 3).
- **routeCorridor** — `thinRoute` giữ cờ cao tốc khớp điểm; `pickAlongRoute` loại trạm bên kia dải phân cách, gắn `viaExit`; trần 400 trạm; `alongRoute` cắt theo offset.
- **chargePlan** — tới đích không cần dừng; 1–2 điểm dừng; "sạc vừa đủ" ở điểm cuối; kẹt (`ok:false, stuckAtKm`); bỏ trạm `viaExit`; trạm DC < 50 kW không chọn.
- **groups/backup** — `toggleMembership` với mục hết hạn, grace `pruneExpired`, `bookFromStored` làm sạch `colorHex`, `mergeBooks`/`diffCount`, encode/decode khứ hồi.
- **stations** — `nearestStations` ở vĩ độ 21°N với trạm lệch đông-tây: `it.fails('B1 …')`.

## 3. Acceptance criteria

- [ ] `npm test` xanh (các `it.fails` được tính là pass).
- [ ] Mỗi file test ≥ 3 case; tổng ≥ 60 case.
- [ ] Không file nào trong `src/` ngoài `*.test.ts` và `__fixtures__` bị đổi (`git diff --stat`).
- [ ] `npm run typecheck` xanh (test file nằm trong `src` nên được tsc kiểm).

## 4. Out of scope

Test hook/component React, test worker (phase 05 thêm test cho `worker/http.ts`, validate review).

## 5. Commit message dự kiến

```
test: unit test cho logic thuần (maps link, polyline, hành lang, kế hoạch sạc, nhóm, sao lưu, live)

Chụp hành vi hiện tại làm lưới an toàn trước khi refactor. Lỗi đã biết
(B1 nearestStations bỏ sót trạm theo kinh độ) đánh it.fails, sửa ở phase 03.
```
