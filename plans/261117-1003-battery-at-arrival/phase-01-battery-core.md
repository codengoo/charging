# Phase 01 — Bảng xe, cài đặt xe, hàm ước tính pin

**Goal:** Có dữ liệu và logic thuần (không UI): bảng mẫu xe VinFast, 4 trường Settings mới, hàm ước tính % pin khi đến / thời gian sạc, hook `useBattery` lưu % pin hiện tại.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/data/vehicles.ts` | CREATE |
| `src/data/battery.ts` | CREATE |
| `src/data/settings.ts` | MODIFY — thêm `vehicleId`, `customKwh`, `customKwhPer100`, `climate` |

## 2. `src/data/vehicles.ts`

Thông số tra web 2026-11-17 (VinFast VN, ev-database.org, autocarindia, auto-data.net). `kwhPer100` là **ước tính thực tế** ≈ dung lượng ÷ (NEDC × ~0,8), không phải số công bố. `dcKw` / `acKw` là mức tối đa xe nhận, làm tròn theo thời gian sạc 10–70% công bố.

| id | Tên | kWh | kWh/100 km | DC kW | AC kW |
|---|---|---|---|---|---|
| `vf3` | VF 3 | 18,64 | 11 | 30 | 6,6 |
| `minio` | Minio Green | 18,5 | 11 | 30 | 6,6 |
| `vf5` | VF 5 / Herio Green | 37,23 | 14 | 50 | 7,4 |
| `vfe34` | VF e34 / Nerio Green | 41,9 | 15 | 60 | 7,4 |
| `vf6` | VF 6 | 59,6 | 15,5 | 100 | 7,4 |
| `limo` | Limo Green | 60,13 | 15,5 | 80 | 7,4 |
| `vf7eco` | VF 7 Eco | 59,6 | 16,5 | 100 | 11 |
| `vf7plus` | VF 7 Plus | 70,8 | 17,5 | 100 | 11 |
| `vf8` | VF 8 | 87,7 | 19,5 | 150 | 11 |
| `vf9` | VF 9 | 123 | 23 | 150 | 11 |

`CUSTOM_ID = 'custom'`: dùng `customKwh` / `customKwhPer100` của Settings, `dcKw` 150, `acKw` 11 (không giới hạn thêm).

```ts
export function vehicleOf(id: string | null, customKwh: number, customKwhPer100: number): Vehicle | null
```

## 3. `src/data/battery.ts`

```ts
export const STALE_MS = 2 * 60 * 60 * 1000
export const RESERVE_PCT = 10        // "còn kịp" = ước tính bi quan ≥ 10%
export const TARGET_PCT = 80
const CLIMATE = 1.08
const SPREAD = 0.08

export function speedFactor(avgKmh: number): number // <40 .95 · <70 1 · <90 1.12 · ≥90 1.25
export function arrivalPct(startPct: number, km: number, avgKmh: number, v: Vehicle, climate: boolean): ArrivalEstimate
export function chargePort(power: StationPower | undefined, live: LivePorts[] | null): { kw: number; dc: boolean } | null
export function chargeMinutes(fromPct: number, port: { kw: number; dc: boolean }, v: Vehicle): number | null
export function useBattery(): { reading: BatteryReading | null; stale: boolean; set: (pct: number) => void }
```

- `arrivalPct`: `used% = km × kwhPer100/100 × speedFactor × (climate ? 1,08 : 1) ÷ kwh × 100`; `low = start − used × 1,08`, `high = start − used × 0,92`.
- `chargePort`: cổng mạnh nhất còn trống theo live (DC/AC tra theo `groups`, không có thì kW > 22 là DC); không có live → nhóm cổng mạnh nhất, ưu tiên DC.
- `chargeMinutes`: `from ≥ 80` → null. Công suất hiệu dụng DC = min(cổng, xe) × 0,75, AC = min(cổng, xe) × 0,9.
- `useBattery`: localStorage `tramsac.battery` `{ pct, at }`; đọc/ghi bọc try/catch; `stale` = quá `STALE_MS`.

## 4. `src/data/settings.ts`

Thêm 4 trường vào `Settings` + `DEFAULT_SETTINGS` (`null`, 60, 16, true) + `parseSettings` (id phải thuộc `VEHICLE_IDS` hoặc `'custom'`; `customKwh` 5–250, `customKwhPer100` 5–60, sai thì về mặc định).

## 5. Acceptance criteria

- [ ] `npm run build` (tsc + vite) qua.
- [ ] Kiểm tay bằng node: VF 6, 80%, 100 km, 80 km/h, điều hoà bật → khoảng ~46–51%.
- [ ] `parseSettings('{"vehicleId":"xx"}')` → `vehicleId: null`; bản lưu cũ không có trường mới → mặc định.

## 6. Out of scope

UI (phase 02, 03).

## 7. Commit message dự kiến

```
feat(battery): bảng xe VinFast, cài đặt xe và hàm ước tính % pin khi đến

vehicles.ts: 10 mẫu VinFast (pin, tiêu thụ ước tính, sạc DC/AC) + Tuỳ chỉnh.
battery.ts: arrivalPct (hệ số tốc độ, điều hoà, khoảng ±8%), chargeMinutes tới 80%,
useBattery lưu % pin trong localStorage (cũ sau 2 giờ). Settings thêm vehicleId,
customKwh, customKwhPer100, climate.
```
