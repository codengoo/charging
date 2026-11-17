# Kế hoạch dừng sạc, tiện ích gần trạm, ghi chú cá nhân, đánh giá & bình luận công khai

**Date:** 2026-11-17 14:00 (ICT)
**Scope:** `src/data/`, `src/ui/`, `src/App.tsx`, `worker/`, `migrations/` (mới), `wrangler.jsonc`, docs
**Trigger:** Sau bản 0.9.0 (% pin khi đến), người dùng chọn: (1) tự lên kế hoạch dừng sạc cho hành trình, (2) mức tiêu thụ đúng với xe (chỉ ghi đè tay — bỏ tự học), (3) tiện ích quanh trạm trong lúc chờ sạc; thêm (4) ghi chú cá nhân lưu local, (5) đánh giá sao + bình luận công khai cho từng trạm.

## 1. Goal

- **Ghi đè tiêu thụ:** VehicleSheet có ô "Tiêu thụ thực tế (kWh/100 km)" cho mẫu xe đang chọn (đọc trên màn hình xe); để trống = số ước tính của mẫu. Giữ nguyên giới hạn sạc DC/AC của mẫu.
- **Kế hoạch sạc:** bảng Dọc đường có nút "Lên kế hoạch sạc" → chọn điểm dừng tự động, tóm tắt "2 điểm dừng · sạc ~55 phút · tới nơi ~4 giờ 50 phút, còn ~35%". Điểm dừng gắn nhãn "Dừng 1/2" trong danh sách; bật kế hoạch thì bản đồ chỉ vẽ ghim các điểm dừng.
- **Tiện ích gần trạm:** mở trạm thấy cà phê / ăn uống / WC / tạp hoá / cây xăng trong 400 m, từ OpenStreetMap (Overpass) qua `/api/amenities`, Worker cache 7 ngày. Ghi "© OpenStreetMap".
- **Ghi chú cá nhân:** ô ghi chú trong bảng trạm, lưu localStorage, đi kèm sao lưu / chuyển máy.
- **Đánh giá & bình luận:** mỗi thiết bị một đánh giá (1–5 sao + bình luận tuỳ chọn + biệt danh) mỗi trạm, sửa/xoá được bài của mình; điểm trung bình + phân bố sao + danh sách mới nhất; nút Báo cáo, đủ 3 thiết bị báo cáo thì tự ẩn. D1 + Turnstile (tuỳ chọn) + giới hạn tần suất; endpoint admin có secret.

## 2. Quyết định đã chốt (Q&A 2 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Tự học tiêu thụ | **Bỏ.** Chỉ ghi đè tay `usageOverride` cho mẫu đang chọn. |
| Ghi đè lưu ở đâu | `Settings.usageOverride: number \| null` (5–60). Đổi mẫu xe → xoá ghi đè (số của xe cũ không còn đúng). Xe Tuỳ chỉnh vẫn dùng `customKwhPer100`. |
| Ứng viên điểm dừng | Trạm trong danh sách Dọc đường hiện tại (đã qua bộ lọc công suất của người dùng) **có cổng DC ≥ 50 kW** (`power`). |
| Thuật toán | Tham lam: từ vị trí hiện tại, nếu tới đích được với ước tính bi quan ≥ 10% thì dừng; không thì chọn trạm XA NHẤT tới được (bi quan ≥ 10%), sạc lên 80%, lặp. Không tìm được → báo "Không đủ trạm sạc nhanh sau km X". |
| Thời gian sạc mỗi điểm | `chargeMinutes(arrive mid, {kw: DC mạnh nhất, dc: true}, xe)` — không dùng live (trạm ở xa, live vô nghĩa lúc lên kế hoạch). |
| Bản đồ khi bật kế hoạch | `TripLayer.stationIds` = chỉ các điểm dừng. Tắt kế hoạch → như cũ. |
| Nguồn tiện ích | Overpass API (OSM), `overpass-api.de` rồi `overpass.kumi.systems` khi lỗi. Bán kính 400 m. Loại: `amenity=cafe,restaurant,fast_food,toilets,fuel` + `shop=convenience,supermarket`. |
| Cache tiện ích | Cache API ở Worker, khoá theo toạ độ trạm làm tròn 4 số, 7 ngày; lỗi cache 10 phút. Chỉ gọi khi mở trạm. Chung rate limit `API_LIMIT`. |
| Ghi chú | localStorage `tramsac.notes` = `{ [entityId]: { text, at } }`, ≤ 1.000 ký tự. Sao lưu: thêm trường `notes` (tuỳ chọn) vào payload; nhập GỘP — trạm đã có ghi chú thì giữ bản mới hơn (`at`). |
| Danh tính | Ẩn danh: máy sinh `deviceId` ngẫu nhiên 128 bit (`tramsac.device`), gửi header `X-Device`. Server chỉ lưu `SHA-256(deviceId + REVIEW_PEPPER)`. Biệt danh 2–30 ký tự, nhớ local. |
| Một đánh giá | `UNIQUE(station_id, device_hash)`, PUT là upsert. Sao bắt buộc, bình luận tuỳ chọn ≤ 500 ký tự. |
| Kiểm duyệt | Hiện ngay. Báo cáo: mỗi thiết bị một lần/bài; `report_count ≥ 3` → `hidden = 1`. Admin `hidden = 2` (ẩn) / `0` (hiện lại) / xoá, header `Authorization: Bearer <ADMIN_TOKEN>`. Bài ẩn không tính vào điểm trung bình. Tác giả vẫn thấy bài của mình kèm nhãn "Đang ẩn". |
| Lọc nội dung | Từ chối (422) bình luận / biệt danh có URL, email, số điện thoại (≥ 9 chữ số liền hoặc cách bằng dấu chấm/cách). |
| Chống spam | `REVIEW_LIMIT` (ratelimit binding) 5 lần ghi / 60 s theo IP; Turnstile bắt buộc khi Worker có `TURNSTILE_SECRET` (chưa có thì bỏ qua). Client chỉ tải script Turnstile khi build có `VITE_TURNSTILE_SITEKEY`. |
| Kiểm trạm tồn tại | Ghi chỉ nhận `entityId` có trong shard SEO (`seo-<gen>/<id % 32>.json`) — 1 lượt đọc R2. |
| Hạ tầng | Claude tạo D1 `tramsac-reviews` (remote) + chạy migration, đặt secret `REVIEW_PEPPER`, `ADMIN_TOKEN`. Turnstile: người dùng tạo widget trên dashboard rồi đặt `TURNSTILE_SECRET` + `VITE_TURNSTILE_SITEKEY`. **Không deploy** — người dùng tự `npm run deploy`. |
| Phiên bản | 0.10.0. Mỗi phase một commit. |

