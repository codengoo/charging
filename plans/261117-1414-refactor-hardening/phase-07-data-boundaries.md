# Phase 07 — Ranh giới module data

**Goal:** Module thuần không import React; logic hành trình tách khỏi hook để test được.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/here.ts` (+test chuyển từ `trip.test.ts`) | CREATE — `parseHereRoutes`, `limitedFlags`, `pathOf`, `sumSummary` |
| `src/data/trip.ts` | MODIFY — chỉ còn `resolveTrip` + gọi API |
| `src/data/drive.ts` | MODIFY — dùng `sumSummary` |
| `src/data/tripTypes.ts` | CREATE — `TripRadius`, `TRIP_RADII`, `RoutePath` |
| `src/data/useTrip.ts` | MODIFY — `tripReducer` thuần (+test); `routeTotals` dùng lại `hits` |
| `src/data/settings.ts`, `src/data/routeCorridor.ts` | MODIFY — import `tripTypes` |
| `src/data/chargePlan.ts` (+test) | MODIFY — export `arriveKm(item)` / `passByKm(item)` (theo quyết định §2 plan.md) |
| `src/ui/TripPanel.tsx` | MODIFY — dùng `passByKm` |
| `src/data/battery.ts`, `src/data/useBattery.ts` | MODIFY / CREATE — tách hook khỏi mô hình năng lượng; `ChargePort = Omit<PortGroup,'count'>`; đặt tên hằng 22 kW, đường cong 0,75/0,9 |

## 2. Acceptance criteria

- [ ] typecheck + test + build xanh.
- [ ] Không file nào trong `src/data/{settings,battery,chargePlan,routeCorridor,here,trip,tripTypes}.ts` import `react`.
- [ ] Dev: link mẫu Dọc đường ra cùng số trạm, cùng kế hoạch sạc như trước (chụp màn trước/sau).

## 3. Commit message dự kiến

```
refactor(data): tách parser HERE, kiểu hành trình, reducer useTrip; hook pin ra khỏi mô hình năng lượng
```

## 4. Kết quả (ghi lúc thực hiện)

- `src/data/here.ts` (parseHereRoutes, limitedFlags, pathOf, sumSummary) — trip.ts chỉ còn client mạng + resolveTrip; drive.ts dùng `sumSummary`.
- `src/data/tripTypes.ts` (TripRadius, TRIP_RADII, RoutePath) — settings.ts / SettingsSheet / TripPanel / routeCorridor không còn import useTrip.ts.
- `passByKm()` trong chargePlan.ts (giữ ngữ nghĩa 2 × độ lệch theo §2) + test; TripPanel dùng nó.
- `useBattery` → `src/data/useBattery.ts`; battery.ts thuần; `ChargePort = Omit<PortGroup,'count'>`; hằng `AC_MAX_KW`, `DC_CURVE`, `AC_CURVE`.
- `routeTotals` dùng lại `hits.total` cho tuyến đang chọn (đỡ một lượt alongRoute).
- **Không làm `tripReducer`**: các chuyển trạng thái đã là updater một dòng trong `useCallback`; gom thành reducer chỉ thêm lớp action/type mà không tách được phần async (đó mới là chỗ dễ lỗi). Ghi lại để cân nhắc nếu useTrip lớn thêm.
- `settings.ts` vẫn import React vì chứa hook `useSettings` (đúng chỗ) — điều cần sửa là nó không còn kéo useTrip (React + mạng) qua TRIP_RADII.
- Playwright: `/trip?link=…/dir/21.0285,105.8542/20.2506,105.9745/` trên bản refactor và bản main cùng ra "283 trạm trong 2 km", 3 tuyến 283 / 294 / 291 trạm.
