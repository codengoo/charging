# Bản đồ trạm sạc ô tô VinFast — Web

Webapp bản đồ 23.942 trạm sạc ô tô VinFast. Port Phase 1 từ app Android `charge-map-android`.

- **Bản đồ:** MapLibre GL JS + tile **OpenFreeMap** (miễn phí, không cần key, không backend).
- **Dữ liệu:** 23.942 trạm nhúng sẵn (`public/stations.json`) — mở trang là có ngay, không gọi API.
- **Deploy:** Cloudflare Pages (tĩnh hoàn toàn).

> Quy ước giao diện (màu, chữ, component, pattern bảng/QR) ở [`design.md`](design.md) — dùng chung hệ với chiatien.

## Tính năng Phase 1

- Bản đồ toàn VN, tự gom cụm marker, bấm cụm để phóng to.
- Mở trang tự xin vị trí hiện tại và bay về đó.
- Tìm trạm theo tên/địa chỉ (không phân biệt dấu).
- Lọc: chỉ hiện trạm đã lưu.
- Chi tiết trạm: tên, địa chỉ, công cộng/nội bộ, trụ LINK, phí gửi xe.
- **Nhóm trạm đã lưu** (port từ app Android): 3 nhóm dựng sẵn + nhóm tự tạo (tên, biểu
  tượng, màu, thời hạn tự gỡ), danh sách đã lưu lọc theo nhóm. Lưu trong localStorage
  khoá `tramsac.groups`; khoá cũ `tramsac.favorites` tự chuyển sang nhóm "Yêu thích".
- **Ghim trạm** vẽ từ SVG (`src/map/pins.ts`, port `ic_pin_*` / `ic_grp_*`): vỏ giọt nước
  trắng + đĩa màu nhạt + hình đậm, raster theo `devicePixelRatio` rồi `map.addImage`.
- Nút **Chỉ đường** mở Google Maps.
- **Chia sẻ bằng QR** (`src/ui/ShareSheet.tsx`): QR link trạm (mở app) và QR vị trí Google Maps,
  tải ảnh thẻ QR / Web Share.

## Link trạm & chia sẻ

- Mỗi trạm có URL `/tram/<entityId>-<slug>` (`src/lib/stationUrl.ts`). App đọc URL lúc mở để
  chọn trạm, và đổi URL theo trạm đang mở.
- `functions/tram/[[path]].ts` (Cloudflare Pages Function) thay meta title / description /
  Open Graph theo trạm trong `index.html` để link gửi qua Zalo, Messenger có preview đúng;
  slug sai → 301 về slug đúng, id không tồn tại → 404. HTML không cache (asset có hash đổi
  mỗi lần deploy).
- **Dữ liệu trạm là nội bộ:** trang `/tram/*` gắn `noindex` (header `X-Robots-Tag` + thẻ meta),
  không JSON-LD. `stations.json` và `seo/*` cũng `noindex` + `Disallow` trong robots.txt.
  `public/sitemap.xml` chỉ có trang chủ.
- `seo.plugin.ts` (plugin Vite, chỉ chạy lúc build) sinh `dist/seo/<id % 128>.json` — Function
  chỉ đọc một shard ~25 KB thay vì `stations.json` 4 MB (giới hạn CPU Functions gói free).
- Thử Function local: `npm run build && npx wrangler pages dev dist`.

> Số cổng, công suất và trạng thái còn/hết chỗ **chưa có** ở Phase 1 — dữ liệu tĩnh của
> VinFast không kèm các trường này; cần backend proxy (Phase 2).

## Chạy local

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # ra thư mục dist/
npm run preview    # xem thử bản build
```

## Deploy lên Cloudflare Pages

### Cách A — một lệnh (Wrangler CLI)

```bash
npm run deploy
# = npm run build && wrangler pages deploy dist --project-name tramsac
```

Lần đầu Wrangler sẽ mở trình duyệt để đăng nhập Cloudflare. Nếu project `tramsac`
chưa tồn tại, nó hỏi tạo mới — chọn **Create new project**.

### Cách B — nối Git (CI tự build)

Trên dashboard Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**, trỏ
tới repo này và đặt:

| Mục | Giá trị |
|---|---|
| Framework preset | None (hoặc Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | 18 trở lên (biến môi trường `NODE_VERSION=20`) |

Mỗi lần push là Cloudflare tự build và deploy.

### Cấu hình kèm theo

- `public/_headers` — cache `stations.json` 1 ngày, asset có hash cache vĩnh viễn.
- `public/_redirects` — SPA fallback về `index.html`.
- `wrangler.toml` — tên project + thư mục output cho `wrangler pages deploy`.

## Cập nhật dữ liệu trạm

Chạy lại `partition.js` bên repo `vinfast-charging`, rồi copy gói tĩnh (đã giải nén) đè
lên `public/stations.json`. Format: `{"v","cell","generation","fields":[id,storeId,name,address,lat,lng,flags,availableDate],"rows":[...]}`.
`flags`: bit 1 = công cộng, 2 = phí gửi xe, 4 = trụ LINK.

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
    4. ghi builder/out/{base,power}-{gen}.json, manifest.json
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

> **TODO (chưa làm):** nguồn `get-locator/{entityId}` của VinFast (sau Cloudflare, cần
> warm-up cookie `__cf_bm` + rate-limit) cho **ảnh thật của trạm** + connector chính xác —
> những thứ My Maps không có. Crawl trước trong Action rồi nhồi URL ảnh vào `power-{gen}`.

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

- **Phase 2:** chi tiết trạm từ `get-locator` (ảnh + connector) qua Worker proxy; status
  refresh + EVCS real-time.
- **Phase 3:** chỉ đường, PWA offline, chia sẻ URL `?station=`.
