# Bản đồ trạm sạc ô tô VinFast — Web

Webapp bản đồ ~25.000 trạm sạc ô tô VinFast, dữ liệu làm mới hằng ngày. Port từ app Android
`charge-map-android`. Chạy tại **https://charging.cangao.asia**.

- **Bản đồ:** MapLibre GL JS + tile **OpenFreeMap** (miễn phí, không cần key).
- **Dữ liệu:** GitHub Action build mỗi ngày → R2 → Worker phục vụ `/data/*` (xem
  "Pipeline dữ liệu" bên dưới). Client tải `manifest` → `base` (vẽ bản đồ) → `power` (số cổng, kW).
- **Deploy:** Cloudflare **Worker + Static Assets** (`wrangler.jsonc`, `worker/index.ts`).

> Quy ước giao diện (màu, chữ, component, pattern bảng/QR) ở [`design.md`](design.md) — dùng chung hệ với chiatien.

## Tính năng

- Bản đồ toàn VN, tự gom cụm marker, bấm cụm để phóng to.
- Mở trang tự xin vị trí hiện tại và bay về đó (không có nút zoom / định vị — GeolocateControl
  vẫn chạy ngầm để vẽ chấm vị trí).
- Tìm trạm theo tên/địa chỉ (không phân biệt dấu).
- Lọc (kết hợp phép VÀ, `passesFilters` trong `src/data/stations.ts`): đã lưu, **sạc nhanh DC** /
  **≥ 120 kW** (theo cổng DC mạnh nhất; trạm chưa có dữ liệu power bị ẩn khi lọc), **đang hoạt động**.
- **Màu ghim theo công suất** (`TIER_COLORS` trong `src/map/pins.ts`): AC/chưa rõ xanh lá, DC < 120 kW
  xanh dương, DC ≥ 120 kW tím; trạm đã lưu vẫn đeo ghim nhóm. Chú giải `src/ui/PowerLegend.tsx`.
- **Trạng thái trạm**: bảo trì / ngừng / sắp khai trương vẽ mờ (`icon-opacity`), có nhãn trong chi
  tiết. Lấy từ bản build ngày; mở trạm thì `depot_status` live (kể cả "hết cổng trống") đè lên.
- **Gần tôi** (`src/ui/NearbySheet.tsx`): 20 trạm đang hoạt động gần nhất theo bộ lọc công suất,
  vị trí GPS hoặc tâm bản đồ.
- Chi tiết trạm: tên, địa chỉ, công cộng/nội bộ, trụ LINK, phí gửi xe, **số cổng + công suất
  từng mức kW (AC/DC)** — ~89% trạm có dữ liệu.
- **Nhóm trạm đã lưu** (port từ app Android): 3 nhóm dựng sẵn + nhóm tự tạo (tên, biểu
  tượng, màu, thời hạn tự gỡ), danh sách đã lưu lọc theo nhóm. Lưu trong localStorage
  khoá `tramsac.groups`; khoá cũ `tramsac.favorites` tự chuyển sang nhóm "Yêu thích".
- **Ghim trạm** vẽ từ SVG (`src/map/pins.ts`, port `ic_pin_*` / `ic_grp_*`): vỏ giọt nước
  trắng + đĩa màu nhạt + hình đậm, raster theo `devicePixelRatio` rồi `map.addImage`.
- Nút **Chỉ đường** mở Google Maps.
- **Chia sẻ bằng QR** (`src/ui/ShareSheet.tsx`): QR link trạm (mở app) và QR vị trí Google Maps,
  tải ảnh thẻ QR / Web Share.
