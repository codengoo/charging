# tramsac-builder — Cron Worker precompute dữ liệu trạm

Tính sẵn dữ liệu 25k trạm (version mới nhất của VinFast) + enrich công suất từ 2 Google
My Maps, ghi vào R2 để client CDN. Xem kiến trúc tổng ở `../README.md` (mục Pipeline dữ liệu).

## Cấu trúc

```
lib/kml.mjs       stream-parse KML My Maps → index toạ độ→công suất
lib/snapshot.mjs  stream-parse snapshot VinFast (gzip) → trạm ô tô (type 2444)
lib/build.mjs     lõi: lấy version mới nhất, trộn enrich, đóng gói base/power/manifest
worker.mjs        Cloudflare Worker: cron + ghi R2 + /build để test
run-local.mjs     chạy local, ghi ra out/ để kiểm tra (không cần Cloudflare)
```

Lõi portable (Web Streams), chạy cả Node 18+ lẫn Worker. Giữ bộ nhớ thấp bằng streaming
(không load nguyên 72MB snapshot / 35MB KML) — hợp giới hạn 128MB của Worker.

## Chạy thử local

```bash
node run-local.mjs
# → out/manifest.json, out/base-<gen>.json.gz, out/power-<gen>.json.gz
```

## Deploy

```bash
# 1. Tạo R2 bucket (một lần)
wrangler r2 bucket create tramsac-data

# 2. (tuỳ chọn) token để test thủ công
wrangler secret put BUILD_TOKEN

# 3. Deploy worker
cd builder && wrangler deploy

# 4. Test thủ công
curl "https://tramsac-builder.<account>.workers.dev/build?token=<BUILD_TOKEN>"
```

Cron đã đặt `0 19 * * *` (02:00 giờ VN) — chạy full pipeline mỗi ngày.

## Output

- `manifest.json` — `{generation, builtAt, base, power, counts}` (cache 5 phút).
- `base-<gen>.json.gz` — trạm: `[id, storeId, name, address, lat, lng, flags, availableDate]`
  (flags: bit1 công cộng, bit2 phí gửi xe, bit4 trụ LINK). Cache vĩnh viễn.
- `power-<gen>.json.gz` — enrich căn chỉnh theo index base; mỗi hàng `null` (chưa có dữ liệu)
  hoặc `[portCount, maxKw, dcCount, "kw:count:dc|…"]`. Cache vĩnh viễn.

Client đọc `manifest.json` → tải `base` (render ngay) → `power` (lười). Phục vụ qua Pages
Function `../functions/data/[[path]].ts` tại `/data/*`.
