# Quét QR trạm, kế hoạch sạc theo thứ tự ưu tiên + đường cong sạc từng mẫu, dùng được khi offline

**Date:** 2026-11-17 15:35 (ICT)
**Scope:** `src/ui/`, `src/data/` (battery, vehicles, chargePlan), `src/lib/`, `vite.config.ts`, `package.json`, docs
**Trigger:** Người dùng chọn ý tưởng 5 (kế hoạch tối ưu + đường cong sạc theo xe) và 6 (dùng được khi sóng yếu), thêm nút quét QR cạnh Cài đặt để mở trạm bằng camera.

## 1. Goal

- **Quét QR:** nút QR cạnh ⚙ ở cuối ô tìm kiếm → bảng camera, quét mã trạm (QR "Link trạm" app tạo, cả link `/station/<id>` mới và `/tram/<id>` cũ đã in) → mở trạm. Mã không phải trạm → báo; không có camera / bị chặn quyền → báo cách bật.
- **Đường cong sạc:** mỗi mẫu xe có đường cong DC (kW theo % pin); thời gian sạc tính bằng tích phân theo đường cong, công suất bị giới hạn bởi trạm. Dùng cho bảng trạm ("sạc lên 80% ~X phút") và kế hoạch.
- **Kế hoạch sạc:** chọn theo thứ tự ưu tiên (1) ít lần sạc nhất → (2) tổng thời gian sạc ngắn nhất → (3) gần lộ trình gốc nhất (tổng quãng vòng nhỏ nhất). Mỗi lần sạc chọn mức bất kỳ ≤ 80%.
- **Offline:** service worker (vite-plugin-pwa / Workbox): app shell, dữ liệu trạm, ô bản đồ đã xem, hành trình vừa mở (link, tuyến HERE) dùng lại được khi mất mạng. Cổng trống thời gian thực / đánh giá báo "đang offline".

## 2. Quyết định đã chốt (Q&A 1 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Mục tiêu kế hoạch | Thứ tự từ điển: số lần sạc → tổng phút sạc → tổng km vòng khỏi tuyến. |
| Trạm phải ra cao tốc | Không còn luật "chỉ khi kẹt": quãng vòng ước tính (EXIT_ACCESS_KM) tính vào tiêu chí (3) và vào pin; vì (1)(2) đứng trước nên trạm ra cao tốc chỉ thắng khi giúp ít lần sạc hơn hoặc sạc nhanh hơn. |
| Mức sạc mỗi lần | Bất kỳ ≤ 80% (TARGET_PCT); lần cuối vừa đủ tới đích còn ≥ mức dự phòng (bi quan). |
| Đường cong sạc | Riêng từng mẫu, piecewise-linear `[soc, kW][]`, tra số liệu công bố + cộng đồng (agent tra cứu), khớp thời gian 10→70% công bố. Xe Tuỳ chỉnh: dạng chung co theo 150 kW. |
| Offline lưu gì | App shell + dữ liệu trạm + ô bản đồ đã xem + API tuyến/link vừa dùng. Không tải trước ô bản đồ dọc tuyến. |
| Công cụ SW | vite-plugin-pwa (generateSW), giữ `public/manifest.webmanifest` hiện có (`manifest: false`). |
| Quét QR | Thư viện `qr-scanner` (nạp lười khi mở bảng; dùng BarcodeDetector khi có, iOS Safari dùng bộ giải mã JS). |
| Phiên bản | 0.14.0. Mỗi phase một commit. Deploy khi người dùng bảo. |

## 3. Kế hoạch sạc — mô hình

```
trạng thái  = (trạm i, % pin khi tới, làm tròn 1%)
nhãn        = (số lần sạc, phút sạc, km vòng)   so sánh theo thứ tự từ điển
lớp k       = các trạng thái tới được với đúng k lần sạc (BFS theo số lần sạc)
chuyển      = ở trạm i sạc lên L (L ∈ {mức vừa đủ tới j cho từng trạm j phía trước} ∪ {80}, L ≤ 80)
              rồi tới trạm j / đích nếu pin bi quan khi tới ≥ mức dự phòng
dừng        = lớp nhỏ nhất có thể tới đích → nhãn nhỏ nhất trong lớp đó
```

## 6. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-qr-scan.md | Nút QR + bảng camera quét mã trạm | — |
| 02 | phase-02-charge-curves.md | Đường cong sạc DC từng mẫu, `chargeMinutes` tích phân theo đường cong | — |
| 03 | phase-03-plan-lexicographic.md | Kế hoạch theo thứ tự ưu tiên (BFS theo số lần sạc + nhãn từ điển) | 02 |
| 04 | phase-04-offline.md | vite-plugin-pwa: precache shell, runtime cache dữ liệu / ô bản đồ / API tuyến; báo offline | — |
| 05 | phase-05-docs.md | Changelog 0.14.0, README | 01–04 |

## 8. Phạm vi

**Out:** tải trước ô bản đồ dọc tuyến, thông báo đẩy, quét mã Google Maps để mở hành trình (chỉ mã trạm), dự báo độ đông.

## 9. Risks

- Đường cong từ nguồn không chính thức → sai số thời gian sạc; ghi rõ "ước tính" như hiện tại.
- Service worker cache sai → người dùng kẹt bản cũ. Giảm thiểu: `registerType: 'autoUpdate'`, skipWaiting + clientsClaim; dữ liệu `base-<gen>-<hash>` bất biến (cache-first), `manifest.json` network-first.
- iOS PWA: camera trong standalone cần quyền; Safari không có BarcodeDetector → qr-scanner dùng bộ giải mã JS (chậm hơn, vẫn ổn).
- Kế hoạch mới đổi kết quả so với bản tham lam → cập nhật test; kiểm lại trên tuyến thật (HN→Sa Pa, HN→Vinh).
