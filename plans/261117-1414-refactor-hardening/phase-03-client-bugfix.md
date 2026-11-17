# Phase 03 — Sửa lỗi phía client (B1–B11)

**Goal:** Các lỗi B1–B11 trong `plan.md` §4 được sửa; test `it.fails` của B1 đảo thành `it`; thêm test cho B3.

## 1. Files chạm vào

| File | Action | Lỗi |
|---|---|---|
| `src/data/stations.ts` | MODIFY | B1 — bán kính dừng dùng `111·cos(lat)` cho kinh độ |
| `src/data/reviews.ts` | MODIFY | B2 — `AbortController` + kiểm `shownFor.current === entityId`; effect đầu đi qua `call()` |
| `src/data/settings.ts`, `src/data/notes.ts` | MODIFY | B3 — persist trong `useEffect([state])`, updater thuần |
| `src/data/useStationData.ts` | MODIFY | B4 — recheck OK thì `setError(null)`; bỏ kết quả `loadPower` của gen cũ |
| `src/lib/qrCard.ts` | MODIFY | B5 — `setTimeout(() => URL.revokeObjectURL(u), 1000)` |
| `src/map/MapView.tsx`, `src/App.tsx` | MODIFY | B6 — prop `autoLocate` (false khi mở `/station/…` hoặc `/trip`); B7 — chỉ `onLocate` khi dịch > 50 m |
| `src/ui/SearchBar.tsx` | MODIFY | B8 — đóng khi blur/bấm ngoài/Escape, hàng là `<button>`, `role="listbox"` |
| `src/ui/StationSheet.tsx` | MODIFY | B9 — `<HistoryBox key={station.entityId}>` |
| `src/ui/SavedSheet.tsx` | MODIFY | B10 — bỏ id lọc không còn trong `usedGroups` |
| `src/ui/NearbySheet.tsx` | MODIFY | B11 — reset `gpsError` khi mở |
| `src/data/stations.test.ts`, `src/data/settings.test.ts` | MODIFY | |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh.
- [ ] Dev: mở `/station/<id>` khi GPS bật → camera ở lại trạm (B6).
- [ ] Dev: gõ tìm kiếm, bấm bản đồ → danh sách đóng; Escape đóng (B8).
- [ ] Dev: trạm A chọn mức kW trong lịch sử, mở trạm B → về mặc định (B9).
- [ ] GPS giả lập dao động < 50 m → App không re-render (B7). Không đo được thì ghi "chưa kiểm tra".

## 3. Commit message dự kiến

```
fix: sửa 11 lỗi client (trạm gần bỏ sót theo kinh độ, review lẫn trạm, GPS kéo camera, ô tìm kiếm không đóng…)
```

## 4. Kết quả (ghi lúc thực hiện)

- B6 làm khác dự kiến: không thêm prop `autoLocate` (bỏ `geo.trigger()` thì mất luôn chấm vị trí và `userPos`). Thay vào đó MapView nghe `movestart`: camera bị app/người dùng dời đi khi control còn `WAITING_ACTIVE` thì đặt `_watchState = 'BACKGROUND'` (trường nội bộ maplibre 4.x) — fix đầu chỉ cập nhật chấm, không kéo camera.
- B3 không có test: hook React cần môi trường DOM + testing-library, ngoài phạm vi (env `node`).
- SearchBar thêm `onClick` mở lại danh sách (Escape đóng nhưng ô vẫn giữ focus).
- Playwright (dev, GPS giả về sau 5 s): `/station/28704-…` camera ở lại trạm (17,45 / 106,63) dù GPS là Hà Nội; `/` không link thì camera bay về Hà Nội (ACTIVE_LOCK); tìm "vincom" → bấm bản đồ đóng, bấm ô mở lại, Esc đóng, chọn kết quả mở trạm.
- B7 (re-render) chưa đo bằng Profiler — chưa kiểm tra.