- **Trạm dọc đường** (`src/ui/TripPanel.tsx`, `src/data/useTrip.ts`, port từ `charge-map-android`):
  dán link chỉ đường Google Maps (hoặc chia sẻ từ Google Maps vào PWA đã cài trên Android — Web
  Share Target `action: /trip`). Link rút gọn mở qua `/api/maps-link`; chặng chỉ có tên đoán toạ
  độ bằng HERE; tuyến tính bằng HERE Routing (`/api/route`). Đi thẳng 2 điểm thì xin tối đa 3 tuyến
  (thẻ trong bảng + đường xám chạm được trên bản đồ, không ghi vào URL). Khối `data=` của link đọc theo
  cây (`src/lib/mapsLink.ts`): toạ độ chặng `!2m2!1d<lng>!2d<lat>`, điểm kéo tuyến `!3m…!1m2!1d!2d` (gửi
  HERE dạng via `passThrough`), tránh `!2m…!1b1` cao tốc / `!2b1` thu phí / `!3b1` phà, tuyến đang chọn
  `!5iN` (chỉ để gợi ý). Link iOS `maps.google.com/?saddr=…&daddr=…&geocode=…` cũng đọc được. Client giải mã flexible polyline
  (`src/lib/flexiblePolyline.ts`), lọc hành lang 2/5/10 km (`src/data/routeCorridor.ts`: đo phẳng,
  bỏ trạm bên kia dải phân cách cao tốc, trạm sát cao tốc mà không phải trạm dừng nghỉ cùng chiều (phải
  > 150 m hoặc bên trái) gắn `viaExit` — kế hoạch sạc cộng quãng vòng ước tính `EXIT_ACCESS_KM` (2,5 km) mỗi chiều, trần 400 trạm theo độ lệch), xếp theo km gặp trên đường.
  URL `/trip?link=…` mở lại hành trình. Cần secret `HERE_API_KEY` (xem "API proxy HERE").
- **% pin khi đến trạm** (`src/data/battery.ts`, `src/data/useBattery.ts`, `src/data/vehicles.ts`, `src/ui/BatteryControl.tsx`): chọn xe
  trong Cài đặt (10 mẫu VinFast hoặc Tuỳ chỉnh, công tắc điều hoà ×1,08), kéo % pin hiện tại (localStorage
  `tramsac.battery`, cũ sau 2 giờ). Bảng trạm hiện "Còn ~X–Y% khi tới" theo quãng đường lái (`/api/drive`; đường
  chim bay × 1,3 khi lỗi) và thời gian sạc lên 80% ở cổng mạnh nhất còn trống; Dọc đường hiện % tại từng trạm
  (`atKm + 2 × offsetKm`) và vạch "Trạm cuối còn kịp" (ước tính bi quan ≥ mức dự phòng, mặc định 10%). Tính hoàn toàn ở client, không
  gọi thêm HERE/EVCS. Mô hình: tiêu thụ thực tế ước tính của xe × hệ số tốc độ trung bình (< 40 km/h 0,95 … ≥ 90
  km/h 1,25), hiện khoảng ±8%, chưa tính độ dốc. Thông số xe tra 2026-11-17, `kwhPer100` là ước tính (≈ dung
  lượng ÷ NEDC × 0,8), không phải số hãng công bố.
- **Ghi đè tiêu thụ:** VehicleSheet có ô "Tiêu thụ thực tế" (`Settings.usageOverride`) — giữ pin / công suất sạc
  của mẫu, chỉ thay kWh/100 km. Đổi mẫu thì xoá.
- **Kế hoạch dừng sạc** (`src/data/chargePlan.ts`): chip "Lên kế hoạch sạc" trong Dọc đường. Thứ tự ưu tiên:
  (1) ít lần sạc nhất → (2) tổng phút sạc ngắn nhất (chênh < 1 phút coi như bằng) → (3) tổng km vòng khỏi tuyến ít nhất.
  Duyệt theo lớp số lần sạc trên trạng thái (trạm DC ≥ 50 kW, % pin khi tới làm tròn 1%); mỗi lần dừng thử "vừa đủ
  tới trạm kế" và 50/60/70/80%, lần cuối vừa đủ tới đích; an toàn = ước tính bi quan khi tới ≥ mức dự phòng
  (`Settings.reservePct`, mặc định 10%). ≤ 20 ms với 400 trạm.
