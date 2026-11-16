# Phase 02 — Trạng thái trên bản đồ và trong chi tiết trạm

**Goal:** Ghim trạm bảo trì / ngừng / chưa khai trương bị làm mờ. Chi tiết trạm có nhãn trạng thái: live từ `detail.depotStatus` nếu có, không thì lấy từ base. Chip **Đang hoạt động** ẩn các trạm không hoạt động.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/stations.ts` | MODIFY: thêm `STATUS_LABEL`, `statusOf(station, detail?)` |
| `src/map/MapView.tsx` | MODIFY: `Filters.activeOnly`, thuộc tính `st` trên feature, `icon-opacity`; **bỏ nút zoom +/− và ẩn nút định vị** (yêu cầu thêm của người dùng giữa phase, GeolocateControl vẫn chạy ngầm) |
| `src/ui/StationSheet.tsx` | MODIFY: nhãn trạng thái dùng `statusOf` (thêm Planned, AllBusy) |
| `src/App.tsx` | MODIFY: `Filters.activeOnly` + chip "Đang hoạt động" |

## 2. `src/data/stations.ts`

```ts
export type StatusKind = 'active' | 'busy' | 'maintaining' | 'out' | 'planned'

const FROM_BASE: Record<StationStatus, StatusKind> = { 0: 'active', 1: 'maintaining', 2: 'out', 3: 'planned' }
const FROM_DEPOT: Record<string, StatusKind> = {
  Available: 'active', AllBusy: 'busy', Maintaining: 'maintaining', OutOfService: 'out', Planned: 'planned',
}

export const STATUS_LABEL: Record<Exclude<StatusKind, 'active'>, string> = {
  busy: 'Đang hết cổng trống',
  maintaining: 'Đang bảo trì',
  out: 'Ngừng hoạt động',
  planned: 'Sắp khai trương',
}

/** Trạng thái để HIỂN THỊ: detail (live, khi mở trạm) đè bản build ngày. */
export function statusOf(st: Station, depotStatus?: string | null): StatusKind {
  return (depotStatus && FROM_DEPOT[depotStatus]) || FROM_BASE[st.status]
}
```

## 3. `src/map/MapView.tsx`

- `Filters` (bản sao trong file) thêm `activeOnly: boolean`. Phase 03 sẽ chuyển `Filters` thành type export dùng chung. Phase này vẫn giữ hai bản trùng như hiện tại để diff nhỏ.
- `toGeoJSON`: `if (filters.activeOnly && st.status !== 0) continue` và `properties: { id, grp, rank, st: st.status }`.
- Layer `point` thêm `paint`:

```ts
        paint: {
          // Bảo trì / ngừng / chưa khai trương: vẫn vẽ để biết có trạm, nhưng lùi ra sau.
          'icon-opacity': ['case', ['==', ['get', 'st'], 0], 1, 0.45],
        },
```

- `symbol-sort-key`: trạm không hoạt động vẽ dưới. Dùng `['-', ['get', 'rank'], ['case', ['==', ['get', 'st'], 0], 0, 2]]` (rank 1 = đã lưu, vẫn nổi hơn trạm thường).

## 4. `src/ui/StationSheet.tsx`

Thay khối `closed` bằng:

```tsx
  const status = statusOf(station, detail?.depotStatus)
  // ...
          {status !== 'active' && (
            <Chip size="sm" className={status === 'busy' ? 'bg-[#F0A500] text-white' : status === 'planned' ? 'bg-[#64748B] text-white' : 'bg-[#E53935] text-white'}>
              {status === 'planned' ? <CalendarClock /> : <Wrench />}
              {STATUS_LABEL[status]}
            </Chip>
          )}
```

`busy` chỉ đến từ detail (live), vì base không bao giờ có trạng thái này.

## 5. `src/App.tsx`

```tsx
interface Filters { favoritesOnly: boolean; activeOnly: boolean }
// state mặc định activeOnly: false
          <FilterChip
            label="Đang hoạt động"
            on={filters.activeOnly}
            onClick={() => setFilters((f) => ({ ...f, activeOnly: !f.activeOnly }))}
          />
```

## 6. Acceptance criteria

- [ ] `npm run build` pass.
- [ ] Chạy dev với base v3 local: tìm một trạm `status=3` (vd. entity `197158`). Ghim mờ, mở ra thấy chip "Sắp khai trương".
- [ ] Trạm `INACTIVE` (vd. `28725`): ghim mờ, chip "Đang bảo trì".
- [ ] Bật "Đang hoạt động": các ghim mờ biến mất, số trong cụm giảm. Tắt thì hiện lại.
- [ ] Regression: chip "Đã lưu", chọn trạm, ghim nhóm vẫn đúng. Trạm đang chọn (ghim lớn) không bị mờ.
- [ ] Đối chiếu thêm 3 trạm `status=3` với `get-locator` (`depot_status` phải là `Planned`).

## 7. Out of scope

- Màu theo kW, lọc công suất (phase 03).

## 8. Commit message dự kiến

```
feat(map): làm mờ trạm không hoạt động, thêm lọc "Đang hoạt động"

Ghim trạm bảo trì / ngừng / chưa khai trương có icon-opacity 0.45 theo cột status
của base. StationSheet hiện nhãn trạng thái qua statusOf(): depot_status live đè
bản build ngày, thêm "Sắp khai trương" và "Đang hết cổng trống".
```
