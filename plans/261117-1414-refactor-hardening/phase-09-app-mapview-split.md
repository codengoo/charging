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

## 4. Kết quả (ghi lúc thực hiện)

- `src/app/useUrlSync.ts` (deep link trạm / `/trip` / `#import`, đồng bộ URL + tiêu đề tab; effect mở trip đứng trước effect URL như cũ), `useTripPlan.ts` (kế hoạch sạc + lớp tuyến cho bản đồ), `useSheets.ts` (9 cờ bảng + luật đóng bảng con), `MapChips.tsx`.
- `src/map/layers.ts`: hằng nguồn/lớp, dựng GeoJSON, `addAppLayers`, `bindLayerEvents`, `ensurePinImages`, `pointFilter`. MapView thêm `styleimagemissing` → nạp lại ảnh ghim (gộp một lượt).
- Dòng: `App.tsx` 512 → ~378, `MapView.tsx` 506 → ~220. **App chưa xuống < 300**: phần còn lại chủ yếu là JSX truyền prop cho 10 bảng; tách thêm (vd. `StationSheets`) chỉ chuyển prop qua một tầng nữa. **Không làm `BatteryContext`**: đổi chữ ký prop của StationSheet / TripPanel / BatteryControl — đúng mấy file phiên khác đang sửa liên tục trên main; để đợt sau.
- Playwright: `/station/28704-x` → URL chuẩn `…-dai-ly-o-to-vinfast-phuc-thanh` + tiêu đề tab; `/en/station/28704` → tiêu đề EN; `/trip?link=…` giữ `/trip?link=`, đóng Dọc đường → `/`; nền tối 4 ảnh ghim đủ; `/#import=zzz` → hash bị xoá + hộp "Không đọc được bản sao lưu"; số trạm / 3 tuyến trùng khớp bản main. Không lỗi JS.
- Escape lần hai không đóng Đã lưu sau khi đóng Sao lưu — **có sẵn ở main**, không do refactor (đã đối chiếu).
