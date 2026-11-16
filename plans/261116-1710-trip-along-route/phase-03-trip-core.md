# Phase 03 — Lõi hành trình (TS thuần, chưa có UI)

**Goal:** Có đủ code client để từ một đoạn text hoặc link chia sẻ ra `RoutePath` và `RouteHits`. Có hook `useTrip` giữ state theo máy trạng thái ở plan §3. Chưa có UI nào dùng tới.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/flexiblePolyline.ts` | CREATE — port `FlexiblePolyline.kt` |
| `src/lib/mapsLink.ts` | CREATE — port `MapsLink.kt` (phần parse; phần mở link rút gọn gọi `/api/maps-link`) |
| `src/data/routeCorridor.ts` | CREATE — port `RouteCorridor.kt` + `StationRepository.alongRoute` |
| `src/data/trip.ts` | CREATE — client `/api/*`: `fetchRoute`, `geocode`, `reverse`, `expandLink`; `resolveTrip` |
| `src/data/useTrip.ts` | CREATE — hook state machine |

Ràng buộc: `flexiblePolyline.ts`, `mapsLink.ts` (phần parse), `routeCorridor.ts` **không import runtime** gì ngoài nhau (chỉ `import type`). Như vậy chạy thử được bằng `node` (Node 24 tự bỏ type) từ script ở scratchpad.

## 2. `src/lib/flexiblePolyline.ts`

Port 1-1: bảng `TABLE` từ ký tự `'-'` (45), varint 5 bit + cờ `0x20`, unzigzag, header (precision, thirdDim), bỏ qua chiều thứ ba. Dùng `number` thường: toạ độ × 10^precision ≤ ~1,8e7, an toàn trong 2^53. Trả `[]` khi version ≠ 1 hoặc chuỗi hỏng.

```ts
export interface GeoPoint { lat: number; lng: number }
export function decodeFlexiblePolyline(encoded: string): GeoPoint[]
```

## 3. `src/lib/mapsLink.ts`

```ts
export interface TripStop { lat?: number; lng?: number; text?: string }
export const SHORTENER_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co']
export function firstUrl(text: string): string | null          // /https?:\/\/\S+/ rồi bỏ . , ) " cuối
export function isShortLink(url: string): boolean
/** Link full -> các chặng; null nếu không đọc được. Thử readDirections rồi readSinglePlace. */
export function parseMapsUrl(url: string): TripStop[] | null
```

Port y nguyên logic Kotlin:
- `/dir/` có `destination` → origin + `waypoints` tách theo `|` + destination.
- `/dir/A/B/@…/data=…` → segment sau `dir`, bỏ `@…` và `data=…`, `decodeURIComponent` + `+`→space. Ghép lần lượt các cặp `!3d…!4d…` vào segment **có tên**; segment là "lat,lng" thì đọc thẳng.
- Một địa điểm: `?q=` → `!3d!4d` → `/@lat,lng` → tên từ `/place/<name>`.
- **Khác bản Android:** link chỉ đường ngoài `!3d<lat>!4d<lng>` còn có thể ghi toạ độ dạng `!1d<lng>!2d<lat>` (thứ tự **kinh độ trước**). Đã thấy trong link thật `https://maps.app.goo.gl/Wa4BHQY94CRPMfuA7` (2026-11-16): `…!2m2!1d105.8007614!2d21.007222…!2m2!1d105.7639194!2d21.0204835`. Đọc cả hai dạng theo thứ tự xuất hiện trong `data=`; nếu link có cả hai dạng thì ưu tiên `!1d!2d` (dạng chỉ đường). Regex Android chỉ có `!3d!4d`, nên với link này app sẽ phải đoán lại toạ độ từ tên qua HERE.

## 4. `src/data/routeCorridor.ts`

