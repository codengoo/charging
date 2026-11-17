# Phase 03 — Kế hoạch theo thứ tự ưu tiên

**Goal:** `planCharging` chọn kế hoạch theo (số lần sạc, phút sạc, km vòng) từ điển — mô hình ở plan §3. Giữ nguyên chữ ký hàm và kiểu `ChargePlan` (TripPanel không đổi).

| File | Action |
|---|---|
| `src/data/chargePlan.ts` | MODIFY — thay vòng tham lam bằng BFS theo số lần sạc, nhãn từ điển theo (trạm, % khi tới) |
| `src/data/chargePlan.test.ts` | MODIFY — test: ít lần sạc thắng; cùng số lần → trạm sạc nhanh hơn thắng; cùng thời gian → ít vòng hơn thắng; kẹt; trạm ra cao tốc chỉ thắng khi giảm số lần sạc / nhanh hơn |

Acceptance: typecheck, test, build; tuyến thật HN→Sa Pa / HN→Vinh (VF 3, VF 8) ra kế hoạch hợp lý, so với bản tham lam.