- **Đường cong sạc** (`src/data/vehicles.ts` `dcCurve`, `src/data/battery.ts` `chargeMinutes`): mỗi mẫu một đường
  [% pin, kW], hình dạng suy luận theo loại pin, co cho 10→70% khớp thời gian hãng công bố; thời gian sạc tích phân
  bước 0,5%, mỗi bước min(đường cong, cổng trạm).
- **Quét QR** (`src/ui/QrScanSheet.tsx`, nút cạnh ⚙): `qr-scanner` nạp lười, nhận link `/station/<id>` và `/tram/<id>`
  cũ của đúng host app (`stationIdFromQr`).
- **Offline** (`vite.config.ts`, vite-plugin-pwa): precache app shell; `/data/base|power-*` CacheFirst,
  `manifest.json` NetworkFirst; ô bản đồ OpenFreeMap StaleWhileRevalidate (4000 mục, 30 ngày); `/api/route|maps-link|
  geocode|revgeocode|drive` NetworkFirst (7 ngày) → mở lại hành trình vừa xem khi mất sóng; live / đánh giá không
  cache. Nhãn "Đang offline" (`src/ui/OfflineBadge.tsx`). `sw.js` no-cache trong `public/_headers`. Tính trên danh sách trạm dọc đường đang hiện (theo bộ lọc công suất), không gọi thêm API. Bật thì bản
  đồ chỉ vẽ ghim các điểm dừng.
- **Ghi chú cá nhân** (`src/data/notes.ts`, `src/ui/NoteBox.tsx`): localStorage `tramsac.notes`, ≤ 1.000 ký tự;
  sao lưu mang trường `notes` (gộp giữ bản sửa sau).
- **Đánh giá & bình luận công khai** (`worker/reviews.ts`, `src/ui/ReviewsSection.tsx`): xem mục bên dưới.
- **Sao lưu / chuyển máy** (`src/data/backup.ts`, `src/ui/BackupSheet.tsx`): sổ nhóm nén
  `deflate-raw` + base64url trong hash `/#import=…` (không tới server), QR khi link ≤ 2.000 ký
  tự, tải / nhập file `.json`. Nhập luôn **gộp**, hỏi xác nhận trước.

### Dữ liệu ở client (`src/data/useStationData.ts`)

- `GET /data/manifest.json` với `cache: 'no-cache'` (luôn hỏi lại, thường chỉ 304) →
  `base-<gen>-<hash>.json` (vẽ bản đồ) → `power-<gen>-<hash>.json` tải ngầm, căn theo thứ tự hàng của base.
- Tab để mở lâu: quay lại tab (sau ≥ 30 phút) thì hỏi manifest; tên file base/power đổi (`dataKey`
  trong `src/data/format.ts`) → tải lại và thay chỉ mục **không dựng lại bản đồ**. Trạm đang mở và
  nhóm đã lưu giữ nguyên (cùng `entityId`).

## Link trạm & chia sẻ

- Mỗi trạm có URL `/station/<entityId>-<slug>` (`src/lib/stationUrl.ts`; trước 0.7.0 là `/tram/…`,
  Worker 301 `/tram/<rest>` → `/station/<rest>` giữ query để QR đã in vẫn mở được). App đọc URL lúc mở để
  chọn trạm, và đổi URL theo trạm đang mở.
- `worker/index.ts` (route `/station/*`, khai trong `run_worker_first`) thay meta title /
  description / Open Graph theo trạm trong `index.html` để link gửi qua Zalo, Messenger có
  preview đúng; slug sai → 301 về slug đúng, id không tồn tại → 404. HTML không cache.
- Tra trạm từ shard `seo-<gen>/<id % 32>.json` (~100 KB) do builder ghi lên R2 — parse cả base
  4 MB vượt hạn 10 ms CPU Free plan. Manifest chưa có `seo` (bản build cũ) thì vẫn mở app,
  chỉ thiếu preview.
- **Dữ liệu trạm là nội bộ:** trang `/station/*` gắn `noindex` (header `X-Robots-Tag` + thẻ meta),
  không JSON-LD; `/data/*` cũng `noindex` + `Disallow` trong robots.txt. `public/sitemap.xml`
  chỉ có trang chủ.

