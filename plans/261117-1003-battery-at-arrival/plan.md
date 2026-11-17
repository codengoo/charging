# % pin khi đến trạm

**Date:** 2026-11-17 10:03 (ICT)
**Scope:** `src/data/`, `src/ui/`, `src/App.tsx`, docs (`README.md`, `CHANGELOG.md`, `src/data/changelog.ts`)
**Trigger:** Người dùng mở trạm thấy quãng đường lái xe, nhưng không biết pin còn bao nhiêu khi tới, cũng không biết dọc hành trình trạm nào còn kịp. App đã có đủ dữ liệu quãng đường (`/api/drive`, km trên tuyến trong `routeCorridor`) và công suất cổng; chỉ thiếu thông số xe và % pin hiện tại.

## 1. Goal

- ⚙ Cài đặt có mục **Xe của bạn**: chọn một mẫu VinFast (dung lượng pin, mức tiêu thụ, công suất sạc DC/AC có sẵn) hoặc **Tuỳ chỉnh** (tự nhập kWh và kWh/100 km), kèm công tắc **Điều hoà** (+8% tiêu thụ).
- Bảng trạm: khi đã chọn xe, có thanh trượt **% pin hiện tại** và dòng **"Còn ~38–45% khi tới"** dưới dòng quãng đường, tô cam dưới 15%, đỏ dưới 5% (kèm "Có thể không tới được"). Kèm **"Sạc lên 80%: ~25 phút"** theo cổng mạnh nhất còn trống.
- Bảng Dọc đường: mỗi trạm có % pin ước tính khi ngang qua; vạch **"Trạm cuối còn kịp"** sau trạm xa nhất mà ước tính bi quan vẫn ≥ 10%.
- Chưa chọn xe: bảng trạm hiện link nhỏ "Ước tính pin khi đến" mở Cài đặt.
- Mọi phép tính chạy ở client, **không thêm lượt gọi HERE / EVCS nào**.

## 2. Quyết định đã chốt (Q&A 1 vòng)

| Câu hỏi | Lựa chọn |
|---|---|
| Nguồn thông số xe | Tra web (dung lượng pin công bố, NEDC/WLTP) + mức tiêu thụ ước tính thực tế ≈ dung lượng ÷ (NEDC × ~0,8). Có mục **Tuỳ chỉnh**. Bảng ghi rõ là ước tính. |
| Lưu % pin | localStorage `tramsac.battery` = `{ pct, at }`. Quá **2 giờ** thì coi là cũ: vẫn tính, nhưng làm mờ và nhắc "nhập lại". |
| Hệ số phụ | Hệ số tốc độ theo tốc độ trung bình của tuyến (`meters/seconds`) + **công tắc Điều hoà** trong Cài đặt (×1,08, mặc định bật — VN nóng). |
| Hiện số | Một **khoảng** ±8% quanh giá trị giữa, không một số chính xác giả. Làm tròn về số nguyên, kẹp dưới tại 0 khi hiện (giá trị âm → "không tới được"). |
| Hệ số tốc độ | < 40 km/h ×0,95 · 40–70 ×1,0 · 70–90 ×1,12 · ≥ 90 ×1,25. |
| Dọc đường | Mốc xuất phát = % pin hiện tại. Quãng đường tới trạm = `atKm + 2 × offsetKm` (rẽ vào và quay ra). Tốc độ trung bình = cả tuyến. |
| "Trạm cuối còn kịp" | Trạm xa nhất (theo `atKm`) có ước tính **bi quan** ≥ 10%. Danh sách giữ nguyên thứ tự; chỉ chèn vạch sau trạm đó. Trạm vượt mốc hiện số đỏ. |
| Thời gian sạc | Từ % khi đến tới 80%. Công suất = min(cổng, xe): DC dùng `dcKw` của xe × 0,75 (đường cong trung bình dưới 80%), AC dùng `acKw` × 0,9. Cổng: mạnh nhất **còn trống** theo live nếu có, không thì mạnh nhất theo dữ liệu cổng. ≥ 80% → không hiện. |
| Đồng bộ % pin giữa bảng trạm và Dọc đường | Một hook `useBattery()` ở `App.tsx`, truyền xuống hai nơi. |
| Phiên bản | 0.9.0. |
| Git | Working tree sạch (`aec40ce`). Mỗi phase một commit. |

## 3. Payload / DTO shape

```ts
// src/data/vehicles.ts
export interface Vehicle {
  id: string
  name: string
  /** Dung lượng pin dùng được. */
  kwh: number
  /** Tiêu thụ thực tế ước tính ở tốc độ hỗn hợp, không điều hoà. */
  kwhPer100: number
  /** Công suất sạc DC tối đa xe nhận. */
  dcKw: number
  /** Bộ sạc AC trên xe. */
  acKw: number
}

// src/data/settings.ts — thêm vào Settings
vehicleId: string | null      // id trong VEHICLES, 'custom', hoặc null = chưa chọn
customKwh: number             // mặc định 60
customKwhPer100: number       // mặc định 16
climate: boolean              // mặc định true

// src/data/battery.ts
export interface BatteryReading { pct: number; at: number }
export interface ArrivalEstimate { low: number; high: number } // % khi đến; low = bi quan, có thể âm
```

## 4. Phase breakdown

| Phase | File | Mục tiêu | Phụ thuộc |
|---|---|---|---|
| 01 | phase-01-battery-core.md | Bảng xe, trường Settings mới, hàm ước tính + hook `useBattery` | — |
| 02 | phase-02-settings-station.md | Mục "Xe của bạn" trong Cài đặt; thanh trượt + dòng % pin + thời gian sạc trong bảng trạm | 01 |
| 03 | phase-03-trip-battery.md | % pin từng trạm dọc đường + vạch "Trạm cuối còn kịp" | 01, 02 (dùng chung `BatteryControl`) |
| 04 | phase-04-docs.md | README, CHANGELOG, `changelog.ts`, bản 0.9.0 | 03 |

## 5. Phạm vi (In / Out)

**In scope:** `src/data/vehicles.ts` (mới), `src/data/battery.ts` (mới), `src/data/settings.ts`, `src/ui/BatteryControl.tsx` (mới), `src/ui/SettingsSheet.tsx`, `src/ui/StationSheet.tsx`, `src/ui/TripPanel.tsx`, `src/App.tsx`, docs.

**Out of scope:**
- HERE EV routing (`ev[...]`, có độ dốc) — tốn hạn mức, để sau.
- Gợi ý điểm dừng tự động cho cả hành trình.
- Lọc "Gần tôi" theo tầm pin.
- Đọc pin từ xe / app VinFast.
- Tự hiệu chỉnh mức tiêu thụ từ lịch sử sạc.

## 6. Risks

- **Số liệu xe sai lệch** (tiêu thụ thực tế khác nhiều theo cách lái, tải, độ dốc) → hiện khoảng ±8%, ghi "ước tính", có Tuỳ chỉnh.
- **Đường đèo** (Hải Vân, Bảo Lộc…) tiêu thụ tăng mạnh mà hệ số tốc độ không bắt được → chấp nhận; HERE EV routing là bước sau.
- **% pin cũ** (nhập lúc sáng, tối mở lại) → mờ + nhắc khi quá 2 giờ.
- **Dọc đường xuất phát không phải vị trí hiện tại** (link có điểm đầu khác) → ghi "nếu xuất phát với X%".
- **Không có test runner** trong repo → kiểm bằng `npm run build` (tsc) + chạy thử trên trình duyệt (Playwright).
