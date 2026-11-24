import { describe, expect, it } from 'vitest'
import { nextFiveMinutes, planTimeline } from '@/data/eta'
import type { ChargePlan, PlanStop } from '@/data/chargePlan'
import type { Station } from '@/data/types'

/** 60 km/h: 1 km = 60 s. */
const route = { meters: 300_000, seconds: 300 * 60 }
const stop = (atKm: number, chargeMin: number | null, viaExit = false, detourKm = 0): PlanStop => ({
  item: { station: { entityId: String(atKm) } as Station, atKm, offsetKm: 0, viaExit },
  arrive: { low: 20, high: 25 },
  kw: 150,
  toPct: 80,
  chargeMin,
  detourKm,
})
const T0 = Date.UTC(2026, 10, 24, 0, 0)
const MIN = 60_000

describe('planTimeline', () => {
  it('giờ tới / rời từng điểm dừng + tới nơi khớp totalSeconds', () => {
    const plan: ChargePlan = {
      ok: true,
      stops: [stop(100, 20), stop(200, 10)],
      arriveDest: { low: 15, high: 20 },
      chargeMin: 30,
      totalSeconds: route.seconds + 30 * 60,
    }
    const t = planTimeline(plan, route, T0)
    expect(t.stops[0]).toEqual({ arrive: T0 + 100 * MIN, leave: T0 + 120 * MIN })
    expect(t.stops[1]).toEqual({ arrive: T0 + 220 * MIN, leave: T0 + 230 * MIN })
    expect(t.arriveDest).toBe(T0 + 330 * MIN)
  })
  it('ra nút giao: cộng nửa quãng vòng lúc vào, nửa lúc ra', () => {
    const plan: ChargePlan = {
      ok: true,
      stops: [stop(100, 0, true, 10)],
      arriveDest: { low: 15, high: 20 },
      chargeMin: 0,
      totalSeconds: route.seconds + 10 * 60,
    }
    const t = planTimeline(plan, route, T0)
    expect(t.stops[0].arrive).toBe(T0 + 105 * MIN)
    expect(t.arriveDest).toBe(T0 + 310 * MIN)
  })
  it('kế hoạch kẹt → không có giờ tới nơi', () => {
    expect(planTimeline({ ok: false, stops: [], stuckAtKm: 50 }, route, T0).arriveDest).toBeNull()
  })
})

describe('nextFiveMinutes', () => {
  it('làm tròn lên 5 phút', () => {
    expect(nextFiveMinutes(T0 + 61_000)).toBe(T0 + 5 * MIN)
    expect(nextFiveMinutes(T0 + 5 * MIN)).toBe(T0 + 5 * MIN)
  })
})
