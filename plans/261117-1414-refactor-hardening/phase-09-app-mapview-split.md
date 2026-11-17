# Phase 09 — Tách App.tsx và MapView.tsx

**Goal:** `App.tsx` < 300 dòng, `MapView.tsx` < 300 dòng, không đổi hành vi.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/app/useUrlSync.ts` | CREATE — deep link, `#import`, mở trip một lần, `replaceState`, title (giữ `tripHandled` trong cùng hook) |
| `src/app/useSheets.ts` | CREATE — reducer 9 cờ sheet + luật đóng sheet con khi đóng cha |
| `src/app/useChargePlan.ts` | CREATE |
| `src/app/BatteryContext.tsx` | CREATE — vehicle, climate, battery, stale, setBattery (bỏ ~10 prop) |
| `src/app/MapChips.tsx` | CREATE |
| `src/App.tsx` | MODIFY |
| `src/ui/{StationSheet,TripPanel,BatteryControl}.tsx` | MODIFY — đọc `BatteryContext` |
| `src/map/layers.ts` | CREATE — `addAppSources`, `addAppLayers`, `bindLayerEvents`, `notSelectedFilter()`; handler `styleimagemissing` → `ensurePinImages` |
| `src/map/MapView.tsx` | MODIFY |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh; `src/App.tsx` và `src/map/MapView.tsx` mỗi file < 300 dòng.
- [ ] Dev, thử tay: `/`, `/station/<id>-<slug>`, `/en/station/<id>`, `/trip?link=<link mẫu>`, `/#import=…`. Share Target (POST `/trip`) nếu giả lập được, không thì "chưa kiểm tra".
- [ ] Mở Nhóm từ Đã lưu, đóng Đã lưu → Nhóm đóng theo; đổi sáng/tối → ghim vẫn hiện.

## 3. Commit message dự kiến

```
refactor(app): tách đồng bộ URL, trạng thái sheet, kế hoạch sạc, context pin khỏi App; lớp bản đồ ra map/layers.ts
```
