# Trạm sạc dọc đường từ link Google Maps (web)

**Date:** 2026-11-16 17:10 (ICT)
**Scope:** `worker/`, `src/lib/`, `src/data/`, `src/ui/`, `src/map/`, `src/App.tsx`, `public/manifest.webmanifest`, `wrangler.jsonc`, `vite.config.ts`, docs (`README.md`, `CHANGELOG.md`, `src/data/changelog.ts`)
**Trigger:** App Android `charge-map-android` có tính năng: chia sẻ chỉ đường từ Google Maps sang app → app tính lại tuyến bằng HERE và liệt kê trạm sạc dọc tuyến theo thứ tự gặp trên đường. Port tính năng này sang web. Mọi lệnh gọi HERE và việc mở link rút gọn `maps.app.goo.gl` đi qua Worker của app để key HERE không lộ ra client.

## 1. Goal

- Người dùng đưa một link Google Maps (chỉ đường hoặc một địa điểm) vào app bằng hai cách:
  - Trên Android, PWA đã cài hiện trong menu **Chia sẻ** của Google Maps (Web Share Target).
  - Ở mọi nền tảng, **dán link** vào ô trong bảng "Trạm dọc đường".
- App vẽ tuyến lên bản đồ và liệt kê các trạm nằm trong hành lang 2/5/10 km quanh tuyến:
  - Danh sách xếp theo km gặp trên đường, mỗi trạm ghi "cách tuyến … m/km" và kW tối đa.
  - Bấm một trạm thì mở chi tiết trạm như bình thường.
- Hành trình có URL riêng `/trip?link=<link Maps>`: mở lại hoặc gửi URL này là tính lại được hành trình.
- Worker có thêm `/api/route`, `/api/geocode`, `/api/revgeocode` và `/api/maps-link`:
  - Ba endpoint đầu proxy sang HERE bằng secret `HERE_API_KEY`.
  - `/api/maps-link` mở link rút gọn của Google ở phía server.
  - Cả bốn chỉ nhận request cùng origin và bị giới hạn số lần gọi theo IP.
- Đổi đường dẫn trạm `/tram/<id>-<slug>` thành `/station/<id>-<slug>` (path tiếng Anh). `/tram/*` cũ chuyển 301 sang `/station/*` để QR đã in vẫn chạy.

## 2. Quyết định đã chốt (từ Q&A 1 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Lối vào hành trình | Web Share Target (PWA Android) + ô dán link. **Không** có ô nhập điểm đi/đến (giống Android). |
| Xác thực HERE | API key, Worker secret `HERE_API_KEY`, gắn `apiKey=` khi gọi HERE. Không làm OAuth. |
| Chống lạm dụng `/api/*` | Chỉ nhận request cùng origin (`Sec-Fetch-Site: same-origin`, hoặc `Origin`/`Referer` thuộc `charging.cangao.asia`/localhost) + Workers Rate Limiting binding theo IP: **30 request / 60 s**. |
| URL hành trình | Có, path tiếng Anh: `/trip?link=<url-encoded Maps link>`. |
| Path trạm | Đổi `/tram/*` → `/station/*`; Worker 301 `/tram/<rest>` → `/station/<rest>` (giữ query). |
| Ai làm gì | Worker chỉ làm I/O: proxy HERE, trả **nguyên** body của HERE; mở link rút gọn. Client lo phần tính toán: đọc link full, giải mã polyline, lọc hành lang. Lý do: Workers Free bị giới hạn 10 ms CPU. |
| Đọc link full (`/maps/dir/…`) | Ở client (`src/lib/mapsLink.ts`, thuần TS). Worker chỉ mở link rút gọn rồi trả về URL đích. |
| Chặn SSRF ở `/api/maps-link` | Chỉ mở host `maps.app.goo.gl`, `goo.gl`, `g.co`; chỉ trả URL đích thuộc `google.<tld>/maps`. |
| Bán kính hành lang | Chip 2 / 5 / 10 km, mặc định 2 km. Đổi bán kính chỉ lọc lại, không gọi routing lại. |
| Trần số trạm | 400 trạm. Vượt trần thì bỏ các trạm lệch xa tuyến nhất, giữ thứ tự km (giống Android). |
| Lọc trạm ngược chiều cao tốc | Có: trạm cách tuyến ≤ 300 m, nằm bên trái hướng đi, trên đoạn `functionalClass = 1` thì bỏ (port y nguyên). |
| Link chỉ có 1 chặng | Lấy GPS (`navigator.geolocation`) làm điểm đi. Không có GPS thì báo lỗi, giữ bảng mở. |
| Điểm dừng giữa | Tối đa 20 điểm `via` (giống Android). |
| Bản đồ khi đang có tuyến | Vẽ đường tuyến; chỉ hiện ghim của các trạm dọc tuyến (giống Android `tripFocus`); fit camera theo tuyến. |
| URL khi đang có hành trình | Trong lúc bảng hành trình mở, URL giữ `/trip?link=…`. Mở chi tiết trạm **không** đổi URL sang `/station/…`. Đóng hành trình thì về `/` (hoặc về `/station/…` nếu đang mở trạm). |

