# Phase 06 — Helper dùng chung phía client + xoá code chết

**Goal:** Mỗi việc lặp lại có đúng một cài đặt trong `src/lib/`. Không đổi hành vi.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/storage.ts` (+test) | CREATE — `readJson(key, parse)`, `writeJson`, `readStr`, `writeStr` |
| `src/lib/http.ts` (+test) | CREATE — `fetchJson(path, {signal, onStatus})`, `isAbort(e)` |
| `src/lib/geo.ts` (+test) | CREATE — `LatLng`, `KM_PER_LAT`, `kmPerLng(lat)`, `haversineKm`, `getPosition()` (một bộ timeout) |
| `src/lib/text.ts` (+test) | CREATE — `foldText` (`̀-ͯ`), `b64urlEncode/Decode` |
| `src/lib/format.ts` | MODIFY — thêm `fmtMinutes`, `clock`, `remaining` |
| `src/data/{battery,settings,notes,groups,reviews,stations,live,trip,drive,useStationDetail,useTrip,backup,routeCorridor}.ts` | MODIFY — dùng helper mới |
| `src/lib/{langSwitch,mapsLink,stationUrl,flexiblePolyline}.ts` | MODIFY — dùng helper mới |
| `src/ui/{TripPanel,PowerLegend,LiveSection,BatteryControl}.tsx`, `src/App.tsx` | MODIFY — storage/format/geo |
| `src/components/ui/card.tsx`, `src/components/ui/separator.tsx` | DELETE (không ai import) |
| `src/hooks/use-media-query.ts`, `src/components/ui/responsive-dialog.tsx`, `src/index.css` | MODIFY — bỏ `useIsSmallScreen`, `useIsDesktop`, `ResponsiveDialogTrigger/Close`, token sidebar/chart |
| `src/data/groups.ts` | MODIFY — xoá `isSaved`; thêm `normalizeBook()` thay `JSON.parse(serializeBook())` trong `backup.ts` |

Hằng số: `CELL_SIZE` một chỗ (`stations.ts`, `routeCorridor` import); `dcMax` export từ `stations.ts`; `FALLBACK_KMH = 50` một chỗ.

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh; test phase 02 chỉ đổi đường import.
- [ ] `grep -rn "localStorage\." src` chỉ còn `lib/storage.ts`.
- [ ] `grep -rn "navigator.geolocation" src` chỉ còn `lib/geo.ts`.
- [ ] Dev: thông báo lỗi 429/404/mất mạng của Dọc đường, live, chi tiết trạm như cũ (tắt mạng bằng DevTools).

## 3. Commit message dự kiến

```
refactor(lib): gom localStorage, fetch, định vị, bỏ dấu, định dạng thời gian; xoá code không dùng
```
