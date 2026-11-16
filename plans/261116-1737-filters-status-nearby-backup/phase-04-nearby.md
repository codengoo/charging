# Phase 04 — Trạm gần nhất

**Goal:** Chip **Gần tôi** mở bảng 20 trạm hoạt động gần nhất, áp bộ lọc công suất đang bật. Vị trí lấy theo GPS; chưa có GPS thì theo tâm bản đồ. Bấm một dòng thì mở trạm như bình thường.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/stations.ts` | MODIFY: `nearestStations` nhận `predicate` + `maxRing` |
| `src/map/MapView.tsx` | MODIFY: prop `onMoveEnd(center)` |
| `src/ui/NearbySheet.tsx` | CREATE |
| `src/lib/format.ts` | CREATE: `fmtDistance` (từ SavedSheet) + `fmtKw` (từ StationSheet) |
| `src/ui/SavedSheet.tsx` | MODIFY: import `fmtDistance` từ `@/lib/format` |
| `src/ui/StationSheet.tsx` | MODIFY: import `fmtKw` từ `@/lib/format` (bảng Gần tôi cũng hiện kW) |
| `src/App.tsx` | MODIFY: state `showNearby`, `mapCenter` ref, chip "Gần tôi" |

## 2. `src/data/stations.ts`

```ts
/**
 * Các trạm gần một điểm, sắp xếp theo khoảng cách tăng dần. Quét rộng dần theo vòng ô lưới
 * (~11 km/vòng) cho tới khi đủ `limit` trạm qua `predicate`, tối đa `maxRing` vòng.
 */
export function nearestStations(
  index: StationIndex,
  lat: number,
  lng: number,
  limit = 20,
  predicate: (st: Station) => boolean = () => true,
  maxRing = 10,
): Array<Station & { distanceKm: number }> {
  for (let ring = 1; ring <= maxRing; ring++) {
    const deg = ring * CELL_SIZE
    const cand = stationsInBounds(index, lng - deg, lat - deg, lng + deg, lat + deg).filter(predicate)
    // Đủ số lượng CHƯA đủ: trạm ở góc hình vuông có thể xa hơn trạm ngoài vòng. Chỉ dừng khi
    // trạm thứ `limit` nằm trong bán kính vòng tròn nội tiếp (deg * 111 km).
    const sorted = cand
      .map((st) => ({ ...st, distanceKm: distanceKm(lat, lng, st.lat, st.lng) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
    if ((sorted.length >= limit && sorted[limit - 1].distanceKm <= deg * 111) || ring === maxRing) {
      return sorted.slice(0, limit)
    }
  }
  return []
}
```

Hàm cũ có lỗi nhỏ: đủ `limit` là dừng ngay, trong khi trạm ở góc ô vuông có thể xa hơn trạm ngoài vòng. Bản mới thêm điều kiện bán kính. Hiện chưa có chỗ nào khác gọi `nearestStations` (đã grep), nên đổi chữ ký an toàn.

## 3. `src/map/MapView.tsx`

```ts
  onMoveEnd?: (center: { lat: number; lng: number }) => void
// trong load: map.on('moveend', () => { const c = map.getCenter(); latest.current.onMoveEnd?.({ lat: c.lat, lng: c.lng }) })
```

## 4. `src/ui/NearbySheet.tsx`

- `ResponsiveDialog` giống `SavedSheet`.
- Props: `open, index, power, filters, origin: {lat,lng}, fromGps: boolean, onPick, onClose`.
- Tiêu đề "Trạm gần bạn" / "Trạm gần tâm bản đồ". Mô tả: "20 trạm đang hoạt động gần nhất · lọc: Sạc nhanh DC" (nhãn lọc chỉ hiện khi bật).
- Danh sách tính bằng `useMemo(() => nearestStations(index, origin.lat, origin.lng, 20, (st) => st.status === 0 && passesFilters(st, {...filters, favoritesOnly: false, activeOnly: true}, power), 10), …)`. `favoritesOnly` bỏ qua trong bảng này: muốn xem trạm đã lưu thì đã có bảng Danh sách.
- Mỗi dòng: `PinPreview` theo tier (cùng màu ghim), tên (clamp 2), địa chỉ (truncate), bên phải là khoảng cách (`fmtDistance`) và `maxKw` (vd "120 kW", chưa có dữ liệu thì bỏ trống).
- Không có kết quả: "Không có trạm phù hợp trong ~110 km." kèm gợi ý tắt bộ lọc.
- `origin` được **chụp lúc mở bảng** (state trong App lúc bấm chip), không chạy theo `moveend`: kéo bản đồ sau bảng thì danh sách không nhảy.

## 5. `src/App.tsx`

```tsx
const mapCenter = useRef<{ lat: number; lng: number }>({ lat: 16.05, lng: 108.2 })
const [nearby, setNearby] = useState<{ origin: { lat: number; lng: number }; fromGps: boolean } | null>(null)
// chip:
<Chip variant="floating" onClick={() => setNearby(userPos ? { origin: userPos, fromGps: true } : { origin: mapCenter.current, fromGps: false })}>
  <LocateFixed />
  Gần tôi
</Chip>
// MapView onMoveEnd={(c) => (mapCenter.current = c)}
// NearbySheet open={nearby !== null}; giữ origin cuối để còn nội dung lúc trôi xuống (giống sheetStation).
```

## 6. Acceptance criteria

- [ ] `npm run build` pass.
- [ ] Cho phép vị trí (hoặc giả lập toạ độ Hà Nội trong DevTools Sensors): "Gần tôi" ra 20 trạm, khoảng cách tăng dần, dòng đầu ≤ vài km, không có trạm mờ.
- [ ] Chặn vị trí: tiêu đề "gần tâm bản đồ", danh sách theo chỗ đang xem.
- [ ] Bật "≥ 120 kW" rồi mở "Gần tôi": mọi dòng có kW ≥ 120.
- [ ] Ra giữa biển (không trạm trong 110 km): hiện thông báo rỗng, không treo.
- [ ] Bấm một dòng: bảng đóng, bay tới trạm, mở chi tiết.
- [ ] Regression: `SavedSheet` vẫn hiện khoảng cách đúng (nếu chuyển `fmtDistance`).

## 7. Out of scope

- Khoảng cách theo đường đi (cần routing, thuộc plan trip).
- Tự cập nhật danh sách khi di chuyển.

## 8. Commit message dự kiến

```
feat(ui): bảng "Gần tôi" — 20 trạm hoạt động gần nhất theo bộ lọc

NearbySheet dùng nearestStations (thêm predicate + điều kiện bán kính để không bỏ
sót trạm ngoài góc ô lưới). Vị trí lấy GPS, không có thì theo tâm bản đồ (MapView
onMoveEnd); origin chụp lúc mở bảng.
```