## 3. State machine (hành trình phía client)

```
            open(link)                    parse ok + đủ toạ độ
  CLOSED ─────────────► RESOLVING ───────────────────────► ROUTING ──ok──► READY
     ▲                    │  parse/geo fail                  │ fail          │ đổi bán kính
     │                    ▼                                  ▼               ▼
     │                  ERROR ◄─────────────────────────── ERROR          FILTERING ──► READY
     │  close()           │ dán link mới → RESOLVING
     └────────────────────┴───────────────────────────────────────────────────────────
```

- `open(link)` khi đang chạy thì **huỷ** lượt trước (`AbortController` + mã lượt), chỉ kết quả của lượt mới nhất được ghi vào state. Trùng với `tripJob?.cancel()` bên Android.
- `FILTERING` chạy đồng bộ trên main thread vì đã giảm còn ≤ 1.500 điểm × vài trăm ứng viên, vài ms. Không cần Web Worker.
- Thiếu GPS khi link chỉ có 1 chặng → `ERROR`, nhưng vẫn giữ `stops` để hiện.

## 4. Schema

Không có (không thêm DB/R2 key). Secret mới: `HERE_API_KEY`. Binding mới: rate limiter `API_LIMIT`.

## 5. Payload / DTO shape

Worker (tất cả `GET`, trả JSON, lỗi dạng `{ "error": string }` kèm status 400/403/429/502):

```ts
// GET /api/route?stops=lat,lng;lat,lng[;...]   (2..22 điểm; giữa = via, tối đa 20)
// -> nguyên body HERE Routing v8 (return=polyline,summary & spans=length,functionalClass)

// GET /api/geocode?q=<text>[&at=lat,lng]       -> nguyên body HERE discover (có at) / geocode (in=countryCode:VNM)
// GET /api/revgeocode?at=lat,lng               -> nguyên body HERE revgeocode (lang=vi, limit=1)

// GET /api/maps-link?url=<short link>
interface MapsLinkResponse { url: string }      // URL đích đã mở, thuộc google.*/maps
```

Client:

```ts
export interface GeoPoint { lat: number; lng: number }

export interface TripStop { lat?: number; lng?: number; text?: string }   // đọc từ link
export interface TripPoint { label: string; lat: number; lng: number }     // đã có toạ độ

export interface RoutePath {
  points: GeoPoint[]
  /** limited[i]: đoạn bắt đầu từ điểm i là cao tốc (functionalClass 1). Dài bằng points. */
  limited: boolean[]
  meters: number
  seconds: number
}

export interface AlongRoute { station: Station; atKm: number; offsetKm: number }
export interface RouteHits { items: AlongRoute[]; total: number }

export interface TripState {
  link: string | null
  status: 'closed' | 'resolving' | 'routing' | 'ready' | 'error'
  error: string | null
  stops: TripPoint[]
  route: RoutePath | null
  radiusKm: 2 | 5 | 10
  hits: RouteHits
}
```

## 6. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-station-path.md | Đổi `/tram/*` → `/station/*`, Worker 301 path cũ | — |
| 02 | phase-02-worker-api.md | Worker `/api/*`: proxy HERE + mở link rút gọn, kiểm origin, rate limit | 01 |
| 03 | phase-03-trip-core.md | Lib thuần TS: flexible polyline, đọc link Maps, hành lang tuyến, gọi API + điều phối hành trình | 02 |
| 04 | phase-04-trip-ui.md | TripSheet, vẽ tuyến trên MapView, nối App + URL `/trip` | 03 |
| 05 | phase-05-share-target.md | `share_target` trong manifest, changelog 0.5.0, README | 04 |

## 7. Bài học từ lần revert

Không áp dụng — chưa có plan trước cho tính năng này.

## 8. Phạm vi (In / Out)

