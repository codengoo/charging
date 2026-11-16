# Phase 04 — UI hành trình + vẽ tuyến + URL `/trip`

**Goal:** Người dùng mở bảng "Trạm dọc đường" từ chip trên bản đồ, dán link Google Maps và thấy:
- tuyến vẽ trên bản đồ, chỉ còn ghim của các trạm dọc tuyến;
- danh sách trạm xếp theo km, đổi được bán kính 2/5/10 km;
- bấm một trạm thì mở chi tiết trạm.

Mở trực tiếp `/trip?link=…` thì tự chạy hành trình.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/ui/TripSheet.tsx` | CREATE |
| `src/map/MapView.tsx` | MODIFY — prop `trip` (path + id trạm dọc tuyến + bounds); layer `trip-line`; lọc ghim; fitBounds |
| `src/App.tsx` | MODIFY — `useTrip`, chip "Dọc đường", đọc/ghi URL `/trip`, chặn đổi URL trạm khi trip mở |
| `src/lib/stationUrl.ts` | MODIFY — `TRIP_PATH = '/trip'`, `tripPath(link)`, `readTripLink(location)` |

## 2. `src/ui/TripSheet.tsx`

- Dựng bằng `Drawer` của vaul giống `StationSheet`/`SavedSheet`, đọc 2 file đó để giữ đúng style. Có các mức `snapPoints` để ở mức thấp vẫn thấy bản đồ; `modal={false}` để kéo/zoom map được ở mức thấp. Lý do giống Android: không phủ màn chắn lên map.
- Nội dung:
  - Tiêu đề "Trạm dọc đường", nút đóng.
  - Ô dán link: `Input` + nút "Dán" (`navigator.clipboard.readText()`, có try/catch) + nút "Tìm".
  - Dòng các chặng: "Điểm đi → … → Điểm đến".
  - Chip bán kính 2 / 5 / 10 km (`Chip` có sẵn).
  - Dòng tóm tắt, tuỳ trạng thái:
    - lỗi: chữ màu destructive;
    - đang chạy: spinner + "Đang tính đường và tìm trạm…";
    - xong: "qua N điểm dừng · 115 km · 2 giờ 5 phút · 42 trạm trong 2 km (hiện 400 trạm sát tuyến nhất)";
    - trống: "Mở Google Maps, chỉ đường rồi bấm Chia sẻ → Trạm Sạc, hoặc dán link vào đây".
  - Danh sách: cột trái "km 37" (màu brand, rộng cố định); bên phải tên trạm (2 dòng) và "cách tuyến 120 m · tối đa 150 kW" (kW lấy từ `power`, không có thì bỏ).
- Danh sách dài (≤ 400 dòng) render thẳng, không cần virtualize.

## 3. `src/map/MapView.tsx`

```ts
interface TripLayer {
  path: GeoPoint[]            // rỗng = không có tuyến
  stationIds: Set<string>
  bounds: [[number, number], [number, number]] | null
}
// Props thêm: trip: TripLayer | null
```

- Source `trip-route` (LineString) + layer `trip-line`: `line-color` = brand, `line-width` 5, `line-opacity` 0.85, viền trắng (`trip-line-casing`), đặt **dưới** `clusters`.
- Khi `trip.path.length > 0`, `toGeoJSON` chỉ phát feature có id thuộc `stationIds` (thêm tham số), tắt cluster bằng cách dùng source thứ hai `stations-trip`, cluster: false. Lý do: ≤ 400 điểm, gom cụm sẽ giấu trạm.
- `bounds` đổi → `map.fitBounds(bounds, { padding: { top: 120, bottom: <chiều cao peek của sheet>, left: 40, right: 40 } })`.
- Hết trip → xoá data tuyến, về source cụm như cũ.

## 4. `src/App.tsx`

- `const trip = useTrip(index, userPos)`.
- Lúc khởi tạo: `readTripLink(location)` đọc `link`, hoặc `url`, hoặc `firstUrl(text)` (do share target gửi). Có link → `trip.open(link)` khi `index` sẵn sàng, rồi `history.replaceState` về `tripPath(link)` (bỏ `title`/`text`/`url` thô).
- Chip mới cạnh "Danh sách": icon `Route` (lucide), nhãn "Dọc đường" → mở TripSheet trống.
- Effect đồng bộ URL hiện có: khi `trip.status !== 'closed'` thì **không** ghi `/station/…`. URL là `tripPath(link)` (hoặc `/trip` khi chưa có link).
- Bấm trạm trong TripSheet → `pick(st)`, StationSheet mở đè lên. TripSheet tự hạ xuống mức thấp nhất (giống Android `detailOpen`).
- Đóng TripSheet → `trip.close()`, URL về `/station/…` nếu đang có trạm, không thì `/`.

## 5. Acceptance criteria

- [ ] `npx tsc -b` + `npm run build` pass.
- [ ] Chạy `wrangler dev` (có `.dev.vars`) + `DATA_ORIGIN=http://127.0.0.1:8787 npm run dev`, kiểm bằng Playwright (viewport mobile 390×844 và desktop):
  - Dán link `https://www.google.com/maps/dir/21.0278,105.8342/20.8449,106.6881` → tuyến Hà Nội–Hải Phòng hiện trên map, có danh sách trạm, `km` tăng dần, tóm tắt có km + thời gian.
  - Đổi 2 → 5 km → số trạm tăng, **không** có request `/api/route` mới (xem network).
  - Bấm một trạm → StationSheet mở; URL vẫn là `/trip?link=…`.
  - Đóng TripSheet → tuyến biến mất, ghim cụm trở lại, URL về `/station/…` hoặc `/`.
  - Mở thẳng `/trip?link=<encoded link trên>` → tự tính hành trình.
  - Link rác `https://example.com` → hiện "Không đọc được liên kết Google Maps này."
  - Link rút gọn `maps.app.goo.gl/…` (user cung cấp) → chạy được. Nếu Google chặn ở local thì ghi lại, kiểm lại sau deploy.
- [ ] Chế độ tối: tuyến và sheet đọc được (screenshot).
- [ ] Regression: tìm kiếm, lọc "Đã lưu", mở trạm từ `/station/…`, QR vẫn chạy.

## 6. Out of scope

- Share target (phase 05).
- Lọc công suất trong danh sách dọc đường.

## 7. Commit message dự kiến

```
feat(trip): stations-along-route sheet with route overlay and /trip URL

TripSheet takes a pasted Google Maps link, draws the HERE route on the map,
limits pins to corridor stations and lists them by km with a 2/5/10 km
radius switch. /trip?link=... reopens a trip; station URLs are not written
while a trip is open.
```
