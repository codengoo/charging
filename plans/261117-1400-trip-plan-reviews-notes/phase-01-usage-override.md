# Phase 01 — Ghi đè tiêu thụ cho mẫu xe

**Goal:** Người dùng nhập mức tiêu thụ đọc trên màn hình xe; mọi ước tính pin dùng số đó thay số ước tính của mẫu.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/settings.ts` | MODIFY — `usageOverride: number \| null` (5–60, mặc định null) |
| `src/data/vehicles.ts` | MODIFY — `vehicleOf(id, customKwh, customKwhPer100, usageOverride)` áp ghi đè cho mẫu có sẵn |
| `src/ui/VehicleSheet.tsx` | MODIFY — ô "Tiêu thụ thực tế" (placeholder = số ước tính của mẫu); đổi mẫu → `usageOverride: null` |
| `src/App.tsx` | MODIFY — truyền `usageOverride` vào `vehicleOf` |
| `src/ui/SettingsSheet.tsx` | MODIFY — "Khôi phục mặc định" giữ cả `usageOverride` (thêm khi làm) |

## 2. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] Chọn VF 6, nhập 20 → bảng trạm ra % thấp hơn so với để trống; xoá ô → về số mẫu.
- [ ] Đổi sang VF 8 → ô trống lại.

## 3. Commit message dự kiến

```
feat(battery): ghi đè mức tiêu thụ thực tế cho mẫu xe đang chọn
```