**In scope:**
- `worker/index.ts` (route mới) và file mới `worker/api.ts`
- `wrangler.jsonc` (`run_worker_first`, `ratelimits`), `vite.config.ts` (proxy `/api`)
- `src/lib/stationUrl.ts`, `src/lib/flexiblePolyline.ts`, `src/lib/mapsLink.ts`
- `src/data/routeCorridor.ts`, `src/data/trip.ts`, `src/data/useTrip.ts`
- `src/ui/TripSheet.tsx`, `src/map/MapView.tsx`, `src/App.tsx`
- `public/manifest.webmanifest`, `public/robots.txt`
- `README.md`, `CHANGELOG.md`, `src/data/changelog.ts`, comment nhắc `/tram` trong `builder/`, `.github/workflows/build-data.yml`, `src/data/types.ts`

**Out of scope:**
- Ô nhập điểm đi/đến, tìm địa điểm bằng HERE Places trong UI
- Bộ lọc công suất (power band) cho danh sách dọc đường. Chỉ hiện kW tối đa nếu có.
- Đọc giọng nói, Android Auto, widget, quét QR (các tính năng khác của app Android)
- Cache response HERE ở Worker (KV/Cache API)
- Viết test framework cho repo (repo chưa có jest/vitest). Verify bằng script tạm ở scratchpad.
- Đổi tên các khoá localStorage, cấu trúc R2

## 9. Risks

- **Google chặn hoặc trả trang consent cho IP Cloudflare khi mở `maps.app.goo.gl`.** Giảm thiểu: Worker đặt User-Agent mobile như Android, đọc header `Location` theo từng bước (`redirect: 'manual'`, tối đa 5 bước), không được thì tìm URL `/maps/` trong body. Vẫn hỏng thì client báo "Không đọc được liên kết…" và gợi ý mở link trong Google Maps rồi copy link đầy đủ trên thanh địa chỉ.
- **Format link Google đổi không báo trước.** Chấp nhận được: mọi hàm parse trả null chứ không ném lỗi, UI có thông báo rõ.
- **Kiểm origin giả được bằng script.** Chấp nhận được: rate limit theo IP mới là hàng rào thật; quota HERE free rộng. Theo dõi dashboard HERE sau khi lên.
- **CPU Worker 10 ms.** Giảm thiểu: Worker không parse JSON route (stream nguyên body). Chỉ `/api/maps-link` có thể phải chạy regex trên body HTML: cắt body ở 256 KB đầu.
- **Share Target chỉ chạy khi PWA đã cài trên Android (Chrome).** Chấp nhận được: ô dán link là đường chính cho iOS/desktop.
- **Repo đang có nhiều thay đổi chưa commit (chuyển Pages Functions → Worker).** Commit theo phase sẽ trộn với các thay đổi đó. Giảm thiểu: user commit phần đang dở trước khi bắt đầu phase 01, hoặc phase chỉ `git add` đúng file trong bảng "Files chạm vào" (file đã có sửa dở thì sẽ dính chung).

## 10. Cập nhật trước khi thực hiện (2026-11-16, sau plan 261116-1737)

| Điểm | Thay đổi |
|---|---|
| Phiên bản | 0.5.0 và 0.6.0 đã dùng → bản trip là **0.7.0** (phase 05). |
| `/api/*` đã có `/api/station/<id>` (proxy chi tiết VinFast, `worker/locator.ts`) | `serveApi` chỉ nhận 4 path mới. `/api/station/*` giữ nguyên handler cũ, **không** bị kiểm origin / rate limit (đang chạy production, cache edge 6 giờ). |
| Bộ lọc mới (`Filters`, `passesFilters`, màu ghim theo `tier`, ghim mờ theo `st`) | Khi trip mở: source `stations-trip` (không gom cụm) chỉ chứa trạm dọc tuyến, vẫn mang `tier`/`st` để cùng màu/độ mờ với bản đồ thường. Bộ lọc chip không áp lên danh sách dọc đường (giữ Out of scope của plan). |
| Hàng chip vuốt ngang | Chip "Dọc đường" đứng sau "Gần tôi". |
| HERE key | Máy dev chưa có `HERE_API_KEY`. `/api/route`, `/api/geocode`, `/api/revgeocode` kiểm bằng response HERE giả (polyline tự mã hoá) ở server dữ liệu local. Gọi HERE thật: **chưa kiểm tra**, cần user đặt key. `/api/maps-link` không cần key, kiểm thật. |
