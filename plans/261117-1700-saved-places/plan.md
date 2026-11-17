# Địa điểm hay dùng (Nhà, Công ty…) + quét QR dạng hộp thoại

**Date:** 2026-11-17 17:00 (ICT)
**Scope:** `src/data/`, `src/ui/`, `src/app/`, `src/map/`, `src/App.tsx`, `worker/api.ts`, docs
**Trigger:** Người dùng: quét QR trên điện thoại mở hộp thoại thay vì drawer; lưu sẵn vài địa điểm hay dùng (Nhà, Công ty…) để tìm đường + trạm dọc đường nhanh hơn.

## 1. Goal

- Quét QR: trên điện thoại là hộp thoại toàn màn hình (camera to, nút đóng), không phải drawer.
- Địa điểm: Nhà, Công ty (cố định) + tối đa 8 địa điểm tự đặt tên. Lưu trên máy (`tramsac.places`), đi kèm sao lưu / chuyển máy.
- Thêm / sửa bằng: gõ địa chỉ (gợi ý HERE), vị trí hiện tại, chạm giữ trên bản đồ, dán link Google Maps.
- Dùng ở: chip trong bảng Dọc đường (bấm → tìm đường từ "Từ" — mặc định vị trí của tôi — tới địa điểm; đổi được điểm đi), "Gần tôi" chọn được gốc là địa điểm, ghim địa điểm trên bản đồ.

## 2. Quyết định đã chốt (Q&A 1 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Cách thêm | Cả bốn: gõ địa chỉ (HERE, `/api/geocode?limit=5`), vị trí hiện tại (+ revgeocode lấy tên), chạm giữ bản đồ, dán link Google Maps (parseMapsUrl, link 1 địa điểm). |
| Cách dùng | Chip trong Dọc đường; gốc của "Gần tôi"; ghim trên bản đồ. |
| Danh sách | Nhà, Công ty + ≤ 8 tự đặt (tên ≤ 30 ký tự). |
| Tìm đường | Dựng link `https://www.google.com/maps/dir/?api=1&origin=…&destination=…` (toạ độ) → `trip.open` — dùng lại parser + URL `/trip?link=` chia sẻ được. Thiếu origin = vị trí hiện tại (parser đã xử lý). |
| Lưu trữ | `src/lib/storage.ts`, khoá `tramsac.places`; sao lưu thêm trường `places` (gộp: theo id, bản sửa sau thắng). |
| Chạm giữ bản đồ | `contextmenu` của maplibre (chạm giữ trên điện thoại / chuột phải) → popover: Lưu làm Nhà / Công ty / Địa điểm khác… / Tìm đường tới đây. |
| Phiên bản | 0.15.0. Mỗi phase một commit. |

## 6. Phase breakdown

| Phase | Mục tiêu | Phụ thuộc |
|---|---|---|
| 01 | QR: hộp thoại toàn màn hình trên điện thoại | — |
| 02 | `src/data/places.ts` (kiểu, parse, gộp, usePlaces) + sao lưu `places` + test | — |
| 03 | Worker `/api/geocode?limit` + `searchPlaces()`; `PlacesSheet` (danh sách, sửa: gõ địa chỉ / vị trí hiện tại / dán link); mở từ Cài đặt | 02 |
| 04 | Bản đồ: ghim địa điểm + chạm giữ → menu lưu / tìm đường | 02, 03 |
| 05 | Dọc đường: chip địa điểm + chọn "Từ"; "Gần tôi": chọn gốc | 02 |
| 06 | Changelog 0.15.0, README | 01–05 |

## 9. Risks

- Gõ địa chỉ tốn lượt HERE → debounce 400 ms, ≥ 3 ký tự, chung rate limit API_LIMIT.
- `contextmenu` maplibre trên iOS: maplibre phát `contextmenu` khi chạm giữ? Nếu không → tự đo touchstart/touchend ≥ 500 ms không di chuyển.