## Đánh giá & bình luận (`worker/reviews.ts`, D1)

Mỗi thiết bị một đánh giá (1–5 sao + bình luận ≤ 500 ký tự + biệt danh) mỗi trạm, sửa / xoá được. Ẩn danh: máy
sinh `deviceId` ngẫu nhiên (`tramsac.device`), gửi header `X-Device`; D1 chỉ lưu `SHA-256(REVIEW_PEPPER:deviceId)`.
Bài có 3 thiết bị báo cáo thì tự ẩn (tác giả vẫn thấy kèm nhãn). Lọc link / email / số điện thoại (422), giới hạn
`REVIEW_LIMIT` 5 lần ghi / phút / IP, Turnstile khi có secret. Schema: `migrations/0001_reviews.sql`.

| Endpoint | Việc |
|---|---|
| `GET /api/reviews/<entityId>[?before=<updatedAt>]` | Điểm TB, phân bố, bài của tôi, 20 bài mới nhất |
| `PUT /api/reviews/<entityId>` | Viết / sửa bài của tôi `{ rating, body, nickname, turnstile? }` |
| `DELETE /api/reviews/<entityId>` | Xoá bài của tôi |
| `POST /api/reviews/report/<id>` | Báo cáo `{ turnstile? }` |
| `GET /api/admin/reviews?hidden=1\|2\|all` | Bài bị ẩn (1 tự ẩn, 2 admin ẩn) / tất cả — `Authorization: Bearer <ADMIN_TOKEN>` |
| `POST /api/admin/reviews/<id>` | `{ "hidden": 0 }` hiện lại (xoá báo cáo cũ) / `{ "hidden": 2 }` ẩn |
| `DELETE /api/admin/reviews/<id>` | Xoá hẳn |

**Bật trên production (một lần):**

```bash
# Token CLOUDFLARE_API_TOKEN cần quyền D1:Edit (hoặc `npx wrangler login`).
npx wrangler d1 create tramsac-reviews          # đã tạo 2026-11-17 (id trong wrangler.jsonc)
npx wrangler d1 migrations apply tramsac-reviews --remote
npx wrangler secret put REVIEW_PEPPER           # chuỗi ngẫu nhiên dài, ĐỪNG đổi sau này (đổi = mất quyền sửa bài cũ)
npx wrangler secret put ADMIN_TOKEN
# Turnstile (khuyên bật): dashboard Cloudflare → Turnstile → Add widget, hostname charging.cangao.asia.
npx wrangler secret put TURNSTILE_SECRET        # Secret key
npm run deploy                                  # site key nằm trong .env.production (công khai)
```

Chưa có `TURNSTILE_SECRET` thì Worker không bắt token (chỉ còn rate limit + lọc nội dung). Có secret mà build thiếu
`VITE_TURNSTILE_SITEKEY` thì mọi lần ghi bị 403 — đặt cả hai. Local: chép `.dev.vars.example` thành `.dev.vars`,
`npx wrangler d1 migrations apply tramsac-reviews --local`, `npx wrangler dev --local`.

