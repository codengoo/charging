# Phase 01 — Đọc `data=` của link chỉ đường

**Goal:** `parseMapsUrl` trả `ParsedLink` gồm chặng, điểm kéo tuyến theo từng chặng, tuỳ chọn tránh và số thứ tự tuyến Google. Toạ độ chặng có tên chỉ lấy từ `2m` (hoặc `!3d!4d`), không bao giờ lấy nhầm điểm kéo.

## 1. Files chạm vào

| File | Action |
|---|---|
| `src/lib/mapsLink.ts` | MODIFY — thêm `Avoid`, `ParsedLink`, đọc cây `data=`; `parseMapsUrl` trả `ParsedLink` |
| `src/data/trip.ts` | MODIFY — tối thiểu để build qua: `resolveTrip` đọc `parsed.stops` (phần còn lại ở phase 02) |

## 2. `src/lib/mapsLink.ts`

Thêm sau các regex hiện có:

```ts
import type { GeoPoint } from './flexiblePolyline'

export interface Avoid {
  toll: boolean
  highway: boolean
  ferry: boolean
}
export const NO_AVOID: Avoid = { toll: false, highway: false, ferry: false }

export interface ParsedLink {
  stops: TripStop[]
  /** vias[i] = điểm kéo tuyến giữa stops[i] và stops[i+1]; dài bằng `stops`, phần tử cuối rỗng. */
  vias: GeoPoint[][]
  avoid: Avoid
  /** Tuyến đang chọn trên Google (`!5iN`, đếm từ 0); null nếu link không ghi. */
  googleRoute: number | null
}

/**
 * Khối `data=` là protobuf viết thành chữ: mỗi token `!<field><kiểu><giá trị>`, kiểu `m` là một
 * message có `<giá trị>` token con cháu theo sau. Dựng cây theo số đếm đó thì đọc theo field được,
 * khỏi đoán bằng regex. Định dạng chỉ đường (kiểm bằng link thật 2026-11-17):
 *   !4m…!4m…            khối chỉ đường
 *     !1m…              một chặng (lặp lại, đúng thứ tự trên đường; chặng toạ độ trần là `!1m0`)
 *       !2m2!1d<lng>!2d<lat>              toạ độ chặng có tên
 *       !3m…!1m2!1d<lng>!2d<lat>!3s…      điểm kéo tuyến SAU chặng này
 *     !2m…!1b1!2b1!3b1  tránh cao tốc / thu phí / phà (phà chưa kiểm)
 *     !3e0              phương tiện (0 = ô tô)
 *     !5i1              tuyến thứ mấy đang chọn
 */
interface PbNode {
  field: number
  type: string
  value: string
  kids: PbNode[]
}

function pbTree(data: string): PbNode[] {
  const toks = data
    .split('!')
    .map((s) => /^(\d+)([a-zA-Z])(.*)$/.exec(s))
    .filter((m): m is RegExpExecArray => m !== null)
  let i = 0
  // Đọc tối đa `n` token (tính cả con cháu) thành danh sách node cùng cấp.
  const take = (n: number): PbNode[] => {
    const out: PbNode[] = []
    let used = 0
    while (used < n && i < toks.length) {
      const [, f, type, value] = toks[i++]
      used++
      const node: PbNode = { field: +f, type, value, kids: [] }
      if (type === 'm') {
        const start = i
        node.kids = take(parseInt(value, 10) || 0)
        used += i - start
      }
      out.push(node)
    }
    return out
  }
  return take(Infinity)
}

const kid = (n: PbNode, field: number, type: string) => n.kids.find((k) => k.field === field && k.type === type)

function pbPoint(n: PbNode | undefined): GeoPoint | null {
  if (!n) return null
  const lng = parseFloat(kid(n, 1, 'd')?.value ?? '')
  const lat = parseFloat(kid(n, 2, 'd')?.value ?? '')
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

interface PbDirections {
  /** Mỗi chặng: toạ độ riêng (null nếu chặng là toạ độ trần) + điểm kéo sau nó. */
  waypoints: Array<{ fix: GeoPoint | null; vias: GeoPoint[] }>
  avoid: Avoid
  googleRoute: number | null
}

function readPbDirections(raw: string): PbDirections | null {
  const data = /\/data=([^?#/]*)/.exec(raw)?.[1]
  if (!data) return null
  const outer = pbTree(data).find((n) => n.field === 4 && n.type === 'm')
  const dir = outer && kid(outer, 4, 'm')
  if (!dir) return null
  const waypoints = dir.kids
    .filter((k) => k.field === 1 && k.type === 'm')
    .map((w) => ({
      fix: pbPoint(kid(w, 2, 'm')),
      vias: (kid(w, 3, 'm')?.kids ?? [])
        .filter((v) => v.field === 1 && v.type === 'm')
        .map(pbPoint)
        .filter((p): p is GeoPoint => p !== null),
    }))
  const opt = kid(dir, 2, 'm')
  const flag = (f: number) => kid(opt ?? { kids: [] } as unknown as PbNode, f, 'b')?.value === '1'
  const idx = parseInt(kid(dir, 5, 'i')?.value ?? '', 10)
  return {
    waypoints,
    avoid: { highway: flag(1), toll: flag(2), ferry: flag(3) },
    googleRoute: Number.isFinite(idx) ? idx : null,
  }
}
```

