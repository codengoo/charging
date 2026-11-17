import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPosition, type GeoPoint } from '../lib/geo'
import { NO_AVOID, type Avoid } from '../lib/mapsLink'
import { alongRoute, type RouteHits, type RoutePath } from './routeCorridor'
import type { StationIndex } from './stations'
import type { Station } from './types'
import { MSG, TripError, fetchRoutes, resolveTrip, waypointsOf, type TripPoint } from './trip'

export type TripRadius = 2 | 5 | 10
export const TRIP_RADII: TripRadius[] = [2, 5, 10]

/** Số tuyến khác xin thêm khi hành trình chỉ có điểm đi + điểm đến (tối đa 3 tuyến). */
const ALTERNATIVES = 2

/**
 * closed → resolving (đọc link, đoán toạ độ) → routing (gọi HERE) → ready. Lỗi ở bước nào cũng
 * về `error`, giữ `stops` đã có để hiện. Đổi bán kính / chọn tuyến khác chỉ lọc lại, không gọi
 * mạng; đổi tuỳ chọn tránh thì tính lại tuyến (không đọc lại link).
 */
export interface TripState {
  link: string | null
  status: 'closed' | 'idle' | 'resolving' | 'routing' | 'ready' | 'error'
  error: string | null
  stops: TripPoint[]
  /** vias[i] = điểm kéo tuyến giữa stops[i] và stops[i+1] (đọc từ link). */
  vias: GeoPoint[][]
  avoid: Avoid
  /** Tuyến người dùng đã chọn trên Google (`!5iN`), chỉ để gợi ý — thứ tự tuyến HERE khác Google. */
  googleRoute: number | null
  /** Mọi tuyến HERE trả; tuyến 0 là tuyến HERE đề xuất. */
  routes: RoutePath[]
  routeIdx: number
  /** = routes[routeIdx]; giữ riêng để nơi dùng chỉ cần một tuyến không phải đổi. */
  route: RoutePath | null
  radiusKm: TripRadius
}

const CLOSED: TripState = {
  link: null,
  status: 'closed',
  error: null,
  stops: [],
  vias: [],
  avoid: NO_AVOID,
  googleRoute: null,
  routes: [],
  routeIdx: 0,
  route: null,
  radiusKm: 2,
}
const EMPTY_HITS: RouteHits = { items: [], total: 0 }

/** Vị trí hiện tại khi chưa có `userPos`: hỏi trình duyệt (tối đa 10 s). */
const askPosition = async (): Promise<GeoPoint | null> => (await getPosition()).pos

/** Hành trình "trạm dọc đường". Port tripJob / handleSharedText / setTripRadius của MapViewModel. */
export function useTrip(
  index: StationIndex | null,
  userPos: GeoPoint | null,
  initialRadiusKm: TripRadius = 2,
  /** Lọc trạm dọc tuyến (mức công suất). Truyền hàm ổn định (useCallback) — đổi là lọc lại. */
  keep?: (st: Station) => boolean,
) {
  const [trip, setTrip] = useState<TripState>(() => ({ ...CLOSED, radiusKm: initialRadiusKm }))
  const job = useRef<AbortController | null>(null)
  const pos = useRef(userPos)
  pos.current = userPos
  // setAvoid cần stops/vias mới nhất mà không phụ thuộc state trong closure.
  const latest = useRef(trip)
  latest.current = trip

  // Lọc lại khi đổi bán kính / có generation mới — đồng bộ, vài ms cho ≤ 1.500 điểm.
  const hits = useMemo(
    () => (index && trip.route ? alongRoute(index, trip.route, trip.radiusKm, keep) : EMPTY_HITS),
    [index, trip.route, trip.radiusKm, keep],
  )
  // Số trạm của từng tuyến cho thẻ chọn tuyến. Chỉ tính khi có hơn một tuyến.
  const routeTotals = useMemo(
    () => (index && trip.routes.length > 1 ? trip.routes.map((r) => alongRoute(index, r, trip.radiusKm, keep).total) : []),
    [index, trip.routes, trip.radiusKm, keep],
  )

  /** Lượt mới huỷ lượt cũ: chỉ kết quả của lượt mới nhất được ghi vào state. */
  const startJob = useCallback(() => {
    job.current?.abort()
    const ctrl = new AbortController()
    job.current = ctrl
    return ctrl
  }, [])

  /** Gọi HERE cho stops + vias hiện có rồi ghi kết quả. Ném TripError khi không có tuyến. */
  const runRoute = useCallback(async (stops: TripPoint[], vias: GeoPoint[][], avoid: Avoid, ctrl: AbortController) => {
    const plain = stops.length === 2 && vias.every((v) => v.length === 0)
    const routes = await fetchRoutes(waypointsOf(stops, vias), { alt: plain ? ALTERNATIVES : 0, avoid }, ctrl.signal)
    if (ctrl.signal.aborted) return
    if (routes.length === 0) throw new TripError(MSG.noRoute)
    setTrip((t) => ({ ...t, routes, routeIdx: 0, route: routes[0], status: 'ready', error: null }))
  }, [])

  const fail = useCallback((e: unknown, ctrl: AbortController) => {
    if (ctrl.signal.aborted) return
    const msg = e instanceof TripError ? e.message : MSG.noRoute
    setTrip((t) => ({ ...t, status: 'error', error: msg }))
  }, [])

  /** Mở bảng trống (chưa có link). */
  const show = useCallback(() => setTrip((t) => (t.status === 'closed' ? { ...CLOSED, status: 'idle', radiusKm: t.radiusKm } : t)), [])

  const open = useCallback(
    (text: string) => {
      const ctrl = startJob()
      setTrip((t) => ({ ...CLOSED, link: text, status: 'resolving', radiusKm: t.radiusKm }))

      void (async () => {
        try {
          const r = await resolveTrip(text, async () => pos.current ?? (await askPosition()), ctrl.signal)
          if (ctrl.signal.aborted) return
          setTrip((t) => ({ ...t, stops: r.points, vias: r.vias, avoid: r.avoid, googleRoute: r.googleRoute, status: 'routing' }))
          await runRoute(r.points, r.vias, r.avoid, ctrl)
        } catch (e) {
          fail(e, ctrl)
        }
      })()
    },
    [startJob, runRoute, fail],
  )

  /** Đổi tuỳ chọn tránh → tính lại tuyến với chặng đã có. Chưa có chặng thì chỉ ghi lại. */
  const setAvoid = useCallback(
    (avoid: Avoid) => {
      const { stops, vias, status } = latest.current
      if (stops.length < 2 || status === 'resolving') {
        setTrip((t) => ({ ...t, avoid }))
        return
      }
      const ctrl = startJob()
      setTrip((t) => ({ ...t, avoid, status: 'routing', error: null, routes: [], routeIdx: 0, route: null }))
      runRoute(stops, vias, avoid, ctrl).catch((e) => fail(e, ctrl))
    },
    [startJob, runRoute, fail],
  )

  const selectRoute = useCallback(
    (i: number) =>
      setTrip((t) => (Number.isInteger(i) && i >= 0 && i < t.routes.length ? { ...t, routeIdx: i, route: t.routes[i] } : t)),
    [],
  )

  const setRadius = useCallback((radiusKm: TripRadius) => setTrip((t) => ({ ...t, radiusKm })), [])

  const close = useCallback(() => {
    job.current?.abort()
    job.current = null
    setTrip((t) => ({ ...CLOSED, radiusKm: t.radiusKm }))
  }, [])

  useEffect(() => () => job.current?.abort(), [])

  return { trip, hits, routeTotals, show, open, setAvoid, selectRoute, setRadius, close }
}
