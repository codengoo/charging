import { describe, expect, it } from 'vitest'
import { CLIMATE, ROAD_DETOUR, SPREAD } from '@/data/battery'
import { batteryRange, circleRing, destination } from '@/data/range'
import { distanceKm } from '@/lib/geo'

const car = { kwh: 60, kwhPer100: 15 }

describe('batteryRange', () => {
  it('chừa dự phòng, tiêu thụ bi quan, chim bay = đường ÷ ROAD_DETOUR', () => {
    const r = batteryRange(80, 10, car, false)
    const road = ((0.7 * 60) / (15 * (1 + SPREAD))) * 100
    expect(r.roadKm).toBeCloseTo(road, 6)
    expect(r.oneWayKm).toBeCloseTo(road / ROAD_DETOUR, 6)
    expect(r.roundTripKm).toBeCloseTo(road / ROAD_DETOUR / 2, 6)
  })
  it('điều hoà làm ngắn tầm', () => {
    const off = batteryRange(80, 10, car, false).roadKm
    const on = batteryRange(80, 10, car, true).roadKm
    expect(on).toBeCloseTo(off / CLIMATE, 6)
  })
  it('pin ≤ dự phòng → 0', () => {
    expect(batteryRange(10, 10, car, true).roadKm).toBe(0)
    expect(batteryRange(5, 10, car, true).oneWayKm).toBe(0)
  })
})

describe('destination / circleRing', () => {
  const hn = { lat: 21.0285, lng: 105.8542 }
  it('điểm cách tâm đúng khoảng cách', () => {
    for (const b of [0, 45, 90, 200]) {
      const [lng, lat] = destination(hn, 120, b)
      expect(distanceKm(hn.lat, hn.lng, lat, lng)).toBeCloseTo(120, 0)
    }
  })
  it('hướng 0° là phía bắc', () => {
    const [lng, lat] = destination(hn, 50, 0)
    expect(lat).toBeGreaterThan(hn.lat)
    expect(lng).toBeCloseTo(hn.lng, 6)
  })
  it('vòng khép kín', () => {
    const ring = circleRing(hn, 30, 16)
    expect(ring).toHaveLength(17)
    expect(ring[16]).toEqual(ring[0])
  })
})