`readDirections` (dạng path) đổi thành:

```ts
  const pb = readPbDirections(raw)
  // Khớp chặng ↔ waypoint theo vị trí khi hai bên cùng số lượng (trường hợp thường gặp). Lệch nhau
  // (Google bỏ điểm đi khi đó là vị trí hiện tại…) thì chỉ ăn toạ độ theo thứ tự, bỏ điểm kéo.
  const aligned = pb && pb.waypoints.length === segments.length
  const fixes = pb && pb.waypoints.some((w) => w.fix)
    ? pb.waypoints.map((w) => w.fix).filter((p): p is GeoPoint => p !== null)
    : [...raw.matchAll(LATLNG_3D4D)].map((m) => ({ lat: +m[1], lng: +m[2] }))
  let next = 0
  const stops = segments.map((seg, i) => {
    if (LATLNG_TEXT.test(seg)) return stopOf(seg)
    const fix = aligned ? pb.waypoints[i].fix : fixes[next++]
    return fix ? { lat: fix.lat, lng: fix.lng, text: seg } : { text: seg }
  })
  return {
    stops,
    vias: segments.map((_, i) => (aligned && i < segments.length - 1 ? pb.waypoints[i].vias : [])),
    avoid: pb?.avoid ?? NO_AVOID,
    googleRoute: pb?.googleRoute ?? null,
  }
```

- Bỏ `LNGLAT_1D2D` (thay bằng cây). Giữ `LATLNG_3D4D` cho link kiểu cũ và cho `readSinglePlace`.
- Dạng `?api=1&origin=…`: `vias` toàn mảng rỗng, `avoid: NO_AVOID`, `googleRoute: null`.
- `readSinglePlace` bọc kết quả vào `ParsedLink` tương tự.
- `parseMapsUrl(url): ParsedLink | null`; điều kiện `every(usable)` áp lên `stops`.

## 3. `src/data/trip.ts` (tối thiểu)

```ts
  const parsed = full ? parseMapsUrl(full) : null
  if (!parsed) throw new TripError(MSG.badLink)
  const stops = parsed.stops
```

## 4. Acceptance criteria

Script `scratchpad/p1.ts` (bundle bằng `npx esbuild --bundle --platform=node`) chạy `parseMapsUrl` với:
- [ ] URL "kéo tuyến, 2 chặng có tên" ở plan §7 → 2 chặng: Hồ Hoàn Kiếm (21.0286669, 105.8521484), Nhà hát Hải Phòng (**20.8572691, 106.6818164**); `vias[0]` = [(20.8498361, 106.2053022)]; `vias[1]` = [].
- [ ] URL "kéo tuyến, 2 chặng toạ độ" → 2 chặng toạ độ trần; `vias[0]` = [(20.5370365, 106.2167991)].
- [ ] `…/data=!4m5!4m4!2m2!1b1!2b1!3e0` → `avoid = { highway: true, toll: true, ferry: false }`.
- [ ] `…/data=!4m3!4m2!3e0!5i1` → `googleRoute = 1`.
- [ ] Link thật cũ `maps.app.goo.gl/Wa4BHQY94CRPMfuA7` (mở qua curl) → 2 chặng đúng toạ độ như phase-03 plan trước.
- [ ] Các mẫu cũ trong `plans/261116-1710-trip-along-route/phase-03-trip-core.md` §4 (`api=1` 4 chặng, path + `!3d!4d`, `place`) vẫn ra đúng chặng.
- [ ] `npx tsc -b` không lỗi.

## 5. Out of scope

Gửi vias / avoid lên HERE (phase 02). UI (phase 03).

## 6. Commit message dự kiến

```
fix(trip): đọc data= của link Google Maps theo cây, lấy điểm kéo tuyến và tuỳ chọn tránh

Link có điểm kéo tuyến ghi thêm cặp !1d!2d nên chặng có tên bị gán nhầm toạ độ điểm kéo.
mapsLink.ts dựng cây protobuf-chữ từ data= và đọc theo field: toạ độ chặng (2m), điểm kéo (3m),
tránh cao tốc/thu phí/phà (2m…b), tuyến Google đang chọn (5i). parseMapsUrl trả ParsedLink.
```