Duyệt bài bị báo cáo:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://charging.cangao.asia/api/admin/reviews?hidden=1
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"hidden":0}' https://charging.cangao.asia/api/admin/reviews/<id>
```

### Hạn chế đã biết: "mỗi thiết bị một đánh giá" chưa chặt

Hiện **không dựa vào IP**: duy nhất theo `UNIQUE (station_id, device_hash)`, với "thiết bị" = mã ngẫu nhiên trong
localStorage (`tramsac.device`). IP chỉ dùng tạm cho rate limit (`REVIEW_LIMIT` 5 ghi / `API_LIMIT` 30 đọc mỗi phút)
và gửi kèm khi xác minh Turnstile — không lưu vào D1. Chốt giữ như vậy (2026-11-17), khắc phục khi có dấu hiệu bị
dìm / thổi điểm.

**Lỗ hổng:** tab ẩn danh, xoá dữ liệu trang, trình duyệt khác, PWA trên iOS (localStorage tách khỏi Safari) → mã
thiết bị mới → đánh giá thêm cho cùng trạm. Turnstile chỉ chặn bot, không chặn người làm tay.

**Các hướng đã cân nhắc** (chi tiết lý do trong lịch sử thảo luận khi làm 0.10.0):

| Hướng | Được | Vướng |
|---|---|---|
| Chặn cứng N bài / IP / trạm / 30 ngày | Chặn người vô tình đánh giá lại trên cùng mạng | CGNAT 4G và wifi công cộng tại trạm → chặn nhầm đúng người đang ở trạm; máy bay / đổi mạng / IPv6 / VPN là lách; IP là dữ liệu cá nhân (NĐ 13/2023) — phải HMAC có pepper (IPv4 băm thường dò ngược được), cron xoá sau 30 ngày; phải đếm theo nhật ký tạo bài (không thì xoá rồi viết lại là lách) |
| FingerprintJS mã nguồn mở (v5, MIT) | Miễn phí, chạy ở trình duyệt | Chính xác ~40–60%: iPhone cùng đời trùng mã → chặn nhầm; mã sinh ở client nên tự sửa được; chỉ đáng làm tín hiệu phụ |
| Fingerprint Pro (trả phí) | Nhận ra ẩn danh / xoá dữ liệu, server xác minh, ~99,5% (hãng công bố) | ~99 USD / tháng / 20k lượt (giá 2026, kiểm lại); phụ thuộc dịch vụ ngoài; là công nghệ theo dõi — cần ghi vào chính sách riêng tư, có thể phải xin đồng ý |
| Đăng nhập (Google / Zalo) | Thật sự mỗi người một bài | Làm OAuth + phiên; người dùng ngại đăng nhập |

**Đề xuất khi cần làm:** bước đầu **không chặn mà gộp khi tính điểm** — lưu `HMAC(pepper, IP hoặc tiền tố IPv6 /64)`
(xoá sau 30 ngày) cho mỗi bài; điểm trung bình tính các bài trùng mạng của cùng trạm là một (bình luận vẫn hiện đủ);
`/api/admin/reviews` thêm lọc "nhiều bài từ cùng mạng". Cần chắc chắn mỗi người một bài thì chuyển sang đăng nhập
(hoặc Fingerprint Pro nếu chấp nhận chi phí). Kiểm tra định kỳ: `GET /api/admin/reviews?hidden=all`.

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173 — /data/* proxy sang https://charging.cangao.asia
npm run build      # ra thư mục dist/
```

## Kiểm tra

```bash
npm run typecheck  # tsc cho src/ + worker/ (workers-types, không DOM) + builder/ (.mjs, @ts-check)
npm test           # Vitest, logic thuần (env node) — script đã cố định --maxWorkers=2
```

Luôn chạy test với **tối đa 2 worker** (`npm test` / `npm run test:watch` đã gắn sẵn
`--maxWorkers=2`; gọi `npx vitest` trực tiếp thì tự thêm) — chạy full core làm treo máy.
CI (`.github/workflows/ci.yml`) chạy typecheck + test + build trên mỗi push / PR vào `main`.
Test nằm cạnh file (`*.test.ts`); test chưa phủ hook / component React.

## Cấu trúc mã

```
src/
  App.tsx            ghép trạng thái + bảng; logic tách ra src/app/
  app/               useUrlSync (deep link trạm / hành trình / sao lưu, URL + tiêu đề tab),
                     useTripPlan (kế hoạch sạc + lớp tuyến), useSheets (cờ mở bảng), MapChips
  map/               MapView (vòng đời MapLibre), layers.ts (nguồn / lớp / sự kiện / ảnh ghim), pins.ts
  ui/                các bảng (AppSheet = khung chung), StationRow, useQrCanvas (QR / chép / nháy)
  components/ui/     primitive shadcn (dialog, drawer, responsive-dialog, …)
  data/              miền + hook: stations, groups, trip (mạng) / here (đọc body HERE) / tripTypes /
                     routeCorridor / chargePlan / battery (thuần) + useTrip / useBattery / useSettings…
                     format.ts = định dạng file R2 dùng chung builder ↔ Worker ↔ client
  lib/               storage (localStorage an toàn), http (fetchJson + HttpError), geo (GeoPoint,
                     distanceKm, getPosition), text (bỏ dấu, base64url), format, mapsLink, stationUrl…
worker/              index.ts (bảng ROUTES + guard), http.ts (json / fail / sameSite / checkGuard),
                     manifest.ts (cache manifest + tra shard SEO), api / locator / evcs / reviews
builder/             ETL Node thuần (.mjs, @ts-check), check.mjs chặn upload bản build hỏng
```

