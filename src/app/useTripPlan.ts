import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_PCT, type BatteryReading } from '../data/battery'
import { planCharging } from '../data/chargePlan'
import { LOAD_KG, climbKwh, elevationProfile } from '../data/elevation'
import { routeBounds, type RouteHits } from '../data/routeCorridor'
import type { StationPower } from '../data/types'
import type { TripState } from '../data/useTrip'
import type { Vehicle } from '../data/vehicles'
import type { TripLayer } from '../map/MapView'

/** Kế hoạch sạc tóm tắt của một tuyến (thẻ chọn tuyến). */
export interface RouteSummary {
  ok: boolean
  /** Số lần dừng sạc (kẹt: số lần dừng tới chỗ kẹt). */
  stops: number
  chargeMin: number
}

interface Args {
  trip: TripState
  hits: RouteHits
  /** Trạm dọc TỪNG tuyến (rỗng khi chỉ có một tuyến) — so sánh kế hoạch sạc trên thẻ chọn tuyến. */
  routeHits: RouteHits[]
  power: Map<string, StationPower> | null
  vehicle: Vehicle | null
  battery: BatteryReading | null
  climate: boolean
  reservePct: number
  isMobile: boolean
}

/**
 * Kế hoạch dừng sạc + lớp tuyến vẽ lên bản đồ cho hành trình đang mở. Kế hoạch chỉ tính khi bật,
 * có xe và tuyến đã sẵn sàng; đóng hành trình thì tự tắt.
 */
export function useTripPlan({ trip, hits, routeHits, power, vehicle, battery, climate, reservePct, isMobile }: Args) {
  const [planOn, setPlanOn] = useState(false)
  useEffect(() => {
    if (trip.status === 'closed') setPlanOn(false)
  }, [trip.status])

  // Độ dốc: hồ sơ độ cao của tuyến (một lần mỗi tuyến) → kWh thêm giữa hai km, theo khối lượng xe.
  const profile = useMemo(() => (trip.route ? elevationProfile(trip.route.points, trip.route.elev) : null), [trip.route])
  const climb = useMemo(() => {
    if (!profile || !vehicle) return undefined
    const mass = vehicle.massKg + LOAD_KG
    return (fromKm: number, toKm: number) => climbKwh(profile, fromKm, toKm, mass)
  }, [profile, vehicle])

  const plan = useMemo(
    () =>
      planOn && vehicle && trip.route && trip.status === 'ready'
        ? planCharging(hits.items, power, trip.route, battery?.pct ?? DEFAULT_PCT, vehicle, climate, reservePct, climb)
        : null,
    [planOn, vehicle, trip.route, trip.status, hits, power, battery, climate, reservePct, climb],
  )

  // Chừa chỗ cho bảng hành trình: điện thoại là dải dưới (~55% màn), màn rộng là thẻ trái — khớp
  // bề rộng `sm:w-[380px]` của TripPanel (+ lề). Đổi bố cục TripPanel thì sửa cả đây.
  const layer = useMemo<TripLayer | null>(() => {
    if (!trip.route) return null
    return {
      path: trip.route.points,
      alts: trip.routes.map((r, idx) => ({ idx, path: r.points })).filter((a) => a.idx !== trip.routeIdx),
      // Đang bật kế hoạch sạc: chỉ vẽ ghim các điểm dừng.
      stationIds: new Set((plan ? plan.stops.map((s) => s.item) : hits.items).map((h) => h.station.entityId)),
      // Gộp mọi tuyến: chọn tuyến khác thì khung nhìn đứng yên.
      bounds: routeBounds(trip.routes.flatMap((r) => r.points)),
      padding: isMobile
        ? { top: 130, bottom: Math.round(window.innerHeight * 0.55), left: 30, right: 30 }
        : { top: 130, bottom: 60, left: 420, right: 60 },
    }
  }, [trip.route, trip.routes, trip.routeIdx, hits, plan, isMobile])

  // So sánh tuyến: kế hoạch sạc tóm tắt cho mỗi tuyến (có độ dốc riêng của tuyến đó). ≤ 3 tuyến × ~20 ms.
  const routeSummaries = useMemo<(RouteSummary | null)[]>(() => {
    if (!vehicle || trip.status !== 'ready' || routeHits.length < 2) return []
    const mass = vehicle.massKg + LOAD_KG
    return trip.routes.map((r, i) => {
      const h = routeHits[i]
      if (!h) return null
      const prof = elevationProfile(r.points, r.elev)
      const climbOf = prof ? (a: number, b: number) => climbKwh(prof, a, b, mass) : undefined
      const p = planCharging(h.items, power, r, battery?.pct ?? DEFAULT_PCT, vehicle, climate, reservePct, climbOf)
      return p.ok ? { ok: true, stops: p.stops.length, chargeMin: p.chargeMin } : { ok: false, stops: p.stops.length, chargeMin: 0 }
    })
  }, [vehicle, trip.status, trip.routes, routeHits, power, battery, climate, reservePct])

  /** Tổng mét leo / xuống cả tuyến (null = HERE không trả độ cao). */
  const elevation = profile ? { up: profile.totalUp, down: profile.totalDown } : null
  return { planOn, togglePlan: () => setPlanOn((v) => !v), plan, layer, climb, elevation, routeSummaries }
}
