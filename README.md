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
- **Sao lưu / chuyển máy** (`src/data/backup.ts`, `src/ui/BackupSheet.tsx`): sổ nhóm nén
  `deflate-raw` + base64url trong hash `/#import=…` (không tới server), QR khi link ≤ 2.000 ký
  tự, tải / nhập file `.json`. Nhập luôn **gộp**, hỏi xác nhận trước.

### Dữ liệu ở client (`src/data/useStationData.ts`)

- `GET /data/manifest.json` với `cache: 'no-cache'` (luôn hỏi lại, thường chỉ 304) →
  `base-<gen>.json` (vẽ bản đồ) → `power-<gen>.json` tải ngầm, căn theo thứ tự hàng của base.
- Tab để mở lâu: quay lại tab (sau ≥ 30 phút) thì hỏi manifest; generation mới → tải lại và
  thay chỉ mục **không dựng lại bản đồ**. Trạm đang mở và nhóm đã lưu giữ nguyên (cùng `entityId`).

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

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173 — /data/* proxy sang https://charging.cangao.asia
npm run build      # ra thư mục dist/
```

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
| `GET /api/route?stops=lat,lng;lat,lng[;…]` | HERE Routing v8 (`polyline,summary` + spans `length,functionalClass`), 2–22 điểm |
| `GET /api/geocode?q=…[&at=lat,lng]` | HERE discover (có `at`) / geocode trong VN |
| `GET /api/revgeocode?at=lat,lng` | Tên điểm từ toạ độ |
| `GET /api/maps-link?url=<maps.app.goo.gl/…>` | Mở link rút gọn, trả `{ url }` thuộc `google.*/maps` |

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
    4. ghi builder/out/{base,power}-{gen}.json, seo-{gen}/*.json (preview /station), manifest.json
  → wrangler r2 object put … (JSON THÔ)
R2 "tramsac-data" → Worker (worker/index.ts) phục vụ /data/* → Cloudflare auto-nén (zstd/gzip)
```

`base` v3: `[id, storeId, name, address, lat, lng, flags, availableDate, status]`, `status` 0 hoạt
động / 1 bảo trì / 2 ngừng / 3 chưa khai trương (`BUSY` gộp vào 0 — build chỉ chạy mỗi ngày). Client
đọc base v2 cũ (8 cột) thì coi mọi trạm là hoạt động.

Client: `GET /data/manifest.json` (con trỏ latest) → `base-{gen}` (render ngay) →
`power-{gen}` (lười, bật lọc công suất + hiện số cổng). File mang `generation` nên cache
vĩnh viễn, đổi gen tự cache-bust. **Lưu R2 dạng JSON thô** — Cloudflare tự nén trên đường
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
- **Phase 3:** chỉ đường, PWA offline, chia sẻ URL `?station=`.
