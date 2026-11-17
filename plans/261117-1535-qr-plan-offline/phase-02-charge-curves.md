# Phase 02 — Đường cong sạc DC từng mẫu

**Goal:** `Vehicle.dcCurve: [soc, kW][]`; `chargeMinutes` DC tích phân theo đường cong, kW mỗi đoạn = min(đường cong xe, cổng trạm).

| File | Action |
|---|---|
| `src/data/vehicles.ts` | MODIFY — `dcCurve` cho 10 mẫu (số liệu agent tra cứu, ghi nguồn), xe Tuỳ chỉnh = dạng chung co theo 150 kW |
| `src/data/battery.ts` | MODIFY — `chargeMinutes` DC: tích phân bước 1%; AC giữ phẳng `AC_CURVE`; bỏ `DC_CURVE` |
| `src/data/battery.test.ts` | MODIFY — test tích phân (đường cong phẳng = công thức cũ; giới hạn bởi cổng; từng mẫu khớp thời gian 10→70% công bố ±10%) |

Acceptance: typecheck, test, build pass; bảng trạm + kế hoạch dùng đường cong mới.
