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
- Mở trang tự xin vị trí hiện tại và bay về đó.
- Tìm trạm theo tên/địa chỉ (không phân biệt dấu).
- Lọc: chỉ hiện trạm đã lưu.
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

### Dữ liệu ở client (`src/data/useStationData.ts`)

- `GET /data/manifest.json` với `cache: 'no-cache'` (luôn hỏi lại, thường chỉ 304) →
  `base-<gen>.json` (vẽ bản đồ) → `power-<gen>.json` tải ngầm, căn theo thứ tự hàng của base.
- Tab để mở lâu: quay lại tab (sau ≥ 30 phút) thì hỏi manifest; generation mới → tải lại và
  thay chỉ mục **không dựng lại bản đồ**. Trạm đang mở và nhóm đã lưu giữ nguyên (cùng `entityId`).

## Link trạm & chia sẻ

- Mỗi trạm có URL `/tram/<entityId>-<slug>` (`src/lib/stationUrl.ts`). App đọc URL lúc mở để
  chọn trạm, và đổi URL theo trạm đang mở.
- `worker/index.ts` (route `/tram/*`, khai trong `run_worker_first`) thay meta title /
  description / Open Graph theo trạm trong `index.html` để link gửi qua Zalo, Messenger có
  preview đúng; slug sai → 301 về slug đúng, id không tồn tại → 404. HTML không cache.
- Tra trạm từ shard `seo-<gen>/<id % 32>.json` (~100 KB) do builder ghi lên R2 — parse cả base
  4 MB vượt hạn 10 ms CPU Free plan. Manifest chưa có `seo` (bản build cũ) thì vẫn mở app,
  chỉ thiếu preview.
- **Dữ liệu trạm là nội bộ:** trang `/tram/*` gắn `noindex` (header `X-Robots-Tag` + thẻ meta),
  không JSON-LD; `/data/*` cũng `noindex` + `Disallow` trong robots.txt. `public/sitemap.xml`
  chỉ có trang chủ.

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173 — /data/* proxy sang https://charging.cangao.asia
npm run build      # ra thư mục dist/
```

Thử cả Worker (`/data/*` từ R2 giả lập + preview `/tram/*`):

```bash
node builder/run-local.mjs                       # sinh builder/out/
# nạp builder/out vào R2 local: npx wrangler r2 object put tramsac-data/<file> --file=builder/out/<file> --local
npm run build && npx wrangler dev --local        # http://127.0.0.1:8787
# hoặc: DATA_ORIGIN=http://127.0.0.1:8787 npm run dev
```

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
- `count` = tổng locator **mọi loại**. `sc` = file phụ ~180KB (nghi là status rút gọn, dùng sau).

### Kiến trúc hiện tại — GitHub Action → R2 → Worker

Build nặng (parse 72MB snapshot + 35MB KML) **không chạy được trong Workers Free plan**
(giới hạn 10ms CPU/invocation), nên ETL chạy ở **GitHub Action** (CI Node đầy đủ, không
dính 10ms), kết quả đẩy vào **R2** rồi Worker phục vụ.

```
GitHub Action (.github/workflows/build-data.yml), cron 0 19 * * * (02:00 VN):
  node builder/run-local.mjs
    1. GET locators-meta.json → generation
    2. STREAM snapshot + 2 KML My Maps (streaming, không load nguyên khối)
    3. Lọc type=2444, trộn enrich theo toạ độ (lệch → để trống)
    4. ghi builder/out/{base,power}-{gen}.json, seo-{gen}/*.json (preview /tram), manifest.json
  → wrangler r2 object put … (JSON THÔ)
R2 "tramsac-data" → Worker (worker/index.ts) phục vụ /data/* → Cloudflare auto-nén (zstd/gzip)
```

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
