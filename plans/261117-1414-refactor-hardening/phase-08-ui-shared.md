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
