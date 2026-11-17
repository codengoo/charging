# Phase 02 — Cài đặt xe + % pin trong bảng trạm

**Goal:** Người dùng chọn xe trong Cài đặt, kéo % pin hiện tại trong bảng trạm và thấy "Còn ~X–Y% khi tới" + "Sạc lên 80%: ~N phút".

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/ui/BatteryControl.tsx` | CREATE — thanh trượt % pin (dùng lại ở phase 03) + `BatteryBox` cho bảng trạm |
| `src/ui/SettingsSheet.tsx` | MODIFY — mục "Xe của bạn" (select, ô Tuỳ chỉnh, công tắc Điều hoà) |
| `src/ui/StationSheet.tsx` | MODIFY — nhận `vehicle`, `climate`, `battery`, `onBattery`, `onOpenSettings`; gắn `BatteryBox` sau `PortsBox` |
| `src/App.tsx` | MODIFY — `useBattery()`, `vehicleOf(settings…)`, truyền xuống `StationSheet` |

## 2. Hành vi

- **Chưa chọn xe:** `BatteryBox` chỉ là link nhỏ "Ước tính pin khi đến — chọn xe" → mở Cài đặt (đóng bảng trạm? không — Cài đặt mở đè lên).
- **Đã chọn xe:** hộp `bg-muted rounded-xl` như `PortsBox`:
  - Hàng 1: icon pin, "Pin hiện tại", `<input type="range" min=0 max=100>` `accent-brand`, số "62%". Chưa nhập → mặc định 80% hiển thị mờ, "kéo để nhập".
  - `stale` → "Nhập lúc 08:15 — kéo để cập nhật" màu cam.
  - Hàng 2 (có `drive.kind === 'ok'` hoặc `fallback` × 1,3 với 50 km/h): "Còn **~38–45%** khi tới". < 15% cam, < 5% đỏ + "Có thể không tới được" khi `low < 0`.
  - Hàng 3 (có `chargePort`): "Sạc lên 80% ở cổng 120 kW: ~25 phút". Bỏ khi đến ≥ 80%.
  - Không có GPS (`drive.kind === 'none'`): "Bật định vị để ước tính pin khi tới".
- **Cài đặt:** mục "Xe của bạn" đặt đầu danh sách sau Giao diện; `<select>` style như `Input`; chọn Tuỳ chỉnh hiện 2 ô số (kWh, kWh/100 km); "Điều hoà" Segmented Bật/Tắt; hint "Số liệu ước tính, thực tế phụ thuộc cách lái và địa hình."

## 3. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] Chạy `npm run dev`, Playwright: mở Cài đặt chọn VF 6 → mở một trạm → thấy thanh trượt; kéo % → dòng "Còn ~…" đổi; reload → % pin còn.
- [ ] Chưa chọn xe → chỉ thấy link "chọn xe", bấm mở Cài đặt.
- [ ] Giao diện tối không vỡ màu.

## 4. Commit message dự kiến

```
feat(battery): chọn xe trong cài đặt, % pin khi tới và thời gian sạc trong bảng trạm
```
