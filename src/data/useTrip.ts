import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GeoPoint } from '../lib/flexiblePolyline'
import { alongRoute, type RouteHits, type RoutePath } from './routeCorridor'
import type { StationIndex } from './stations'
import type { Station } from './types'
import { MSG, TripError, fetchRoute, resolveTrip, type TripPoint } from './trip'

export type TripRadius = 2 | 5 | 10
export const TRIP_RADII: TripRadius[] = [2, 5, 10]

/**
 * closed → resolving (đọc link, đoán toạ độ) → routing (gọi HERE) → ready. Lỗi ở bước nào cũng
 * về `error`, giữ `stops` đã có để hiện. Đổi bán kính chỉ lọc lại, không gọi mạng.
 */
export interface TripState {
  link: string | null
  status: 'closed' | 'idle' | 'resolving' | 'routing' | 'ready' | 'error'
  error: string | null
  stops: TripPoint[]
  route: RoutePath | null
  radiusKm: TripRadius
}

const CLOSED: TripState = { link: null, status: 'closed', error: null, stops: [], route: null, radiusKm: 2 }
const EMPTY_HITS: RouteHits = { items: [], total: 0 }

/** Vị trí hiện tại: dùng `userPos` nếu đã có, không thì hỏi trình duyệt (tối đa 10 s). */
function askPosition(): Promise<GeoPoint | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 60_000 },
    ),
  )
}

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

  // Lọc lại khi đổi bán kính / có generation mới — đồng bộ, vài ms cho ≤ 1.500 điểm.
  const hits = useMemo(
    () => (index && trip.route ? alongRoute(index, trip.route, trip.radiusKm, keep) : EMPTY_HITS),
    [index, trip.route, trip.radiusKm, keep],
  )

  /** Mở bảng trống (chưa có link). */
  const show = useCallback(() => setTrip((t) => (t.status === 'closed' ? { ...CLOSED, status: 'idle', radiusKm: t.radiusKm } : t)), [])

  const open = useCallback((text: string) => {
    // Lượt mới huỷ lượt cũ: chỉ kết quả của lượt mới nhất được ghi vào state.
    job.current?.abort()
    const ctrl = new AbortController()
    job.current = ctrl
    const alive = () => !ctrl.signal.aborted
    setTrip((t) => ({ ...CLOSED, link: text, status: 'resolving', radiusKm: t.radiusKm }))

    void (async () => {
      try {
        const stops = await resolveTrip(text, async () => pos.current ?? (await askPosition()), ctrl.signal)
        if (!alive()) return
        setTrip((t) => ({ ...t, stops, status: 'routing' }))
        const route = await fetchRoute(stops, ctrl.signal)
        if (!alive()) return
        if (!route) throw new TripError(MSG.noRoute)
        setTrip((t) => ({ ...t, route, status: 'ready' }))
      } catch (e) {
        if (!alive()) return
        const msg = e instanceof TripError ? e.message : MSG.noRoute
        setTrip((t) => ({ ...t, status: 'error', error: msg }))
      }
    })()
  }, [])

  const setRadius = useCallback((radiusKm: TripRadius) => setTrip((t) => ({ ...t, radiusKm })), [])

  const close = useCallback(() => {
    job.current?.abort()
    job.current = null
    setTrip((t) => ({ ...CLOSED, radiusKm: t.radiusKm }))
  }, [])

  useEffect(() => () => job.current?.abort(), [])

  return { trip, hits, show, open, setRadius, close }
}
