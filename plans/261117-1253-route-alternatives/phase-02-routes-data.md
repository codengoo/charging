# Phase 02 — Nhiều tuyến, điểm đi qua và tránh ở Worker + client

**Goal:** `/api/route` nhận `alt`, `avoid`, token `!p`; `fetchRoutes` trả mọi tuyến; `useTrip` giữ `routes`/`routeIdx`/`vias`/`avoid`/`googleRoute`, có `selectRoute` và `setAvoid`. `trip.route` vẫn là tuyến đang chọn nên App/TripPanel/chargePlan chạy như cũ.

## 1. Files chạm vào

| File | Action |
|---|---|
| `worker/api.ts` | MODIFY — `route()`: `alt`, `avoid`, `!p` → `passThrough` |
| `src/data/trip.ts` | MODIFY — `parseHereRoutes`, `fetchRoutes`, `resolveTrip` trả `{ points, vias, avoid, googleRoute }` |
| `src/data/useTrip.ts` | MODIFY — state mới, `selectRoute`, `setAvoid`, `routeTotals` |

## 2. `worker/api.ts` — `route()`

```ts
const AVOID_FEATURE: Record<string, string> = { toll: 'tollRoad', highway: 'controlledAccessHighway', ferry: 'ferry' }

/** `stops=lat,lng;lat,lng!p;…` (2..22; `!p` = điểm đi qua, chỉ ở giữa), `alt=0..2`, `avoid=toll,highway,ferry`. */
async function route(url: URL, env: ApiEnv): Promise<Response> {
  const tokens = (url.searchParams.get('stops') ?? '').split(';').filter(Boolean)
  const parsed = tokens.map((t) => ({ at: t.replace(/!p$/, ''), pass: t.endsWith('!p') }))
  if (parsed.length < 2 || !parsed.every((s) => COORD.test(s.at))) return fail(400, 'stops không hợp lệ')
  if (parsed[0].pass || parsed[parsed.length - 1].pass) return fail(400, 'stops không hợp lệ')
  const key = hereKey(env)
  if (!key) return fail(503, 'Chưa cấu hình HERE_API_KEY')
  const via = parsed.slice(1, -1).slice(0, MAX_VIA)
  // Có điểm giữa thì người dùng đã chốt hướng — không xin tuyến khác.
  const alt = via.length === 0 ? Math.min(Math.max(parseInt(url.searchParams.get('alt') ?? '0', 10) || 0, 0), 2) : 0
  const avoid = (url.searchParams.get('avoid') ?? '').split(',').map((s) => AVOID_FEATURE[s]).filter(Boolean)

  const target = new URL('https://router.hereapi.com/v8/routes')
  target.searchParams.set('transportMode', 'car')
  target.searchParams.set('origin', parsed[0].at)
  for (const v of via) target.searchParams.append('via', v.pass ? `${v.at}!passThrough=true` : v.at)
  target.searchParams.set('destination', parsed[parsed.length - 1].at)
  if (alt > 0) target.searchParams.set('alternatives', String(alt))
  if (avoid.length) target.searchParams.set('avoid[features]', [...new Set(avoid)].join(','))
  target.searchParams.set('return', 'polyline,summary')
  target.searchParams.set('spans', 'length,functionalClass')
  target.searchParams.set('apiKey', key)
  return passHere(target, 300)
}
```

## 3. `src/data/trip.ts`

- `parseHereRoute(body)` → `parseHereRoutes(body): RoutePath[]` — lặp `body.routes ?? []`, mỗi route dùng đúng logic gộp section hiện tại (tách hàm `pathOf(sections)`), bỏ route < 2 điểm.
- `fetchRoutes(waypoints, opts: { alt: number; avoid: Avoid }, signal): Promise<RoutePath[]>`:
  - `waypoints: Array<GeoPoint & { pass?: boolean }>` → `stops=` với `!p` cho điểm đi qua.
  - `avoid` → `toll,highway,ferry` theo cờ bật.
  - Kết quả rỗng và `alt > 0` → gọi lại **một lần** với `alt: 0` (phòng HERE từ chối `alternatives`).
- `export function waypointsOf(stops: TripPoint[], vias: GeoPoint[][])`: xen kẽ chặng và điểm kéo (`pass: true`).
- `resolveTrip` trả `ResolvedTrip`:

