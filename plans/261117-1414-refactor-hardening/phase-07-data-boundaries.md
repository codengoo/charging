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
