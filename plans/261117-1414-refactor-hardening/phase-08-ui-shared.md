# Phase 08 — Component UI dùng chung

**Goal:** 10 sheet dùng một `AppSheet`; 3 danh sách trạm dùng `StationRow`; QR/copy dùng chung; màu cảnh báo có token.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/ui/AppSheet.tsx` | CREATE — `<AppSheet open onClose title description nested size>`, một kiểu header |
| `src/ui/StationRow.tsx` | CREATE — `<StationRow leading title subtitle trailing onClick>` |
| `src/ui/useQrCanvas.ts`, `src/ui/useCopy.ts` | CREATE — gom từ ShareSheet/BackupSheet; clear `setTimeout` |
| `src/ui/{StationSheet,SavedSheet,NearbySheet,GroupsSheet,ChangelogModal,SettingsSheet,VehicleSheet,ShareSheet,BackupSheet,ImportDialog}.tsx` | MODIFY — dùng `AppSheet` |
| `src/ui/{NearbySheet,SavedSheet,TripPanel}.tsx` | MODIFY — dùng `StationRow` |
| `src/index.css` | MODIFY — token `--warn` (#B45309 / tối #F0A500), `--full` (#E53935) |
| `src/ui/{SavedSheet,BatteryControl,TripPanel,StationSheet,LiveSection}.tsx` | MODIFY — dùng token; `DEFAULT_PIN` = `TIER_COLORS[0]` |
| `src/components/ui/dialog.tsx`, `src/i18n.ts` | MODIFY — "Close", "Hotline", tick giờ qua i18n |
| `src/ui/layout.ts` | CREATE — `TRIP_PANEL_W`, `TRIP_PANEL_MAX_VH` dùng chung cho padding bản đồ + class TripPanel |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh.
- [ ] Dev, 390px + 1280px, sáng + tối: mở từng sheet, so ảnh trước/sau — không lệch (header đồng nhất là thay đổi chấp nhận).
- [ ] Tải ảnh QR và Copy link ở Chia sẻ + Sao lưu vẫn chạy.

## 3. Commit message dự kiến

```
refactor(ui): AppSheet, StationRow, hook QR/copy dùng chung; token màu cảnh báo
```

## 4. Kết quả (ghi lúc thực hiện)

- `AppSheet` thay khung của 8 bảng: Saved, Settings, Vehicle, Share, Nearby, Backup, Changelog, Import. Header thống nhất `gap-1 pr-6 text-left` + tiêu đề `text-lg` + mô tả `text-sm` (4 bảng Settings/Vehicle/Share/Backup trước nhỏ hơn trên điện thoại — thay đổi nhìn thấy được, có chủ ý). **StationSheet và GroupsSheet giữ khung riêng**: header tuỳ biến (nút lưu/chia sẻ; đổi màn tạo nhóm trong cùng hộp).
- `StationRow` dùng cho Gần bạn + Đã lưu. **TripPanel giữ hàng riêng** — mỗi hàng đổi nền/viền theo vùng pin, đặt chung sẽ phải mở thêm nhiều prop.
- `useQrCanvas`, `useCopy`, `useFlash` (gỡ component thì huỷ setTimeout) trong `src/ui/useQrCanvas.ts`.
- Token `warn` / `gold` / `full` trong `index.css` thay mọi `[#B45309]`, `[#F0A500]`, `[#E53935]` trong class. Màu dữ liệu (colorHex nhóm dựng sẵn, `FULL_RED` vẽ SVG) giữ hex.
- "Close" của dialog → i18n "Đóng"/"Close". "Hotline" không còn chuỗi cứng (đã đổi ở main). Tick giờ `6h` của biểu đồ giữ nguyên (định dạng, không phải bản dịch thiếu).
- **Không làm `src/ui/layout.ts`**: bề rộng TripPanel là class Tailwind tĩnh (`sm:w-[380px]`), không lấy được từ hằng JS mà vẫn để Tailwind quét được — chỉ ghi chú cạnh padding trong App ở phase 09.
- Playwright 390 px: Cài đặt / Đã lưu / Gần bạn mở đúng tiêu đề + mô tả, hàng Gần bạn hiển thị như trước, không lỗi JS.