```ts
export interface ResolvedTrip {
  points: TripPoint[]
  vias: GeoPoint[][]   // dài bằng points
  avoid: Avoid
  googleRoute: number | null
}
```
  Link một chặng (thêm "Vị trí của tôi" đầu) → `vias` thêm `[]` ở đầu cho khớp độ dài.

## 4. `src/data/useTrip.ts`

```ts
export interface TripState {
  link: string | null
  status: 'closed' | 'idle' | 'resolving' | 'routing' | 'ready' | 'error'
  error: string | null
  stops: TripPoint[]
  vias: GeoPoint[][]
  avoid: Avoid
  googleRoute: number | null
  routes: RoutePath[]
  routeIdx: number
  /** = routes[routeIdx] ?? null. Giữ để nơi dùng cũ không đổi. */
  route: RoutePath | null
  radiusKm: TripRadius
}
```
- `CLOSED` thêm `vias: [], avoid: NO_AVOID, googleRoute: null, routes: [], routeIdx: 0`.
- Tách `runRoute(stops, vias, avoid, ctrl)` dùng chung cho `open` và `setAvoid`: `alt = stops.length === 2 && vias.every((v) => v.length === 0) ? 2 : 0`; ghi `routes`, `routeIdx: 0`, `route: routes[0]`, `status: 'ready'`; rỗng → `TripError(MSG.noRoute)`.
- `open(text)`: resolve → `setTrip({ stops, vias, avoid, googleRoute, status: 'routing' })` → `runRoute`.
- `setAvoid(avoid)`: huỷ job cũ; nếu `stops.length < 2` chỉ ghi `avoid`; không thì `status: 'routing'` rồi `runRoute` với `stops`/`vias` hiện có (đọc qua ref `latest` để khỏi phụ thuộc state cũ).
- `selectRoute(i)`: `0 <= i < routes.length` → `{ routeIdx: i, route: routes[i] }`.
- `routeTotals = useMemo(() => routes.map((r) => alongRoute(index, r, radiusKm, keep).total))` khi `routes.length > 1`, không thì `[]`.
- Trả thêm `routeTotals, selectRoute, setAvoid`.

## 5. Encapsulation / wiring notes

- Worker vẫn chỉ làm I/O (không parse body HERE) — giới hạn 10 ms CPU.
- `MSG`/`TripError` dùng lại; không thêm câu lỗi mới.

## 6. Acceptance criteria

- [ ] `npx tsc -b` không lỗi; `npm run build` pass.
- [ ] Script scratchpad: `parseHereRoutes` với body giả 3 routes (polyline mã hoá từ `flexiblePolyline` mẫu ở plan trước) → 3 `RoutePath`, km/giây đúng từng route; body `{}` → `[]`.
- [ ] Script scratchpad gọi handler `serveApi` của worker với `fetch` giả (ghi lại URL HERE): `stops=a;b&alt=2&avoid=toll,highway` → có `alternatives=2`, `avoid[features]=tollRoad,controlledAccessHighway`; `stops=a;v!p;b&alt=2` → không có `alternatives`, có `via=v!passThrough=true`; `stops=a!p;b` → 400; `avoid=xyz` → không có `avoid[features]`.
- [ ] Nếu `.dev.vars` có `HERE_API_KEY`: `npx wrangler dev` + curl `/api/route?stops=21.0278,105.8342;20.8449,106.6881&alt=2` (header `Sec-Fetch-Site: same-origin`) → ≥ 2 routes; thêm `&avoid=toll` → 200. Không có key → ghi "chưa kiểm tra, cần key".

## 7. Out of scope

UI chọn tuyến, chip tránh, lớp bản đồ (phase 03).

## 8. Commit message dự kiến

```
feat(trip): xin tối đa 3 tuyến, đi qua điểm kéo tuyến và tránh theo link Google Maps

/api/route nhận alt (chỉ khi không có điểm giữa), avoid=toll,highway,ferry và token `!p` =
via passThrough. trip.ts trả mọi tuyến (parseHereRoutes, fetchRoutes thử lại alt=0 khi rỗng);
useTrip giữ routes/routeIdx/vias/avoid, thêm selectRoute, setAvoid, routeTotals.
```
