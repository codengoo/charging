# Phase 03 — Tiện ích gần trạm

**Goal:** Mở trạm thấy cà phê / ăn uống / WC / tạp hoá / cây xăng trong 400 m (OpenStreetMap).

## 1. Files chạm vào

| File | Action |
|---|---|
| `worker/amenities.ts` | CREATE — `/api/amenities?at=lat,lng` → Overpass, rút gọn thành `Amenity[]`, Cache API 7 ngày |
| `worker/api.ts` | MODIFY — route `/api/amenities` |
| `src/data/amenities.ts` | CREATE — `useAmenities(station, enabled)` |
| `src/ui/AmenitiesBox.tsx` | CREATE — chip theo loại (kèm số lượng); bấm chip xổ tối đa 5 chỗ gần nhất + khoảng cách; bấm chỗ mở Google Maps; dòng "© OpenStreetMap" |
| `src/ui/StationSheet.tsx` | MODIFY — gắn `AmenitiesBox` sau HistoryBox |
| `src/App.tsx` | MODIFY — gọi hook, truyền xuống |

## 2. Overpass

```
[out:json][timeout:8];
(nwr(around:400,LAT,LNG)[amenity~"^(cafe|restaurant|fast_food|toilets|fuel)$"];
 nwr(around:400,LAT,LNG)[shop~"^(convenience|supermarket)$"];);
out center 60;
```

`cafe`→cafe, `restaurant|fast_food`→food, `toilets`→toilets, `fuel`→fuel, `shop=*`→shop. Máy chủ: `overpass-api.de`, lỗi thì `overpass.kumi.systems`. Cache key `https://cache.local/amenities/<lat 4 số>,<lng 4 số>`; lỗi trả 502 không cache.

## 3. Acceptance criteria

- [ ] `npm run build` qua; `wrangler dev` + curl `/api/amenities?at=21.0285,105.8542` trả mảng; lần 2 có `X-Cache: HIT`.
- [ ] Bảng trạm hiện hộp tiện ích (dev server với `API_ORIGIN` trỏ wrangler dev).

## 4. Commit message dự kiến

```
feat: tiện ích quanh trạm (cà phê, ăn uống, WC…) từ OpenStreetMap
```
