# Phase 01 — Trạng thái trạm vào dữ liệu base

**Goal:** `base-<gen>.json` có cột thứ 9 `status` (0 hoạt động / 1 bảo trì / 2 ngừng / 3 chưa khai trương), `v = 3`. Client đọc thành `Station.status`. Chưa đổi gì trên giao diện.

## 1. Files chạm vào

| File | Action |
|---|---|
| `builder/lib/snapshot.mjs` | MODIFY: `toRow` đọc `charging_status` → `status` |
| `builder/lib/build.mjs` | MODIFY: đẩy `r.status` vào hàng base, `fields` + `v: 3`, log đếm theo trạng thái |
| `src/data/types.ts` | MODIFY: `StationStatus`, `Station.status` |
| `src/data/stations.ts` | MODIFY: `parseRow` đọc `r[8]` |

## 2. `builder/lib/snapshot.mjs`

```js
/**
 * `charging_status` của snapshot → mã gọn. Đối chiếu với `extra_data.depot_status` của
 * get-locator: ACTIVE=Available, INACTIVE=Maintaining, UNAVAILABLE=Planned (chưa khai trương),
 * OUTOFSERVICE=OutOfService. BUSY (=AllBusy) gộp vào hoạt động: build chạy mỗi ngày một lần,
 * "hết cổng trống" lúc 02:00 sai gần cả ngày. Giá trị lạ → coi như hoạt động.
 */
const STATUS = { INACTIVE: 1, OUTOFSERVICE: 2, UNAVAILABLE: 3 }

// trong toRow(), thêm vào object trả về:
    status: STATUS[str(o.charging_status)] ?? 0,
```

## 3. `builder/lib/build.mjs`

```js
  const statusCount = [0, 0, 0, 0]
  // ...
  for await (const r of streamCarStations(snapText)) {
    baseRows.push([r.entityId, r.storeId, r.name, r.address, r.lat, r.lng, r.flags, r.availableDate ?? 0, r.status])
    statusCount[r.status]++
  // ...
  log(`trạng thái: hoạt động ${statusCount[0]} | bảo trì ${statusCount[1]} | ngừng ${statusCount[2]} | chưa khai trương ${statusCount[3]}`)

  const base = {
    v: 3,
    // ...
    fields: ['id', 'storeId', 'name', 'address', 'lat', 'lng', 'flags', 'availableDate', 'status'],
```

Comment cạnh `fields` ghi rõ: v3 = v2 + cột `status`; client cũ bỏ qua cột thừa.

## 4. `src/data/types.ts`

```ts
/**
 * Trạng thái trạm theo bản build ngày (cột 9 của base). 0 hoạt động, 1 bảo trì, 2 ngừng hoạt
 * động, 3 chưa khai trương. "Hết cổng trống" không có ở đây — chỉ có realtime khi mở trạm.
 */
export type StationStatus = 0 | 1 | 2 | 3

export interface Station {
  // ...
  availableDate: string | null
  /** Base v2 (chưa có cột) → 0. */
  status: StationStatus
}
```

## 5. `src/data/stations.ts`

```ts
/** Giải mã một dòng packed [id,storeId,name,address,lat,lng,flags,availableDate,status]. */
function parseRow(r: unknown[]): Station {
  // ...
  const st = r[8]
  return {
    // ...
    // Base v2 chưa có cột này; mã lạ cũng coi như hoạt động.
    status: st === 1 || st === 2 || st === 3 ? st : 0,
  }
}
```

## 6. Acceptance criteria

- [ ] `node builder/run-local.mjs` chạy xong, log dòng "trạng thái: …" với tổng khớp số trạm base (~25.000; bảo trì ~4.000, chưa khai trương ~2.800, ngừng ~90).
- [ ] `builder/out/base-<gen>.json`: `v === 3`, `fields.length === 9`, mọi hàng có 9 phần tử, cột 9 ∈ {0,1,2,3}.
- [ ] `npx tsc -b` (hoặc `npm run build`) pass.
- [ ] `npm run dev` với base mới ở local: app mở bình thường, trong console `__map` vẫn có ~25k điểm, không lỗi.
- [ ] Regression: chạy client mới với base cũ (`base-2785.json` v2): app vẫn mở, `status` toàn 0.

## 7. Out of scope

- Mọi thay đổi giao diện (phase 02).
- Shard SEO của Worker: không cần trạng thái.

## 8. Commit message dự kiến

```
feat(data): đưa trạng thái trạm vào base v3

Builder đọc charging_status của snapshot VinFast thành cột status (0 hoạt động,
1 bảo trì, 2 ngừng, 3 chưa khai trương); BUSY gộp vào hoạt động vì build chỉ chạy
mỗi ngày. Client parseRow đọc cột 9, base v2 cũ coi như hoạt động hết.
```