Quy ước: `localStorage` chỉ qua `src/lib/storage.ts`, `fetch` JSON chỉ qua `src/lib/http.ts`,
`navigator.geolocation` chỉ qua `src/lib/geo.ts` (bản đồ theo dõi vị trí bằng GeolocateControl).
Module thuần trong `src/data/` không import React — hook để file `use*.ts` riêng.

Thử cả Worker (`/data/*` từ R2 giả lập + preview `/station/*`):

```bash
node builder/run-local.mjs                       # sinh builder/out/
# nạp builder/out vào R2 local: npx wrangler r2 object put tramsac-data/<file> --file=builder/out/<file> --local
npm run build && npx wrangler dev --local        # http://127.0.0.1:8787
# hoặc: DATA_ORIGIN=http://127.0.0.1:8787 npm run dev
```

## API proxy HERE (`worker/api.ts`)

Trạm dọc đường cần tính tuyến (HERE Routing v8) và đoán toạ độ từ tên (HERE geocode). Key nằm
ở Worker, không xuống client:

| Endpoint | Việc |
|---|---|
| `GET /api/route?stops=lat,lng;lat,lng[!p][;…]&alt=0..2&avoid=toll,highway,ferry` | HERE Routing v8 (`polyline,summary` + spans `length,functionalClass`), 2–22 điểm; `!p` = via `passThrough`; `alt` (tuyến khác) chỉ khi không có điểm giữa |
| `GET /api/geocode?q=…[&at=lat,lng]` | HERE discover (có `at`) / geocode trong VN |
| `GET /api/revgeocode?at=lat,lng` | Tên điểm từ toạ độ |
| `GET /api/maps-link?url=<maps.app.goo.gl/…>` | Mở link rút gọn, trả `{ url }` thuộc `google.*/maps` hoặc `maps.google.*/` |
| `GET /api/drive?from=lat,lng&to=lat,lng` | Quãng đường lái xe thật tới trạm đang mở (`return=summary`), 1 lượt Routing Car |

## Số cổng trống thời gian thực (`worker/evcs.ts`)

Port `EvcsApi` / `EvcsHistory` của app Android. `charging_status` của VinFast trễ 1–2 giờ; EVCS.VN
trả số cổng trống theo từng mức kW gần như tức thời. `storeId` VinFast (`C.HNO1129`) = locationId
của EVCS. Khách vãng lai, không cần đăng nhập.

| Endpoint | Việc | Cache (Cache API, dùng chung) |
|---|---|---|
| `GET /api/live/<storeId>` | Token (POST trang trạm, `X-Partial: user`) → POST `/charging`: `ports` ("60kW trống 7/10 cổng"), `chargingKw`, `maintPorts`, `depotMaint`, `ticker` | 60 s |
| `GET /api/live-history/<storeId>` | socket.io qua WebSocket `www2.evcs.vn`: `history_data` + `history_kw_data` 24h, ghép bằng cắt chuỗi | 5 phút |

- Chỉ gọi `/live` + `/live-history` khi người dùng MỞ một trạm (không quét nền, không huy hiệu trên
  ghim). EVCS tự cache ~5 phút và chặn nhịp — gọi dày hơn vô ích.
- EVCS (Cloudflare) chặn `/charging` trên `evcs.vn` và `www2` khi gọi từ Worker (403) nên Worker gọi qua
  `www1.evcs.vn` (token vẫn xin ở `evcs.vn`). Trình duyệt không gọi thẳng được: `/charging` đòi `Referer`
  thuộc `evcs.vn`. Vẫn bị chặn thì bảng trạm ước tính cổng trống từ điểm cuối lịch sử 24h (dùng khi điểm
  cuối ≤ 3 giờ — EVCS chỉ ghi điểm khi số xe đổi).