```ts
export interface RoutePath { points: GeoPoint[]; limited: boolean[]; meters: number; seconds: number }
export interface AlongRoute { station: Station; atKm: number; offsetKm: number }
export interface RouteHits { items: AlongRoute[]; total: number }

export function thinRoute(points: GeoPoint[], limited: boolean[]): { points: GeoPoint[]; limited: boolean[] }
export function corridorCells(points: GeoPoint[], radiusKm: number): number[]   // dùng cellOf() công thức như stations.ts
export function pickAlongRoute(route: ThinRoute, stations: Station[], radiusKm: number): AlongRoute[]
export function routeBounds(points: GeoPoint[]): [[number, number], [number, number]] | null  // [[w,s],[e,n]] cho maplibre fitBounds
/** = StationRepository.alongRoute: thin → cells → byCell → pick → trần 400 theo offset. */
export function alongRoute(index: StationIndex, route: RoutePath, radiusKm: number, limit = 400): RouteHits
```

Hằng số giữ nguyên: `KM_PER_LAT = 110.574`, `KM_PER_LNG = 111.320`, `MAX_POINTS = 1500`, `MIN_STEP_KM = 0.25`, `OPPOSITE_SIDE_KM = 0.3`, ô lưới 0,1°. Copy luôn comment giải thích "vì sao" (đo phẳng thay haversine, cắt theo offset chứ không cắt đuôi, luật ngược chiều cao tốc) sang tiếng Việt có dấu, giống style repo.

`cellOf` cần export từ `stations.ts` (đã export). `routeCorridor.ts` import `cellOf` từ `./stations`. Chạy bằng node: `stations.ts` không import runtime gì khác, nên vẫn chạy được.

## 5. `src/data/trip.ts`

```ts
export class TripError extends Error {}   // message là câu tiếng Việt hiển thị thẳng cho user

async function api<T>(path: string, signal: AbortSignal): Promise<T>   // !ok -> đọc {error}; 429 -> TripError('Gọi quá nhanh…')
export async function expandLink(url: string, signal: AbortSignal): Promise<string | null>
export async function geocode(q: string, at: GeoPoint | null, signal: AbortSignal): Promise<TripPoint | null>
export async function reverse(p: GeoPoint, signal: AbortSignal): Promise<string | null>
export async function fetchRoute(stops: GeoPoint[], signal: AbortSignal): Promise<RoutePath | null>
  // nối các section, bỏ điểm trùng ở chỗ nối (bỏ cả cờ đi kèm), limitedFlags từ spans (offset → offset kế tiếp)
/** text/link -> stops có toạ độ. Ném TripError với các câu giống Android. */
export async function resolveTrip(text: string, here: () => Promise<GeoPoint | null>, signal: AbortSignal): Promise<TripPoint[]>
```

Câu lỗi (giữ như Android):
- `Không đọc được liên kết Google Maps này.`
- `Không xác định được một trong các điểm của hành trình.`
- `Chưa lấy được vị trí của bạn — bật định vị rồi thử lại.`
- `Không tìm được đường giữa các điểm này. Kiểm tra mạng rồi thử lại.`

## 6. `src/data/useTrip.ts`

```ts
export function useTrip(index: StationIndex | null, userPos: GeoPoint | null): {
  trip: TripState
  open(text: string): void      // huỷ lượt cũ (AbortController), chạy resolve → route → filter
  setRadius(km: 2 | 5 | 10): void   // chỉ lọc lại bằng alongRoute(), không gọi mạng
  close(): void
}
```

- `here()`: dùng `userPos` nếu có, không thì `navigator.geolocation.getCurrentPosition` (timeout 10 s).
- `index` đổi (generation mới) thì lọc lại trên route đang có.

## 7. Acceptance criteria

