# Phase 03 — Lọc công suất và màu ghim theo kW

**Goal:** Chip **Sạc nhanh DC** / **≥ 120 kW** (loại trừ nhau) lọc trạm theo `power`. Ghim thường đổi màu theo mức kW. Có một chú giải màu nhỏ. `Filters` thành type dùng chung, hết cảnh mỗi file một bản.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/stations.ts` | MODIFY: `PowerTier`, `tierOf(power)`, `Filters` + `passesFilters()` |
| `src/map/pins.ts` | MODIFY: không đổi glyph; chỉ export hằng màu tier nếu cần dùng chung với legend |
| `src/map/MapView.tsx` | MODIFY: nhận prop `power`, feature có `tier`, ảnh ghim theo tier, dùng `Filters` chung |
| `src/ui/PowerLegend.tsx` | CREATE: chú giải 3 màu, hiện khi bật lọc công suất |
| `src/App.tsx` | MODIFY: `filters.power`, hai chip, truyền `power` vào `MapView`, legend |

## 2. `src/data/stations.ts`

```ts
/** Mốc "siêu nhanh": dữ liệu My Maps có 120 kW ~2.300 trạm, 150–250 kW ~780 trạm. */
export const FAST_KW = 120

/** 0 = AC hoặc chưa có dữ liệu, 1 = DC dưới 120 kW, 2 = DC từ 120 kW. */
export type PowerTier = 0 | 1 | 2

export function tierOf(p: StationPower | undefined): PowerTier {
  if (!p || p.dcCount === 0) return 0
  const dcMax = p.groups.reduce((m, g) => (g.dc ? Math.max(m, g.kw) : m), 0)
  return dcMax >= FAST_KW ? 2 : 1
}

export interface Filters {
  favoritesOnly: boolean
  activeOnly: boolean
  /** 'dc' = có cổng DC; 'dc120' = có cổng DC ≥ 120 kW. Trạm chưa có dữ liệu power bị ẩn. */
  power: 'all' | 'dc' | 'dc120'
}

export const DEFAULT_FILTERS: Filters = { favoritesOnly: false, activeOnly: false, power: 'all' }

/** Lọc chung cho bản đồ và bảng "Gần tôi" (phase 04). `saved` chỉ cần khi favoritesOnly. */
export function passesFilters(
  st: Station,
  f: Filters,
  power: Map<string, StationPower> | null,
  saved?: Set<string>,
): boolean {
  if (f.favoritesOnly && !saved?.has(st.entityId)) return false
  if (f.activeOnly && st.status !== 0) return false
  if (f.power !== 'all') {
    const t = tierOf(power?.get(st.entityId))
    if (f.power === 'dc' ? t < 1 : t < 2) return false
  }
  return true
}
```

Lưu ý: `tierOf` dùng max kW của **cổng DC**, không dùng `maxKw` chung. Trạm có cả AC 11 kW lẫn DC 60 kW là tier 1.

## 3. `src/map/MapView.tsx`

- Bỏ `interface Filters` cục bộ, import `Filters`, `passesFilters`, `tierOf` từ `../data/stations`.
- Prop mới `power: Map<string, StationPower> | null`. Thêm vào `latest` ref và vào deps của effect `setData`: power tải xong thì vẽ lại một lần để có màu.
- `toGeoJSON(index, filters, book, power)`: dùng `passesFilters(st, filters, power, saved)`, `properties.tier = tierOf(power?.get(id))`.
- Ảnh ghim: thêm hai ảnh `pin-dc` (`#0284C7`) và `pin-dc120` (`#7C3AED`), glyph `charger`, rộng `PIN_W`. `IMG_DEFAULT` giữ `#12B76A` cho tier 0.
- `icon-image` của layer `point`:

```ts
          'icon-image': [
            'case',
            ['!=', ['get', 'grp'], ''],
            ['concat', 'pin-grp-', ['get', 'grp']],
            ['match', ['get', 'tier'], 1, IMG_DC, 2, IMG_DC120, IMG_DEFAULT],
          ],
```

## 4. `src/ui/PowerLegend.tsx`

Thẻ nhỏ `bg-card/90 backdrop-blur` ở góc dưới phải (nút changelog nằm góc trái nên không đè). Ba dòng gồm chấm màu + nhãn: "AC / chưa rõ", "DC < 120 kW", "DC ≥ 120 kW", thêm một dòng ghim mờ "Không hoạt động / sắp mở". Bấm vào thẻ thì thu thành một chấm tròn, bấm lại thì mở ra. Trạng thái thu/mở lưu localStorage `tramsac.legend` (đọc/ghi trong try/catch), mặc định là mở.

## 5. `src/App.tsx`

```tsx
const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
const setPower = (p: Filters['power']) =>
  setFilters((f) => ({ ...f, power: f.power === p ? 'all' : p }))
// hàng chip: Đã lưu · Sạc nhanh DC · ≥ 120 kW · Đang hoạt động · Danh sách
<FilterChip label="Sạc nhanh DC" on={filters.power === 'dc'} onClick={() => setPower('dc')} />
<FilterChip label="≥ 120 kW" on={filters.power === 'dc120'} onClick={() => setPower('dc120')} />
<MapView ... power={power} />
```

Hàng chip đã `flex-wrap`, trên điện thoại 360px sẽ xuống hai dòng. Chấp nhận được; nếu chật quá thì đổi sang một hàng vuốt ngang `overflow-x-auto no-scrollbar` (giống chip trong StationSheet).

## 6. Acceptance criteria

- [ ] `npm run build` pass.
- [ ] Dev: lúc mới mở ghim toàn xanh lá. Vài giây sau `power` tải xong thì ghim DC đổi xanh dương / tím mà bản đồ không nháy, camera không nhảy.
- [ ] Bật "Sạc nhanh DC": còn ~7.100 trạm (đếm `__map.getSource('stations')._data.features.length`). Bật "≥ 120 kW": ~3.000. Bấm lại thì về tất cả. Hai chip không cùng sáng.
- [ ] Kết hợp "≥ 120 kW" + "Đang hoạt động" + "Đã lưu" lọc đúng phép VÀ.
- [ ] Trạm đã lưu vẫn đeo ghim nhóm dù là DC.
- [ ] Legend thu/mở được, nhớ qua lần tải lại; chế độ riêng tư (localStorage lỗi) vẫn hiện bình thường.
- [ ] Màn 360px: hàng chip không tràn ngang trang.

## 7. Out of scope

- Lọc theo chuẩn đầu sạc (CCS2…): chỉ có trong detail.
- Lọc theo số cổng.

## 8. Commit message dự kiến

```
feat(map): lọc sạc nhanh DC / ≥120 kW và tô màu ghim theo công suất

Filters thành type chung trong stations.ts (passesFilters, tierOf) cho bản đồ và
các bảng sau. Ghim thường có 3 màu theo cổng DC mạnh nhất; vẽ lại một lần khi
power tải xong. Thêm PowerLegend bật/tắt được.
```