- 403 trả ngay, không thử lại. Lỗi tạm khác (503, trả HTML) thử lại 2 lần (700 ms, 1,8 s); token hết hạn trên socket (`44`) xin lại một lần.
- Dự báo "xe sắp sạc xong" (`ticker`) hiện bị khoá cho khách vãng lai (cần EVCS Go) — client vẫn
  đọc nếu có.

- Body HERE trả **nguyên** (stream, không parse) để dưới hạn 10 ms CPU; client tự giải mã.
- Chỉ nhận request cùng origin (`Sec-Fetch-Site` / `Origin` / `Referer`) + rate limit 30 request /
  60 s theo IP (binding `API_LIMIT`). Chưa đặt key thì 3 endpoint HERE trả 503.
- Secret: `npx wrangler secret put HERE_API_KEY`. Local: chép `.dev.vars.example` → `.dev.vars`.

## Deploy

```bash
npm run deploy     # = npm run build && wrangler deploy
```

`wrangler.jsonc`: Worker `tramsac`, static assets từ `dist/` (SPA fallback), R2 `tramsac-data`,
custom domain `charging.cangao.asia`. `public/_headers`: asset có hash cache vĩnh viễn.

## Pipeline dữ liệu (precompute trên Cloudflare)

Dữ liệu trạm được **tính sẵn ở server** rồi CDN qua Cloudflare, client chỉ tải và dùng.

### Quy tắc lấy version mới nhất

VinFast tự công bố con trỏ "latest" ở CDN:

```
GET https://static-cms-prod.vinfastauto.com/locators/locators-meta.json
→ {"generation":2785,"count":70553,"full":"locators-2785.json.gz","sc":"locators-sc-2785.json.gz"}
```

- `generation` tăng dần → so với gen đã build, khác thì rebuild.
- `full` = tên snapshot đầy đủ → tải `{CDN}/{full}` (~6MB gz → ~72MB JSON, lọc `type=2444`).
- `count` = tổng locator **mọi loại**. `sc` = ~1.400 showroom / xưởng dịch vụ (không có trạm sạc) — không dùng.
- Trạng thái trạm nằm ngay trong snapshot: `charging_status` (`ACTIVE`, `BUSY`, `INACTIVE`=bảo trì,
  `UNAVAILABLE`=chưa khai trương, `OUTOFSERVICE`), khớp `extra_data.depot_status` của `get-locator`.

### Kiến trúc hiện tại — GitHub Action → R2 → Worker

Build nặng (parse 72MB snapshot + 35MB KML) **không chạy được trong Workers Free plan**
(giới hạn 10ms CPU/invocation), nên ETL chạy ở **GitHub Action** (CI Node đầy đủ, không
dính 10ms), kết quả đẩy vào **R2** rồi Worker phục vụ.

```
GitHub Action (.github/workflows/build-data.yml), cron 0 19 * * * (02:00 VN):
  node builder/run-local.mjs
    1. GET locators-meta.json → generation
    2. STREAM snapshot + 2 KML My Maps (streaming, không load nguyên khối)
    3. Lọc type=2444, trộn enrich theo toạ độ (lệch → để trống), charging_status → cột status
    4. ghi builder/out/{base,power}-{gen}-{hash}.json, seo-{gen}/*.json (preview /station), manifest.json
  node builder/check.mjs   (< 20.000 trạm / < 50% có số cổng / tụt > 5% so bản đang chạy → dừng)
  → wrangler r2 object put … (JSON THÔ, manifest đẩy sau cùng)
R2 "tramsac-data" → Worker (worker/index.ts) phục vụ /data/* → Cloudflare auto-nén (zstd/gzip)
```