## 3. Schema (D1 `tramsac-reviews`, `migrations/0001_reviews.sql`)

```sql
CREATE TABLE reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id   TEXT    NOT NULL,              -- entityId VinFast
  device_hash  TEXT    NOT NULL,              -- hex SHA-256(deviceId + REVIEW_PEPPER)
  nickname     TEXT    NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,              -- epoch ms
  updated_at   INTEGER NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0,    -- 0 hiện, 1 tự ẩn do báo cáo, 2 admin ẩn
  report_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (station_id, device_hash)
);
CREATE INDEX reviews_station ON reviews (station_id, hidden, updated_at DESC);
CREATE INDEX reviews_hidden ON reviews (hidden, updated_at DESC);

CREATE TABLE review_reports (
  review_id   INTEGER NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  device_hash TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (review_id, device_hash)
);
```

A1: `reviews` — một hàng cho mỗi cặp (trạm, thiết bị); mỗi hàng là ý kiến hiện tại của một người về một trạm (sửa = ghi đè). `review_reports` — một hàng cho mỗi cặp (bài, thiết bị báo cáo).

## 4. Payload

```ts
// GET /api/reviews/<entityId>?before=<updated_at>
interface ReviewsPage {
  avg: number | null          // null khi chưa có đánh giá hiện
  count: number
  dist: [number, number, number, number, number] // số đánh giá 1..5 sao
  mine: Review | null         // theo X-Device, kể cả khi đang ẩn
  items: Review[]             // hiện, mới nhất trước, tối đa 20, không gồm `mine`
  next: number | null         // updated_at cho trang sau
}
interface Review {
  id: number
  nickname: string
  rating: 1 | 2 | 3 | 4 | 5
  body: string
  createdAt: number
  updatedAt: number
  hidden?: boolean            // chỉ có ở `mine`
}
// PUT /api/reviews/<entityId>  body { rating, body, nickname, turnstile? } → Review
// DELETE /api/reviews/<entityId> → 204
// POST /api/reviews/report/<id>  body { turnstile? } → { hidden: boolean }
// GET  /api/admin/reviews?hidden=1|2|all       (Bearer ADMIN_TOKEN)
// POST /api/admin/reviews/<id>  body { hidden: 0 | 2 }
// DELETE /api/admin/reviews/<id>

// GET /api/amenities?at=lat,lng
interface Amenity { kind: 'cafe' | 'food' | 'toilets' | 'shop' | 'fuel'; name: string | null; lat: number; lng: number }
```

## 5. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-usage-override.md | Ghi đè tiêu thụ cho mẫu xe | — |
| 02 | phase-02-charge-plan.md | Kế hoạch dừng sạc trong Dọc đường + bản đồ | 01 |
| 03 | phase-03-amenities.md | `/api/amenities` (Overpass, cache) + hộp tiện ích trong bảng trạm | — |
| 04 | phase-04-notes.md | Ghi chú cá nhân local + sao lưu | — |
| 05 | phase-05-reviews-api.md | D1 + migration + Worker API đánh giá/báo cáo/admin | — |
| 06 | phase-06-reviews-ui.md | Hộp đánh giá & bình luận trong bảng trạm | 05 |
| 07 | phase-07-docs.md | README, CHANGELOG, 0.10.0, hướng dẫn Turnstile/admin | 01–06 |

## 6. Phạm vi

**In:** các file trong từng phase.
**Out:** đăng nhập; trả lời bình luận; ảnh trong bình luận; điểm sao trên ghim bản đồ / bộ lọc theo sao; trang admin có giao diện (chỉ endpoint); tự học tiêu thụ; tiện ích ngoài 400 m; deploy production.

## 7. Risks

- **Spam / nội dung xấu** khi chưa bật Turnstile → rate limit + lọc URL/SĐT + báo cáo tự ẩn; nhắc người dùng tạo Turnstile trước khi deploy.
- **Overpass chậm / chặn** (máy chủ công cộng, fair-use) → cache 7 ngày, 2 máy chủ, timeout 8 s, lỗi thì ẩn hộp.
- **Device id bị xoá** (xoá dữ liệu trình duyệt) → mất quyền sửa bài cũ, có thể đánh giá lại (2 bài). Chấp nhận.
- **Kế hoạch sạc dựa trên ước tính thô** → luôn ghi "ước tính", dùng ngưỡng bi quan.
- **Workers Free 10 ms CPU**: Overpass JSON tối đa ~40 phần tử, SHA-256 dùng `crypto.subtle` (không tính CPU JS nhiều) → ổn.
