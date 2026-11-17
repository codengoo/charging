# Phase 02 — Kế hoạch dừng sạc

**Goal:** Bảng Dọc đường tự chọn điểm dừng sạc, hiện tóm tắt và đánh dấu điểm dừng trên danh sách lẫn bản đồ.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/chargePlan.ts` | CREATE — `planCharging(...)` thuần |
| `src/ui/TripPanel.tsx` | MODIFY — nút bật/tắt kế hoạch, thẻ tóm tắt, nhãn "Dừng n" |
| `src/App.tsx` | MODIFY — state bật/tắt + kết quả kế hoạch; `TripLayer.stationIds` chỉ còn điểm dừng khi bật |

## 2. `planCharging`

```ts
export interface PlanStop { item: AlongRoute; arrive: ArrivalEstimate; kw: number; chargeMin: number | null }
export type ChargePlan =
  | { ok: true; stops: PlanStop[]; arriveDest: ArrivalEstimate; chargeMin: number; totalSeconds: number }
  | { ok: false; stops: PlanStop[]; stuckAtKm: number }
export const PLAN_MIN_DC_KW = 50
export function planCharging(
  items: AlongRoute[],
  power: Map<string, StationPower> | null,
  route: { meters: number; seconds: number },
  startPct: number,
  v: Vehicle,
  climate: boolean,
): ChargePlan
```

- Ứng viên: cổng DC mạnh nhất ≥ 50 kW.
- Quãng tới trạm tính từ điểm đang đứng: `atKm − pos + offsetKm` (rẽ vào); rời trạm thì chặng sau cộng thêm `offsetKm` (quay ra).
- Tới được đích (bi quan ≥ 10%) → xong. Không → trạm XA NHẤT tới được (bi quan ≥ 10%), sạc lên 80%, lặp. Không có trạm nào → `ok: false`, `stuckAtKm = pos`.
- `totalSeconds = route.seconds + Σ chargeMin × 60`.

## 3. Acceptance criteria

- [ ] `npm run build` qua; kiểm `planCharging` bằng esbuild + node với dữ liệu giả.
- [ ] Playwright: Hà Nội → Vinh, VF 3, 60% → có ≥ 2 điểm dừng, bản đồ chỉ còn ghim điểm dừng; tắt kế hoạch → như cũ.

## 4. Commit message dự kiến

```
feat(trip): tự lên kế hoạch dừng sạc cho hành trình
```