- [ ] `npx tsc -b` pass.
- [ ] Script scratchpad `node verify-trip-core.ts` (import trực tiếp `src/lib/flexiblePolyline.ts`, `src/lib/mapsLink.ts`, `src/data/routeCorridor.ts`):
  - Decode chuỗi mẫu trong README HERE `BFoz5xJ67i1B1B7PzIhaxL7Y` → 3 điểm ≈ (50.10228, 8.69821), (50.10201, 8.69567), (50.10063, 8.69150).
  - `parseMapsUrl('https://www.google.com/maps/dir/?api=1&origin=21.02,105.83&waypoints=A|B&destination=Hai+Phong')` → 4 chặng đúng thứ tự.
  - `parseMapsUrl('https://www.google.com/maps/dir/21.02,105.83/Tên+A/@20.9,105.8,10z/data=!4m5!1m1!4e1!1m2!1m1!1s0x0:0x0!2m2!1d106.6!2d20.8!3d20.85!4d106.68')` → 2 chặng; chặng 2 có text "Tên A" + toạ độ 20.85/106.68; không có chặng `@…`.
  - `parseMapsUrl('https://www.google.com/maps/place/Ho+Guom/@21.02,105.85,17z')` → 1 chặng có toạ độ + text.
  - Link full đã mở từ `https://maps.app.goo.gl/Wa4BHQY94CRPMfuA7` → 2 chặng: "25T1 Trung Hòa Nhân Chính, …" (21.007222, 105.8007614) và "Sân vận động Quốc gia Mỹ Đình, …" (21.0204835, 105.7639194); đoạn `@21.0131317,…` không thành chặng.
  - `pickAlongRoute` trên tuyến thẳng tự dựng: trạm cách 1 km → giữ, `atKm` đúng ±0,05; trạm cách 3 km với r=2 → bỏ; trạm bên trái cách 50 m trên đoạn `limited` → bỏ, bên phải → giữ.
  - Trần: 500 trạm giả trong hành lang, limit 400 → `total=500`, giữ 400 trạm offset nhỏ nhất, `items` tăng dần theo `atKm`.
- [ ] `grep -rn "apiKey\|HERE_API_KEY" src/` → không có.

## 8. Out of scope

- UI, MapView, App (phase 04).

## 9. Commit message dự kiến

```
feat(trip): add route-corridor core ported from charge-map-android

Pure TS ports of FlexiblePolyline, MapsLink parsing and RouteCorridor
(thin/cells/pick/opposite-carriageway rule, 400-station cap by offset),
plus trip.ts (client for /api/*) and the useTrip state hook. No UI yet.
```

## 10. Kết quả thực hiện (2026-11-16)

- Nguồn port: `codengoo/charge-map-android` (private, lấy qua `gh api`): `FlexiblePolyline.kt`, `MapsLink.kt`, `RouteCorridor.kt`, `HereRouting.kt`, `HerePlaces.kt`, `MapViewModel.handleSharedText/resolvePoint`, `StationRepository.alongRoute`.
- Lệch: chuỗi mẫu HERE `BFoz5xJ67i1B1B7PzIhaxL7Y` giải ra **4** điểm (đúng README HERE; plan ghi 3 là sai). `alongRoute` bỏ trạm `status ≠ 0` như Android (`includeUnusable = false`). `useTrip` thêm `show()` + trạng thái `idle` (bảng mở, chưa có link). `trip.ts` thêm câu lỗi cho 429 / 503 (chưa có key). `parseHereRoute` tách khỏi `fetchRoute` để test không cần mạng.
- Đã kiểm bằng script scratchpad (bundle esbuild): polyline (cả mẫu có chiều thứ 3, chuỗi hỏng), 4 dạng link + link thật `maps.app.goo.gl/Wa4BHQY94CRPMfuA7` mở qua `/api/maps-link` → 2 chặng đúng toạ độ (dạng `!1d!2d`), pick (1 km giữ, 3 km bỏ, trái-cao tốc 50 m bỏ, phải giữ, trái-đường thường giữ, `atKm` ±0,05), trần 400/500 theo offset, bỏ trạm không hoạt động, thin ≤ 1.502 điểm giữ đầu/cuối + cờ cùng nhịp, nối section HERE.
