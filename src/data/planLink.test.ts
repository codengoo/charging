import { describe, expect, it } from 'vitest'
import { MAX_WAYPOINTS, kmAlong, planMapsLink } from '@/data/planLink'
import type { GeoPoint } from '@/lib/geo'

const path: GeoPoint[] = Array.from({ length: 101 }, (_, i) => ({ lat: 10 + i * 0.01, lng: 106 }))
const a = path[0]
const b = path[100]

const params = (url: string | null) => new URL(url!).searchParams

describe('kmAlong', () => {
  it('km của điểm gần nhất trên tuyến', () => {
    expect(kmAlong(path, { lat: 10.5, lng: 106.001 })).toBeCloseTo(50 * 0.01 * 110.574, 1)
  })
})

describe('planMapsLink', () => {
  it('ít hơn 2 chặng → null', () => {
    expect(planMapsLink([a], path, [])).toBeNull()
  })
  it('điểm đi / đến + trạm sạc theo thứ tự km', () => {
    const q = params(planMapsLink([a, b], path, [
      { lat: 10.8, lng: 106, atKm: 88 },
      { lat: 10.3, lng: 106, atKm: 33 },
    ]))
    expect(q.get('api')).toBe('1')
    expect(q.get('travelmode')).toBe('driving')
    expect(q.get('origin')).toBe('10.000000,106.000000')
    expect(q.get('destination')).toBe('11.000000,106.000000')
    expect(q.get('waypoints')).toBe('10.300000,106.000000|10.800000,106.000000')
  })
  it('chặng giữa của người dùng xen đúng chỗ giữa các trạm', () => {
    const mid = { lat: 10.5, lng: 106 }
    const q = params(planMapsLink([a, mid, b], path, [
      { lat: 10.8, lng: 106, atKm: 88 },
      { lat: 10.3, lng: 106, atKm: 33 },
    ]))
    expect(q.get('waypoints')).toBe('10.300000,106.000000|10.500000,106.000000|10.800000,106.000000')
  })
  it(`tối đa ${MAX_WAYPOINTS} điểm ghé`, () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ lat: 10.05 + i * 0.05, lng: 106, atKm: 5 + i * 5 }))
    expect(params(planMapsLink([a, b], path, many)).get('waypoints')!.split('|')).toHaveLength(MAX_WAYPOINTS)
  })
})