`base` v3: `[id, storeId, name, address, lat, lng, flags, availableDate, status]`, `status` 0 hoạt
động / 1 bảo trì / 2 ngừng / 3 chưa khai trương (`BUSY` gộp vào 0 — build chỉ chạy mỗi ngày). Client
đọc base v2 cũ (8 cột) thì coi mọi trạm là hoạt động.

Client: `GET /data/manifest.json` (con trỏ latest) → `base-{gen}-{hash}` (render ngay) →
`power-{gen}-{hash}` (lười, bật lọc công suất + hiện số cổng). Tên file mang generation **và** 8 ký tự
hash nội dung nên cache vĩnh viễn được: chỉ My Maps đổi trong ngày (generation VinFast giữ nguyên) cũng
ra tên mới, không bao giờ ghi đè file đang cache `immutable`. **Lưu R2 dạng JSON thô** — Cloudflare tự nén trên đường
truyền; không tự gzip vì Workers runtime strip `Content-Encoding` set thủ công.

Enrich từ **Google My Maps** (2 KML public): `Cổng sạc` → số cổng + kW + DC/AC. Ghép theo
toạ độ (làm tròn ~11m), phủ ~89%. Streaming parser ở `builder/lib/`.

**GitHub Action cần 2 secret** (repo → Settings → Secrets → Actions):
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (token quyền R2 Edit). Chạy tay: tab
Actions → "Build station data" → Run workflow.

**Chi tiết trạm lúc mở** — `GET /api/station/<entityId>` (`worker/locator.ts`): Worker proxy
`get-locator/{entityId}` của VinFast (cần UA trình duyệt; 403 thì lấy cookie `__cf_bm` rồi thử
lại một lần), rút gọn còn ảnh thật, connector (kW, AC/DC, chuẩn đầu sạc), 24/7 / giờ mở cửa,
đặt trước, hotline, `depot_status`; cache edge 6h (lỗi 60s). Client (`useStationDetail`) CHỈ gọi
khi người dùng chọn một trạm — không crawl hàng loạt. Connector VinFast được ưu tiên hơn My Maps.

### Phương án dự phòng tương lai — Cloudflare Workflows (nếu lên Workers Paid)

Nếu dữ liệu phình to vượt **CPU/128MB RAM của một Worker invocation** (streaming không
còn đủ), chuyển builder sang **Cloudflare Workflows** — chia pipeline thành các bước bền
(durable steps), mỗi bước một invocation riêng với ngân sách RAM/CPU riêng, tự retry:

1. `checkMeta` — đọc `locators-meta.json`, so gen; chưa đổi thì kết thúc sớm.
2. `fetchSnapshot` — tải + lọc `type=2444` → ghi file tạm ra R2 (staging).
3. `fetchKml` — tải + parse 2 KML → ghi index toạ độ→công suất ra R2 (staging).
4. `merge` — đọc staging, trộn enrich, ghi `base/power/manifest` ra R2 (bản chính).
5. `cleanup` — xoá staging, cập nhật con trỏ gen đã build.

Ưu điểm: mỗi bước retry độc lập, không mất tiến độ khi lỗi mạng; vượt được giới hạn một
invocation vì state nằm ở R2 giữa các bước. Giữ nguyên cấu trúc output (`base/power/manifest`)
nên **client không phải đổi gì**. Kích hoạt khi một Worker streaming bắt đầu chạm trần.

## Lộ trình tiếp theo

- **Phase 2:** ~~chi tiết trạm từ `get-locator` qua Worker proxy~~ (xong); status refresh +
  EVCS real-time.
- **Phase 3:** chỉ đường, ~~PWA offline~~ (xong 0.14.0), ~~chia sẻ link trạm~~ (xong).
- **Đánh giá:** siết "mỗi thiết bị một đánh giá" — xem "Hạn chế đã biết" trong mục Đánh giá & bình luận.
- **Tiện ích quanh trạm** (cà phê, WC…): đã bỏ ở 0.10.0 vì Overpass công cộng chặn client tự động (406) và chập
  chờn. Nếu làm lại: tính sẵn từ bản OSM Việt Nam (Geofabrik) trong GitHub Action → shard R2, hoặc HERE Browse.
