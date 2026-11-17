# Phase 03 — % pin từng trạm dọc đường

**Goal:** Bảng Dọc đường hiện % pin ước tính tại mỗi trạm và vạch "Trạm cuối còn kịp".

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/ui/TripPanel.tsx` | MODIFY — props `vehicle`, `climate`, `battery`, `onBattery`; thanh trượt gọn; cột % bên phải mỗi trạm; vạch |
| `src/App.tsx` | MODIFY — truyền props cho `TripPanel` |

## 2. Hành vi

- Chỉ khi `vehicle` có và `trip.status === 'ready'`.
- Dưới hàng chip Công suất: `BatteryControl` dạng gọn ("Xuất phát với 62%").
- Mỗi trạm: `arrivalPct(pct, atKm + 2 × offsetKm, avgKmh(route), vehicle, climate)` → số giữa "~42%" ở cột phải, màu theo ngưỡng như bảng trạm; `low < 0` → "—" đỏ.
- Vạch: sau trạm cuối cùng có `low ≥ RESERVE_PCT` nếu sau nó còn trạm: dòng chữ nhỏ cam "Trạm cuối còn kịp (≥ 10% pin)". Không trạm nào đạt → vạch ở đầu danh sách "Không trạm nào chắc chắn tới được với X%".
- `hits.items` đã xếp theo `atKm` — kiểm lại trong `routeCorridor.alongRoute`.

## 3. Acceptance criteria

- [ ] `npm run build` qua.
- [ ] Playwright: mở `/trip?link=…` (Hà Nội → Vinh), chọn VF 3, 50% → có vạch tầm ~60–70 km; kéo 100% → vạch dời xa hơn.
- [ ] Chưa chọn xe → bảng Dọc đường như cũ.

## 4. Commit message dự kiến

```
feat(trip): % pin ước tính tại từng trạm dọc đường và vạch "trạm cuối còn kịp"
```
