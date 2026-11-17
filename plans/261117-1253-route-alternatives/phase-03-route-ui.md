# Phase 03 — Chọn tuyến và chip Tránh trên giao diện

**Goal:** Bảng Dọc đường có thẻ tuyến (khi > 1 tuyến), gợi ý theo `!5iN`, 3 chip Tránh; bản đồ vẽ tuyến phụ xám bên dưới tuyến chính, chạm vào là chọn.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/ui/TripPanel.tsx` | MODIFY — `RoutePicker`, chip Tránh, gợi ý Google; props mới |
| `src/map/MapView.tsx` | MODIFY — `TripLayer.alts`, `onPickRoute`; source/layer tuyến phụ + lớp bắt chạm |
| `src/App.tsx` | MODIFY — `tripLayer` thêm `alts`, bounds gộp; truyền props mới cho TripPanel |

## 2. `src/ui/TripPanel.tsx`

Props thêm:
```ts
  routeTotals: number[]
  onSelectRoute: (i: number) => void
  onAvoid: (a: Avoid) => void
```
- Chuỗi mới (vi / en):
  - `routes: 'Tuyến đường'` / `'Routes'`
  - `routeCard: (km, n) => \`${km} km · ${n} trạm\`` / `… ${n} stations` (thời gian hiện đậm ở dòng trên của thẻ)
  - `googleHint: (n) => \`Trên Google bạn chọn tuyến thứ ${n} — chạm tuyến khớp bên dưới.\`` / `In Google Maps you picked route ${n} — tap the matching one below.`
  - `avoid: 'Tránh'` / `'Avoid'`, `toll: 'Thu phí'` / `'Tolls'`, `highway: 'Cao tốc'` / `'Highways'`, `ferry: 'Phà'` / `'Ferries'`
- `RoutePicker` đặt ngay sau `<form>`, chỉ hiện khi `trip.routes.length > 1`: hàng nút cuộn ngang (`role="radiogroup"`, mỗi nút `role="radio"` + `aria-checked`), nút chọn viền `border-brand` nền `bg-brand/10`; nội dung `fmtDuration(seconds)` (đậm) + `routeCard(km, routeTotals[i])`. Gợi ý `googleHint(googleRoute + 1)` hiện phía trên khi `googleRoute > 0`.
- Chip Tránh: thêm một nhóm trong hộp cấu hình nền xám (cùng kiểu nhóm "Cách tuyến" / "Công suất" người dùng vừa làm), `variant="outline"`; bấm → `onAvoid({ ...trip.avoid, [k]: !trip.avoid[k] })`. Tắt khi `busy`.
- `fmtDuration` đã có trong file — dùng lại.

## 3. `src/map/MapView.tsx`

```ts
export interface TripLayer {
  path: GeoPoint[]
  /** Tuyến phụ (không phải tuyến đang chọn), `idx` = vị trí trong trip.routes. */
  alts: Array<{ idx: number; path: GeoPoint[] }>
  ...
}
// Props thêm: onPickRoute?: (idx: number) => void
const SRC_ALT = 'trip-alt'
const ALT_COLOR = '#8a94a6'
```
- `addSource(SRC_ALT)` (FeatureCollection, mỗi feature `properties: { idx }`).
- Thêm 3 layer **trước** `trip-line-casing` (nằm dưới tuyến chính): `trip-alt-casing` (trắng, 7 px), `trip-alt-line` (`ALT_COLOR`, 4 px, opacity 0.9), `trip-alt-hit` (line 24 px, `line-opacity: 0`).
- `applyTrip` ghi thêm `SRC_ALT` (rỗng khi không có trip).
- `map.on('click', 'trip-alt-hit', (e) => latest.current.onPickRoute?.(e.features?.[0]?.properties?.idx))`; con trỏ `pointer` khi hover (giống ghim). Kiểm handler click nền bản đồ hiện có: nếu có, bỏ qua khi click trúng `trip-alt-hit` (dùng `queryRenderedFeatures`).
- `latest` ref thêm `onPickRoute`.

## 4. `src/App.tsx`

```ts
  const tripLayer = useMemo<TripLayer | null>(() => {
    if (!trip.route) return null
    return {
      path: trip.route.points,
      alts: trip.routes.map((r, idx) => ({ idx, path: r.points })).filter((a) => a.idx !== trip.routeIdx),
      stationIds: …,
      // Gộp mọi tuyến: chọn tuyến khác không làm khung nhìn nhảy.
      bounds: routeBounds(trip.routes.flatMap((r) => r.points)),
      padding: …,
    }
  }, [trip.route, trip.routes, trip.routeIdx, hits, chargePlan, isMobile])
```
- `<MapView … onPickRoute={tripCtl.selectRoute} />`.
- `<TripPanel … routeTotals={tripCtl.routeTotals} onSelectRoute={tripCtl.selectRoute} onAvoid={tripCtl.setAvoid} />`.

## 5. Acceptance criteria

- [ ] `npx tsc -b` + `npm run build` pass.
- [ ] `npx wrangler dev` + Playwright (viewport 1280×800 và 390×844): mở `/trip?link=<URL kéo tuyến 2 chặng có tên ở plan §7>` → header "Hồ Hoàn Kiếm… → Nhà hát…"; request `/api/route` có token `!p` và không có `alt`. (Cần `HERE_API_KEY`; không có key thì kiểm request URL qua `page.on('request')` và ghi "tuyến chưa kiểm tra".)
- [ ] Có key: `/trip?link=https://www.google.com/maps/dir/21.0278,105.8342/20.8449,106.6881/data=!4m3!4m2!3e0!5i1` → hiện ≥ 2 thẻ tuyến + gợi ý "tuyến thứ 2"; chạm thẻ 2 → danh sách trạm đổi, bản đồ đổi màu tuyến, khung nhìn không nhảy; chạm đường xám → chọn tuyến đó.
- [ ] Chip "Thu phí": request mới có `avoid=toll`, status về ready.
- [ ] Link có `!2m2!1b1!2b1` → chip Cao tốc + Thu phí bật sẵn.
- [ ] Không còn lỗi console mới; panel điện thoại không tràn ngang.

## 6. Out of scope

Docs / changelog (phase 04).

## 7. Commit message dự kiến

```
feat(trip): chọn trong các tuyến gợi ý và bật/tắt tránh thu phí, cao tốc, phà

TripPanel có thẻ tuyến (km · thời gian · số trạm), gợi ý theo tuyến đã chọn trên Google, chip
Tránh. MapView vẽ tuyến phụ xám dưới tuyến chính, chạm để chọn; khung nhìn gộp mọi tuyến.
```
